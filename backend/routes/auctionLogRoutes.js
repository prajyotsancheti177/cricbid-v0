const express = require('express');
const auctionLogController = require('../controller/auctionLogController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const auctionLogRouter = express.Router();

// Protected routes - all auction log operations require authentication
auctionLogRouter.post("/save", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), auctionLogController.saveAuctionLog);
auctionLogRouter.get("/tournament/:tournamentId", authMiddleware, auctionLogController.getAuctionLogsByTournament);
auctionLogRouter.get("/player/:playerId", authMiddleware, auctionLogController.getAuctionLogByPlayer);
auctionLogRouter.get("/stats/:tournamentId", authMiddleware, auctionLogController.getAuctionStats);
auctionLogRouter.get("/top-teams/:tournamentId", authMiddleware, auctionLogController.getTopBiddingTeams);

module.exports = auctionLogRouter;
