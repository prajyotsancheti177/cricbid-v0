const express = require('express');
const siteSettingsController = require('../controller/siteSettingsController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const siteSettingsRouter = express.Router();

// Public — every page (including unauthenticated ones) needs to know whether
// to mask female players' photos/contact numbers.
siteSettingsRouter.post("/get", siteSettingsController.getSettings);

// Protected — gated here as well as in the service layer.
siteSettingsRouter.post("/update", authMiddleware, roleMiddleware(['boss', 'super_user']), siteSettingsController.updateSettings);

module.exports = siteSettingsRouter;
