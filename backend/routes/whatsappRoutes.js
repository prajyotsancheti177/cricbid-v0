const express = require('express');
const c = require('../controller/whatsappController');
const whatsappRouter = express.Router();

// Config
whatsappRouter.post("/config/get",  c.getConfig);
whatsappRouter.post("/config/save", c.saveConfig);

// Individual message triggers
whatsappRouter.post("/notify-player-sold",   c.notifyPlayerSold);
whatsappRouter.post("/notify-player-unsold", c.notifyPlayerUnsold);

// Bulk actions
whatsappRouter.post("/send-post-auction", c.sendPostAuction);
whatsappRouter.post("/send-reminder",     c.sendReminder);

// Logs
whatsappRouter.post("/logs",              c.getLogs);

// Incoming messages
whatsappRouter.get("/incoming/webhook",   c.incomingWebhookVerify);
whatsappRouter.post("/incoming/webhook",  c.incomingWebhook);
whatsappRouter.post("/incoming/list",     c.getIncoming);
whatsappRouter.post("/incoming/mark-read", c.markIncomingRead);

// Legacy
whatsappRouter.post("/announce-auction",  c.announceAuction);
whatsappRouter.post("/preview-recipients",c.previewRecipients);
whatsappRouter.post("/test",              c.testWhatsApp);

module.exports = whatsappRouter;
