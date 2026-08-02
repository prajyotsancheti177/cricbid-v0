const prisma = require("../db/prisma");

/**
 * Analytics counts real visitors only. Applied to every read query so bot
 * traffic — which was previously counted as visitors — is excluded.
 */
const HUMAN_ONLY = { isBot: false };

/**
 * Normalise an incoming event into a UserEvent row.
 * @param {Object} eventData
 * @returns {Object} Prisma create payload
 */
const toEventRow = (eventData) => ({
    userId: eventData.userId || null,
    sessionId: eventData.sessionId,
    visitorId: eventData.visitorId || null,
    tournamentId: eventData.tournamentId,
    eventType: eventData.eventType,
    eventData: eventData.eventData,
    page: eventData.page,
    referrer: eventData.referrer || null,
    userAgent: eventData.userAgent,
    ipAddress: eventData.ipAddress,
    timezone: eventData.timezone || null,
    language: eventData.language || null,
    deviceType: eventData.deviceType || null,
    isBot: eventData.isBot === true,
    timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date()
});

/**
 * Track a single user event
 * @param {Object} eventData - Event data
 * @returns {Object} Created event
 */
/**
 * `userId` and `tournamentId` are foreign keys, and both arrive from the client
 * (localStorage). A stale value — a deleted account, an old tournament id — makes
 * the insert fail, which previously meant that browser stopped being tracked
 * entirely and silently. Drop the offending references and keep the event: an
 * anonymous page view is far more useful than no page view.
 *
 * @param {Object} row - Prisma create payload
 * @returns {Object} the same row with unresolvable references cleared
 */
const withoutBrokenReferences = (row) => ({ ...row, userId: null, tournamentId: null });

const isForeignKeyError = (error) => error && error.code === 'P2003';

const trackEvent = async (eventData) => {
    const row = toEventRow(eventData);

    try {
        return await prisma.userEvent.create({ data: row });
    } catch (error) {
        if (!isForeignKeyError(error)) throw error;

        console.warn('[eventService] Dropping unresolvable userId/tournamentId on event');
        return await prisma.userEvent.create({ data: withoutBrokenReferences(row) });
    }
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

    const rows = events.map(toEventRow);

    try {
        const result = await prisma.userEvent.createMany({ data: rows });
        return { insertedCount: result.count };
    } catch (error) {
        if (!isForeignKeyError(error)) throw error;

        // createMany is all-or-nothing, so one bad reference in the batch would
        // discard every event in it.
        console.warn('[eventService] Dropping unresolvable userId/tournamentId on batch');
        const result = await prisma.userEvent.createMany({
            data: rows.map(withoutBrokenReferences)
        });
        return { insertedCount: result.count };
    }
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
 * Time-bucketing helpers
 * ----------------------
 * `timestamp` is TIMESTAMP(3) *without* time zone holding UTC, so bucketing has
 * to be converted explicitly: `AT TIME ZONE 'UTC'` reads it as UTC, and the
 * second `AT TIME ZONE $tz` renders it in the reporting zone. The previous JS
 * grouping used `Date#getFullYear()`, which silently bucketed by the *server's*
 * local calendar day — wrong for IST reporting on a UTC box.
 */
const GRANULARITIES = { hour: 'hour', day: 'day', week: 'week', month: 'month' };
const DEFAULT_TZ = 'Asia/Kolkata';

/**
 * date_trunc's unit cannot be a bound parameter, so it is whitelisted here
 * rather than interpolated from user input.
 * @param {string} granularity
 * @returns {string} safe date_trunc unit
 */
const safeGranularity = (granularity) => GRANULARITIES[granularity] || 'day';

/**
 * A visitor is identified by visitorId, falling back to sessionId for rows
 * written before the visitorId tracker shipped (2026-08). Those older rows are
 * still counted per-tab and so remain inflated — the fallback keeps historical
 * charts continuous rather than dropping to zero at the cutover.
 */
const VISITOR_EXPR = 'COALESCE("visitorId", "sessionId")';

/**
 * Get a page-view time series bucketed by hour/day/week/month.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Object} options - { granularity, tz, tournamentId, deviceType, page }
 * @returns {Array} Buckets with pageViews, uniqueVisitors and sessions
 */
const getPageViewSeries = async (startDate, endDate, options = {}) => {
    const unit = safeGranularity(options.granularity);
    const tz = options.tz || DEFAULT_TZ;

    const rows = await prisma.$queryRawUnsafe(
        `SELECT date_trunc('${unit}', "timestamp" AT TIME ZONE 'UTC' AT TIME ZONE $3) AS bucket,
                COUNT(*)::int AS "pageViews",
                COUNT(DISTINCT ${VISITOR_EXPR})::int AS "uniqueVisitors",
                COUNT(DISTINCT "sessionId")::int AS "sessions"
         FROM "user_event"
         WHERE "eventType" = 'page_view'
           AND "isBot" = false
           AND "timestamp" >= $1 AND "timestamp" <= $2
           AND ($4::text IS NULL OR "tournamentId" = $4)
           AND ($5::text IS NULL OR "deviceType" = $5)
           AND ($6::text IS NULL OR "page" = $6)
         GROUP BY 1
         ORDER BY 1`,
        new Date(startDate),
        new Date(endDate),
        tz,
        options.tournamentId || null,
        options.deviceType || null,
        options.page || null
    );

    return rows.map((row) => ({
        date: row.bucket,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
        sessions: row.sessions
    }));
};

/**
 * Get daily page views aggregation
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - { tz, tournamentId, deviceType, page }
 * @returns {Array} Daily page view counts
 */
const getDailyPageViews = async (startDate, endDate, options = {}) =>
    getPageViewSeries(startDate, endDate, { ...options, granularity: 'day' });

/**
 * Get monthly page views aggregation
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - { tz, tournamentId, deviceType, page }
 * @returns {Array} Monthly page view counts
 */
const getMonthlyPageViews = async (startDate, endDate, options = {}) => {
    const buckets = await getPageViewSeries(startDate, endDate, { ...options, granularity: 'month' });

    // The existing frontend chart reads year/month off each point.
    return buckets.map((bucket) => {
        const date = new Date(bucket.date);
        return { ...bucket, year: date.getFullYear(), month: date.getMonth() + 1 };
    });
};

/**
 * Get page-wise traffic breakdown
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - { limit, tournamentId }
 * @returns {Array} Traffic by page/route
 */
const getPageTrafficBreakdown = async (startDate, endDate, options = {}) => {
    const limit = Math.min(Number(options.limit) || 20, 100);

    const rows = await prisma.$queryRawUnsafe(
        `SELECT "page",
                COUNT(*)::int AS "pageViews",
                COUNT(DISTINCT ${VISITOR_EXPR})::int AS "uniqueVisitors"
         FROM "user_event"
         WHERE "eventType" = 'page_view'
           AND "isBot" = false
           AND "page" IS NOT NULL
           AND "timestamp" >= $1 AND "timestamp" <= $2
           AND ($3::text IS NULL OR "tournamentId" = $3)
         GROUP BY "page"
         ORDER BY "pageViews" DESC
         LIMIT ${limit}`,
        new Date(startDate),
        new Date(endDate),
        options.tournamentId || null
    );

    return rows;
};

/**
 * Get overall analytics summary
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - { tournamentId }
 * @returns {Object} Analytics summary
 */
const getAnalyticsSummary = async (startDate, endDate, options = {}) => {
    const [row] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS "totalPageViews",
                COUNT(DISTINCT ${VISITOR_EXPR})::int AS "uniqueVisitors",
                COUNT(DISTINCT "sessionId")::int AS "sessions",
                COUNT(DISTINCT "page")::int AS "uniquePages"
         FROM "user_event"
         WHERE "eventType" = 'page_view'
           AND "isBot" = false
           AND "timestamp" >= $1 AND "timestamp" <= $2
           AND ($3::text IS NULL OR "tournamentId" = $3)`,
        new Date(startDate),
        new Date(endDate),
        options.tournamentId || null
    );

    const summary = row || { totalPageViews: 0, uniqueVisitors: 0, sessions: 0, uniquePages: 0 };

    // A returning visitor is one whose first ever page view predates this window.
    const [returning] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS "returningVisitors" FROM (
             SELECT ${VISITOR_EXPR} AS visitor, MIN("timestamp") AS first_seen
             FROM "user_event"
             WHERE "eventType" = 'page_view' AND "isBot" = false
             GROUP BY 1
             HAVING MIN("timestamp") < $1
                AND MAX("timestamp") >= $1
         ) prior_visitors`,
        new Date(startDate)
    );

    const returningVisitors = returning ? returning.returningVisitors : 0;

    return {
        ...summary,
        returningVisitors,
        newVisitors: Math.max(summary.uniqueVisitors - returningVisitors, 0),
        viewsPerSession: summary.sessions
            ? Number((summary.totalPageViews / summary.sessions).toFixed(2))
            : 0
    };
};

/**
 * Break page views down by a single dimension.
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} dimension - deviceType | language | timezone | referrer | tournamentId
 * @returns {Array} Counts per dimension value
 */
const DIMENSIONS = {
    deviceType: '"deviceType"',
    language: '"language"',
    timezone: '"timezone"',
    referrer: '"referrer"',
    tournament: '"tournamentId"'
};

const getBreakdown = async (startDate, endDate, dimension) => {
    const column = DIMENSIONS[dimension];
    if (!column) {
        throw new Error(`Unsupported breakdown dimension: ${dimension}`);
    }

    return await prisma.$queryRawUnsafe(
        `SELECT COALESCE(${column}, 'unknown') AS value,
                COUNT(*)::int AS "pageViews",
                COUNT(DISTINCT ${VISITOR_EXPR})::int AS "uniqueVisitors"
         FROM "user_event"
         WHERE "eventType" = 'page_view'
           AND "isBot" = false
           AND "timestamp" >= $1 AND "timestamp" <= $2
         GROUP BY 1
         ORDER BY "pageViews" DESC
         LIMIT 25`,
        new Date(startDate),
        new Date(endDate)
    );
};

/**
 * Day-of-week x hour-of-day activity grid, in the reporting timezone.
 * Used for the heatmap that shows when the site is actually busy.
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} tz - IANA timezone
 * @returns {Array} { dayOfWeek (0=Sun), hour, pageViews, uniqueVisitors }
 */
const getActivityHeatmap = async (startDate, endDate, tz = DEFAULT_TZ) => {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT EXTRACT(DOW FROM local_ts)::int AS "dayOfWeek",
                EXTRACT(HOUR FROM local_ts)::int AS "hour",
                COUNT(*)::int AS "pageViews",
                COUNT(DISTINCT visitor)::int AS "uniqueVisitors"
         FROM (
             SELECT "timestamp" AT TIME ZONE 'UTC' AT TIME ZONE $3 AS local_ts,
                    ${VISITOR_EXPR} AS visitor
             FROM "user_event"
             WHERE "eventType" = 'page_view'
               AND "isBot" = false
               AND "timestamp" >= $1 AND "timestamp" <= $2
         ) local_events
         GROUP BY 1, 2
         ORDER BY 1, 2`,
        new Date(startDate),
        new Date(endDate),
        tz
    );

    return rows;
};

/**
 * Get unique IP addresses from page_view events in date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of unique IP addresses
 */
const getUniqueIPsByDateRange = async (startDate, endDate) => {
    const groups = await prisma.userEvent.groupBy({
        by: ['ipAddress'],
        where: {
            ...HUMAN_ONLY,
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
    getPageViewSeries,
    getDailyPageViews,
    getMonthlyPageViews,
    getPageTrafficBreakdown,
    getAnalyticsSummary,
    getBreakdown,
    getActivityHeatmap,
    getUniqueIPsByDateRange
};
