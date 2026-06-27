const express = require('express');
const teamController = require('../controller/teamController');
const { authMiddleware } = require('../utils/authMiddleware');
const teamRouter = express.Router();

// Register New Team - Protected
teamRouter.post("/register", authMiddleware, teamController.addTeam);

// Get All Team Details - Public (for viewing)
teamRouter.post("/all", teamController.getTournamentTeamsReport);

// Get Individual Team Detail - Public (for viewing)
teamRouter.post("/detail", teamController.getTeamReport);

// Update Individual Team - Protected
teamRouter.post("/update", authMiddleware, teamController.updateTeam);

// Get All Team Names - Public (for viewing)
teamRouter.post("/names", teamController.getTeamNames);

// Get All Team Names and Budget - Public (for viewing)
teamRouter.post("/names-budget", teamController.getTeamNamesAndBudget);

// Bulk Create Teams - Protected
teamRouter.post("/bulk-create", authMiddleware, teamController.bulkCreateTeams);

// Delete All Teams for a Tournament - Protected
teamRouter.post("/delete-all", authMiddleware, teamController.deleteAllTeams);

module.exports = teamRouter;