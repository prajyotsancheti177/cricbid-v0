const playerProfileService = require("../services/playerProfileService");
const config = require("../config");
const { sendSuccess, sendError } = require("../utils");

/** POST /api/player-profile/google — sign in with a Google ID token. */
const googleLogin = async (req, res) => {
    try {
        const result = await playerProfileService.loginWithGoogle(req.body?.credential);
        return sendSuccess(res, 200, "Signed in with Google", result);
    } catch (error) {
        return sendError(res, 401, error.message || "Google sign-in failed", error);
    }
}

/** Which sign-in methods are available, so the UI can render only those. */
const authConfig = async (_req, res) => {
    return sendSuccess(res, 200, "Auth config", {
        googleClientId: config.googleClientId,
        googleEnabled: Boolean(config.googleClientId),
        // Reserved for the WhatsApp OTP path; false until it ships.
        otpEnabled: false,
    });
}

/** GET /me — the signed-in account and every player it owns. */
const getMe = async (req, res) => {
    return sendSuccess(res, 200, "Account fetched", req.playerAccount);
}

/** GET /profiles */
const listProfiles = async (req, res) => {
    try {
        const profiles = await playerProfileService.listProfiles(req.playerAccount.id);
        return sendSuccess(res, 200, "Players fetched", profiles);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not fetch players", error);
    }
}

/** POST /profiles — add another player to this account. */
const createProfile = async (req, res) => {
    try {
        const profile = await playerProfileService.createProfile(req.playerAccount.id, req.body);
        return sendSuccess(res, 201, "Player added", profile);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not add that player", error);
    }
}

/** PUT /profiles/:profileId */
const updateProfile = async (req, res) => {
    try {
        const profile = await playerProfileService.updateProfile(
            req.playerAccount.id, req.params.profileId, req.body
        );
        return sendSuccess(res, 200, "Player updated", profile);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not update that player", error);
    }
}

/** DELETE /profiles/:profileId */
const deleteProfile = async (req, res) => {
    try {
        await playerProfileService.deleteProfile(req.playerAccount.id, req.params.profileId);
        return sendSuccess(res, 200, "Player removed", null);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not remove that player", error);
    }
}

const logoutProfile = async (req, res) => {
    try {
        await playerProfileService.logoutAccount(req.playerAccount.id);
        return sendSuccess(res, 200, "Signed out", null);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not sign out", error);
    }
}

module.exports = {
    googleLogin,
    authConfig,
    getMe,
    listProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    logoutProfile,
};
