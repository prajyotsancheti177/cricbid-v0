const express = require('express');
const playerController = require('../controller/playerController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess, requireTournamentVisible } = require('../utils/tournamentAccess');
const uploadMiddleware = require('../utils/uploadMiddleware');
const registrationErrors = require('../services/registrationErrorService');
const playerRouter = express.Router();

// Register New Player - Protected
playerRouter.post("/register", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.registerPlayer);

// Register New Player - Public (From customizable registration link)
// Multer's own errors (a file over the 10 MB limit, an S3 failure) never reach
// the controller, so they are caught here and recorded like any other refusal.
const registrationUpload = (req, res, next) => uploadMiddleware.any()(req, res, async (err) => {
    if (!err) return next();
    const code = registrationErrors.classify(err);
    const body = req.body || {};
    const errorId = await registrationErrors.record({
        req, code, message: err.message, httpStatus: 400,
        tournamentId: body.touranmentId || body.tournamentId, name: body.name, mobile: body.mobile,
        details: { multerCode: err.code || null, field: err.field || null },
    });
    return res.status(400).json({
        success: false,
        message: registrationErrors.friendlyMessage(code, { name: body.name, maxMb: 10 }),
        code, errorId, error: err.message,
    });
});

playerRouter.post("/register-public", requireTournamentVisible, registrationUpload, playerController.registerPlayerPublic);
// Public: failures the API never saw (nginx 413, network) reported by the form.
playerRouter.post("/registration-error", playerController.reportRegistrationError);

// Get All Player Details - Public (for viewing)
playerRouter.post("/all", requireTournamentVisible, playerController.allPlayerDetails);

// Get Individual Player Detail - Public (for viewing)
playerRouter.post("/detail", requireTournamentVisible, playerController.getPlayerDetail);

// Update Individual Player Details - Protected
playerRouter.post("/update", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.updatePlayer);

// Delete Player - Protected
playerRouter.post("/delete", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, playerController.deletePlayer);

// CricHeroes stats for a tournament's players - Public (for viewing)
playerRouter.get("/cricheroes-stats/:tournamentId", requireTournamentVisible, playerController.cricHeroesStats);

// Get All Player Categories - Public (for viewing)
playerRouter.post("/categories", requireTournamentVisible, playerController.getPlayerCategories);

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
playerRouter.post("/overlay-stats", requireTournamentVisible, playerController.getOverlayStats);

module.exports = playerRouter;
