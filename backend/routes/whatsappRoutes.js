const express = require('express');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireTournamentAccess } = require('../utils/tournamentAccess');
const c = require('../controller/whatsappController');
const whatsappRouter = express.Router();

// Config
whatsappRouter.post("/config/get",  authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.getConfig);
whatsappRouter.post("/config/save", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.saveConfig);

// Individual message triggers
whatsappRouter.post("/notify-player-sold",   authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.notifyPlayerSold);
whatsappRouter.post("/notify-player-unsold", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.notifyPlayerUnsold);

// Bulk actions
whatsappRouter.post("/send-post-auction", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.sendPostAuction);
whatsappRouter.post("/send-reminder",     authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.sendReminder);

// Logs
whatsappRouter.post("/logs",              authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.getLogs);

// Incoming messages
whatsappRouter.get("/incoming/webhook",   c.incomingWebhookVerify);
whatsappRouter.post("/incoming/webhook",  c.incomingWebhook);
whatsappRouter.post("/incoming/list",     authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.getIncoming);
whatsappRouter.post("/incoming/mark-read", authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.markIncomingRead);

// Legacy
whatsappRouter.post("/announce-auction",  authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.announceAuction);
whatsappRouter.post("/preview-recipients",authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.previewRecipients);
whatsappRouter.post("/test",              authMiddleware, roleMiddleware(['boss', 'super_user', 'tournament_host']), requireTournamentAccess, c.testWhatsApp);

module.exports = whatsappRouter;
