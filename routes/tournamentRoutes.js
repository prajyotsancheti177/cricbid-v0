const express = require('express');
const touranmentController = require('../controller/touranmentController');
const { authMiddleware } = require('../utils/authMiddleware');
const tournamentRouter = express.Router();

// Register New Tournament - Protected
tournamentRouter.post("/register", authMiddleware, touranmentController.addTournamnet);

// Get All Tournaments (filtered by role) - Public (for viewing)
tournamentRouter.post("/all", touranmentController.getAllTournaments);

// Get Individual Tournament Detail - Public (for viewing)
tournamentRouter.post("/detail", touranmentController.getTournamentDetail);

// Update Tournament - Protected
tournamentRouter.post("/update", authMiddleware, touranmentController.updateTournament);

// Delete Tournament - Protected
tournamentRouter.post("/delete", authMiddleware, touranmentController.deleteTournament);

// Get All Tournament Hosts (for boss and super_user) - Protected
tournamentRouter.get("/hosts", authMiddleware, touranmentController.getAllTournamentHosts);

// Export Tournament Data (teams and players) - Protected
tournamentRouter.post("/export", authMiddleware, touranmentController.exportTournamentData);

// Get Public Registration Config - Public
tournamentRouter.get("/:id/registration-config", touranmentController.getRegistrationConfig);

// Update Registration Config - Protected
tournamentRouter.post("/update-registration-config", authMiddleware, touranmentController.updateRegistrationConfig);

module.exports = tournamentRouter;