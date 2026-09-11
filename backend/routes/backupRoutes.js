const express = require("express");
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require('../utils/tournamentAccess');
const { createBackup, listBackups, restoreBackup, deleteBackup } = require("../controller/backupController");

/**
 * Tournament backups — admin-only, and scoped to the tournament.
 *
 * These were reachable with no authentication whatsoever. `/restore` overwrites
 * a tournament's live data from a snapshot, and `/delete` destroys one, so a
 * stranger who knew a tournament id could roll an event back mid-auction.
 * `/list` also disclosed what snapshots existed.
 */
const managing = [authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess];

router.post("/create", managing, createBackup);
router.post("/list", managing, listBackups);
router.post("/restore", managing, restoreBackup);
router.post("/delete", managing, deleteBackup);

module.exports = router;
