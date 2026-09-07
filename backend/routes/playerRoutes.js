const express = require('express');
const playerController = require('../controller/playerController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const uploadMiddleware = require('../utils/uploadMiddleware');
const playerRouter = express.Router();

// Register New Player - Protected
playerRouter.post("/register", authMiddleware, playerController.registerPlayer);

// Register New Player - Public (From customizable registration link)
playerRouter.post("/register-public", uploadMiddleware.any(), playerController.registerPlayerPublic);

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

// Payment verification — gates a registered player's entry into the auction
playerRouter.post("/verify-payments", authMiddleware, playerController.verifyPayments);

// NOTE: sheet -> database sync was removed on 2026-09-08. Matching sheet rows
// back to players proved unreliable (duplicate headers, renamed columns, ids
// that drifted) and it silently overwrote good data. The player sheet in Manage
// Tournament is the editing surface now. The export below is unaffected.

// Push DB to Sheet - Protected
playerRouter.post("/sync-to-sheet", authMiddleware, playerController.syncToSheet);

// Get Overlay Stats - Public (for overlay marquee and top players)
playerRouter.post("/overlay-stats", playerController.getOverlayStats);

module.exports = playerRouter;
