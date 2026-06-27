const tournamentService = require("../services/tournamentService");
const { sendSuccess, sendError } = require("../utils");

const addTournamnet = async (req, res) => {
    try {
        // Extract user info from request (you may need to add auth middleware)
        const { userId, userRole } = req.body; // Adjust based on your auth implementation
        
        const tournament = await tournamentService.createTournament(
            req.body, 
            userId, 
            userRole
        );
        return sendSuccess(res, 201, "Tournament added successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to create tournament", error);
    }
};

const getAllTournaments = async (req, res) => {
    try {
        const { userRole, userId } = req.body; // Adjust based on your auth implementation
        
        let tournaments;
        if (userRole === 'tournament_host') {
            // Tournament hosts see only their tournaments
            tournaments = await tournamentService.getTournamentsByHost(userId);
        } else {
            // Boss and super_user see all tournaments
            tournaments = await tournamentService.getAllTournaments();
        }
        
        return sendSuccess(res, 200, "Tournaments fetched successfully", tournaments);
    } catch (error) {
        return sendError(res, 500, "Failed to fetch tournaments", error);
    }
};

const getTournamentDetail = async (req, res) => {
    try {
        const { tournamentId, userId, userRole } = req.body;
        
        const tournament = await tournamentService.getTournamentDetail(
            tournamentId, 
            userId, 
            userRole
        );
        return sendSuccess(res, 200, "Tournament details fetched successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch tournament details", error);
    }
};

const updateTournament = async (req, res) => {
    try {
        const { tournamentId, userId, userRole, ...updateData } = req.body;
        
        const tournament = await tournamentService.updateTournament(
            tournamentId,
            updateData,
            userId,
            userRole
        );
        return sendSuccess(res, 200, "Tournament updated successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to update tournament", error);
    }
};

const deleteTournament = async (req, res) => {
    try {
        const { tournamentId, userId, userRole } = req.body;
        
        const tournament = await tournamentService.deleteTournament(
            tournamentId,
            userId,
            userRole
        );
        return sendSuccess(res, 200, "Tournament deleted successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to delete tournament", error);
    }
};

const getAllTournamentHosts = async (req, res) => {
    try {
        const hosts = await tournamentService.getAllTournamentHosts();
        return sendSuccess(res, 200, "Tournament hosts fetched successfully", hosts);
    } catch (error) {
        return sendError(res, 500, "Failed to fetch tournament hosts", error);
    }
};

const exportTournamentData = async (req, res) => {
    try {
        const { tournamentId } = req.body;
        const exportData = await tournamentService.getTournamentExportData(tournamentId);
        return sendSuccess(res, 200, "Tournament data exported successfully", exportData);
    } catch (error) {
        return sendError(res, 400, "Failed to export tournament data", error);
    }
};

module.exports = {
    addTournamnet,
    getAllTournaments,
    getTournamentDetail,
    updateTournament,
    deleteTournament,
    getAllTournamentHosts,
    exportTournamentData
};