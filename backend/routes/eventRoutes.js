const express = require('express');
const eventController = require('../controller/eventController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const eventRouter = express.Router();

// Public routes - for tracking events (including anonymous users)
eventRouter.post("/track", eventController.trackEvent);
eventRouter.post("/track-batch", eventController.trackEvents);
eventRouter.post("/heartbeat", eventController.recordHeartbeat);

// Reading events is admin-only. Being signed in is not enough — everyone who
// signs in with Google is a `player`, and site analytics is not theirs to see.
const adminOnly = [authMiddleware, roleMiddleware(['boss', 'super_user'])];
eventRouter.get("/user/:userId", adminOnly, eventController.getEventsByUser);
eventRouter.get("/tournament/:tournamentId", adminOnly, eventController.getEventsByTournament);
eventRouter.get("/stats/:tournamentId", adminOnly, eventController.getEventStats);
eventRouter.get("/analytics", adminOnly, eventController.getAnalyticsDashboard);
eventRouter.get("/analytics/breakdown", adminOnly, eventController.getAnalyticsBreakdown);
eventRouter.get("/active-users", adminOnly, eventController.getActiveUsers);
eventRouter.get("/auction-room-analytics", adminOnly, eventController.getAuctionRoomAnalytics);
eventRouter.get("/auctions", adminOnly, eventController.listComparableAuctions);
eventRouter.get("/auctions/compare", adminOnly, eventController.compareAuctions);
eventRouter.get("/auctions/:sessionId/timeline", adminOnly, eventController.getAuctionTimeline);
eventRouter.get("/geo-analytics", adminOnly, eventController.getGeoAnalytics);

module.exports = eventRouter;

