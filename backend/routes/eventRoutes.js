const express = require('express');
const eventController = require('../controller/eventController');
const { authMiddleware } = require('../utils/authMiddleware');
const eventRouter = express.Router();

// Public routes - for tracking events (including anonymous users)
eventRouter.post("/track", eventController.trackEvent);
eventRouter.post("/track-batch", eventController.trackEvents);
eventRouter.post("/heartbeat", eventController.recordHeartbeat);

// Protected routes - for viewing events (requires authentication)
eventRouter.get("/user/:userId", authMiddleware, eventController.getEventsByUser);
eventRouter.get("/tournament/:tournamentId", authMiddleware, eventController.getEventsByTournament);
eventRouter.get("/stats/:tournamentId", authMiddleware, eventController.getEventStats);
eventRouter.get("/analytics", authMiddleware, eventController.getAnalyticsDashboard);
eventRouter.get("/analytics/breakdown", authMiddleware, eventController.getAnalyticsBreakdown);
eventRouter.get("/active-users", authMiddleware, eventController.getActiveUsers);
eventRouter.get("/auction-room-analytics", authMiddleware, eventController.getAuctionRoomAnalytics);
eventRouter.get("/auctions", authMiddleware, eventController.listComparableAuctions);
eventRouter.get("/auctions/compare", authMiddleware, eventController.compareAuctions);
eventRouter.get("/auctions/:sessionId/timeline", authMiddleware, eventController.getAuctionTimeline);
eventRouter.get("/geo-analytics", authMiddleware, eventController.getGeoAnalytics);

module.exports = eventRouter;

