const express = require('express');
const controller = require('../controller/cricHeroesController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require('../utils/tournamentAccess');

const cricHeroesRouter = express.Router();

/**
 * Reviewing and confirming CricHeroes matches.
 *
 * Every route is for whoever runs the tournament: these decide which stranger
 * on a public site a player is said to be, and the sync treats a confirmed
 * match as final. requireTournamentAccess on each, so a host cannot resolve
 * matches in somebody else's tournament.
 *
 * Reading the resulting stats is separate and public —
 * GET /api/player/cricheroes-stats/:tournamentId, behind the tournament's own
 * visibility — because the overlays and the auction screen need it.
 */
const host = [authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess];

cricHeroesRouter.post("/review", ...host, controller.review);
cricHeroesRouter.post("/resolve", ...host, controller.resolve);
cricHeroesRouter.post("/sync", ...host, controller.sync);

module.exports = cricHeroesRouter;
