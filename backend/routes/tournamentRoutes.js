const express = require('express');
const touranmentController = require('../controller/touranmentController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require('../utils/tournamentAccess');
const uploadMiddleware = require('../utils/uploadMiddleware');
const tournamentRouter = express.Router();

// Register New Tournament - Protected
tournamentRouter.post("/register", authMiddleware, touranmentController.addTournamnet);

// Get All Tournaments (filtered by role) - Public (for viewing)
tournamentRouter.post("/all", touranmentController.getAllTournaments);

// Get Individual Tournament Detail - Public (for viewing)
tournamentRouter.post("/detail", touranmentController.getTournamentDetail);

// Update Tournament - Protected
tournamentRouter.post("/update", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, touranmentController.updateTournament);

// Delete Tournament - Protected
tournamentRouter.post("/delete", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, touranmentController.deleteTournament);

// Get All Tournament Hosts (for boss and super_user) - Protected
tournamentRouter.get("/hosts", authMiddleware, touranmentController.getAllTournamentHosts);

// Export Tournament Data (teams and players) - Protected
tournamentRouter.post("/export", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, touranmentController.exportTournamentData);

// Get Public Registration Config - Public
tournamentRouter.get("/:id/registration-config", touranmentController.getRegistrationConfig);

// Update Registration Config - Protected
tournamentRouter.post("/update-registration-config", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, touranmentController.updateRegistrationConfig);

// Upload tournament image (poster / QR) to S3 - Protected
tournamentRouter.post("/upload-image", authMiddleware, uploadMiddleware.single('image'), touranmentController.uploadImage);

module.exports = tournamentRouter;