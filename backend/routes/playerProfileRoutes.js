const express = require('express');
const playerProfileController = require('../controller/playerProfileController');

const playerProfileRouter = express.Router();

// Lookup player profile by mobile — public, no auth required
playerProfileRouter.post("/lookup", playerProfileController.lookupProfile);

module.exports = playerProfileRouter;
