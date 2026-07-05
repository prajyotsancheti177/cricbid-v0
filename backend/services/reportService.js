const prisma = require('../db/prisma');

/**
 * Get the [start, end) UTC bounds of the calendar day containing `date`.
 */
const getDayRange = (date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
};

/**
 * Build a daily user-activity summary from the user_event table.
 * @param {Date} date - Any timestamp within the day to report on
 * @returns {Object} Aggregated daily activity summary
 */
const getDailyActivitySummary = async (date = new Date()) => {
    const { start, end } = getDayRange(date);

    const events = await prisma.userEvent.findMany({
        where: { timestamp: { gte: start, lt: end } },
        select: {
            eventType: true,
            sessionId: true,
            userId: true,
            page: true,
            ipAddress: true,
            tournamentId: true
        }
    });

    const eventTypeCounts = new Map();
    const uniqueSessions = new Set();
    const uniqueUsers = new Set();
    const uniqueIPs = new Set();
    const pageCounts = new Map();
    const tournamentCounts = new Map();
    let pageViews = 0;

    for (const ev of events) {
        eventTypeCounts.set(ev.eventType, (eventTypeCounts.get(ev.eventType) || 0) + 1);
        if (ev.sessionId) uniqueSessions.add(ev.sessionId);
        if (ev.userId) uniqueUsers.add(ev.userId);
        if (ev.ipAddress) uniqueIPs.add(ev.ipAddress);
        if (ev.tournamentId) tournamentCounts.set(ev.tournamentId, (tournamentCounts.get(ev.tournamentId) || 0) + 1);

        if (ev.eventType === 'page_view') {
            pageViews++;
            if (ev.page) pageCounts.set(ev.page, (pageCounts.get(ev.page) || 0) + 1);
        }
    }

    const eventTypeBreakdown = Array.from(eventTypeCounts.entries())
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((a, b) => b.count - a.count);

    const topPages = Array.from(pageCounts.entries())
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    let topTournaments = [];
    if (tournamentCounts.size > 0) {
        const ids = Array.from(tournamentCounts.keys());
        const tournaments = await prisma.tournament.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true }
        });
        const nameById = new Map(tournaments.map(t => [t.id, t.name]));
        topTournaments = ids
            .map(id => ({ tournamentId: id, name: nameById.get(id) || 'Unknown', count: tournamentCounts.get(id) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    return {
        date: start.toISOString().slice(0, 10),
        totalEvents: events.length,
        uniqueVisitors: uniqueSessions.size,
        uniqueLoggedInUsers: uniqueUsers.size,
        uniqueIPs: uniqueIPs.size,
        pageViews,
        eventTypeBreakdown,
        topPages,
        topTournaments
    };
};

module.exports = { getDailyActivitySummary };
