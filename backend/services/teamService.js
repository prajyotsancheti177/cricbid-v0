const prisma = require("../db/prisma");
const { serializeTeam, serializePlayer } = require("../utils/serialize");
const eventService = require("./eventService");

const sumSpent = (players) => players.reduce((acc, p) => acc + (p.amtSold || 0), 0);

/**
 * The most a team may bid on the player currently in front of them.
 *
 * A team must finish with minPlayersPerTeam players, so it has to keep back
 * enough to buy the slots it will still be short of AFTER winning this player
 * — hence the -1. See docs/FORMULA_CORRECTION.md.
 *
 * This is the ONE place the formula lives. It used to be computed here and then
 * cached on the team object, while the live auction updated the numbers it was
 * derived from and left the cached figure behind — so a team could be shown a
 * max bid larger than the budget it actually had left.
 *
 * Without per-category limits the reserve is the cheapest base price in the
 * tournament times the slots left. With limits switched on it is instead the
 * cheapest *legal* way to finish the squad: a team capped at one U17 and one
 * Female cannot fill six slots with 100-point Females, and reserving as though
 * it could handed out a cap that left it unable to field a legal eleven.
 *
 * Counts already bought are respected, so a team that has used its one Female
 * reserves against the next cheapest category instead. The player on the block
 * counts too, because the whole calculation assumes that bid is won.
 */
const computeMaxBiddableAmount = (input) => {
    const {
        remainingBudget = 0,
        playersCount = 0,
        minPlayersPerTeam = 0,
        minBasePrice = 0,
        playersByCategory = null,
        categoryLimits = null,
        categoryBasePrices = null,
        currentPlayerCategory = null,
    } = input || {};

    const slotsToFill = Math.max(0, (minPlayersPerTeam || 0) - (playersCount || 0) - 1);
    if (slotsToFill === 0) return Math.max(0, remainingBudget || 0);

    const limitsOn = !!(categoryLimits && categoryLimits.enabled && categoryBasePrices);
    if (!limitsOn) {
        return Math.max(0, (remainingBudget || 0) - (minBasePrice || 0) * slotsToFill);
    }

    // Assume the current bid is won, so its category has already been consumed.
    const bought = { ...(playersByCategory || {}) };
    if (currentPlayerCategory) bought[currentPlayerCategory] = (bought[currentPlayerCategory] || 0) + 1;

    const limits = categoryLimits.limits || {};
    const choices = Object.keys(categoryBasePrices)
        .map((category) => {
            const price = Number(categoryBasePrices[category]);
            const rawMax = limits[category] ? limits[category].max : null;
            const max = rawMax === null || rawMax === undefined || rawMax === "" ? null : Number(rawMax);
            const allowance = max === null || !Number.isFinite(max)
                ? Infinity
                : Math.max(0, max - (bought[category] || 0));
            return { category, price: Number.isFinite(price) ? price : 0, allowance };
        })
        .filter((c) => c.allowance > 0 && c.price > 0)
        .sort((a, b) => a.price - b.price);

    let left = slotsToFill;
    let reservedAmount = 0;
    for (const choice of choices) {
        if (left <= 0) break;
        const take = Math.min(left, choice.allowance);
        reservedAmount += take * choice.price;
        left -= take;
    }

    return Math.max(0, (remainingBudget || 0) - reservedAmount);
};

/**
 * Whether this team has already filled its allowance for a category.
 *
 * Bidding is never blocked on this — the auction deliberately lets a host bid
 * past every cap — so this exists only to say plainly what the problem is.
 * Returns null when there is nothing to report.
 */
const describeCategoryLimit = ({ playersByCategory, categoryLimits, category }) => {
    if (!category || !categoryLimits || !categoryLimits.enabled) return null;
    const limit = (categoryLimits.limits || {})[category];
    const rawMax = limit ? limit.max : null;
    if (rawMax === null || rawMax === undefined || rawMax === "") return null;
    const max = Number(rawMax);
    if (!Number.isFinite(max)) return null;
    const have = (playersByCategory || {})[category] || 0;
    if (have < max) return null;
    return `${category} limit reached (${have} of ${max})`;
};

// attach basePrice to a serialized player from the tournament's categoryBasePrices map
const withBasePrice = (player, categoryBasePrices) => {
    const s = serializePlayer(player);
    s.basePrice = (categoryBasePrices && player.playerCategory)
        ? (categoryBasePrices[player.playerCategory] || 0)
        : 0;
    return s;
};

const addTeam = async (teamInput) => {
    const existing = await prisma.team.findFirst({
        where: { touranmentId: teamInput.touranmentId, name: teamInput.name },
    });
    if (existing) {
        throw new Error("Team already exists!");
    }
    const created = await prisma.team.create({
        data: {
            name: teamInput.name,
            logo: teamInput.logo ?? null,
            touranmentId: teamInput.touranmentId ?? null,
            ownerName: teamInput.owner?.name ?? null,
            ownerEmail: teamInput.owner?.email ?? null,
            ownerMobile: teamInput.owner?.mobile ?? null,
        },
    });

    eventService.trackEvent({
        userId: teamInput.userId || null,
        tournamentId: created.touranmentId || null,
        eventType: "team_created",
        page: "/teams",
        eventData: { teamId: created.id, teamName: created.name, ownerName: created.ownerName, source: teamInput.isPublic ? "public_form" : "manual" },
    }).catch(() => {});

    return serializeTeam(created);
};

/**
 * Tournament teams report with per-team spend, remaining budget and max-biddable
 * amount. (Ported from the Mongo aggregation pipeline.)
 */
const getTournamentTeamsReport = async (touranmentId) => {
    const tournament = await prisma.tournament.findUnique({ where: { id: touranmentId } });
    if (!tournament) return []; // matched-nothing -> [] (as aggregate did)

    const teams = await prisma.team.findMany({
        where: { touranmentId },
        include: { players: true },
    });

    const topupTotals = await prisma.teamBudgetTopup.groupBy({
        by: ['teamId'],
        where: { touranmentId },
        _sum: { amount: true },
    });
    const topupByTeamId = Object.fromEntries(topupTotals.map((t) => [t.teamId, t._sum.amount || 0]));

    const categoryBasePrices = tournament.categoryBasePrices || {};
    const basePriceValues = Object.values(categoryBasePrices);
    const minBasePrice = basePriceValues.length > 0 ? Math.min(...basePriceValues) : 0;
    const minPlayersPerTeam = tournament.minPlayersPerTeam || 0;
    // Per-category caps live in the tournament's features blob, so switching
    // them on needs no migration. Off unless a host turns them on.
    const categoryLimits = (tournament.features && tournament.features.categoryLimits) || null;

    const teamsOut = teams.map((t) => {
        const players = t.players.map((p) => withBasePrice(p, categoryBasePrices));
        const totalSpent = sumSpent(t.players);
        const totalToppedUp = topupByTeamId[t.id] || 0;
        const remainingBudget = (tournament.totalBudget || 0) + totalToppedUp - totalSpent;

        const playersAlreadyBought = players.length;
        const playersByCategory = players.reduce((acc, p) => {
            const c = p.playerCategory;
            if (c) acc[c] = (acc[c] || 0) + 1;
            return acc;
        }, {});
        const maxBiddableAmount = computeMaxBiddableAmount({
            remainingBudget,
            playersCount: playersAlreadyBought,
            minPlayersPerTeam,
            minBasePrice,
            playersByCategory,
            categoryLimits,
            categoryBasePrices,
        });

        return {
            _id: String(t.id), // string for strict equality in state manager
            name: t.name,
            logo: t.logo,
            owner: { name: t.ownerName, email: t.ownerEmail, mobile: t.ownerMobile },
            players,
            totalSpent,
            totalToppedUp,
            remainingBudget,
            maxPlayersPerTeam: tournament.maxPlayersPerTeam,
            minPlayersPerTeam: tournament.minPlayersPerTeam,
            maxBiddableAmount,
            playersCount: playersAlreadyBought,
            // Carried so the live auction can recompute maxBiddableAmount
            // itself instead of trusting the value above to stay true. The
            // limit-aware figure also depends on who is on the block, which
            // only the auction knows.
            minBasePrice,
            playersByCategory,
            categoryLimits,
            categoryBasePrices,
        };
    });

    return [{
        _id: tournament.id,
        name: tournament.name,
        totalBudget: tournament.totalBudget,
        maxPlayersPerTeam: tournament.maxPlayersPerTeam,
        minPlayersPerTeam: tournament.minPlayersPerTeam,
        categoryBasePrices: tournament.categoryBasePrices ?? undefined,
        teams: teamsOut,
    }];
};

/**
 * Single team report with spend / remaining budget and tournament summary.
 * (Ported from the Mongo aggregation pipeline.)
 */
const getTeamReport = async (teamId) => {
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { players: true },
    });
    if (!team) return [];

    const tournament = team.touranmentId
        ? await prisma.tournament.findUnique({ where: { id: team.touranmentId } })
        : null;

    const topupAgg = await prisma.teamBudgetTopup.aggregate({
        where: { teamId },
        _sum: { amount: true },
    });
    const totalToppedUp = topupAgg._sum.amount || 0;

    const categoryBasePrices = tournament?.categoryBasePrices || {};
    const totalSpent = sumSpent(team.players);
    const remainingBudget = (tournament?.totalBudget || 0) + totalToppedUp - totalSpent;
    const players = team.players.map((p) => withBasePrice(p, categoryBasePrices));

    return [{
        _id: team.id,
        name: team.name,
        logo: team.logo,
        owner: { name: team.ownerName, email: team.ownerEmail, mobile: team.ownerMobile },
        totalSpent,
        totalToppedUp,
        remainingBudget,
        players,
        tournament: tournament
            ? { _id: tournament.id, name: tournament.name, totalBudget: tournament.totalBudget }
            : undefined,
    }];
};

const updateTeam = async (payload) => {
    const { teamId, name, logo, owner } = payload;
    if (!teamId) throw new Error("teamId is required");

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (logo !== undefined) updateData.logo = logo;
    if (owner) {
        if (owner.name) updateData.ownerName = owner.name.trim();
        if (owner.email) updateData.ownerEmail = owner.email.trim().toLowerCase();
        if (owner.mobile) updateData.ownerMobile = owner.mobile;
    }

    let updated;
    try {
        updated = await prisma.team.update({ where: { id: teamId }, data: updateData });
    } catch (e) {
        if (e.code === 'P2025') throw new Error("Team not found");
        throw e;
    }

    eventService.trackEvent({
        userId: payload.userId || null,
        tournamentId: updated.touranmentId || null,
        eventType: "team_updated",
        page: "/teams",
        eventData: { teamId: updated.id, teamName: updated.name, fieldsUpdated: Object.keys(updateData) },
    }).catch(() => {});

    return serializeTeam(updated);
};

/**
 * Delete a single team. Players on the team are unassigned automatically
 * (teamId -> NULL, per the FK's ON DELETE SET NULL), but a team with
 * existing auction bids or budget top-ups can't be deleted — those FKs are
 * ON DELETE RESTRICT, since silently destroying that history would corrupt
 * the audit trail. Callers get a clear error instead of a raw P2003.
 */
const deleteTeam = async ({ teamId, userId }) => {
    if (!teamId) throw new Error("teamId is required");

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new Error("Team not found");

    try {
        await prisma.team.delete({ where: { id: teamId } });
    } catch (e) {
        if (e.code === 'P2025') throw new Error("Team not found");
        if (e.code === 'P2003') throw new Error("Can't delete this team — it already has bid or top-up history for this tournament.");
        throw e;
    }

    eventService.trackEvent({
        userId: userId || null,
        tournamentId: team.touranmentId || null,
        eventType: "team_deleted",
        page: "/teams",
        eventData: { teamId: team.id, teamName: team.name },
    }).catch(() => {});

    return { teamId: team.id, touranmentId: team.touranmentId };
};

/**
 * Credit a team extra auction points (host manually tops up a team's balance
 * after the owner pays cash outside the app). Any authenticated account may
 * do this, not just the tournament's own host.
 */
const topUpTeamBudget = async ({ teamId, amount, note, userId }) => {
    if (!teamId) throw new Error("teamId is required");
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
        throw new Error("amount must be a positive whole number");
    }
    if (!userId) throw new Error("userId is required");

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new Error("Team not found");
    if (!team.touranmentId) throw new Error("Team is not attached to a tournament");

    const tournament = await prisma.tournament.findUnique({ where: { id: team.touranmentId } });
    if (!tournament) throw new Error("Tournament not found");

    // Any authenticated account (tournament_host, super_user, or boss — the
    // only roles that exist) may top up a team's balance, matching who can
    // reach the tournament management page in the first place.
    const requester = await prisma.user.findUnique({ where: { id: userId } });
    if (!requester) {
        throw new Error("User not found");
    }

    const topup = await prisma.teamBudgetTopup.create({
        data: {
            teamId,
            touranmentId: team.touranmentId,
            amount: parsedAmount,
            note: note ? String(note).trim() || null : null,
            createdById: userId,
        },
    });

    eventService.trackEvent({
        userId,
        tournamentId: team.touranmentId,
        eventType: "team_budget_topup",
        page: "/teams",
        eventData: { teamId, teamName: team.name, amount: parsedAmount, note: topup.note },
    }).catch(() => {});

    return { topupId: topup.id, teamId, touranmentId: team.touranmentId, amount: parsedAmount };
};

/**
 * Top-up history for a tournament (all teams), newest first — the audit
 * trail for manual balance credits.
 */
const getTeamBudgetTopups = async (touranmentId) => {
    if (!touranmentId) throw new Error("touranmentId is required");
    const rows = await prisma.teamBudgetTopup.findMany({
        where: { touranmentId },
        include: {
            team: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
        _id: r.id,
        teamId: r.teamId,
        teamName: r.team?.name || null,
        amount: r.amount,
        note: r.note,
        createdBy: r.createdBy ? { _id: r.createdBy.id, name: r.createdBy.name, email: r.createdBy.email } : null,
        createdAt: r.createdAt,
    }));
};

/**
 * Remove a top-up entry (e.g. entered by mistake). Any authenticated
 * account may do this, same as creating one. Returns the affected team's
 * touranmentId so the caller can refresh/broadcast the live auction state.
 */
const deleteTeamBudgetTopup = async ({ topupId, userId }) => {
    if (!topupId) throw new Error("topupId is required");
    if (!userId) throw new Error("userId is required");

    const requester = await prisma.user.findUnique({ where: { id: userId } });
    if (!requester) throw new Error("User not found");

    const topup = await prisma.teamBudgetTopup.findUnique({ where: { id: topupId } });
    if (!topup) throw new Error("Top-up not found");

    await prisma.teamBudgetTopup.delete({ where: { id: topupId } });

    eventService.trackEvent({
        userId,
        tournamentId: topup.touranmentId,
        eventType: "team_budget_topup_deleted",
        page: "/teams",
        eventData: { topupId, teamId: topup.teamId, amount: topup.amount },
    }).catch(() => {});

    return { teamId: topup.teamId, touranmentId: topup.touranmentId };
};

const getTeamNames = async (touranmentId) => {
    if (!touranmentId) throw new Error("touranmentId is required");
    const teams = await prisma.team.findMany({
        where: { touranmentId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
    return teams.map((t) => ({ _id: t.id, name: t.name }));
};

// Legacy: tournament has no embedded `teams` array (never did in the schema);
// kept to preserve the /names-budget endpoint shape.
const getTeamNamesAndBudget = async (touranmentId) => {
    const t = await prisma.tournament.findUnique({ where: { id: touranmentId }, select: { id: true } });
    return t ? { _id: t.id } : null;
};

const bulkCreateTeams = async (teams, touranmentId) => {
    const teamNames = teams.map((t) => t.name);
    const duplicateNames = teamNames.filter((name, index) => teamNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
        throw new Error(`Duplicate team names found in CSV: ${[...new Set(duplicateNames)].join(', ')}`);
    }

    const existingTeams = await prisma.team.findMany({
        where: { touranmentId, name: { in: teamNames } },
        select: { name: true },
    });
    if (existingTeams.length > 0) {
        throw new Error(`Teams already exist: ${existingTeams.map((t) => t.name).join(', ')}`);
    }

    const created = await prisma.team.createManyAndReturn({
        data: teams.map((t) => ({
            name: t.name,
            logo: t.logo ?? null,
            touranmentId: t.touranmentId ?? touranmentId ?? null,
            ownerName: t.owner?.name ?? null,
            ownerEmail: t.owner?.email ?? null,
            ownerMobile: t.owner?.mobile ?? null,
        })),
    });

    eventService.trackEvent({
        userId: null,
        tournamentId: touranmentId || null,
        eventType: "teams_bulk_created",
        page: "/teams",
        eventData: { count: created.length, tournamentId: touranmentId },
    }).catch(() => {});

    return created.map(serializeTeam);
};

/**
 * Delete all teams for a tournament
 */
const deleteAllTeamsByTournament = async (tournamentId) => {
    if (!tournamentId) {
        throw new Error("Tournament ID is required");
    }
    const result = await prisma.team.deleteMany({ where: { touranmentId: tournamentId } });

    eventService.trackEvent({
        userId: null,
        tournamentId: tournamentId || null,
        eventType: "teams_all_deleted",
        page: "/teams",
        eventData: { tournamentId, count: result.count },
    }).catch(() => {});

    return {
        deletedCount: result.count,
        message: `Successfully deleted ${result.count} teams`,
    };
};

module.exports = {
    computeMaxBiddableAmount,
    describeCategoryLimit,
    addTeam,
    getTournamentTeamsReport,
    getTeamReport,
    updateTeam,
    deleteTeam,
    topUpTeamBudget,
    getTeamBudgetTopups,
    deleteTeamBudgetTopup,
    getTeamNames,
    getTeamNamesAndBudget,
    bulkCreateTeams,
    deleteAllTeamsByTournament,
};
