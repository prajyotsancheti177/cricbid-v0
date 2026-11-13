const express = require('express');
const plannerController = require('../controller/plannerController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require('../utils/tournamentAccess');
const plannerRouter = express.Router();

// Owner-facing: authorised by the per-team planner token in the body. These
// read Team/Player/Tournament and write only the planner's own rows — there is
// no path from here into auction state.
plannerRouter.post("/board", plannerController.getBoard);
plannerRouter.post("/pick", plannerController.addPick);
plannerRouter.post("/pick-amount", plannerController.setPickAmount);
plannerRouter.post("/pick-remove", plannerController.removePick);
plannerRouter.post("/reorder", plannerController.reorderCategory);

// Host-facing: hands out and rotates the per-team links.
plannerRouter.post("/links", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, plannerController.getLinks);
plannerRouter.post("/link-reset", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), plannerController.resetLink);

module.exports = plannerRouter;
