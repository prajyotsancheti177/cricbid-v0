const prisma = require('../db/prisma');
const cricHeroes = require('./cricHeroesService');

/**
 * CricHeroes sync.
 *
 * Matches CricBid players to CricHeroes profiles and stores their stats.
 *
 * The hard part is matching, not fetching. CricHeroes can only be searched by
 * name, returns no phone number to disambiguate on, and common names collide
 * badly — a search for "Naman Kasliwal" returns six accounts, two of them in
 * Aurangabad. Attaching the wrong person's 9,908 runs to a player in a live
 * auction is worse than showing nothing, so the rule here is deliberately
 * strict: auto-link only when exactly one candidate survives, and park
 * everything else as `ambiguous` with its candidates for a host to resolve.
 */

// Fetched stats older than this are refreshed; anything newer is left alone so
// a re-run costs nothing.
const STATS_TTL_MS = 20 * 60 * 60 * 1000; // 20h — comfortably inside a daily cycle

// A player we already failed to find is retried, but not every single day.
const NOT_FOUND_RETRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Normalise a name for comparison.
 *
 * Registration names arrive with mixed case, stray punctuation and — really —
 * Unicode mathematical bold letters pasted from WhatsApp ("𝐕𝐢𝐧𝐢𝐭 𝐀𝐣𝐢𝐭
 * 𝐒𝐮𝐫𝐚𝐧𝐚"), which NFKC folds back to ASCII.
 *
 * @param {string} name
 * @returns {string}
 */
const normaliseName = (name) =>
    String(name || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const nameTokens = (name) => normaliseName(name).split(' ').filter(Boolean);

/**
 * Score a candidate name against ours, 0..1.
 *
 * Deliberately blunt. A cleverer edit-distance score would rate "Pushkar" and
 * "Pushkarr" as a near-match, but it would rate "Rishabh Jain" and "Rushabh
 * Jain" — two different people — just as highly. Only whole-token agreement
 * counts, and anything short of complete agreement is never auto-linked.
 *
 * @param {string} ours
 * @param {string} theirs
 * @returns {number}
 */
const scoreName = (ours, theirs) => {
    const a = normaliseName(ours);
    const b = normaliseName(theirs);
    if (!a || !b) return 0;
    if (a === b) return 1;

    const at = new Set(nameTokens(a));
    const bt = new Set(nameTokens(b));
    // Same words, different order or spacing — "Sancheti Pushkar".
    if (at.size === bt.size && [...at].every((t) => bt.has(t))) return 0.95;

    // One name carries an extra token the other lacks, usually a patronymic:
    // "Rutuj Pravin Parakh" vs "Rutuj Parakh". Strong, but not certain.
    const shared = [...at].filter((t) => bt.has(t)).length;
    const smaller = Math.min(at.size, bt.size);
    if (smaller > 0 && shared === smaller) return 0.8;

    return shared / Math.max(at.size, bt.size);
};

// Aurangabad was officially renamed Chhatrapati Sambhajinagar in 2023, and
// CricHeroes carries accounts under both. Aliases are matched in both
// directions so a rename does not read as a different city.
const CITY_ALIASES = [
    ['aurangabad maharashtra', 'chatrapati sambhajinagar', 'chhatrapati sambhajinagar', 'sambhajinagar']
];

/**
 * Normalise a city for comparison.
 *
 * The parenthetical is deliberately kept: "Aurangabad (Bihar)" and "Aurangabad
 * (Maharashtra)" are 1,200km apart, and stripping it linked a Jain Unity Cup
 * player to a namesake in Bihar.
 */
const normaliseCity = (city) => {
    const base = normaliseName(city);
    if (!base) return '';
    const group = CITY_ALIASES.find((g) => g.includes(base));
    return group ? group[0] : base;
};

/**
 * Choose a CricHeroes profile for one player.
 *
 * @param {string} playerName
 * @param {Array} candidates - raw search results
 * @param {string|null} preferredCity - the tournament's city, when known
 * @returns {{ match: Object|null, confidence: number, ranked: Array }}
 */
const pickMatch = (playerName, candidates, preferredCity) => {
    const preferred = normaliseCity(preferredCity);

    const ranked = candidates
        .map((c) => ({
            id: c.user_id,
            name: c.name,
            city: c.city_name || '',
            isPro: Boolean(c.is_player_pro),
            score: scoreName(playerName, c.name),
            cityMatch: Boolean(preferred) && normaliseCity(c.city_name) === preferred
        }))
        .sort((a, b) => (b.score - a.score) || (Number(b.cityMatch) - Number(a.cityMatch)));

    // Only whole-name agreement is ever a candidate for auto-linking.
    const strong = ranked.filter((c) => c.score >= 0.95);
    if (strong.length === 0) return { match: null, confidence: 0, ranked: ranked.slice(0, 8) };

    // One strong name across all of CricHeroes. Still only safe when it is in
    // the right city — the first dry run matched a Jain Unity Cup player to the
    // only "Laukik Manoj Shingvi" on CricHeroes, who lives in Aurangabad,
    // Bihar, and a "Sumit P Jain" to a "Sumit Jain P" in Pune. A lone result is
    // evidence of a rare name, not of the right person.
    if (strong.length === 1) {
        if (!preferred || strong[0].cityMatch) {
            return { match: strong[0], confidence: strong[0].score, ranked: ranked.slice(0, 8) };
        }
        return { match: null, confidence: 0, ranked: ranked.slice(0, 8) };
    }

    // Several people share the name. The tournament's city is the only signal
    // we have, and it only helps when it isolates exactly one of them.
    const inCity = strong.filter((c) => c.cityMatch);
    if (inCity.length === 1) {
        return { match: inCity[0], confidence: 0.9, ranked: ranked.slice(0, 8) };
    }

    // Two "Naman Kasliwal"s in Aurangabad. Nothing here can separate them.
    return { match: null, confidence: 0, ranked: ranked.slice(0, 8) };
};

/**
 * Flatten the API's { title, value } arrays into the columns the auction card
 * reads, keeping the arrays themselves alongside.
 */
const buildStatRow = (cricheroesPlayerId, profile, statistics) => {
    const { statNumber, statValue } = cricHeroes;
    const batting = statistics?.batting || null;
    const bowling = statistics?.bowling || null;
    const fielding = statistics?.fielding || null;
    const captain = statistics?.captain || null;

    return {
        cricheroesPlayerId,
        name: profile?.name ?? null,
        profilePhoto: profile?.profile_photo ?? null,
        cityName: profile?.city_name ?? null,
        battingHand: profile?.batting_hand ?? null,
        bowlingStyle: profile?.bowling_style ?? null,
        playingRole: profile?.playing_role ?? null,
        batterCategory: profile?.batter_category ?? null,
        bowlerCategory: profile?.bowler_category ?? null,
        isPro: Boolean(profile?.is_pro),
        dob: profile?.dob || null,
        totalMatches: profile?.total_matches ?? statNumber(batting, 'Matches'),
        totalRuns: profile?.total_runs ?? statNumber(batting, 'Runs'),
        totalWickets: profile?.total_wickets ?? statNumber(bowling, 'Wickets'),
        battingAverage: statNumber(batting, 'Avg'),
        battingStrikeRate: statNumber(batting, 'SR'),
        highestScore: statValue(batting, 'Highest Runs') ?? null,
        bowlingEconomy: statNumber(bowling, 'Economy'),
        bestBowling: statValue(bowling, 'Best Bowling') ?? null,
        catches: statNumber(fielding, 'Catches'),
        batting,
        bowling,
        fielding,
        captain,
        profileRaw: profile || null,
        fetchedAt: new Date()
    };
};

/** Fetch and upsert one CricHeroes profile's stats, honouring the TTL. */
const refreshStats = async (cricheroesPlayerId) => {
    const existing = await prisma.cricHeroesStat.findUnique({
        where: { cricheroesPlayerId },
        select: { fetchedAt: true }
    });
    if (existing && Date.now() - existing.fetchedAt.getTime() < STATS_TTL_MS) {
        return { skipped: true };
    }

    const profile = await cricHeroes.getPlayerProfile(cricheroesPlayerId);
    const statistics = await cricHeroes.getPlayerStatistics(cricheroesPlayerId);
    if (!profile && !statistics) return { skipped: false, empty: true };

    const row = buildStatRow(cricheroesPlayerId, profile, statistics);
    const { cricheroesPlayerId: _id, ...updatable } = row;
    await prisma.cricHeroesStat.upsert({
        where: { cricheroesPlayerId },
        create: row,
        update: updatable
    });
    return { skipped: false, empty: false };
};

/**
 * Which players in a tournament need work this run.
 *
 * Skips anything a human has confirmed, anything already linked with fresh
 * stats, and recent misses.
 */
const selectPlayersToSync = async (tournamentId, { force = false } = {}) => {
    const players = await prisma.player.findMany({
        where: { touranmentId: tournamentId },
        select: { id: true, name: true, cricHeroesLink: true },
        orderBy: { name: 'asc' }
    });

    const staleBefore = Date.now() - STATS_TTL_MS;
    const retryBefore = Date.now() - NOT_FOUND_RETRY_MS;

    return players.filter((p) => {
        if (!p.name || !normaliseName(p.name)) return false;
        const link = p.cricHeroesLink;
        if (!link) return true;
        if (force) return true;
        // A host's decision — a confirmed match or a deliberate clearing — is
        // never revisited by the job.
        if (link.confirmedAt) return link.status === 'linked';
        if (link.status === 'linked') return true; // stats TTL is checked per-profile
        if (link.status === 'not_found') return !link.lastSearchedAt || link.lastSearchedAt.getTime() < retryBefore;
        if (link.status === 'error') return true;
        // `ambiguous` needs a human, not another identical search.
        return false;
    }).map((p) => ({ ...p, staleBefore }));
};

/**
 * Sync one tournament's players against CricHeroes.
 *
 * Never throws for a single player's failure — one bad row must not abandon the
 * other 39.
 *
 * @param {string} tournamentId
 * @param {{ preferredCity?: string, force?: boolean, limit?: number, dryRun?: boolean,
 *           onProgress?: Function }} options
 * @returns {Promise<Object>} counters plus, in dryRun, the planned changes
 */
const syncTournament = async (tournamentId, options = {}) => {
    const { preferredCity = null, force = false, limit = null, dryRun = false, onProgress = null } = options;

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, name: true }
    });
    if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

    let players = await selectPlayersToSync(tournamentId, { force });
    if (limit) players = players.slice(0, limit);

    const summary = {
        tournamentId,
        tournamentName: tournament.name,
        considered: players.length,
        linked: 0,
        ambiguous: 0,
        notFound: 0,
        errors: 0,
        statsFetched: 0,
        statsSkipped: 0,
        plan: []
    };

    for (const player of players) {
        try {
            let link = player.cricHeroesLink;

            // Already resolved to a profile — only the stats may need refreshing.
            if (link && link.status === 'linked' && link.cricheroesPlayerId && !force) {
                if (!dryRun) {
                    const res = await refreshStats(link.cricheroesPlayerId);
                    if (res.skipped) summary.statsSkipped += 1;
                    else summary.statsFetched += 1;
                } else {
                    summary.plan.push({ player: player.name, action: 'refresh-stats', cricheroesPlayerId: link.cricheroesPlayerId });
                }
                summary.linked += 1;
                if (onProgress) onProgress(summary);
                continue;
            }

            const candidates = await cricHeroes.searchPlayers(player.name);
            const { match, confidence, ranked } = pickMatch(player.name, candidates, preferredCity);

            const base = {
                tournamentId,
                lastSearchedAt: new Date(),
                lastError: null,
                candidates: ranked
            };

            if (!match) {
                const status = candidates.length === 0 ? 'not_found' : 'ambiguous';
                if (status === 'not_found') summary.notFound += 1;
                else summary.ambiguous += 1;

                summary.plan.push({
                    player: player.name,
                    action: status,
                    candidates: ranked.slice(0, 3).map((c) => `${c.name} (${c.city})`)
                });

                if (!dryRun) {
                    await prisma.cricHeroesLink.upsert({
                        where: { playerId: player.id },
                        create: { playerId: player.id, status, cricheroesPlayerId: null, confidence: null, ...base },
                        update: { status, cricheroesPlayerId: null, confidence: null, ...base }
                    });
                }
                if (onProgress) onProgress(summary);
                continue;
            }

            summary.linked += 1;
            summary.plan.push({
                player: player.name,
                action: 'link',
                cricheroesPlayerId: match.id,
                matched: `${match.name} (${match.city})`,
                confidence
            });

            if (!dryRun) {
                await prisma.cricHeroesLink.upsert({
                    where: { playerId: player.id },
                    create: {
                        playerId: player.id,
                        status: 'linked',
                        cricheroesPlayerId: match.id,
                        matchedName: match.name,
                        matchedCity: match.city,
                        confidence,
                        ...base
                    },
                    update: {
                        status: 'linked',
                        cricheroesPlayerId: match.id,
                        matchedName: match.name,
                        matchedCity: match.city,
                        confidence,
                        ...base
                    }
                });

                const res = await refreshStats(match.id);
                if (res.skipped) summary.statsSkipped += 1;
                else summary.statsFetched += 1;
            }
        } catch (err) {
            summary.errors += 1;
            summary.plan.push({ player: player.name, action: 'error', message: err.message });
            if (!dryRun) {
                await prisma.cricHeroesLink.upsert({
                    where: { playerId: player.id },
                    create: {
                        playerId: player.id,
                        tournamentId,
                        status: 'error',
                        lastSearchedAt: new Date(),
                        lastError: err.message.slice(0, 500)
                    },
                    update: {
                        status: 'error',
                        lastSearchedAt: new Date(),
                        lastError: err.message.slice(0, 500)
                    }
                }).catch(() => {});
            }
        }
        if (onProgress) onProgress(summary);
    }

    return summary;
};


/**
 * Stats for every linked player in a tournament, keyed by CricBid player id.
 *
 * Only `linked` rows are returned — an ambiguous match is a guess, and a guess
 * shown on an auction card is worse than showing nothing.
 *
 * @param {string} tournamentId
 * @returns {Promise<Object>} `{ [playerId]: stat }`
 */
const statsForTournament = async (tournamentId) => {
    const links = await prisma.cricHeroesLink.findMany({
        where: { tournamentId, status: 'linked', cricheroesPlayerId: { not: null } },
        select: { playerId: true, cricheroesPlayerId: true }
    });
    if (links.length === 0) return {};

    const stats = await prisma.cricHeroesStat.findMany({
        where: { cricheroesPlayerId: { in: links.map((l) => l.cricheroesPlayerId) } }
    });
    const byCricHeroesId = new Map(stats.map((s) => [s.cricheroesPlayerId, s]));

    const out = {};
    for (const link of links) {
        const stat = byCricHeroesId.get(link.cricheroesPlayerId);
        if (stat) out[link.playerId] = toCardShape(stat);
    }
    return out;
};

/**
 * The subset of a stat row the cards actually render.
 *
 * `ballTypes` and `overs` are the honest-context line: these are 5-over
 * tennis-ball numbers, and a 218 strike rate read as a 20-over figure is a
 * misleading number, not an impressive one.
 */
const toCardShape = (s) => ({
    cricheroesPlayerId: s.cricheroesPlayerId,
    name: s.name,
    matches: s.totalMatches,
    runs: s.totalRuns,
    wickets: s.totalWickets,
    average: s.battingAverage,
    strikeRate: s.battingStrikeRate,
    highestScore: s.highestScore,
    economy: s.bowlingEconomy,
    bestBowling: s.bestBowling,
    catches: s.catches,
    fetchedAt: s.fetchedAt
});

module.exports = {
    syncTournament,
    statsForTournament,
    refreshStats,
    selectPlayersToSync,
    // exported for tests / manual checks
    normaliseName,
    scoreName,
    pickMatch,
    STATS_TTL_MS
};
