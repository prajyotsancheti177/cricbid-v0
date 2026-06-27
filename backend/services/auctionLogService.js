const AuctionLog = require("../models/auctionLog");
const mongoose = require("mongoose");

/**
 * Save complete auction log when auction ends
 * This is called once at the end of an auction with all bid history
 * @param {Object} auctionData - Complete auction data including all bids
 * @returns {Object} Created auction log
 */
const saveAuctionLog = async (auctionData) => {
    const {
        tournamentId,
        playerId,
        playerName,
        playerCategory,
        basePrice,
        auctionMode,
        status,
        winningTeamId,
        winningTeamName,
        finalPrice,
        bids,
        auctionStartedAt,
        auctionEndedAt,
        conductedBy
    } = auctionData;

    // Calculate statistics
    const totalBids = bids ? bids.length : 0;
    const uniqueTeams = bids ? [...new Set(bids.map(b => b.teamId?.toString()))].length : 0;
    
    // Calculate duration in seconds
    let durationSeconds = null;
    if (auctionStartedAt && auctionEndedAt) {
        durationSeconds = Math.floor((new Date(auctionEndedAt) - new Date(auctionStartedAt)) / 1000);
    }

    const auctionLog = new AuctionLog({
        tournamentId,
        playerId,
        playerName,
        playerCategory,
        basePrice,
        auctionMode,
        status,
        winningTeamId: winningTeamId || null,
        winningTeamName: winningTeamName || null,
        finalPrice: finalPrice || null,
        bids: bids || [],
        totalBids,
        uniqueTeamsBidding: uniqueTeams,
        auctionStartedAt,
        auctionEndedAt: auctionEndedAt || new Date(),
        totalDurationSeconds: durationSeconds,
        conductedBy
    });

    return await auctionLog.save();
};

/**
 * Get all auction logs for a tournament
 * @param {string} tournamentId - Tournament ID
 * @param {Object} filters - Optional filters (status, playerCategory)
 * @returns {Array} List of auction logs
 */
const getAuctionLogsByTournament = async (tournamentId, filters = {}) => {
    const query = { tournamentId: new mongoose.Types.ObjectId(tournamentId) };

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.playerCategory) {
        query.playerCategory = filters.playerCategory;
    }

    return await AuctionLog.find(query)
        .populate('playerId', 'name photo')
        .populate('winningTeamId', 'name logo')
        .sort({ auctionEndedAt: -1 });
};

/**
 * Get auction log for a specific player
 * @param {string} playerId - Player ID
 * @returns {Object} Auction log or null
 */
const getAuctionLogByPlayer = async (playerId) => {
    return await AuctionLog.findOne({ playerId: new mongoose.Types.ObjectId(playerId) })
        .populate('playerId', 'name photo playerCategory')
        .populate('winningTeamId', 'name logo')
        .populate('bids.teamId', 'name logo');
};

/**
 * Get auction statistics for a tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Object} Auction statistics
 */
const getAuctionStats = async (tournamentId) => {
    const pipeline = [
        { $match: { tournamentId: new mongoose.Types.ObjectId(tournamentId) } },
        {
            $group: {
                _id: null,
                totalAuctions: { $sum: 1 },
                totalSold: { $sum: { $cond: [{ $eq: ["$status", "sold"] }, 1, 0] } },
                totalUnsold: { $sum: { $cond: [{ $eq: ["$status", "unsold"] }, 1, 0] } },
                totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "sold"] }, "$finalPrice", 0] } },
                avgSoldPrice: { $avg: { $cond: [{ $eq: ["$status", "sold"] }, "$finalPrice", null] } },
                avgBidsPerAuction: { $avg: "$totalBids" },
                avgDurationSeconds: { $avg: "$totalDurationSeconds" }
            }
        }
    ];

    const result = await AuctionLog.aggregate(pipeline);
    return result[0] || {
        totalAuctions: 0,
        totalSold: 0,
        totalUnsold: 0,
        totalRevenue: 0,
        avgSoldPrice: 0,
        avgBidsPerAuction: 0,
        avgDurationSeconds: 0
    };
};

/**
 * Get top bidding teams for a tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Array} Teams with bid counts
 */
const getTopBiddingTeams = async (tournamentId) => {
    const pipeline = [
        { $match: { tournamentId: new mongoose.Types.ObjectId(tournamentId) } },
        { $unwind: "$bids" },
        {
            $group: {
                _id: "$bids.teamId",
                teamName: { $first: "$bids.teamName" },
                totalBids: { $sum: 1 },
                totalWins: { 
                    $sum: { 
                        $cond: [{ $eq: ["$winningTeamId", "$bids.teamId"] }, 1, 0] 
                    } 
                }
            }
        },
        { $sort: { totalBids: -1 } },
        { $limit: 10 }
    ];

    return await AuctionLog.aggregate(pipeline);
};

module.exports = {
    saveAuctionLog,
    getAuctionLogsByTournament,
    getAuctionLogByPlayer,
    getAuctionStats,
    getTopBiddingTeams
};
