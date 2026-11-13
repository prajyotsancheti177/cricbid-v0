const crypto = require('crypto');
const prisma = require('../db/prisma');

/**
 * Owner auction planner ("wishlist").
 *
 * One ranked list per auction category. Rank 1 is the owner's first choice; if
 * that player goes elsewhere the list closes up and the next preference becomes
 * first. A category whose squad quota is already filled is closed: there is no
 * point ranking a second U17 when you can only field one.
 *
 * Isolation is the point of this module. It only ever reads Team, Player and
 * Tournament, and only ever writes its own two tables. Nothing in the live
 * auction, the overlays or the player sheet reads any of it, so a bug here
 * cannot reach a running auction.
 */

const newToken = () => crypto.randomBytes(24).toString('base64url');

const asNumericMax = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

// Everything the planner needs to know about a player, and nothing it doesn't:
// no mobile, email, address or payment fields. This endpoint is reachable with
// only a team token, so it must not become another way to read player PII.
const publicPlayer = (p) => ({
    _id: p.id,
    name: p.name,
    photo: p.photo,
    skill: p.skill,
    playerCategory: p.playerCategory,
    auctionSerialNumber: p.auctionSerialNumber,
    sold: p.sold === true,
    amtSold: p.amtSold ?? null,
    teamId: p.teamId ?? null,
});

const PLAYER_SELECT = {
    id: true, name: true, photo: true, skill: true, playerCategory: true,
    auctionSerialNumber: true, sold: true, amtSold: true, teamId: true,
};

/**
 * Create (or return) the planner link for a team. Host-side; the caller is
 * already checked for tournament access by the route.
 */
const ensurePlannerForTeam = async ({ teamId }) => {
    if (!teamId) throw new Error("teamId is required");

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new Error("Team not found");
    if (!team.touranmentId) throw new Error("Team is not attached to a tournament");

    const existing = await prisma.teamPlanner.findUnique({ where: { teamId } });
    if (existing) return { teamId, teamName: team.name, token: existing.token };

    const created = await prisma.teamPlanner.create({
        data: { teamId, touranmentId: team.touranmentId, token: newToken() },
    });
    return { teamId, teamName: team.name, token: created.token };
};

/** Every team in a tournament with its planner link, creating any that are missing. */
const listPlannerLinks = async ({ tournamentId }) => {
    if (!tournamentId) throw new Error("tournamentId is required");
    const teams = await prisma.team.findMany({
        where: { touranmentId: tournamentId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
    const out = [];
    for (const t of teams) out.push(await ensurePlannerForTeam({ teamId: t.id }));
    return out;
};

/** Rotate a team's token, which invalidates the old link. */
const resetPlannerToken = async ({ teamId }) => {
    if (!teamId) throw new Error("teamId is required");
    const planner = await prisma.teamPlanner.findUnique({ where: { teamId } });
    if (!planner) return ensurePlannerForTeam({ teamId });
    const updated = await prisma.teamPlanner.update({
        where: { teamId },
        data: { token: newToken() },
    });
    return { teamId, token: updated.token };
};

// Resolve a token to its planner plus the team/tournament context around it.
// Every owner-facing call goes through here, so the token is the only thing
// that ever decides which team's plan is readable or writable.
const loadContext = async (token) => {
    if (!token) throw new Error("A planner link is required");

    const planner = await prisma.teamPlanner.findUnique({
        where: { token },
        include: { team: { include: { players: { select: PLAYER_SELECT } } } },
    });
    if (!planner || !planner.team) throw new Error("This planner link is not valid");

    const tournament = await prisma.tournament.findUnique({ where: { id: planner.touranmentId } });
    if (!tournament) throw new Error("This planner link is not valid");

    return { planner, team: planner.team, tournament };
};

/**
 * Squad shape: how many of each category this team still needs.
 *
 * A capped category's quota is its cap. An uncapped one (typically "Regular")
 * gets whatever squad places the caps leave over, which is the only honest
 * reading of "6 Regulars" when the host never typed a 6.
 */
const buildCategories = ({ tournament, ownedByCategory }) => {
    const categoryBasePrices = tournament.categoryBasePrices || {};
    const categoryLimits = (tournament.features && tournament.features.categoryLimits) || null;
    const limitsOn = !!(categoryLimits && categoryLimits.enabled);
    const limits = (categoryLimits && categoryLimits.limits) || {};

    const names = Array.from(new Set([
        ...(tournament.playerCategories || []),
        ...Object.keys(categoryBasePrices),
    ])).filter(Boolean);

    const maxOf = (c) => (limitsOn ? asNumericMax(limits[c] ? limits[c].max : null) : null);
    const cappedTotal = names.reduce((sum, c) => {
        const m = maxOf(c);
        return m === null ? sum : sum + m;
    }, 0);
    const leftoverQuota = Math.max(0, (tournament.minPlayersPerTeam || 0) - cappedTotal);

    return names.map((category) => {
        const max = maxOf(category);
        const quota = max === null ? leftoverQuota : max;
        const owned = ownedByCategory[category] || 0;
        return {
            category,
            basePrice: Number(categoryBasePrices[category]) || 0,
            owned,
            max,
            quota,
            needed: Math.max(0, quota - owned),
            closed: owned >= quota,
        };
    });
};

/** Everything the owner's screen renders, in one call. */
const getBoard = async (token) => {
    const { planner, team, tournament } = await loadContext(token);

    const ownPlayers = team.players || [];
    const ownedByCategory = ownPlayers.reduce((acc, p) => {
        if (p.playerCategory) acc[p.playerCategory] = (acc[p.playerCategory] || 0) + 1;
        return acc;
    }, {});

    const topupAgg = await prisma.teamBudgetTopup.aggregate({
        where: { teamId: team.id }, _sum: { amount: true },
    });
    const totalToppedUp = topupAgg._sum.amount || 0;
    const totalSpent = ownPlayers.reduce((sum, p) => sum + (p.amtSold || 0), 0);
    const remainingBudget = (tournament.totalBudget || 0) + totalToppedUp - totalSpent;

    const categories = buildCategories({ tournament, ownedByCategory });

    const [picks, pool, teams] = await Promise.all([
        prisma.plannerPick.findMany({
            where: { plannerId: planner.id },
            include: { player: { select: PLAYER_SELECT } },
            orderBy: [{ category: 'asc' }, { rank: 'asc' }],
        }),
        prisma.player.findMany({
            where: { touranmentId: tournament.id, auctionStatus: true },
            select: PLAYER_SELECT,
            orderBy: { auctionSerialNumber: 'asc' },
        }),
        prisma.team.findMany({
            where: { touranmentId: tournament.id },
            select: { id: true, name: true },
        }),
    ]);

    const teamNameById = teams.reduce((acc, t) => { acc[t.id] = t.name; return acc; }, {});

    const picksOut = picks.map((pick) => {
        const p = pick.player;
        const sold = p && p.sold === true;
        const mine = sold && p.teamId === team.id;
        return {
            playerId: pick.playerId,
            category: pick.category,
            rank: pick.rank,
            plannedAmount: pick.plannedAmount,
            status: !sold ? 'open' : mine ? 'secured' : 'lost',
            soldTo: sold && !mine ? (teamNameById[p.teamId] || null) : null,
            soldFor: sold ? p.amtSold ?? null : null,
            player: p ? publicPlayer(p) : null,
        };
    });

    // What the plan commits, against what the squad still has to be able to afford.
    const openPicks = picksOut.filter((p) => p.status === 'open');
    const plannedTotal = openPicks.reduce((sum, p) => sum + (p.plannedAmount || 0), 0);
    const placesLeft = Math.max(0, (tournament.minPlayersPerTeam || 0) - ownPlayers.length);
    const unplannedPlaces = Math.max(0, placesLeft - openPicks.length);
    const cheapestBase = categories.reduce(
        (min, c) => (c.basePrice > 0 ? Math.min(min, c.basePrice) : min), Infinity);
    const reservedForRest = Number.isFinite(cheapestBase) ? cheapestBase * unplannedPlaces : 0;

    return {
        team: {
            _id: team.id,
            name: team.name,
            logo: team.logo,
            totalSpent,
            totalToppedUp,
            remainingBudget,
            playersCount: ownPlayers.length,
            players: ownPlayers.map(publicPlayer),
            ownedByCategory,
        },
        tournament: {
            _id: tournament.id,
            name: tournament.name,
            totalBudget: tournament.totalBudget,
            minPlayersPerTeam: tournament.minPlayersPerTeam,
        },
        categories,
        picks: picksOut,
        pool: pool.map(publicPlayer),
        plan: {
            plannedTotal,
            placesLeft,
            unplannedPlaces,
            reservedForRest,
            spare: remainingBudget - plannedTotal - reservedForRest,
        },
    };
};

/**
 * Append a player to the bottom of their category's ranking.
 *
 * Refuses when that category is already filled — the squad cannot use another
 * one, so ranking it would only produce a plan that cannot be played.
 */
const addPick = async ({ token, playerId, plannedAmount }) => {
    const { planner, team, tournament } = await loadContext(token);
    if (!playerId) throw new Error("playerId is required");

    const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { ...PLAYER_SELECT, touranmentId: true },
    });
    if (!player || player.touranmentId !== tournament.id) {
        throw new Error("That player is not in this tournament");
    }
    if (!player.playerCategory) throw new Error("That player has no auction category yet");
    if (player.sold === true) throw new Error("That player has already been sold");

    const ownedByCategory = (team.players || []).reduce((acc, p) => {
        if (p.playerCategory) acc[p.playerCategory] = (acc[p.playerCategory] || 0) + 1;
        return acc;
    }, {});
    const category = buildCategories({ tournament, ownedByCategory })
        .find((c) => c.category === player.playerCategory);
    if (!category) throw new Error("That player's category is not part of this auction");
    if (category.closed) {
        throw new Error(
            `Your ${category.category} places are already filled (${category.owned} of ${category.quota}) — there is nothing left to rank.`
        );
    }

    const existing = await prisma.plannerPick.findUnique({
        where: { plannerId_playerId: { plannerId: planner.id, playerId } },
    });
    if (existing) throw new Error("That player is already on your list");

    const last = await prisma.plannerPick.findFirst({
        where: { plannerId: planner.id, category: player.playerCategory },
        orderBy: { rank: 'desc' },
        select: { rank: true },
    });

    const amount = Number(plannedAmount);
    await prisma.plannerPick.create({
        data: {
            plannerId: planner.id,
            playerId,
            category: player.playerCategory,
            rank: (last ? last.rank : 0) + 1,
            plannedAmount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
        },
    });

    return getBoard(token);
};

/** Change what the owner is willing to pay for a player already on the list. */
const setPickAmount = async ({ token, playerId, plannedAmount }) => {
    const { planner } = await loadContext(token);
    if (!playerId) throw new Error("playerId is required");

    const amount = Number(plannedAmount);
    const updated = await prisma.plannerPick.updateMany({
        where: { plannerId: planner.id, playerId },
        data: { plannedAmount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null },
    });
    if (updated.count === 0) throw new Error("That player is not on your list");

    return getBoard(token);
};

/** Remove a player and close the ranking up behind them. */
const removePick = async ({ token, playerId }) => {
    const { planner } = await loadContext(token);
    if (!playerId) throw new Error("playerId is required");

    const pick = await prisma.plannerPick.findUnique({
        where: { plannerId_playerId: { plannerId: planner.id, playerId } },
    });
    if (!pick) throw new Error("That player is not on your list");

    await prisma.$transaction([
        prisma.plannerPick.delete({ where: { id: pick.id } }),
        prisma.plannerPick.updateMany({
            where: { plannerId: planner.id, category: pick.category, rank: { gt: pick.rank } },
            data: { rank: { decrement: 1 } },
        }),
    ]);

    return getBoard(token);
};

/**
 * Reorder one category's ranking. `playerIds` is the new order, first choice
 * first, and must name exactly the players currently in that category.
 *
 * Ranks are written negative first: `rank` is unique per category only by
 * convention, but two passes keep the list consistent even mid-transaction.
 */
const reorderCategory = async ({ token, category, playerIds }) => {
    const { planner } = await loadContext(token);
    if (!category) throw new Error("category is required");
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
        throw new Error("playerIds is required");
    }

    const current = await prisma.plannerPick.findMany({
        where: { plannerId: planner.id, category },
        select: { id: true, playerId: true },
    });
    const idByPlayer = new Map(current.map((p) => [p.playerId, p.id]));
    if (playerIds.length !== current.length || playerIds.some((id) => !idByPlayer.has(id))) {
        throw new Error("That order does not match your list for this category");
    }

    await prisma.$transaction([
        ...playerIds.map((playerId, i) => prisma.plannerPick.update({
            where: { id: idByPlayer.get(playerId) },
            data: { rank: -(i + 1) },
        })),
        ...playerIds.map((playerId, i) => prisma.plannerPick.update({
            where: { id: idByPlayer.get(playerId) },
            data: { rank: i + 1 },
        })),
    ]);

    return getBoard(token);
};

module.exports = {
    ensurePlannerForTeam,
    listPlannerLinks,
    resetPlannerToken,
    getBoard,
    addPick,
    setPickAmount,
    removePick,
    reorderCategory,
};
