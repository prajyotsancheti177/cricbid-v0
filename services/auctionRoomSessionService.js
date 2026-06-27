const AuctionRoomSession = require('../models/auctionRoomSession');

/**
 * Auction Room Session Service
 * Manages persistence and analytics for live auction room sessions
 */

/**
 * Create a new auction room session
 * @param {Object} params Session parameters
 * @returns {Object} Created session
 */
const createSession = async ({ tournamentId, tournamentName, hostUserId, hostUserName }) => {
    try {
        // Check if there's already an active session for this tournament
        const existingActive = await AuctionRoomSession.findOne({
            tournamentId,
            status: 'active'
        });

        if (existingActive) {
            // Mark it as abandoned and create new one
            existingActive.status = 'abandoned';
            existingActive.sessionEndedAt = new Date();
            await existingActive.save();
        }

        const session = new AuctionRoomSession({
            tournamentId,
            tournamentName,
            hostUserId,
            hostUserName,
            sessionStartedAt: new Date(),
            status: 'active'
        });

        await session.save();
        console.log(`[AuctionRoomSession] Created session for tournament ${tournamentId}`);
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error creating session:', error);
        throw error;
    }
};

/**
 * Get active session for a tournament
 * @param {string} tournamentId Tournament ID
 * @returns {Object|null} Active session or null
 */
const getActiveSession = async (tournamentId) => {
    return AuctionRoomSession.findOne({
        tournamentId,
        status: 'active'
    });
};

/**
 * Record a viewer joining the room
 * @param {string} tournamentId Tournament ID
 * @param {string|null} userId User ID (null if anonymous)
 * @param {string|null} ipAddress IP address for anonymous tracking
 * @returns {Object} Updated session
 */
const recordViewerJoin = async (tournamentId, userId, ipAddress) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        session.totalJoins++;

        if (userId) {
            // Logged-in user - add to unique viewers if not already present
            if (!session.uniqueViewerUserIds.includes(userId)) {
                session.uniqueViewerUserIds.push(userId);
            }
        } else if (ipAddress) {
            // Anonymous user - track by IP
            if (!session.anonymousViewerIPs.includes(ipAddress)) {
                session.anonymousViewerIPs.push(ipAddress);
            }
        }

        // Update total unique viewers count
        session.totalUniqueViewers = 
            session.uniqueViewerUserIds.length + session.anonymousViewerIPs.length;

        await session.save();
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error recording viewer join:', error);
        return null;
    }
};

/**
 * Update current viewer count and check for peak
 * @param {string} tournamentId Tournament ID
 * @param {number} currentCount Current viewer count
 * @returns {Object} Updated session
 */
const updateViewerCount = async (tournamentId, currentCount) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        // Check if this is a new peak
        if (currentCount > session.peakConcurrentViewers) {
            session.peakConcurrentViewers = currentCount;
            session.peakViewerTimestamp = new Date();
        }

        await session.save();
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error updating viewer count:', error);
        return null;
    }
};

/**
 * Record viewer count for time-series (called every 1 minute)
 * @param {string} tournamentId Tournament ID
 * @param {number} viewerCount Current viewer count
 */
const recordViewerHistorySample = async (tournamentId, viewerCount) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        session.viewerHistory.push({
            timestamp: new Date(),
            viewerCount
        });

        // Also update peak if needed
        if (viewerCount > session.peakConcurrentViewers) {
            session.peakConcurrentViewers = viewerCount;
            session.peakViewerTimestamp = new Date();
        }

        await session.save();
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error recording viewer history:', error);
        return null;
    }
};

/**
 * Record auction activity
 * @param {string} tournamentId Tournament ID
 * @param {string} activityType Type of activity: 'bid', 'sold', 'unsold', 'auctioned'
 */
const recordAuctionActivity = async (tournamentId, activityType) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        switch (activityType) {
            case 'bid':
                session.totalBids++;
                break;
            case 'sold':
                session.playersSold++;
                session.playersAuctioned++;
                break;
            case 'unsold':
                session.playersUnsold++;
                session.playersAuctioned++;
                break;
            case 'auctioned':
                session.playersAuctioned++;
                break;
        }

        await session.save();
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error recording activity:', error);
        return null;
    }
};

/**
 * End a session
 * @param {string} tournamentId Tournament ID
 * @returns {Object} Updated session
 */
const endSession = async (tournamentId) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        session.sessionEndedAt = new Date();
        session.status = 'ended';
        
        // Calculate duration in minutes
        const durationMs = session.sessionEndedAt - session.sessionStartedAt;
        session.sessionDurationMinutes = Math.round(durationMs / 60000);

        await session.save();
        console.log(`[AuctionRoomSession] Ended session for tournament ${tournamentId}, duration: ${session.sessionDurationMinutes} minutes`);
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error ending session:', error);
        return null;
    }
};

/**
 * Get aggregated session analytics
 * @param {Date} startDate Start date
 * @param {Date} endDate End date
 * @returns {Object} Analytics data
 */
const getSessionAnalytics = async (startDate, endDate) => {
    try {
        const matchStage = {
            sessionStartedAt: { $gte: startDate, $lte: endDate }
        };

        // Summary statistics
        const summary = await AuctionRoomSession.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalSessions: { $sum: 1 },
                    totalUniqueViewers: { $sum: '$totalUniqueViewers' },
                    totalJoins: { $sum: '$totalJoins' },
                    avgSessionDuration: { $avg: '$sessionDurationMinutes' },
                    avgPeakViewers: { $avg: '$peakConcurrentViewers' },
                    maxPeakViewers: { $max: '$peakConcurrentViewers' },
                    totalPlayersSold: { $sum: '$playersSold' },
                    totalPlayersUnsold: { $sum: '$playersUnsold' },
                    totalBids: { $sum: '$totalBids' }
                }
            }
        ]);

        // Daily breakdown
        const daily = await AuctionRoomSession.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$sessionStartedAt' }
                    },
                    sessionsCreated: { $sum: 1 },
                    uniqueViewers: { $sum: '$totalUniqueViewers' },
                    avgPeakViewers: { $avg: '$peakConcurrentViewers' }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: '$_id',
                    sessionsCreated: 1,
                    uniqueViewers: 1,
                    avgPeakViewers: { $round: ['$avgPeakViewers', 1] },
                    _id: 0
                }
            }
        ]);

        // Top sessions by peak viewers
        const topSessions = await AuctionRoomSession.find(matchStage)
            .sort({ peakConcurrentViewers: -1 })
            .limit(10)
            .select('tournamentId tournamentName peakConcurrentViewers totalUniqueViewers sessionDurationMinutes sessionStartedAt')
            .lean();

        return {
            summary: summary[0] || {
                totalSessions: 0,
                totalUniqueViewers: 0,
                totalJoins: 0,
                avgSessionDuration: 0,
                avgPeakViewers: 0,
                maxPeakViewers: 0,
                totalPlayersSold: 0,
                totalPlayersUnsold: 0,
                totalBids: 0
            },
            daily,
            topSessions
        };
    } catch (error) {
        console.error('[AuctionRoomSession] Error getting analytics:', error);
        throw error;
    }
};

/**
 * Get all sessions for a specific tournament
 * @param {string} tournamentId Tournament ID
 * @returns {Array} Sessions
 */
const getTournamentSessions = async (tournamentId) => {
    return AuctionRoomSession.find({ tournamentId })
        .sort({ sessionStartedAt: -1 })
        .lean();
};

module.exports = {
    createSession,
    getActiveSession,
    recordViewerJoin,
    updateViewerCount,
    recordViewerHistorySample,
    recordAuctionActivity,
    endSession,
    getSessionAnalytics,
    getTournamentSessions
};
