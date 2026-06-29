const playerProfileService = require("../services/playerProfileService");
const { sendError } = require("./index");

const playerProfileAuthMiddleware = async (req, res, next) => {
    const token = req.headers["x-player-token"] || req.body?.playerToken;
    if (!token) return sendError(res, 401, "Authentication required. Please login.");

    const profile = await playerProfileService.getProfileByToken(token);
    if (!profile) return sendError(res, 401, "Invalid or expired session. Please login again.");

    req.playerProfile = profile;
    next();
};

module.exports = playerProfileAuthMiddleware;
