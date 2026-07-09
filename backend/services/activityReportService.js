const prisma = require("../db/prisma");

/**
 * Get the [start, end) window for "yesterday" in UTC.
 */
const getYesterdayRange = (referenceDate = new Date()) => {
    const end = new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate()
    ));
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { start, end };
};

/**
 * Build the daily activity summary for a date range by querying user_event
 * (plus new signups/tournaments for context).
 * @param {Date} start - inclusive
 * @param {Date} end - exclusive
 */
const getDailyActivitySummary = async (start, end) => {
    const timestampWhere = { gte: start, lt: end };

    const [
        totalEvents,
        eventTypeGroups,
        userIdGroups,
        sessionIdGroups,
        pageGroups,
        newSignups,
        newTournaments
    ] = await Promise.all([
        prisma.userEvent.count({ where: { timestamp: timestampWhere } }),
        prisma.userEvent.groupBy({
            by: ["eventType"],
            where: { timestamp: timestampWhere },
            _count: { _all: true }
        }),
        prisma.userEvent.groupBy({
            by: ["userId"],
            where: { timestamp: timestampWhere, userId: { not: null } }
        }),
        prisma.userEvent.groupBy({
            by: ["sessionId"],
            where: { timestamp: timestampWhere, sessionId: { not: null } }
        }),
        prisma.userEvent.groupBy({
            by: ["page"],
            where: { timestamp: timestampWhere, eventType: "page_view", page: { not: null } },
            _count: { _all: true }
        }),
        prisma.user.count({ where: { createdAt: timestampWhere } }),
        prisma.tournament.count({ where: { createdAt: timestampWhere } })
    ]);

    const eventTypeBreakdown = eventTypeGroups
        .map(g => ({ eventType: g.eventType, count: g._count._all }))
        .sort((a, b) => b.count - a.count);

    const topPages = pageGroups
        .map(g => ({ page: g.page, count: g._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const findCount = (type) => eventTypeBreakdown.find(e => e.eventType === type)?.count || 0;

    return {
        start,
        end,
        totalEvents,
        uniqueActiveUsers: userIdGroups.length,
        uniqueSessions: sessionIdGroups.length,
        newSignups,
        newTournaments,
        logins: findCount("login"),
        eventTypeBreakdown,
        topPages
    };
};

module.exports = { getYesterdayRange, getDailyActivitySummary };
