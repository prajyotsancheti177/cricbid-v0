const WhatsAppLog = require("../models/whatsappLog");

/**
 * Log a WhatsApp message
 * @param {Object} logData - Log data
 * @returns {Object} Created log entry
 */
const logMessage = async (logData) => {
    const log = new WhatsAppLog({
        messageType: logData.messageType,
        templateName: logData.templateName,
        recipientMobile: logData.recipientMobile,
        playerId: logData.playerId,
        playerName: logData.playerName,
        tournamentId: logData.tournamentId,
        tournamentName: logData.tournamentName,
        teamName: logData.teamName,
        amtSold: logData.amtSold,
        status: logData.status,
        messageId: logData.messageId,
        errorMessage: logData.errorMessage,
        timestamp: logData.timestamp || new Date()
    });

    return await log.save();
};

/**
 * Get daily WhatsApp message stats
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Daily message counts
 */
const getDailyWhatsAppStats = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$timestamp" },
                    month: { $month: "$timestamp" },
                    day: { $dayOfMonth: "$timestamp" },
                    status: "$status"
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: "$_id.day"
                },
                total: { $sum: "$count" },
                success: {
                    $sum: {
                        $cond: [{ $eq: ["$_id.status", "success"] }, "$count", 0]
                    }
                },
                failed: {
                    $sum: {
                        $cond: [{ $eq: ["$_id.status", "failed"] }, "$count", 0]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                date: {
                    $dateFromParts: {
                        year: "$_id.year",
                        month: "$_id.month",
                        day: "$_id.day"
                    }
                },
                total: 1,
                success: 1,
                failed: 1
            }
        },
        { $sort: { date: 1 } }
    ];

    return await WhatsAppLog.aggregate(pipeline);
};

/**
 * Get WhatsApp message summary
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Summary stats
 */
const getWhatsAppSummary = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                },
                failedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                },
                soldNotifications: {
                    $sum: { $cond: [{ $eq: ["$messageType", "player_sold"] }, 1, 0] }
                },
                unsoldNotifications: {
                    $sum: { $cond: [{ $eq: ["$messageType", "player_unsold"] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalMessages: 1,
                successCount: 1,
                failedCount: 1,
                soldNotifications: 1,
                unsoldNotifications: 1,
                successRate: {
                    $cond: [
                        { $gt: ["$totalMessages", 0] },
                        { $multiply: [{ $divide: ["$successCount", "$totalMessages"] }, 100] },
                        0
                    ]
                }
            }
        }
    ];

    const result = await WhatsAppLog.aggregate(pipeline);
    return result[0] || { 
        totalMessages: 0, 
        successCount: 0, 
        failedCount: 0, 
        soldNotifications: 0,
        unsoldNotifications: 0,
        successRate: 0 
    };
};

/**
 * Get message type breakdown
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Message type counts
 */
const getMessageTypeBreakdown = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: "$messageType",
                count: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                },
                failedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                messageType: "$_id",
                count: 1,
                successCount: 1,
                failedCount: 1
            }
        },
        { $sort: { count: -1 } }
    ];

    return await WhatsAppLog.aggregate(pipeline);
};

module.exports = {
    logMessage,
    getDailyWhatsAppStats,
    getWhatsAppSummary,
    getMessageTypeBreakdown
};
