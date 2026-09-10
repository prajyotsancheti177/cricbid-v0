const express = require('express');
const playerProfileController = require('../controller/playerProfileController');
const playerProfileAuthMiddleware = require('../utils/playerProfileAuthMiddleware');

const playerProfileRouter = express.Router();

// Public — no auth. There is no password login: Google now, WhatsApp OTP later.
playerProfileRouter.get("/auth-config", playerProfileController.authConfig);
playerProfileRouter.post("/google", playerProfileController.googleLogin);

// Protected — requires x-player-token header
playerProfileRouter.get("/me", playerProfileAuthMiddleware, playerProfileController.getMe);
playerProfileRouter.post("/logout", playerProfileAuthMiddleware, playerProfileController.logoutProfile);

// The players an account owns — a parent may have several.
playerProfileRouter.get("/profiles", playerProfileAuthMiddleware, playerProfileController.listProfiles);
playerProfileRouter.post("/profiles", playerProfileAuthMiddleware, playerProfileController.createProfile);
playerProfileRouter.put("/profiles/:profileId", playerProfileAuthMiddleware, playerProfileController.updateProfile);
playerProfileRouter.delete("/profiles/:profileId", playerProfileAuthMiddleware, playerProfileController.deleteProfile);

module.exports = playerProfileRouter;
