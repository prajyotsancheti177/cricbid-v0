const express = require('express');
const playerController = require('../controller/playerController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const playerRouter = express.Router();

// Register New Player - Protected
playerRouter.post("/register", authMiddleware, playerController.registerPlayer);

// Get All Player Details - Public (for viewing)
playerRouter.post("/all", playerController.allPlayerDetails);

// Get Individual Player Detail - Public (for viewing)
playerRouter.post("/detail", playerController.getPlayerDetail);

// Update Individual Player Details - Protected
playerRouter.post("/update", authMiddleware, playerController.updatePlayer);

// Delete Player - Protected
playerRouter.post("/delete", authMiddleware, playerController.deletePlayer);

// Get All Player Categories - Public (for viewing)
playerRouter.post("/categories", playerController.getPlayerCategories);

// Bulk Create Players - Protected
playerRouter.post("/bulk-create", authMiddleware, playerController.bulkCreatePlayers);

// Reset Unsold Players - Protected (Admin and Tournament Host)
playerRouter.post("/reset-unsold", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), playerController.resetUnsoldPlayers);

// Bulk Update Existing Players - Protected
playerRouter.post("/bulk-update", authMiddleware, playerController.bulkUpdatePlayers);

// Delete All Players for a Tournament - Protected
playerRouter.post("/delete-all", authMiddleware, playerController.deleteAllPlayers);

module.exports = playerRouter;
