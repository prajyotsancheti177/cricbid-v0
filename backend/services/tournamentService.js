const prisma = require("../db/prisma");
const googleService = require("../utils/googleService");
const { serializeTournament, serializeTeam, serializePlayer } = require("../utils/serialize");

// Whitelist of tournament fields writable from request bodies
const TOURNAMENT_FIELDS = [
    'name', 'tournamentHostId', 'noOfTeams', 'maxPlayersPerTeam', 'minPlayersPerTeam',
    'totalBudget', 'playerCategories', 'categoryBasePrices', 'bidIncrementSlabs',
    'registrationFormConfig',
];
const pickTournament = (data) => {
    const out = {};
    for (const k of TOURNAMENT_FIELDS) if (data[k] !== undefined) out[k] = data[k];
    return out;
};

/**
 * Create a new tournament
 */
const createTournament = async (tournamentData, creatorId, creatorRole) => {
    try {
        if (creatorRole === 'tournament_host') {
            tournamentData.tournamentHostId = creatorId;
        } else if (creatorRole === 'boss' || creatorRole === 'super_user') {
            if (!tournamentData.tournamentHostId) {
                throw new Error("Tournament host must be specified");
            }
            const selectedHost = await prisma.user.findUnique({ where: { id: tournamentData.tournamentHostId } });
            if (!selectedHost || selectedHost.role !== 'tournament_host') {
                throw new Error("Selected user is not a tournament host");
            }
        } else {
            throw new Error("Unauthorized to create tournament");
        }

        const created = await prisma.tournament.create({ data: pickTournament(tournamentData) });
        return serializeTournament(created);
    } catch (error) {
        console.error("Error in createTournament service:", error);
        throw error;
    }
};

/**
 * Get all tournaments (for boss and super_user)
 */
const getAllTournaments = async () => {
    try {
        const tournaments = await prisma.tournament.findMany({ orderBy: { createdAt: 'desc' } });
        return tournaments.map(serializeTournament);
    } catch (error) {
        console.error("Error in getAllTournaments service:", error);
        throw error;
    }
};

/**
 * Get tournaments by host (for tournament_host users)
 */
const getTournamentsByHost = async (hostId) => {
    try {
        const tournaments = await prisma.tournament.findMany({
            where: { tournamentHostId: hostId },
            orderBy: { createdAt: 'desc' },
        });
        return tournaments.map(serializeTournament);
    } catch (error) {
        console.error("Error in getTournamentsByHost service:", error);
        throw error;
    }
};

/**
 * Get single tournament detail
 */
const getTournamentDetail = async (tournamentId, userId, userRole) => {
    try {
        const tournamentData = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!tournamentData) {
            throw new Error("Tournament not found");
        }

        // Tournament hosts can only view their own tournaments (guests can view any)
        if (userRole === 'tournament_host' && userId &&
            tournamentData.tournamentHostId &&
            String(tournamentData.tournamentHostId) !== userId) {
            throw new Error("Unauthorized to view this tournament");
        }

        return serializeTournament(tournamentData);
    } catch (error) {
        console.error("Error in getTournamentDetail service:", error);
        throw error;
    }
};

/**
 * Update tournament
 */
const updateTournament = async (tournamentId, updateData, userId, userRole) => {
    try {
        const existingTournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!existingTournament) {
            throw new Error("Tournament not found");
        }

        if (userRole === 'tournament_host' &&
            String(existingTournament.tournamentHostId) !== userId) {
            throw new Error("Unauthorized to update this tournament");
        }

        if ((userRole === 'boss' || userRole === 'super_user') && updateData.tournamentHostId) {
            const newHost = await prisma.user.findUnique({ where: { id: updateData.tournamentHostId } });
            if (!newHost || newHost.role !== 'tournament_host') {
                throw new Error("Invalid tournament host selected");
            }
        }

        if (userRole === 'tournament_host') {
            delete updateData.tournamentHostId;
        }

        const updated = await prisma.tournament.update({
            where: { id: tournamentId },
            data: pickTournament(updateData),
        });
        return serializeTournament(updated);
    } catch (error) {
        console.error("Error in updateTournament service:", error);
        throw error;
    }
};

/**
 * Delete tournament
 */
const deleteTournament = async (tournamentId, userId, userRole) => {
    try {
        const existingTournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!existingTournament) {
            throw new Error("Tournament not found");
        }

        if (userRole === 'tournament_host' &&
            String(existingTournament.tournamentHostId) !== userId) {
            throw new Error("Unauthorized to delete this tournament");
        }

        await prisma.tournament.delete({ where: { id: tournamentId } });
        return serializeTournament(existingTournament);
    } catch (error) {
        console.error("Error in deleteTournament service:", error);
        throw error;
    }
};

/**
 * Get all tournament hosts (for boss and super_user to select from)
 */
const getAllTournamentHosts = async () => {
    try {
        const hosts = await prisma.user.findMany({
            where: { role: 'tournament_host', isActive: true },
            select: { id: true, name: true, email: true, logo: true },
            orderBy: { name: 'asc' },
        });
        return hosts.map((h) => ({ _id: h.id, name: h.name, email: h.email, logo: h.logo }));
    } catch (error) {
        console.error("Error in getAllTournamentHosts service:", error);
        throw error;
    }
};

/**
 * Get tournament data for export (teams and players)
 */
const getTournamentExportData = async (tournamentId) => {
    try {
        const tournamentData = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!tournamentData) {
            throw new Error("Tournament not found");
        }

        const teams = await prisma.team.findMany({ where: { touranmentId: tournamentId } });
        const players = await prisma.player.findMany({
            where: { touranmentId: tournamentId },
            include: { team: { select: { id: true, name: true } } },
        });

        return {
            tournament: {
                _id: tournamentData.id,
                name: tournamentData.name,
                totalBudget: tournamentData.totalBudget,
            },
            teams: teams.map((t) => ({
                _id: t.id,
                name: t.name,
                logo: t.logo || '',
                ownerName: t.ownerName || '',
                ownerMobile: t.ownerMobile || '',
            })),
            players: players.map((p) => ({
                _id: p.id,
                auctionSerialNumber: p.auctionSerialNumber || '',
                name: p.name,
                age: p.age || '',
                photo: p.photo || '',
                playerCategory: p.playerCategory || '',
                skill: p.skill || '',
                mobile: p.mobile || '',
                teamName: p.team?.name || 'Unsold',
                sold: p.sold ? 'Yes' : 'No',
                amtSold: p.amtSold || 0,
            })),
        };
    } catch (error) {
        console.error("Error in getTournamentExportData service:", error);
        throw error;
    }
};

/**
 * Get tournament public registration config
 */
const getRegistrationConfig = async (tournamentId) => {
    try {
        const tournamentData = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: { id: true, name: true, registrationFormConfig: true, playerCategories: true },
        });
        if (!tournamentData) {
            throw new Error("Tournament not found");
        }
        return {
            _id: tournamentData.id,
            name: tournamentData.name,
            registrationFormConfig: tournamentData.registrationFormConfig ?? undefined,
            playerCategories: tournamentData.playerCategories ?? [],
        };
    } catch (error) {
        console.error("Error in getRegistrationConfig service:", error);
        throw error;
    }
};

/**
 * Update tournament registration config
 */
const updateRegistrationConfig = async (tournamentId, configData, userId, userRole) => {
    try {
        const existingTournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!existingTournament) {
            throw new Error("Tournament not found");
        }

        if (userRole === 'tournament_host' && String(existingTournament.tournamentHostId) !== userId) {
            throw new Error("Unauthorized to update this tournament");
        }

        if (configData.isActive && configData.googleSheetId) {
            await googleService.initializeSheetHeaders(configData.googleSheetId, configData);
        }

        const updated = await prisma.tournament.update({
            where: { id: tournamentId },
            data: { registrationFormConfig: configData },
        });
        return updated.registrationFormConfig;
    } catch (error) {
        console.error("Error in updateRegistrationConfig service:", error);
        throw error;
    }
};

module.exports = {
    createTournament,
    getAllTournaments,
    getTournamentsByHost,
    getTournamentDetail,
    updateTournament,
    deleteTournament,
    getAllTournamentHosts,
    getTournamentExportData,
    getRegistrationConfig,
    updateRegistrationConfig,
};
