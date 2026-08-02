const express = require('express');
const siteSettingsController = require('../controller/siteSettingsController');
const { authMiddleware } = require('../utils/authMiddleware');
const siteSettingsRouter = express.Router();

// Public — every page (including unauthenticated ones) needs to know whether
// to mask female players' photos/contact numbers.
siteSettingsRouter.post("/get", siteSettingsController.getSettings);

// Protected — role check (boss/super_user only) happens in the service layer.
siteSettingsRouter.post("/update", authMiddleware, siteSettingsController.updateSettings);

module.exports = siteSettingsRouter;
