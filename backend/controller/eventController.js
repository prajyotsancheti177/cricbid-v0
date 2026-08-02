const eventService = require("../services/eventService");
const auctionRoomSessionService = require("../services/auctionRoomSessionService");
const geoService = require("../services/geoService");
const presenceService = require("../services/presenceService");
const { classifyUserAgent } = require("../utils/userAgent");
const { sendSuccess, sendError } = require("../utils");

/**
 * Attach server-derived fields to an incoming event. The client is never
 * trusted for IP, user agent or bot classification.
 * @param {Object} req - Express request
 * @param {Object} event - Client-supplied event body
 * @returns {Object} Enriched event
 */
const enrichEvent = (req, event) => {
    const userAgent = req.headers['user-agent'];
    const { isBot, deviceType } = classifyUserAgent(userAgent);

    return {
        ...event,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent,
        isBot,
        deviceType
    };
};

/**
 * Track a single user event
 */
const trackEvent = async (req, res) => {
    try {
        const event = await eventService.trackEvent(enrichEvent(req, req.body));
        sendSuccess(res, 201, "Event tracked successfully", { eventId: event.id });
    } catch (error) {
        console.error("Error tracking event:", error);
        sendError(res, 500, "Failed to track event", error);
    }
};

/**
 * Track multiple events in batch
 */
const trackEvents = async (req, res) => {
    try {
        const { events } = req.body;

        if (!events || !Array.isArray(events)) {
            return sendError(res, 400, "Events array is required");
        }

        const enrichedEvents = events.map(event => enrichEvent(req, event));

        const result = await eventService.trackEvents(enrichedEvents);
        sendSuccess(res, 201, "Events tracked successfully", { count: result.insertedCount });
    } catch (error) {
        console.error("Error tracking events:", error);
        sendError(res, 500, "Failed to track events", error);
    }
};

/**
 * Get events by user ID
 */
const getEventsByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const filters = req.query;

        const events = await eventService.getEventsByUser(userId, filters);
        sendSuccess(res, 200, "Events retrieved successfully", events);
    } catch (error) {
        console.error("Error getting user events:", error);
        sendError(res, 500, "Failed to get events", error);
    }
};

/**
 * Get events by tournament ID
 */
const getEventsByTournament = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const filters = req.query;

        const events = await eventService.getEventsByTournament(tournamentId, filters);
        sendSuccess(res, 200, "Events retrieved successfully", events);
    } catch (error) {
        console.error("Error getting tournament events:", error);
        sendError(res, 500, "Failed to get events", error);
    }
};

/**
 * Get event statistics for a tournament
 */
const getEventStats = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const stats = await eventService.getEventStats(tournamentId);
        sendSuccess(res, 200, "Event stats retrieved successfully", stats);
    } catch (error) {
        console.error("Error getting event stats:", error);
        sendError(res, 500, "Failed to get event stats", error);
    }
};

/**
 * Get analytics dashboard data
 * Combines daily, monthly, page traffic, and summary data
 */
const getAnalyticsDashboard = async (req, res) => {
    try {
        const { startDate, endDate, granularity, tz, compare, tournamentId, deviceType, page } = req.query;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Ensure end date includes the full day
        end.setHours(23, 59, 59, 999);

        const options = { tz, tournamentId, deviceType, page };
        const seriesOptions = { ...options, granularity: granularity || 'day' };

        // Import whatsappLogService here to avoid circular dependency
        const whatsappLogService = require("../services/whatsappLogService");

        const [series, daily, monthly, pageTraffic, summary, heatmap, whatsappDaily, whatsappSummary, whatsappTypes] = await Promise.all([
            eventService.getPageViewSeries(start, end, seriesOptions),
            eventService.getDailyPageViews(start, end, options),
            eventService.getMonthlyPageViews(start, end, options),
            eventService.getPageTrafficBreakdown(start, end, options),
            eventService.getAnalyticsSummary(start, end, options),
            eventService.getActivityHeatmap(start, end, tz),
            whatsappLogService.getDailyWhatsAppStats(start, end),
            whatsappLogService.getWhatsAppSummary(start, end),
            whatsappLogService.getMessageTypeBreakdown(start, end)
        ]);

        // Day-on-day view: the immediately preceding window of equal length, so
        // every headline number can be shown with a delta.
        let previous = null;
        if (compare !== 'none') {
            const windowMs = end.getTime() - start.getTime();
            const previousEnd = new Date(start.getTime() - 1);
            const previousStart = new Date(previousEnd.getTime() - windowMs);

            const [previousSummary, previousSeries] = await Promise.all([
                eventService.getAnalyticsSummary(previousStart, previousEnd, options),
                eventService.getPageViewSeries(previousStart, previousEnd, seriesOptions)
            ]);

            previous = {
                summary: previousSummary,
                series: previousSeries,
                dateRange: {
                    startDate: previousStart.toISOString(),
                    endDate: previousEnd.toISOString()
                }
            };
        }

        sendSuccess(res, 200, "Analytics data retrieved successfully", {
            series,
            granularity: seriesOptions.granularity,
            daily,
            monthly,
            pageTraffic,
            summary,
            heatmap,
            previous,
            whatsapp: {
                daily: whatsappDaily,
                summary: whatsappSummary,
                messageTypes: whatsappTypes
            },
            dateRange: {
                startDate: start.toISOString(),
                endDate: end.toISOString()
            }
        });
    } catch (error) {
        console.error("Error getting analytics dashboard:", error);
        sendError(res, 500, "Failed to get analytics data", error);
    }
};

/**
 * Break page views down by a single dimension (device, language, referrer, ...)
 */
const getAnalyticsBreakdown = async (req, res) => {
    try {
        const { startDate, endDate, dimension } = req.query;

        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);

        const breakdown = await eventService.getBreakdown(start, end, dimension || 'deviceType');

        sendSuccess(res, 200, "Breakdown retrieved successfully", { dimension, breakdown });
    } catch (error) {
        console.error("Error getting analytics breakdown:", error);
        sendError(res, 400, error.message || "Failed to get breakdown", error);
    }
};

/**
 * Record a presence heartbeat. Public — anonymous viewers count too.
 */
const recordHeartbeat = async (req, res) => {
    try {
        const { visitorId, sessionId, page } = req.body;

        // Bots must not inflate the live counter.
        const { isBot } = classifyUserAgent(req.headers['user-agent']);
        if (!isBot) {
            presenceService.recordHeartbeat({ visitorId, sessionId, page });
        }

        sendSuccess(res, 200, "Heartbeat recorded", null);
    } catch (error) {
        console.error("Error recording heartbeat:", error);
        sendError(res, 500, "Failed to record heartbeat", error);
    }
};

/**
 * Current live active-user count, with per-page breakdown and recent history.
 */
const getActiveUsers = async (req, res) => {
    try {
        sendSuccess(res, 200, "Active users retrieved successfully", presenceService.getSnapshot());
    } catch (error) {
        console.error("Error getting active users:", error);
        sendError(res, 500, "Failed to get active users", error);
    }
};

/**
 * Get auction room analytics
 * Returns session statistics, daily trends, and top rooms
 */
const getAuctionRoomAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Ensure end date includes the full day
        end.setHours(23, 59, 59, 999);

        const analytics = await auctionRoomSessionService.getSessionAnalytics(start, end);

        sendSuccess(res, 200, "Auction room analytics retrieved successfully", {
            ...analytics,
            dateRange: {
                startDate: start.toISOString(),
                endDate: end.toISOString()
            }
        });
    } catch (error) {
        console.error("Error getting auction room analytics:", error);
        sendError(res, 500, "Failed to get auction room analytics", error);
    }
};

/**
 * List auctions available for comparison (the comparison picker's options).
 */
const listComparableAuctions = async (req, res) => {
    try {
        const sessions = await auctionRoomSessionService.listComparableSessions(req.query);
        sendSuccess(res, 200, "Auctions retrieved successfully", { sessions });
    } catch (error) {
        console.error("Error listing comparable auctions:", error);
        sendError(res, 500, "Failed to list auctions", error);
    }
};

/**
 * Full timeline for one auction: viewer curve plus player-sale markers.
 */
const getAuctionTimeline = async (req, res) => {
    try {
        const timeline = await auctionRoomSessionService.getAuctionTimeline(req.params.sessionId);

        if (!timeline) {
            return sendError(res, 404, "Auction session not found");
        }

        sendSuccess(res, 200, "Auction timeline retrieved successfully", timeline);
    } catch (error) {
        console.error("Error getting auction timeline:", error);
        sendError(res, 500, "Failed to get auction timeline", error);
    }
};

/**
 * Compare several auctions on a normalised time axis.
 */
const compareAuctions = async (req, res) => {
    try {
        const { sessionIds } = req.query;

        const ids = String(sessionIds || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);

        if (ids.length === 0) {
            return sendError(res, 400, "sessionIds query parameter is required");
        }

        const auctions = await auctionRoomSessionService.compareAuctions(ids);
        sendSuccess(res, 200, "Auction comparison retrieved successfully", { auctions });
    } catch (error) {
        console.error("Error comparing auctions:", error);
        sendError(res, 500, "Failed to compare auctions", error);
    }
};

/**
 * Get geo-analytics data
 * Returns unique IPs aggregated by city with lat/lng for map visualization
 */
const getGeoAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Ensure end date includes the full day
        end.setHours(23, 59, 59, 999);

        // Get unique IPs in date range
        const uniqueIPs = await eventService.getUniqueIPsByDateRange(start, end);
        
        if (uniqueIPs.length === 0) {
            return sendSuccess(res, 200, "Geo analytics retrieved successfully", {
                cityData: [],
                totalUniqueIPs: 0,
                dateRange: {
                    startDate: start.toISOString(),
                    endDate: end.toISOString()
                }
            });
        }

        // Batch lookup locations for all IPs
        const locationMap = await geoService.batchGetLocations(uniqueIPs);

        // Aggregate by city
        const cityData = geoService.aggregateByCity(locationMap);

        // Filter to only India locations for the India map
        const indiaCity = cityData.filter(c => c.country === 'India');

        sendSuccess(res, 200, "Geo analytics retrieved successfully", {
            cityData: indiaCity,
            allCityData: cityData, // Include all countries for reference
            totalUniqueIPs: uniqueIPs.length,
            indiaUniqueIPs: indiaCity.reduce((sum, c) => sum + c.count, 0),
            dateRange: {
                startDate: start.toISOString(),
                endDate: end.toISOString()
            }
        });
    } catch (error) {
        console.error("Error getting geo analytics:", error);
        sendError(res, 500, "Failed to get geo analytics", error);
    }
};

module.exports = {
    trackEvent,
    trackEvents,
    getEventsByUser,
    getEventsByTournament,
    getEventStats,
    getAnalyticsDashboard,
    getAnalyticsBreakdown,
    getAuctionRoomAnalytics,
    listComparableAuctions,
    getAuctionTimeline,
    compareAuctions,
    getGeoAnalytics,
    recordHeartbeat,
    getActiveUsers
};
