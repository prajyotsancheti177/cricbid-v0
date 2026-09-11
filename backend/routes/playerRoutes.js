const express = require('express');
const playerController = require('../controller/playerController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require('../utils/tournamentAccess');
const uploadMiddleware = require('../utils/uploadMiddleware');
const playerRouter = express.Router();

// Register New Player - Protected
playerRouter.post("/register", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.registerPlayer);

// Register New Player - Public (From customizable registration link)
playerRouter.post("/register-public", uploadMiddleware.any(), playerController.registerPlayerPublic);

// Get All Player Details - Public (for viewing)
playerRouter.post("/all", playerController.allPlayerDetails);

// Get Individual Player Detail - Public (for viewing)
playerRouter.post("/detail", playerController.getPlayerDetail);

// Update Individual Player Details - Protected
playerRouter.post("/update", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.updatePlayer);

// Delete Player - Protected
playerRouter.post("/delete", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.deletePlayer);

// CricHeroes stats for a tournament's players - Public (for viewing)
playerRouter.get("/cricheroes-stats/:tournamentId", playerController.cricHeroesStats);

// Get All Player Categories - Public (for viewing)
playerRouter.post("/categories", playerController.getPlayerCategories);

// Bulk Create Players - Protected
playerRouter.post("/bulk-create", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.bulkCreatePlayers);

// Reset Unsold Players - Protected (Admin and Tournament Host)
playerRouter.post("/reset-unsold", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), playerController.resetUnsoldPlayers);

// Bulk Update Existing Players - Protected
playerRouter.post("/bulk-update", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.bulkUpdatePlayers);

// Delete All Players for a Tournament - Protected
playerRouter.post("/delete-all", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.deleteAllPlayers);

// Payment verification — gates a registered player's entry into the auction
playerRouter.post("/verify-payments", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.verifyPayments);

// Close gaps in the auction serial numbers (pass preview:true to dry-run)
playerRouter.post("/resequence-serials", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.resequenceSerials);

// Edit history and undo
playerRouter.post("/history", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), playerController.getPlayerHistory);
playerRouter.post("/undo", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), playerController.undoPlayerChanges);

// NOTE: sheet -> database sync was removed on 2026-09-08. Matching sheet rows
// back to players proved unreliable (duplicate headers, renamed columns, ids
// that drifted) and it silently overwrote good data. The player sheet in Manage
// Tournament is the editing surface now. The export below is unaffected.

// Push DB to Sheet - Protected
playerRouter.post("/sync-to-sheet", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.syncToSheet);

// Get Overlay Stats - Public (for overlay marquee and top players)
playerRouter.post("/overlay-stats", playerController.getOverlayStats);

module.exports = playerRouter;
