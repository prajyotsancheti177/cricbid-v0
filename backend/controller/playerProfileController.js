const playerProfileService = require("../services/playerProfileService");
const { sendSuccess, sendError } = require("../utils");

const registerProfile = async (req, res) => {
    try {
        const { mobile, password, name, age, gender, skill, email, address } = req.body;
        const profile = await playerProfileService.registerProfile({ mobile, password, name, age, gender, skill, email, address });
        const { password: _p, sessionToken: _t, ...safe } = profile;
        return sendSuccess(res, 201, "Profile created successfully!", safe);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to create profile", error);
    }
};

const loginProfile = async (req, res) => {
    try {
        const { mobile, password } = req.body;
        const result = await playerProfileService.loginProfile({ mobile, password });
        return sendSuccess(res, 200, "Login successful!", result);
    } catch (error) {
        return sendError(res, 401, error.message || "Login failed", error);
    }
};

const getMe = async (req, res) => {
    try {
        return sendSuccess(res, 200, "Profile fetched successfully!", req.playerProfile);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch profile", error);
    }
};

const updateMe = async (req, res) => {
    try {
        const updated = await playerProfileService.updateProfile(req.playerProfile.id, req.body);
        return sendSuccess(res, 200, "Profile updated successfully!", updated);
    } catch (error) {
        return sendError(res, 400, "Failed to update profile", error);
    }
};

const logoutProfile = async (req, res) => {
    try {
        await playerProfileService.logoutProfile(req.playerProfile.id);
        return sendSuccess(res, 200, "Logged out successfully");
    } catch (error) {
        return sendError(res, 400, "Failed to logout", error);
    }
};

const lookupProfile = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return sendError(res, 400, "Mobile number is required");
        const profile = await playerProfileService.lookupProfile(mobile);
        if (!profile) return sendSuccess(res, 200, "No profile found", { found: false, profile: null });
        return sendSuccess(res, 200, "Profile found", { found: true, profile });
    } catch (error) {
        return sendError(res, 400, "Failed to look up profile", error);
    }
};

module.exports = { registerProfile, loginProfile, getMe, updateMe, logoutProfile, lookupProfile };
