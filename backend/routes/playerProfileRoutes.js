const express = require('express');
const playerProfileController = require('../controller/playerProfileController');
const playerProfileAuthMiddleware = require('../utils/playerProfileAuthMiddleware');

const playerProfileRouter = express.Router();

// Public — no auth
playerProfileRouter.post("/register", playerProfileController.registerProfile);
playerProfileRouter.post("/login", playerProfileController.loginProfile);
playerProfileRouter.post("/lookup", playerProfileController.lookupProfile);

// Protected — requires x-player-token header
playerProfileRouter.get("/me", playerProfileAuthMiddleware, playerProfileController.getMe);
playerProfileRouter.put("/me", playerProfileAuthMiddleware, playerProfileController.updateMe);
playerProfileRouter.post("/logout", playerProfileAuthMiddleware, playerProfileController.logoutProfile);

module.exports = playerProfileRouter;
