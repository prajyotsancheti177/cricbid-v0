const express = require("express");
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require("../utils/tournamentAccess");
const c = require("../controller/scoringController");
const scoringRouter = express.Router();

scoringRouter.post("/start-innings",  authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.startInnings);
scoringRouter.post("/ball",           authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.recordBall);
scoringRouter.post("/undo",           authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.undoLastBall);
scoringRouter.post("/add-batsman",    authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.addBatsman);
scoringRouter.post("/set-bowler",     authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.setBowler);
scoringRouter.post("/live",           c.getLiveState);
scoringRouter.post("/scorecard",      c.getScorecard);
scoringRouter.post("/stats",          c.getTournamentStats);
scoringRouter.post("/commentary",     authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.getCommentary);

module.exports = scoringRouter;
