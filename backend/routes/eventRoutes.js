const express = require('express');
const eventController = require('../controller/eventController');
const { authMiddleware } = require('../utils/authMiddleware');
const eventRouter = express.Router();

// Public routes - for tracking events (including anonymous users)
eventRouter.post("/track", eventController.trackEvent);
eventRouter.post("/track-batch", eventController.trackEvents);

// Protected routes - for viewing events (requires authentication)
eventRouter.get("/user/:userId", authMiddleware, eventController.getEventsByUser);
eventRouter.get("/tournament/:tournamentId", authMiddleware, eventController.getEventsByTournament);
eventRouter.get("/stats/:tournamentId", authMiddleware, eventController.getEventStats);
eventRouter.get("/analytics", authMiddleware, eventController.getAnalyticsDashboard);
eventRouter.get("/auction-room-analytics", authMiddleware, eventController.getAuctionRoomAnalytics);
eventRouter.get("/geo-analytics", authMiddleware, eventController.getGeoAnalytics);

module.exports = eventRouter;

