const express = require('express');
const teamController = require('../controller/teamController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireVisible } = require('../utils/requireVisible');
const { requireTournamentAccess, requireTournamentVisible } = require('../utils/tournamentAccess');
const uploadMiddleware = require('../utils/uploadMiddleware');
const teamRouter = express.Router();

// Register New Team - Public (for public team registration form)
teamRouter.post("/register-public", uploadMiddleware.any(), requireTournamentVisible, teamController.registerTeamPublic);

// Register New Team - Protected
teamRouter.post("/register", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, teamController.addTeam);

// Get All Team Details - Public (for viewing)
teamRouter.post("/all", requireTournamentVisible, teamController.getTournamentTeamsReport);

// Get Individual Team Detail - Public (for viewing)
teamRouter.post("/detail", requireTournamentVisible, teamController.getTeamReport);

// Update Individual Team - Protected (multipart: uploadMiddleware must run
// before authMiddleware, since only multer populates req.body for multipart requests)
teamRouter.post("/update", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), uploadMiddleware.any(), requireTournamentAccess, teamController.updateTeam);

// Delete Individual Team - Protected
teamRouter.post("/delete", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, teamController.deleteTeam);

// Top up a team's auction balance - Protected
teamRouter.post("/topup-budget", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.topUp"), requireTournamentAccess, teamController.topUpTeamBudget);

// Team budget top-up history for a tournament - Protected
teamRouter.post("/topup-history", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.topUp"), requireTournamentAccess, teamController.getTeamBudgetTopups);

// Delete a team budget top-up entry - Protected
teamRouter.post("/topup-delete", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.topUp"), requireTournamentAccess, teamController.deleteTeamBudgetTopup);

// Get All Team Names - Public (for viewing)
teamRouter.post("/names", requireTournamentVisible, teamController.getTeamNames);

// Get All Team Names and Budget - Public (for viewing)
teamRouter.post("/names-budget", requireTournamentVisible, teamController.getTeamNamesAndBudget);

// Bulk Create Teams - Protected
teamRouter.post("/bulk-create", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible(["page.workspace.bulkUpload", "page.bulkUpload"]), requireTournamentAccess, teamController.bulkCreateTeams);

// Delete All Teams for a Tournament - Protected
teamRouter.post("/delete-all", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("action.bulkDelete"), requireTournamentAccess, teamController.deleteAllTeams);

module.exports = teamRouter;