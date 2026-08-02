const prisma = require("../db/prisma");

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
 * Sessions short enough to be a mis-click or a connection test are excluded from
 * analytics. Without this, the 100+ abandoned few-second sessions in the table
 * drown out the handful of real auctions.
 */
const SIGNIFICANT_SESSION = {
    OR: [
        { playersSold: { gt: 0 } },
        { sessionDurationMinutes: { gte: 10 } },
    ],
};

/**
 * Aggregated session analytics.
 *
 * Ported from Mongoose to Prisma. Sessions have been written to Postgres since
 * the migration while this read still hit Mongo, so the auction section of the
 * analytics page was reporting zeros against a live, populated table.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Object} options - { significantOnly }
 * @returns {Object} { summary, daily, topSessions }
 */
const getSessionAnalytics = async (startDate, endDate, options = {}) => {
    const where = {
        sessionStartedAt: { gte: new Date(startDate), lte: new Date(endDate) },
        ...(options.significantOnly === false ? {} : SIGNIFICANT_SESSION),
    };

    const [aggregate, sessions] = await Promise.all([
        prisma.auctionRoomSession.aggregate({
            where,
            _count: { _all: true },
            _sum: {
                totalUniqueViewers: true,
                totalJoins: true,
                playersSold: true,
                playersUnsold: true,
                totalBids: true,
            },
            _avg: { sessionDurationMinutes: true, peakConcurrentViewers: true },
            _max: { peakConcurrentViewers: true },
        }),
        prisma.auctionRoomSession.findMany({
            where,
            orderBy: { sessionStartedAt: 'asc' },
            select: {
                id: true,
                tournamentId: true,
                tournamentName: true,
                sessionStartedAt: true,
                sessionDurationMinutes: true,
                peakConcurrentViewers: true,
                totalUniqueViewers: true,
                totalJoins: true,
                playersSold: true,
                playersUnsold: true,
                totalBids: true,
            },
        }),
    ]);

    const round = (value, dp = 1) => (value == null ? 0 : Number(value.toFixed(dp)));

    const summary = {
        totalSessions: aggregate._count._all,
        totalUniqueViewers: aggregate._sum.totalUniqueViewers || 0,
        totalJoins: aggregate._sum.totalJoins || 0,
        avgSessionDuration: round(aggregate._avg.sessionDurationMinutes),
        avgPeakViewers: round(aggregate._avg.peakConcurrentViewers),
        maxPeakViewers: aggregate._max.peakConcurrentViewers || 0,
        totalPlayersSold: aggregate._sum.playersSold || 0,
        totalPlayersUnsold: aggregate._sum.playersUnsold || 0,
        totalBids: aggregate._sum.totalBids || 0,
    };

    // Group by calendar day of the session start.
    const byDate = new Map();
    for (const session of sessions) {
        if (!session.sessionStartedAt) continue;
        const date = session.sessionStartedAt.toISOString().slice(0, 10);

        if (!byDate.has(date)) {
            byDate.set(date, { date, sessionsCreated: 0, uniqueViewers: 0, peakTotal: 0 });
        }
        const entry = byDate.get(date);
        entry.sessionsCreated += 1;
        entry.uniqueViewers += session.totalUniqueViewers || 0;
        entry.peakTotal += session.peakConcurrentViewers || 0;
    }

    const daily = Array.from(byDate.values())
        .map(({ date, sessionsCreated, uniqueViewers, peakTotal }) => ({
            date,
            sessionsCreated,
            uniqueViewers,
            avgPeakViewers: round(peakTotal / sessionsCreated),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const topSessions = [...sessions]
        .sort((a, b) => b.peakConcurrentViewers - a.peakConcurrentViewers)
        .slice(0, 10);

    return { summary, daily, topSessions };
};

/**
 * List auctions that are worth comparing, newest first — this is what populates
 * the comparison picker.
 * @param {Object} options - { startDate, endDate, limit }
 * @returns {Array} Session summaries
 */
const listComparableSessions = async (options = {}) => {
    const where = { ...SIGNIFICANT_SESSION };

    if (options.startDate || options.endDate) {
        where.sessionStartedAt = {};
        if (options.startDate) where.sessionStartedAt.gte = new Date(options.startDate);
        if (options.endDate) where.sessionStartedAt.lte = new Date(options.endDate);
    }

    return await prisma.auctionRoomSession.findMany({
        where,
        orderBy: { sessionStartedAt: 'desc' },
        take: Math.min(Number(options.limit) || 50, 200),
        select: {
            id: true,
            tournamentId: true,
            tournamentName: true,
            sessionStartedAt: true,
            sessionDurationMinutes: true,
            peakConcurrentViewers: true,
            playersSold: true,
            totalBids: true,
        },
    });
};

/**
 * Viewer-count samples for one session, normalised onto two axes:
 *   elapsedMinutes — minutes since the auction started
 *   progressPct    — position through the auction as a percentage
 *
 * The percentage axis is what makes auctions of different lengths and dates
 * directly overlayable.
 *
 * @param {Object} session - session row including viewerHistory
 * @returns {Array} Normalised curve points
 */
const normaliseViewerCurve = (session) => {
    const history = Array.isArray(session.viewerHistory) ? session.viewerHistory : [];
    if (history.length === 0 || !session.sessionStartedAt) return [];

    const startedAt = new Date(session.sessionStartedAt).getTime();

    // Prefer the recorded duration; fall back to the span of the samples so a
    // session that never got an end timestamp still normalises.
    const lastSampleAt = new Date(history[history.length - 1].timestamp).getTime();
    const durationMs = session.sessionDurationMinutes
        ? session.sessionDurationMinutes * 60000
        : Math.max(lastSampleAt - startedAt, 1);

    return history
        .map((sample) => {
            const elapsedMs = new Date(sample.timestamp).getTime() - startedAt;
            return {
                timestamp: sample.timestamp,
                elapsedMinutes: Number((elapsedMs / 60000).toFixed(1)),
                progressPct: Number(Math.min((elapsedMs / durationMs) * 100, 100).toFixed(1)),
                viewerCount: sample.viewerCount || 0,
            };
        })
        .filter((point) => point.elapsedMinutes >= 0);
};

/**
 * Viewer retention at quarter points of the auction, as a percentage of peak.
 * A room that holds 80% of its peak to the end played out very differently from
 * one that empties after the marquee players go.
 * @param {Array} curve - output of normaliseViewerCurve
 * @param {number} peak
 * @returns {Object} { at25, at50, at75, at100 }
 */
const retentionFromCurve = (curve, peak) => {
    const pick = (targetPct) => {
        if (curve.length === 0 || !peak) return 0;

        // Nearest sample to the target progress point.
        const nearest = curve.reduce((best, point) =>
            Math.abs(point.progressPct - targetPct) < Math.abs(best.progressPct - targetPct) ? point : best
        );
        return Number(((nearest.viewerCount / peak) * 100).toFixed(1));
    };

    return { at25: pick(25), at50: pick(50), at75: pick(75), at100: pick(100) };
};

/**
 * Full timeline for a single auction: the viewer curve with each player sale
 * placed on it, so viewership can be read against what was happening in the room.
 * @param {string} sessionId
 * @returns {Object|null}
 */
const getAuctionTimeline = async (sessionId) => {
    const session = await prisma.auctionRoomSession.findUnique({ where: { id: sessionId } });
    if (!session) return null;

    const curve = normaliseViewerCurve(session);
    const startedAt = session.sessionStartedAt ? new Date(session.sessionStartedAt) : null;
    const endedAt = session.sessionEndedAt
        ? new Date(session.sessionEndedAt)
        : new Date((startedAt ? startedAt.getTime() : Date.now()) + (session.sessionDurationMinutes || 0) * 60000);

    // Sales are matched to the session by tournament and time window: AuctionLog
    // has no session foreign key.
    const sales = startedAt
        ? await prisma.auctionLog.findMany({
              where: {
                  tournamentId: session.tournamentId,
                  auctionEndedAt: { gte: startedAt, lte: endedAt },
              },
              orderBy: { auctionEndedAt: 'asc' },
              select: {
                  id: true,
                  playerName: true,
                  playerCategory: true,
                  basePrice: true,
                  finalPrice: true,
                  status: true,
                  winningTeamName: true,
                  totalBids: true,
                  auctionEndedAt: true,
              },
          })
        : [];

    const markers = sales.map((sale) => ({
        ...sale,
        elapsedMinutes: startedAt
            ? Number(((new Date(sale.auctionEndedAt).getTime() - startedAt.getTime()) / 60000).toFixed(1))
            : 0,
    }));

    const moneySpent = sales.reduce((total, sale) => total + (sale.finalPrice || 0), 0);

    return {
        session: {
            id: session.id,
            tournamentId: session.tournamentId,
            tournamentName: session.tournamentName,
            sessionStartedAt: session.sessionStartedAt,
            sessionDurationMinutes: session.sessionDurationMinutes,
            peakConcurrentViewers: session.peakConcurrentViewers,
            totalJoins: session.totalJoins,
            playersSold: session.playersSold,
            playersUnsold: session.playersUnsold,
            totalBids: session.totalBids,
        },
        curve,
        markers,
        moneySpent,
        retention: retentionFromCurve(curve, session.peakConcurrentViewers),
    };
};

/**
 * Compare several auctions on a common normalised axis.
 * @param {string[]} sessionIds
 * @returns {Array} One entry per auction, in the order requested
 */
const compareAuctions = async (sessionIds) => {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return [];

    const sessions = await prisma.auctionRoomSession.findMany({
        where: { id: { in: sessionIds.slice(0, 8) } },
    });

    const timelines = await Promise.all(
        sessions.map(async (session) => {
            const curve = normaliseViewerCurve(session);

            const peakPoint = curve.reduce(
                (best, point) => (point.viewerCount > best.viewerCount ? point : best),
                { viewerCount: -1, elapsedMinutes: 0 }
            );

            const sales = session.sessionStartedAt
                ? await prisma.auctionLog.aggregate({
                      where: {
                          tournamentId: session.tournamentId,
                          auctionEndedAt: {
                              gte: new Date(session.sessionStartedAt),
                              lte: new Date(
                                  new Date(session.sessionStartedAt).getTime() +
                                      (session.sessionDurationMinutes || 0) * 60000
                              ),
                          },
                      },
                      _count: { _all: true },
                      _sum: { finalPrice: true },
                      _avg: { finalPrice: true },
                      _max: { finalPrice: true },
                  })
                : { _count: { _all: 0 }, _sum: {}, _avg: {}, _max: {} };

            // AuctionLog is matched to a session by tournament + time window, and
            // that can legitimately find nothing: some older auctions predate
            // per-player logging entirely. Distinguish "no price data recorded"
            // from a genuine zero rather than reporting a confident ₹0.
            const salesRecorded = sales._count._all > 0;

            const playersAuctioned = (session.playersSold || 0) + (session.playersUnsold || 0);

            return {
                sessionId: session.id,
                tournamentId: session.tournamentId,
                tournamentName: session.tournamentName,
                sessionStartedAt: session.sessionStartedAt,
                durationMinutes: session.sessionDurationMinutes || 0,
                curve,
                stats: {
                    peakViewers: session.peakConcurrentViewers || 0,
                    timeToPeakMinutes: peakPoint.viewerCount >= 0 ? peakPoint.elapsedMinutes : 0,
                    totalJoins: session.totalJoins || 0,
                    playersSold: session.playersSold || 0,
                    playersUnsold: session.playersUnsold || 0,
                    sellThroughPct: playersAuctioned
                        ? Number((((session.playersSold || 0) / playersAuctioned) * 100).toFixed(1))
                        : 0,
                    totalBids: session.totalBids || 0,
                    avgBidsPerPlayer: playersAuctioned
                        ? Number(((session.totalBids || 0) / playersAuctioned).toFixed(1))
                        : 0,
                    salesRecorded,
                    moneySpent: salesRecorded ? sales._sum.finalPrice || 0 : null,
                    avgPrice: salesRecorded ? Math.round(sales._avg.finalPrice || 0) : null,
                    highestPrice: salesRecorded ? sales._max.finalPrice || 0 : null,
                },
                retention: retentionFromCurve(curve, session.peakConcurrentViewers),
            };
        })
    );

    // Preserve the caller's ordering so the UI's colour assignment stays stable.
    return sessionIds
        .map((id) => timelines.find((timeline) => timeline.sessionId === id))
        .filter(Boolean);
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
    listComparableSessions,
    getAuctionTimeline,
    compareAuctions,
    getTournamentSessions,
};
