const express = require('express');
const playerCardController = require('../controller/playerCardController');
const playerCardRouter = express.Router();

// Public, read-only, and narrow: name, photo, category, team, price and
// tournament only. No auth, because the link is shared on purpose.
playerCardRouter.post("/", playerCardController.getCard);
playerCardRouter.get("/", playerCardController.getCard);

// Same-origin bytes for the card's images, so the PNG export is not tainted.
playerCardRouter.get("/image", playerCardController.getCardImage);

module.exports = playerCardRouter;
