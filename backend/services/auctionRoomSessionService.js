const prisma = require("../db/prisma");
// Deferred analytics reads still use the Mongoose model (see getSessionAnalytics).
const AuctionRoomSession = require('../models/auctionRoomSession');

// add _id alias for any session returned to callers
const ser = (s) => (s ? { ...s, _id: s.id } : s);

const getActiveSession = async (tournamentId) => {
    const s = await prisma.auctionRoomSession.findFirst({
        where: { tournamentId, status: 'active' },
        orderBy: { sessionStartedAt: 'desc' },
    });
    return s ? ser(s) : null;
};

/**
 * Create a new auction room session (abandons any existing active one)
 */
const createSession = async ({ tournamentId, tournamentName, hostUserId, hostUserName }) => {
    try {
        const existingActive = await prisma.auctionRoomSession.findFirst({
            where: { tournamentId, status: 'active' },
        });
        if (existingActive) {
            await prisma.auctionRoomSession.update({
                where: { id: existingActive.id },
                data: { status: 'abandoned', sessionEndedAt: new Date() },
            });
        }

        const session = await prisma.auctionRoomSession.create({
            data: {
                tournamentId,
                tournamentName,
                hostUserId: hostUserId || null,
                hostUserName,
                sessionStartedAt: new Date(),
                status: 'active',
            },
        });
        console.log(`[AuctionRoomSession] Created session for tournament ${tournamentId}`);
        return ser(session);
    } catch (error) {
        console.error('[AuctionRoomSession] Error creating session:', error);
        throw error;
    }
};

const recordViewerJoin = async (tournamentId, userId, ipAddress) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        const uvu = session.uniqueViewerUserIds || [];
        const aip = session.anonymousViewerIPs || [];
        const data = { totalJoins: { increment: 1 } };

        if (userId && !uvu.includes(userId)) data.uniqueViewerUserIds = [...uvu, userId];
        else if (ipAddress && !aip.includes(ipAddress)) data.anonymousViewerIPs = [...aip, ipAddress];

        const newUvu = data.uniqueViewerUserIds || uvu;
        const newAip = data.anonymousViewerIPs || aip;
        data.totalUniqueViewers = newUvu.length + newAip.length;

        const updated = await prisma.auctionRoomSession.update({ where: { id: session.id }, data });
        return ser(updated);
    } catch (error) {
        console.error('[AuctionRoomSession] Error recording viewer join:', error);
        return null;
    }
};

const updateViewerCount = async (tournamentId, currentCount) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;
        if (currentCount > session.peakConcurrentViewers) {
            const updated = await prisma.auctionRoomSession.update({
                where: { id: session.id },
                data: { peakConcurrentViewers: currentCount, peakViewerTimestamp: new Date() },
            });
            return ser(updated);
        }
        return session;
    } catch (error) {
        console.error('[AuctionRoomSession] Error updating viewer count:', error);
        return null;
    }
};

const recordViewerHistorySample = async (tournamentId, viewerCount) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        const history = Array.isArray(session.viewerHistory) ? session.viewerHistory : [];
        const data = { viewerHistory: [...history, { timestamp: new Date(), viewerCount }] };
        if (viewerCount > session.peakConcurrentViewers) {
            data.peakConcurrentViewers = viewerCount;
            data.peakViewerTimestamp = new Date();
        }
        const updated = await prisma.auctionRoomSession.update({ where: { id: session.id }, data });
        return ser(updated);
    } catch (error) {
        console.error('[AuctionRoomSession] Error recording viewer history:', error);
        return null;
    }
};

const recordAuctionActivity = async (tournamentId, activityType) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        let data;
        switch (activityType) {
            case 'bid': data = { totalBids: { increment: 1 } }; break;
            case 'sold': data = { playersSold: { increment: 1 }, playersAuctioned: { increment: 1 } }; break;
            case 'unsold': data = { playersUnsold: { increment: 1 }, playersAuctioned: { increment: 1 } }; break;
            case 'auctioned': data = { playersAuctioned: { increment: 1 } }; break;
            default: return session;
        }
        const updated = await prisma.auctionRoomSession.update({ where: { id: session.id }, data });
        return ser(updated);
    } catch (error) {
        console.error('[AuctionRoomSession] Error recording activity:', error);
        return null;
    }
};

const endSession = async (tournamentId) => {
    try {
        const session = await getActiveSession(tournamentId);
        if (!session) return null;

        const sessionEndedAt = new Date();
        const durationMs = sessionEndedAt - new Date(session.sessionStartedAt);
        const updated = await prisma.auctionRoomSession.update({
            where: { id: session.id },
            data: {
                sessionEndedAt,
                status: 'ended',
                sessionDurationMinutes: Math.round(durationMs / 60000),
            },
        });
        console.log(`[AuctionRoomSession] Ended session for tournament ${tournamentId}, duration: ${updated.sessionDurationMinutes} minutes`);
        return ser(updated);
    } catch (error) {
        console.error('[AuctionRoomSession] Error ending session:', error);
        return null;
    }
};

const getTournamentSessions = async (tournamentId) => {
    const sessions = await prisma.auctionRoomSession.findMany({
        where: { tournamentId },
        orderBy: { sessionStartedAt: 'desc' },
    });
    return sessions.map(ser);
};

/**
 * Aggregated session analytics. DEFERRED: still reads from Mongo (Mongoose)
 * pending the analytics-page port. New sessions are written to Postgres.
 */
const getSessionAnalytics = async (startDate, endDate) => {
    try {
        const matchStage = { sessionStartedAt: { $gte: startDate, $lte: endDate } };

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
                    totalBids: { $sum: '$totalBids' },
                },
            },
        ]);

        const daily = await AuctionRoomSession.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$sessionStartedAt' } },
                    sessionsCreated: { $sum: 1 },
                    uniqueViewers: { $sum: '$totalUniqueViewers' },
                    avgPeakViewers: { $avg: '$peakConcurrentViewers' },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', sessionsCreated: 1, uniqueViewers: 1, avgPeakViewers: { $round: ['$avgPeakViewers', 1] }, _id: 0 } },
        ]);

        const topSessions = await AuctionRoomSession.find(matchStage)
            .sort({ peakConcurrentViewers: -1 })
            .limit(10)
            .select('tournamentId tournamentName peakConcurrentViewers totalUniqueViewers sessionDurationMinutes sessionStartedAt')
            .lean();

        return {
            summary: summary[0] || {
                totalSessions: 0, totalUniqueViewers: 0, totalJoins: 0, avgSessionDuration: 0,
                avgPeakViewers: 0, maxPeakViewers: 0, totalPlayersSold: 0, totalPlayersUnsold: 0, totalBids: 0,
            },
            daily,
            topSessions,
        };
    } catch (error) {
        console.error('[AuctionRoomSession] Error getting analytics:', error);
        throw error;
    }
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
    getTournamentSessions,
};
