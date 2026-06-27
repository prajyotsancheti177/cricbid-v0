const prisma = require("../db/prisma");
// Deferred analytics-aggregation methods below still use the Mongoose model
// (getEventStats, getDailyPageViews, ... getUniqueIPsByDateRange) pending the
// analytics-page port. Write paths and simple reads use Prisma.
const UserEvent = require("../models/userEvent");

const serEvent = (e) => (e ? { ...e, _id: e.id } : e);

/**
 * Track a single user event
 * @param {Object} eventData - Event data
 * @returns {Object} Created event
 */
const trackEvent = async (eventData) => {
    const created = await prisma.userEvent.create({
        data: {
            userId: eventData.userId || null,
            sessionId: eventData.sessionId ?? null,
            tournamentId: eventData.tournamentId ?? null,
            eventType: eventData.eventType,
            eventData: eventData.eventData ?? null,
            page: eventData.page ?? null,
            userAgent: eventData.userAgent ?? null,
            ipAddress: eventData.ipAddress ?? null,
            timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
        },
    });
    return serEvent(created);
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

    const preparedEvents = events.map(event => ({
        userId: event.userId || null,
        sessionId: event.sessionId ?? null,
        tournamentId: event.tournamentId ?? null,
        eventType: event.eventType,
        eventData: event.eventData ?? null,
        page: event.page ?? null,
        userAgent: event.userAgent ?? null,
        ipAddress: event.ipAddress ?? null,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date()
    }));

    const res = await prisma.userEvent.createMany({ data: preparedEvents });
    // controller reads result.length
    return { length: res.count, insertedCount: res.count };
};

/**
 * Get events by user ID
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters (eventType, startDate, endDate)
 * @returns {Array} List of events
 */
const getEventsByUser = async (userId, filters = {}) => {
    const where = { userId };
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
        if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }
    const rows = await prisma.userEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
    });
    return rows.map(serEvent);
};

/**
 * Get events by tournament ID
 * @param {string} tournamentId - Tournament ID
 * @param {Object} filters - Optional filters
 * @returns {Array} List of events
 */
const getEventsByTournament = async (tournamentId, filters = {}) => {
    const where = { tournamentId };
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = new Date(filters.startDate);
        if (filters.endDate) where.timestamp.lte = new Date(filters.endDate);
    }
    const rows = await prisma.userEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 500,
    });
    return rows.map(serEvent);
};

/**
 * Get event statistics for a tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Object} Event statistics
 */
const getEventStats = async (tournamentId) => {
    const pipeline = [
        { $match: { tournamentId: require('mongoose').Types.ObjectId(tournamentId) } },
        {
            $group: {
                _id: "$eventType",
                count: { $sum: 1 },
                lastOccurred: { $max: "$timestamp" }
            }
        },
        { $sort: { count: -1 } }
    ];

    return await UserEvent.aggregate(pipeline);
};

/**
 * Get daily page views aggregation
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Daily page view counts
 */
const getDailyPageViews = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                eventType: 'page_view',
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
                    day: { $dayOfMonth: "$timestamp" }
                },
                count: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$sessionId" }
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
                pageViews: "$count",
                uniqueVisitors: { $size: "$uniqueVisitors" }
            }
        },
        { $sort: { date: 1 } }
    ];

    return await UserEvent.aggregate(pipeline);
};

/**
 * Get monthly page views aggregation
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Monthly page view counts
 */
const getMonthlyPageViews = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                eventType: 'page_view',
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
                    month: { $month: "$timestamp" }
                },
                count: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$sessionId" }
            }
        },
        {
            $project: {
                _id: 0,
                date: {
                    $dateFromParts: {
                        year: "$_id.year",
                        month: "$_id.month",
                        day: 1
                    }
                },
                year: "$_id.year",
                month: "$_id.month",
                pageViews: "$count",
                uniqueVisitors: { $size: "$uniqueVisitors" }
            }
        },
        { $sort: { date: 1 } }
    ];

    return await UserEvent.aggregate(pipeline);
};

/**
 * Get page-wise traffic breakdown
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Traffic by page/route
 */
const getPageTrafficBreakdown = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                eventType: 'page_view',
                page: { $exists: true, $ne: null },
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: "$page",
                count: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$sessionId" }
            }
        },
        {
            $project: {
                _id: 0,
                page: "$_id",
                pageViews: "$count",
                uniqueVisitors: { $size: "$uniqueVisitors" }
            }
        },
        { $sort: { pageViews: -1 } },
        { $limit: 20 }
    ];

    return await UserEvent.aggregate(pipeline);
};

/**
 * Get overall analytics summary
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Analytics summary
 */
const getAnalyticsSummary = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                eventType: 'page_view',
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: null,
                totalPageViews: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$sessionId" },
                pages: { $addToSet: "$page" }
            }
        },
        {
            $project: {
                _id: 0,
                totalPageViews: 1,
                uniqueVisitors: { $size: "$uniqueVisitors" },
                uniquePages: { $size: "$pages" }
            }
        }
    ];

    const result = await UserEvent.aggregate(pipeline);
    return result[0] || { totalPageViews: 0, uniqueVisitors: 0, uniquePages: 0 };
};

/**
 * Get unique IP addresses from page_view events in date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of unique IP addresses
 */
const getUniqueIPsByDateRange = async (startDate, endDate) => {
    const pipeline = [
        {
            $match: {
                eventType: 'page_view',
                ipAddress: { $exists: true, $ne: null },
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: "$ipAddress"
            }
        },
        {
            $project: {
                _id: 0,
                ipAddress: "$_id"
            }
        }
    ];

    const results = await UserEvent.aggregate(pipeline);
    return results.map(r => r.ipAddress);
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
    getUniqueIPsByDateRange
};

