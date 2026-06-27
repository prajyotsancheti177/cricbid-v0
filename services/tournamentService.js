const tournament = require("../models/tournament");
const User = require("../models/user");

/**
 * Create a new tournament
 * @param {Object} tournamentData - Tournament data
 * @param {String} creatorId - ID of the user creating the tournament
 * @param {String} creatorRole - Role of the user creating the tournament
 * @returns {Promise<Object>} - Created tournament
 */
const createTournament = async (tournamentData, creatorId, creatorRole) => {
    try {
        // If creator is tournament_host, use their own ID
        if (creatorRole === 'tournament_host') {
            tournamentData.tournamentHostId = creatorId;
        } 
        // If boss or super_user, they must specify a tournamentHostId
        else if (creatorRole === 'boss' || creatorRole === 'super_user') {
            if (!tournamentData.tournamentHostId) {
                throw new Error("Tournament host must be specified");
            }
            
            // Verify the selected user is a tournament host
            const selectedHost = await User.findById(tournamentData.tournamentHostId);
            if (!selectedHost || selectedHost.role !== 'tournament_host') {
                throw new Error("Selected user is not a tournament host");
            }
        } else {
            throw new Error("Unauthorized to create tournament");
        }

        const newTournament = new tournament(tournamentData);
        const savedTournament = await newTournament.save();
        
        return savedTournament;
    } catch (error) {
        console.error("Error in createTournament service:", error);
        throw error;
    }
};

/**
 * Get all tournaments (for boss and super_user)
 * @returns {Promise<Array>} - Array of all tournaments
 */
const getAllTournaments = async () => {
    try {
        const tournaments = await tournament.find({})
            .populate('tournamentHostId', 'name email')
            .sort({ createdAt: -1 });
        return tournaments;
    } catch (error) {
        console.error("Error in getAllTournaments service:", error);
        throw error;
    }
};

/**
 * Get tournaments by host (for tournament_host users)
 * @param {String} hostId - Tournament host user ID
 * @returns {Promise<Array>} - Array of tournaments for this host
 */
const getTournamentsByHost = async (hostId) => {
    try {
        const tournaments = await tournament.find({ tournamentHostId: hostId })
            .populate('tournamentHostId', 'name email')
            .sort({ createdAt: -1 });
        return tournaments;
    } catch (error) {
        console.error("Error in getTournamentsByHost service:", error);
        throw error;
    }
};

/**
 * Get single tournament detail
 * @param {String} tournamentId - Tournament ID
 * @param {String} userId - User ID requesting the tournament
 * @param {String} userRole - Role of user requesting
 * @returns {Promise<Object>} - Tournament details
 */
const getTournamentDetail = async (tournamentId, userId, userRole) => {
    try {
        const tournamentData = await tournament.findById(tournamentId)
            .populate('tournamentHostId', 'name email logo');
        
        if (!tournamentData) {
            throw new Error("Tournament not found");
        }

        // Tournament hosts can only view their own tournaments (if they're logged in)
        // Guest users (userRole = 'guest' or empty) can view any tournament
        if (userRole === 'tournament_host' && userId && 
            tournamentData.tournamentHostId && 
            tournamentData.tournamentHostId._id.toString() !== userId) {
            throw new Error("Unauthorized to view this tournament");
        }

        return tournamentData;
    } catch (error) {
        console.error("Error in getTournamentDetail service:", error);
        throw error;
    }
};

/**
 * Update tournament
 * @param {String} tournamentId - Tournament ID
 * @param {Object} updateData - Data to update
 * @param {String} userId - User ID making the update
 * @param {String} userRole - Role of user making update
 * @returns {Promise<Object>} - Updated tournament
 */
const updateTournament = async (tournamentId, updateData, userId, userRole) => {
    try {
        const existingTournament = await tournament.findById(tournamentId);
        
        if (!existingTournament) {
            throw new Error("Tournament not found");
        }

        // Tournament hosts can only update their own tournaments
        if (userRole === 'tournament_host' && 
            existingTournament.tournamentHostId.toString() !== userId) {
            throw new Error("Unauthorized to update this tournament");
        }

        // Boss and super_user can update any tournament, but if they change tournamentHostId, validate it
        if ((userRole === 'boss' || userRole === 'super_user') && updateData.tournamentHostId) {
            const newHost = await User.findById(updateData.tournamentHostId);
            if (!newHost || newHost.role !== 'tournament_host') {
                throw new Error("Invalid tournament host selected");
            }
        }

        // Tournament hosts cannot change the tournamentHostId
        if (userRole === 'tournament_host') {
            delete updateData.tournamentHostId;
        }

        const updatedTournament = await tournament.findByIdAndUpdate(
            tournamentId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('tournamentHostId', 'name email logo');

        return updatedTournament;
    } catch (error) {
        console.error("Error in updateTournament service:", error);
        throw error;
    }
};

/**
 * Delete tournament
 * @param {String} tournamentId - Tournament ID
 * @param {String} userId - User ID making the deletion
 * @param {String} userRole - Role of user making deletion
 * @returns {Promise<Object>} - Deleted tournament
 */
const deleteTournament = async (tournamentId, userId, userRole) => {
    try {
        const existingTournament = await tournament.findById(tournamentId);
        
        if (!existingTournament) {
            throw new Error("Tournament not found");
        }

        // Tournament hosts can only delete their own tournaments
        if (userRole === 'tournament_host' && 
            existingTournament.tournamentHostId.toString() !== userId) {
            throw new Error("Unauthorized to delete this tournament");
        }

        const deletedTournament = await tournament.findByIdAndDelete(tournamentId);
        return deletedTournament;
    } catch (error) {
        console.error("Error in deleteTournament service:", error);
        throw error;
    }
};

/**
 * Get all tournament hosts (for boss and super_user to select from)
 * @returns {Promise<Array>} - Array of tournament host users
 */
const getAllTournamentHosts = async () => {
    try {
        const hosts = await User.find({ role: 'tournament_host', isActive: true })
            .select('name email logo')
            .sort({ name: 1 });
        return hosts;
    } catch (error) {
        console.error("Error in getAllTournamentHosts service:", error);
        throw error;
    }
};

/**
 * Get tournament data for export (teams and players)
 * @param {String} tournamentId - Tournament ID
 * @returns {Promise<Object>} - Tournament with teams and players data
 */
const getTournamentExportData = async (tournamentId) => {
    try {
        const Team = require("../models/team");
        const Player = require("../models/players");

        const tournamentData = await tournament.findById(tournamentId);
        if (!tournamentData) {
            throw new Error("Tournament not found");
        }

        const teams = await Team.find({ touranmentId: tournamentId });
        const players = await Player.find({ touranmentId: tournamentId })
            .populate('teamId', 'name');

        return {
            tournament: {
                _id: tournamentData._id,
                name: tournamentData.name,
                totalBudget: tournamentData.totalBudget
            },
            teams: teams.map(t => ({
                _id: t._id,
                name: t.name,
                logo: t.logo || '',
                ownerName: t.owner?.name || '',
                ownerMobile: t.owner?.mobile || ''
            })),
            players: players.map(p => ({
                _id: p._id,
                auctionSerialNumber: p.auctionSerialNumber || '',
                name: p.name,
                age: p.age || '',
                photo: p.photo || '',
                playerCategory: p.playerCategory || '',
                skill: p.skill || '',
                mobile: p.mobile || '',
                // Additional fields for reference (not in import format)
                teamName: p.teamId?.name || 'Unsold',
                sold: p.sold ? 'Yes' : 'No',
                amtSold: p.amtSold || 0
            }))
        };
    } catch (error) {
        console.error("Error in getTournamentExportData service:", error);
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
    getTournamentExportData
};

