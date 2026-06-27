const express = require('express');
const auctionController = require('../controller/auctionController');
const auctionRouter = express.Router();

// Get new player for auction (Next Auction Player)
auctionRouter.post("/next-player", auctionController.nextAuctionPlayer);

// Get All Player Categories (for auction filtering)
auctionRouter.post("/player-categories", auctionController.playerCategories);

module.exports = auctionRouter;
