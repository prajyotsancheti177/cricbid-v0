const express = require("express");
const router = express.Router();
const { createBackup, listBackups, restoreBackup, deleteBackup } = require("../controller/backupController");

router.post("/create", createBackup);
router.post("/list", listBackups);
router.post("/restore", restoreBackup);
router.post("/delete", deleteBackup);

module.exports = router;
