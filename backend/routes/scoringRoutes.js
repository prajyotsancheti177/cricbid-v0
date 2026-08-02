const express = require("express");
const c = require("../controller/scoringController");
const scoringRouter = express.Router();

scoringRouter.post("/start-innings",  c.startInnings);
scoringRouter.post("/ball",           c.recordBall);
scoringRouter.post("/undo",           c.undoLastBall);
scoringRouter.post("/add-batsman",    c.addBatsman);
scoringRouter.post("/set-bowler",     c.setBowler);
scoringRouter.post("/live",           c.getLiveState);
scoringRouter.post("/scorecard",      c.getScorecard);
scoringRouter.post("/stats",          c.getTournamentStats);
scoringRouter.post("/commentary",     c.getCommentary);

module.exports = scoringRouter;
