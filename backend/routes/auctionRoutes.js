const express = require('express');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const auctionController = require('../controller/auctionController');
const auctionRouter = express.Router();

// Get new player for auction (Next Auction Player)
auctionRouter.post("/next-player", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), auctionController.nextAuctionPlayer);

// Get All Player Categories (for auction filtering)
auctionRouter.post("/player-categories", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), auctionController.playerCategories);

module.exports = auctionRouter;
