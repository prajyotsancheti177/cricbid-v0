const eventService = require("../services/eventService");
const auctionRoomSessionService = require("../services/auctionRoomSessionService");
const geoService = require("../services/geoService");
const { sendSuccess, sendError } = require("../utils");

/**
 * Track a single user event
 */
const trackEvent = async (req, res) => {
    try {
        const eventData = {
            ...req.body,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent']
        };

        const event = await eventService.trackEvent(eventData);
        sendSuccess(res, 201, "Event tracked successfully", { eventId: event._id });
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

        // Add IP and user agent to all events
        const enrichedEvents = events.map(event => ({
            ...event,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent']
        }));

        const result = await eventService.trackEvents(enrichedEvents);
        sendSuccess(res, 201, "Events tracked successfully", { count: result.length });
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
        const { startDate, endDate } = req.query;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Ensure end date includes the full day
        end.setHours(23, 59, 59, 999);

        // Import whatsappLogService here to avoid circular dependency
        const whatsappLogService = require("../services/whatsappLogService");

        const [daily, monthly, pageTraffic, summary, whatsappDaily, whatsappSummary, whatsappTypes] = await Promise.all([
            eventService.getDailyPageViews(start, end),
            eventService.getMonthlyPageViews(start, end),
            eventService.getPageTrafficBreakdown(start, end),
            eventService.getAnalyticsSummary(start, end),
            whatsappLogService.getDailyWhatsAppStats(start, end),
            whatsappLogService.getWhatsAppSummary(start, end),
            whatsappLogService.getMessageTypeBreakdown(start, end)
        ]);

        sendSuccess(res, 200, "Analytics data retrieved successfully", {
            daily,
            monthly,
            pageTraffic,
            summary,
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
    getAuctionRoomAnalytics,
    getGeoAnalytics
};
