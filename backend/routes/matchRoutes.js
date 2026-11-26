const express = require("express");
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireVisible } = require('../utils/requireVisible');
const { requireTournamentAccess } = require("../utils/tournamentAccess");
const c = require("../controller/matchController");
const matchRouter = express.Router();

matchRouter.post("/list",           c.getMatches);
matchRouter.post("/detail",         c.getMatch);
matchRouter.post("/create",         authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.schedule"), requireTournamentAccess, c.createMatch);
matchRouter.post("/update",         authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.schedule"), requireTournamentAccess, c.updateMatch);
matchRouter.post("/delete",         authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.schedule"), requireTournamentAccess, c.deleteMatch);
matchRouter.post("/innings/save",   authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.schedule"), requireTournamentAccess, c.saveInnings);
matchRouter.post("/complete",       authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.schedule"), requireTournamentAccess, c.completeMatch);
matchRouter.post("/points-table",   c.getPointsTable);
matchRouter.post("/bulk-create",    authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireVisible("page.workspace.schedule"), requireTournamentAccess, c.bulkCreateMatches);

module.exports = matchRouter;
