const express = require("express");
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const c = require("../controller/matchController");
const matchRouter = express.Router();

matchRouter.post("/list",           c.getMatches);
matchRouter.post("/detail",         c.getMatch);
matchRouter.post("/create",         authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), c.createMatch);
matchRouter.post("/update",         authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), c.updateMatch);
matchRouter.post("/delete",         authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), c.deleteMatch);
matchRouter.post("/innings/save",   authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), c.saveInnings);
matchRouter.post("/complete",       authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), c.completeMatch);
matchRouter.post("/points-table",   c.getPointsTable);
matchRouter.post("/bulk-create",    authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), c.bulkCreateMatches);

module.exports = matchRouter;
