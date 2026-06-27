const auctionLogService = require("../services/auctionLogService");
const { sendSuccess, sendError } = require("../utils");

/**
 * Save complete auction log when auction ends
 * Receives all bid history from frontend in a single request
 */
const saveAuctionLog = async (req, res) => {
    try {
        const auctionData = req.body;

        if (!auctionData.tournamentId || !auctionData.playerId) {
            return sendError(res, 400, "Tournament ID and Player ID are required");
        }

        if (!auctionData.status || !['sold', 'unsold'].includes(auctionData.status)) {
            return sendError(res, 400, "Valid status (sold/unsold) is required");
        }

        const log = await auctionLogService.saveAuctionLog(auctionData);
        sendSuccess(res, 201, "Auction log saved successfully", log);
    } catch (error) {
        console.error("Error saving auction log:", error);
        sendError(res, 500, "Failed to save auction log", error);
    }
};

/**
 * Get all auction logs for a tournament
 */
const getAuctionLogsByTournament = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const filters = req.query;

        const logs = await auctionLogService.getAuctionLogsByTournament(tournamentId, filters);
        sendSuccess(res, 200, "Auction logs retrieved successfully", logs);
    } catch (error) {
        console.error("Error getting auction logs:", error);
        sendError(res, 500, "Failed to get auction logs", error);
    }
};

/**
 * Get auction log for a specific player
 */
const getAuctionLogByPlayer = async (req, res) => {
    try {
        const { playerId } = req.params;

        const log = await auctionLogService.getAuctionLogByPlayer(playerId);
        if (!log) {
            return sendError(res, 404, "No auction log found for this player");
        }
        sendSuccess(res, 200, "Auction log retrieved successfully", log);
    } catch (error) {
        console.error("Error getting player auction log:", error);
        sendError(res, 500, "Failed to get auction log", error);
    }
};

/**
 * Get auction statistics for a tournament
 */
const getAuctionStats = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const stats = await auctionLogService.getAuctionStats(tournamentId);
        sendSuccess(res, 200, "Auction stats retrieved successfully", stats);
    } catch (error) {
        console.error("Error getting auction stats:", error);
        sendError(res, 500, "Failed to get auction stats", error);
    }
};

/**
 * Get top bidding teams for a tournament
 */
const getTopBiddingTeams = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const teams = await auctionLogService.getTopBiddingTeams(tournamentId);
        sendSuccess(res, 200, "Top bidding teams retrieved successfully", teams);
    } catch (error) {
        console.error("Error getting top bidding teams:", error);
        sendError(res, 500, "Failed to get top bidding teams", error);
    }
};

module.exports = {
    saveAuctionLog,
    getAuctionLogsByTournament,
    getAuctionLogByPlayer,
    getAuctionStats,
    getTopBiddingTeams
};
