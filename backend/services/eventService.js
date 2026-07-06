const prisma = require("../db/prisma");

/**
 * Track a single user event
 * @param {Object} eventData - Event data
 * @returns {Object} Created event
 */
const trackEvent = async (eventData) => {
    return await prisma.userEvent.create({
        data: {
            userId: eventData.userId || null,
            sessionId: eventData.sessionId,
            tournamentId: eventData.tournamentId,
            eventType: eventData.eventType,
            eventData: eventData.eventData,
            page: eventData.page,
            userAgent: eventData.userAgent,
            ipAddress: eventData.ipAddress,
            timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date()
        }
    });
};

/**
 * Track multiple events in batch
 * @param {Array} events - Array of event objects
 * @returns {Object} Insert result
 */
const trackEvents = async (events) => {
    if (!events || events.length === 0) {
        return { insertedCount: 0 };
    }

    const result = await prisma.userEvent.createMany({
        data: events.map(event => ({
            userId: event.userId || null,
            sessionId: event.sessionId,
            tournamentId: event.tournamentId,
            eventType: event.eventType,
            eventData: event.eventData,
            page: event.page,
            userAgent: event.userAgent,
            ipAddress: event.ipAddress,
            timestamp: event.timestamp ? new Date(event.timestamp) : new Date()
        }))
    });

    return { insertedCount: result.count };
};

/**
 * Get events by user ID
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters (eventType, startDate, endDate)
 * @returns {Array} List of events
 */
const getEventsByUser = async (userId, filters = {}) => {
    const where = { userId };

    if (filters.eventType) {
        where.eventType = filters.eventType;
    }

    if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
        if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    return await prisma.userEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100
    });
};

/**
 * Get events by tournament ID
 * @param {string} tournamentId - Tournament ID
 * @param {Object} filters - Optional filters
 * @returns {Array} List of events
 */
const getEventsByTournament = async (tournamentId, filters = {}) => {
    const where = { tournamentId };

    if (filters.eventType) {
        where.eventType = filters.eventType;
    }

    if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
        if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    return await prisma.userEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 500
    });
};

/**
 * Get event statistics for a tournament
 * Replaces: UserEvent.aggregate([{$match}, {$group by eventType}])
 * @param {string} tournamentId - Tournament ID
 * @returns {Array} Event statistics grouped by eventType
 */
const getEventStats = async (tournamentId) => {
    const groups = await prisma.userEvent.groupBy({
        by: ['eventType'],
        where: { tournamentId },
        _count: { _all: true },
        _max: { timestamp: true }
    });

    return groups
        .map(g => ({
            eventType: g.eventType,
            count: g._count._all,
            lastOccurred: g._max.timestamp
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Get daily page views aggregation
 * Replaces: UserEvent.aggregate([{$match page_view + date range}, {$group by year/month/day}])
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Daily page view counts
 */
const getDailyPageViews = async (startDate, endDate) => {
    const events = await prisma.userEvent.findMany({
        where: {
            eventType: 'page_view',
            timestamp: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        select: {
            timestamp: true,
            sessionId: true
        }
    });

    // Group by date in JS
    const byDate = new Map();
    for (const ev of events) {
        const d = ev.timestamp;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!byDate.has(key)) {
            byDate.set(key, { date: new Date(key), pageViews: 0, sessionIds: new Set() });
        }
        const entry = byDate.get(key);
        entry.pageViews++;
        if (ev.sessionId) entry.sessionIds.add(ev.sessionId);
    }

    return Array.from(byDate.values())
        .map(({ date, pageViews, sessionIds }) => ({ date, pageViews, uniqueVisitors: sessionIds.size }))
        .sort((a, b) => a.date - b.date);
};

/**
 * Get monthly page views aggregation
 * Replaces: UserEvent.aggregate([{$match page_view + date range}, {$group by year/month}])
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Monthly page view counts
 */
const getMonthlyPageViews = async (startDate, endDate) => {
    const events = await prisma.userEvent.findMany({
        where: {
            eventType: 'page_view',
            timestamp: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        select: {
            timestamp: true,
            sessionId: true
        }
    });

    // Group by year+month in JS
    const byMonth = new Map();
    for (const ev of events) {
        const d = ev.timestamp;
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (!byMonth.has(key)) {
            byMonth.set(key, { date: new Date(`${year}-${String(month).padStart(2, '0')}-01`), year, month, pageViews: 0, sessionIds: new Set() });
        }
        const entry = byMonth.get(key);
        entry.pageViews++;
        if (ev.sessionId) entry.sessionIds.add(ev.sessionId);
    }

    return Array.from(byMonth.values())
        .map(({ date, year, month, pageViews, sessionIds }) => ({ date, year, month, pageViews, uniqueVisitors: sessionIds.size }))
        .sort((a, b) => a.date - b.date);
};

/**
 * Get page-wise traffic breakdown
 * Replaces: UserEvent.aggregate([{$match page_view}, {$group by page}])
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Traffic by page/route, top 20
 */
const getPageTrafficBreakdown = async (startDate, endDate) => {
    const events = await prisma.userEvent.findMany({
        where: {
            eventType: 'page_view',
            page: { not: null },
            timestamp: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        select: {
            page: true,
            sessionId: true
        }
    });

    // Group by page in JS
    const byPage = new Map();
    for (const ev of events) {
        const p = ev.page;
        if (!byPage.has(p)) {
            byPage.set(p, { page: p, pageViews: 0, sessionIds: new Set() });
        }
        const entry = byPage.get(p);
        entry.pageViews++;
        if (ev.sessionId) entry.sessionIds.add(ev.sessionId);
    }

    return Array.from(byPage.values())
        .map(({ page, pageViews, sessionIds }) => ({ page, pageViews, uniqueVisitors: sessionIds.size }))
        .sort((a, b) => b.pageViews - a.pageViews)
        .slice(0, 20);
};

/**
 * Get overall analytics summary
 * Replaces: UserEvent.aggregate([{$match page_view}, {$group null with addToSet}])
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Analytics summary
 */
const getAnalyticsSummary = async (startDate, endDate) => {
    const events = await prisma.userEvent.findMany({
        where: {
            eventType: 'page_view',
            timestamp: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        select: {
            sessionId: true,
            page: true
        }
    });

    const uniqueSessions = new Set();
    const uniquePages = new Set();

    for (const ev of events) {
        if (ev.sessionId) uniqueSessions.add(ev.sessionId);
        if (ev.page) uniquePages.add(ev.page);
    }

    return {
        totalPageViews: events.length,
        uniqueVisitors: uniqueSessions.size,
        uniquePages: uniquePages.size
    };
};

/**
 * Get a full daily activity summary across all event types in a date range.
 * Replaces: UserEvent.aggregate([{$match date range}, {$group by eventType/page/session/user}])
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Summary with totals, event type breakdown and top pages
 */
const getDailyActivitySummary = async (startDate, endDate) => {
    const events = await prisma.userEvent.findMany({
        where: {
            timestamp: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        select: {
            eventType: true,
            sessionId: true,
            userId: true,
            page: true
        }
    });

    const uniqueSessions = new Set();
    const uniqueUsers = new Set();
    const byEventType = new Map();
    const byPage = new Map();

    for (const ev of events) {
        if (ev.sessionId) uniqueSessions.add(ev.sessionId);
        if (ev.userId) uniqueUsers.add(ev.userId);
        byEventType.set(ev.eventType, (byEventType.get(ev.eventType) || 0) + 1);
        if (ev.page) byPage.set(ev.page, (byPage.get(ev.page) || 0) + 1);
    }

    const eventTypeBreakdown = Array.from(byEventType.entries())
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((a, b) => b.count - a.count);

    const topPages = Array.from(byPage.entries())
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        totalEvents: events.length,
        uniqueVisitors: uniqueSessions.size,
        uniqueUsers: uniqueUsers.size,
        eventTypeBreakdown,
        topPages
    };
};

/**
 * Get unique IP addresses from page_view events in date range
 * Replaces: UserEvent.aggregate([{$match page_view + ipAddress exists}, {$group by ipAddress}])
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of unique IP addresses
 */
const getUniqueIPsByDateRange = async (startDate, endDate) => {
    const groups = await prisma.userEvent.groupBy({
        by: ['ipAddress'],
        where: {
            eventType: 'page_view',
            ipAddress: { not: null },
            timestamp: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        }
    });

    return groups.map(g => g.ipAddress).filter(Boolean);
};

module.exports = {
    trackEvent,
    trackEvents,
    getEventsByUser,
    getEventsByTournament,
    getEventStats,
    getDailyPageViews,
    getMonthlyPageViews,
    getPageTrafficBreakdown,
    getAnalyticsSummary,
    getDailyActivitySummary,
    getUniqueIPsByDateRange
};
