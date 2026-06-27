const express = require('express');
const whatsappController = require('../controller/whatsappController');
const whatsappRouter = express.Router();

// Send notification when player is sold
whatsappRouter.post("/notify-player-sold", whatsappController.notifyPlayerSold);

// Broadcast auction announcement to all players and team owners
whatsappRouter.post("/announce-auction", whatsappController.announceAuction);

// Get recipient count for announcement preview
whatsappRouter.post("/preview-recipients", whatsappController.previewRecipients);

// Test WhatsApp connection
whatsappRouter.post("/test", whatsappController.testWhatsApp);

module.exports = whatsappRouter;
