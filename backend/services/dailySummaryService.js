const prisma = require("../db/prisma");

// India does not observe DST, so a fixed offset is safe here.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Get the [start, end) UTC instants covering the IST calendar day that
 * `referenceDate` falls on.
 * @param {Date} referenceDate
 * @returns {{start: Date, end: Date, label: string}} label is "YYYY-MM-DD" in IST
 */
const getIstDayRange = (referenceDate = new Date()) => {
    const istShifted = new Date(referenceDate.getTime() + IST_OFFSET_MS);
    const year = istShifted.getUTCFullYear();
    const month = istShifted.getUTCMonth();
    const day = istShifted.getUTCDate();

    const startOfIstDayUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS;
    const start = new Date(startOfIstDayUtcMs);
    const end = new Date(startOfIstDayUtcMs + 24 * 60 * 60 * 1000);
    const label = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return { start, end, label };
};

/**
 * Get the range for "yesterday" in IST, relative to now.
 */
const getYesterdayIstRange = () => {
    const now = new Date();
    return getIstDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000));
};

/**
 * Build a daily usage activity summary from the user_event table for the
 * given [start, end) window.
 * @param {Date} start
 * @param {Date} end
 */
const getDailyActivitySummary = async (start, end) => {
    const events = await prisma.userEvent.findMany({
        where: { timestamp: { gte: start, lt: end } },
        select: {
            eventType: true,
            sessionId: true,
            userId: true,
            tournamentId: true,
            page: true,
            ipAddress: true
        }
    });

    const uniqueSessions = new Set();
    const uniqueUsers = new Set();
    const uniqueIPs = new Set();
    const eventTypeCounts = new Map();
    const pageCounts = new Map();
    const tournamentCounts = new Map();

    for (const ev of events) {
        if (ev.sessionId) uniqueSessions.add(ev.sessionId);
        if (ev.userId) uniqueUsers.add(ev.userId);
        if (ev.ipAddress) uniqueIPs.add(ev.ipAddress);

        eventTypeCounts.set(ev.eventType, (eventTypeCounts.get(ev.eventType) || 0) + 1);

        if (ev.eventType === 'page_view' && ev.page) {
            pageCounts.set(ev.page, (pageCounts.get(ev.page) || 0) + 1);
        }

        if (ev.tournamentId) {
            tournamentCounts.set(ev.tournamentId, (tournamentCounts.get(ev.tournamentId) || 0) + 1);
        }
    }

    const topTournamentIds = [...tournamentCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

    const tournaments = topTournamentIds.length
        ? await prisma.tournament.findMany({
            where: { id: { in: topTournamentIds } },
            select: { id: true, name: true }
        })
        : [];
    const tournamentNameById = new Map(tournaments.map(t => [t.id, t.name || 'Unnamed Tournament']));

    return {
        totalEvents: events.length,
        uniqueVisitors: uniqueSessions.size,
        uniqueLoggedInUsers: uniqueUsers.size,
        uniqueIPs: uniqueIPs.size,
        pageViews: eventTypeCounts.get('page_view') || 0,
        eventTypeBreakdown: [...eventTypeCounts.entries()]
            .map(([eventType, count]) => ({ eventType, count }))
            .sort((a, b) => b.count - a.count),
        topPages: [...pageCounts.entries()]
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        topTournaments: topTournamentIds.map(id => ({
            tournamentId: id,
            name: tournamentNameById.get(id) || 'Unnamed Tournament',
            events: tournamentCounts.get(id)
        }))
    };
};

module.exports = { getIstDayRange, getYesterdayIstRange, getDailyActivitySummary };
