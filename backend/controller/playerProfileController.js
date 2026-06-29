const playerProfileService = require("../services/playerProfileService");
const { sendSuccess, sendError } = require("../utils");

const lookupProfile = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return sendError(res, 400, "Mobile number is required");

        const profile = await playerProfileService.lookupProfile(mobile);
        if (!profile) {
            return sendSuccess(res, 200, "No profile found", { found: false, profile: null });
        }
        return sendSuccess(res, 200, "Profile found", { found: true, profile });
    } catch (error) {
        return sendError(res, 400, "Failed to look up profile", error);
    }
};

module.exports = { lookupProfile };
