const prisma = require("../db/prisma");
const { serializeTeam, serializePlayer } = require("../utils/serialize");
const eventService = require("./eventService");

const sumSpent = (players) => players.reduce((acc, p) => acc + (p.amtSold || 0), 0);

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

    const categoryBasePrices = tournament.categoryBasePrices || {};
    const basePriceValues = Object.values(categoryBasePrices);
    const minBasePrice = basePriceValues.length > 0 ? Math.min(...basePriceValues) : 0;
    const minPlayersPerTeam = tournament.minPlayersPerTeam || 0;

    const teamsOut = teams.map((t) => {
        const players = t.players.map((p) => withBasePrice(p, categoryBasePrices));
        const totalSpent = sumSpent(t.players);
        const remainingBudget = (tournament.totalBudget || 0) - totalSpent;

        const playersAlreadyBought = players.length;
        const slotsToFill = Math.max(0, minPlayersPerTeam - playersAlreadyBought - 1);
        const reservedAmount = minBasePrice * slotsToFill;
        const maxBiddableAmount = Math.max(0, remainingBudget - reservedAmount);

        return {
            _id: String(t.id), // string for strict equality in state manager
            name: t.name,
            logo: t.logo,
            owner: { name: t.ownerName, email: t.ownerEmail, mobile: t.ownerMobile },
            players,
            totalSpent,
            remainingBudget,
            maxPlayersPerTeam: tournament.maxPlayersPerTeam,
            minPlayersPerTeam: tournament.minPlayersPerTeam,
            maxBiddableAmount,
            playersCount: playersAlreadyBought,
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

    const categoryBasePrices = tournament?.categoryBasePrices || {};
    const totalSpent = sumSpent(team.players);
    const remainingBudget = (tournament?.totalBudget || 0) - totalSpent;
    const players = team.players.map((p) => withBasePrice(p, categoryBasePrices));

    return [{
        _id: team.id,
        name: team.name,
        logo: team.logo,
        owner: { name: team.ownerName, email: team.ownerEmail, mobile: team.ownerMobile },
        totalSpent,
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
    addTeam,
    getTournamentTeamsReport,
    getTeamReport,
    updateTeam,
    getTeamNames,
    getTeamNamesAndBudget,
    bulkCreateTeams,
    deleteAllTeamsByTournament,
};
