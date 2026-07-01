const express = require("express");
const c = require("../controller/matchController");
const matchRouter = express.Router();

matchRouter.post("/list",           c.getMatches);
matchRouter.post("/detail",         c.getMatch);
matchRouter.post("/create",         c.createMatch);
matchRouter.post("/update",         c.updateMatch);
matchRouter.post("/delete",         c.deleteMatch);
matchRouter.post("/innings/save",   c.saveInnings);
matchRouter.post("/complete",       c.completeMatch);
matchRouter.post("/points-table",   c.getPointsTable);
matchRouter.post("/bulk-create",    c.bulkCreateMatches);

module.exports = matchRouter;
