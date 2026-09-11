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
    // Both names carry the same session token — there is one identity now. The
    // player screens send `x-player-token`; everything built on lib/auth sends
    // `x-session-token`, and only accepting the first made these endpoints
    // reject a perfectly valid session.
    const token = req.headers["x-player-token"]
        || req.headers["x-session-token"]
        || req.body?.playerToken
        || req.body?.sessionToken;
    if (!token) return sendError(res, 401, "Please sign in to continue.");

    const account = await playerProfileService.getAccountByToken(token);
    if (!account) return sendError(res, 401, "Your session has expired. Please sign in again.");

    req.playerAccount = account;
    req.playerToken = token;
    next();
};

module.exports = playerProfileAuthMiddleware;
