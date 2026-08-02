const siteSettingsService = require("../services/siteSettingsService");
const { sendSuccess, sendError } = require("../utils");

const getSettings = async (req, res) => {
    try {
        const settings = await siteSettingsService.getSiteSettings();
        return sendSuccess(res, 200, "Site settings fetched successfully", settings);
    } catch (error) {
        return sendError(res, 500, "Failed to fetch site settings", error);
    }
};

const updateSettings = async (req, res) => {
    try {
        const { userId, ...patch } = req.body;
        const settings = await siteSettingsService.updateSiteSettings(patch, userId);
        return sendSuccess(res, 200, "Site settings updated successfully", settings);
    } catch (error) {
        return sendError(res, 403, "Failed to update site settings", error);
    }
};

module.exports = { getSettings, updateSettings };
