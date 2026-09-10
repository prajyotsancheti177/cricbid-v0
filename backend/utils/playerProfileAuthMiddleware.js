const playerProfileService = require("../services/playerProfileService");
const { sendError } = require("./index");

/**
 * Resolves a player session token to its account.
 *
 * Sets `req.playerAccount` — the login, which may own several players. Handlers
 * that act on one player still have to check that account owns it; being signed
 * in says nothing about which profile id you may touch.
 */
const playerProfileAuthMiddleware = async (req, res, next) => {
    const token = req.headers["x-player-token"] || req.body?.playerToken;
    if (!token) return sendError(res, 401, "Please sign in to continue.");

    const account = await playerProfileService.getAccountByToken(token);
    if (!account) return sendError(res, 401, "Your session has expired. Please sign in again.");

    req.playerAccount = account;
    next();
};

module.exports = playerProfileAuthMiddleware;
