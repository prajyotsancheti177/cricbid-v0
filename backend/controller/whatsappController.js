const whatsappService = require("../services/whatsappService");
const prisma = require("../db/prisma");
const { sendSuccess, sendError } = require("../utils");

// ─── Config ────────────────────────────────────────────────────────────────────

const getConfig = async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const cfg = await whatsappService.getWhatsAppConfig(tournamentId);
    return sendSuccess(res, 200, "Config loaded", cfg);
  } catch (err) {
    return sendError(res, 500, "Failed to load config", err);
  }
};

const saveConfig = async (req, res) => {
  try {
    const { tournamentId, whatsappConfig } = req.body;
    if (!tournamentId || !whatsappConfig) return sendError(res, 400, "tournamentId and whatsappConfig required");
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { whatsappConfig },
    });
    return sendSuccess(res, 200, "Config saved");
  } catch (err) {
    return sendError(res, 500, "Failed to save config", err);
  }
};

// ─── Individual template triggers (manual / test) ──────────────────────────────

const notifyPlayerSold = async (req, res) => {
  try {
    const { name, mobile, teamName, amtSold, tournamentId, playerId } = req.body;
    if (!name || !mobile || !teamName) return sendError(res, 400, "name, mobile, teamName required");
    const result = await whatsappService.sendPlayerSoldNotification({ name, mobile, teamName, amtSold, tournamentId, playerId });
    return result
      ? sendSuccess(res, 200, "Sent", result)
      : sendError(res, 500, "Failed to send");
  } catch (err) {
    return sendError(res, 500, "Error", err);
  }
};

const notifyPlayerUnsold = async (req, res) => {
  try {
    const { name, mobile, tournamentId, playerId } = req.body;
    if (!name || !mobile) return sendError(res, 400, "name, mobile required");
    const result = await whatsappService.sendPlayerUnsoldNotification({ name, mobile, tournamentId, playerId });
    return result
      ? sendSuccess(res, 200, "Sent", result)
      : sendError(res, 500, "Failed to send");
  } catch (err) {
    return sendError(res, 500, "Error", err);
  }
};

const sendPostAuction = async (req, res) => {
  try {
    const { tournamentId, targets } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const results = {};
    if (!targets || targets.includes("players")) {
      results.players = await whatsappService.sendPostAuctionPlayerSummaries({ tournamentId });
    }
    if (!targets || targets.includes("owners")) {
      results.owners = await whatsappService.sendPostAuctionOwnerSummaries({ tournamentId });
    }
    return sendSuccess(res, 200, "Post-auction messages sent", results);
  } catch (err) {
    return sendError(res, 500, "Failed", err);
  }
};

const sendReminder = async (req, res) => {
  try {
    const { tournamentId, customMessage } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const result = await whatsappService.sendAuctionReminderBroadcast({ tournamentId, customMessage });
    return sendSuccess(res, 200, `Reminder sent to ${result.totalSent} recipients`, result);
  } catch (err) {
    return sendError(res, 500, "Failed", err);
  }
};

const announceAuction = sendReminder; // legacy alias

const previewRecipients = async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const result = await whatsappService.getAnnouncementRecipientCount({ tournamentId });
    return sendSuccess(res, 200, "Counts retrieved", result);
  } catch (err) {
    return sendError(res, 500, "Failed", err);
  }
};

// Get recent logs for a tournament
const getLogs = async (req, res) => {
  try {
    const { tournamentId, limit = 50 } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const logs = await prisma.whatsappLog.findMany({
      where: { tournamentId },
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });
    return sendSuccess(res, 200, "Logs retrieved", logs);
  } catch (err) {
    return sendError(res, 500, "Failed to fetch logs", err);
  }
};

const testWhatsApp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return sendError(res, 400, "mobile required");
    const result = await whatsappService.sendPlayerSoldNotification({
      name: "Test Player", mobile, teamName: "Test Team", amtSold: 10000,
    });
    return result
      ? sendSuccess(res, 200, "Test message sent", result)
      : sendError(res, 500, "Failed");
  } catch (err) {
    return sendError(res, 500, "Failed", err);
  }
};

module.exports = {
  getConfig, saveConfig,
  notifyPlayerSold, notifyPlayerUnsold,
  sendPostAuction, sendReminder,
  announceAuction, previewRecipients,
  getLogs, testWhatsApp,
};
