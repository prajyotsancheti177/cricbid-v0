const backupService = require("../services/backupService");
const { sendSuccess, sendError } = require("../utils");

const createBackup = async (req, res) => {
    try {
        const { tournamentId, userId, userRole, label } = req.body;
        const backup = await backupService.createBackup(tournamentId, userId, userRole, label);
        return sendSuccess(res, 201, "Backup created", backup);
    } catch (error) {
        return sendError(res, 400, "Failed to create backup", error);
    }
};

const listBackups = async (req, res) => {
    try {
        const { tournamentId, userId, userRole } = req.body;
        const backups = await backupService.listBackups(tournamentId, userId, userRole);
        return sendSuccess(res, 200, "Backups fetched", backups);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch backups", error);
    }
};

const restoreBackup = async (req, res) => {
    try {
        const { backupId, tournamentId, userId, userRole } = req.body;
        const result = await backupService.restoreBackup(backupId, tournamentId, userId, userRole);
        return sendSuccess(res, 200, "Backup restored successfully", result);
    } catch (error) {
        return sendError(res, 400, "Failed to restore backup", error);
    }
};

const deleteBackup = async (req, res) => {
    try {
        const { backupId, tournamentId, userId, userRole } = req.body;
        const result = await backupService.deleteBackup(backupId, tournamentId, userId, userRole);
        return sendSuccess(res, 200, "Backup deleted", result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete backup", error);
    }
};

module.exports = { createBackup, listBackups, restoreBackup, deleteBackup };
