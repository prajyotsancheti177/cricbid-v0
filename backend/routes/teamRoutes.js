const express = require('express');
const teamController = require('../controller/teamController');
const { authMiddleware } = require('../utils/authMiddleware');
const uploadMiddleware = require('../utils/uploadMiddleware');
const teamRouter = express.Router();

// Register New Team - Public (for public team registration form)
teamRouter.post("/register-public", uploadMiddleware.any(), teamController.registerTeamPublic);

// Register New Team - Protected
teamRouter.post("/register", authMiddleware, teamController.addTeam);

// Get All Team Details - Public (for viewing)
teamRouter.post("/all", teamController.getTournamentTeamsReport);

// Get Individual Team Detail - Public (for viewing)
teamRouter.post("/detail", teamController.getTeamReport);

// Update Individual Team - Protected (multipart: uploadMiddleware must run
// before authMiddleware, since only multer populates req.body for multipart requests)
teamRouter.post("/update", uploadMiddleware.any(), authMiddleware, teamController.updateTeam);

// Delete Individual Team - Protected
teamRouter.post("/delete", authMiddleware, teamController.deleteTeam);

// Top up a team's auction balance - Protected
teamRouter.post("/topup-budget", authMiddleware, teamController.topUpTeamBudget);

// Team budget top-up history for a tournament - Protected
teamRouter.post("/topup-history", authMiddleware, teamController.getTeamBudgetTopups);

// Delete a team budget top-up entry - Protected
teamRouter.post("/topup-delete", authMiddleware, teamController.deleteTeamBudgetTopup);

// Get All Team Names - Public (for viewing)
teamRouter.post("/names", teamController.getTeamNames);

// Get All Team Names and Budget - Public (for viewing)
teamRouter.post("/names-budget", teamController.getTeamNamesAndBudget);

// Bulk Create Teams - Protected
teamRouter.post("/bulk-create", authMiddleware, teamController.bulkCreateTeams);

// Delete All Teams for a Tournament - Protected
teamRouter.post("/delete-all", authMiddleware, teamController.deleteAllTeams);

module.exports = teamRouter;