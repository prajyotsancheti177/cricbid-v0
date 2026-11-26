const userService = require("../services/userService");
const { sendSuccess, sendError } = require("../utils");
const config = require("../config");

const crypto = require("crypto");

const userAgentOf = (req) => req.headers['user-agent'] || null;

const createUser = async (req, res) => {
    try {
        // The creator is whoever is signed in — never a body field, which the
        // caller could leave out to skip the permission check entirely.
        const user = await userService.createUser({ ...req.body, createdBy: req.userId });
        return sendSuccess(res, 201, "User created successfully", user);
    } catch (error) {
        return sendError(res, 400, "Failed to create user", error);
    }
};

const loginUser = async (req, res) => {
    try {
        const user = await userService.loginUser(req.body, { userAgent: userAgentOf(req) });
        return sendSuccess(res, 200, "Login successful", user);
    } catch (error) {
        return sendError(res, 401, "Login failed", error);
    }
};

/** POST /api/user/google-login — popup sign-in with Google. */
const googleLoginUser = async (req, res) => {
    try {
        const user = await userService.loginWithGoogle(req.body?.credential, { userAgent: userAgentOf(req) });
        return sendSuccess(res, 200, "Login successful", user);
    } catch (error) {
        return sendError(res, 401, error.message || "Google sign-in failed", error);
    }
};

/**
 * POST /api/user/link-google — link a Google account to the signed-in user.
 * Used after a password sign-in when Google sign-in answered
 * LINK_REQUIRES_PASSWORD.
 */
const linkGoogle = async (req, res) => {
    try {
        const user = await userService.linkGoogleToUser(req.userId, req.body?.credential);
        return sendSuccess(res, 200, "Google account linked", user);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not link that Google account", error);
    }
};

/** POST /api/user/unlink-google — boss/super_user: clear someone's Google link. */
const unlinkGoogle = async (req, res) => {
    try {
        const user = await userService.unlinkGoogle(req.userId, req.body?.targetUserId);
        return sendSuccess(res, 200, "Google sign-in unlinked", user);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not unlink", error);
    }
};

/** GET /api/user/sessions — the devices this account is signed in on. */
const listSessions = async (req, res) => {
    try {
        const sessions = await userService.listSessions(req.userId);
        return sendSuccess(res, 200, "Sessions", sessions);
    } catch (error) {
        return sendError(res, 400, "Could not list sessions", error);
    }
};

/** POST /api/user/logout-all — sign this account out on every device. */
const logoutAll = async (req, res) => {
    try {
        await userService.logoutEverywhere(req.userId);
        return sendSuccess(res, 200, "Signed out everywhere", null);
    } catch (error) {
        return sendError(res, 400, "Could not sign out everywhere", error);
    }
};

/** GET /api/user/search?q=&role= — find someone to grant access to. */
const searchUsers = async (req, res) => {
    try {
        const users = await userService.searchUsers(req.query.q, {
            role: req.query.role || undefined,
            limit: req.query.limit,
        });
        return sendSuccess(res, 200, "Users fetched", users);
    } catch (error) {
        return sendError(res, 400, error.message || "Search failed", error);
    }
};

/** POST /api/user/set-access — change a role and, for a host, their tournaments. */
const setUserAccess = async (req, res) => {
    try {
        const updated = await userService.setUserAccess(req.userId, {
            userId: req.body.targetUserId,
            role: req.body.role,
            tournamentIds: req.body.tournamentIds,
        });
        return sendSuccess(res, 200, "Access updated", updated);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not update access", error);
    }
};

/**
 * One-time codes from the redirect callback, waiting for the browser that
 * started the sign-in to exchange them. In memory (single process); a code
 * lives two minutes and is gone after one use.
 */
const pendingGoogleCodes = new Map();
const GOOGLE_CODE_TTL_MS = 2 * 60 * 1000;

/**
 * POST /api/user/google-callback — Google's redirect-mode sign-in.
 *
 * The popup flow hands the credential back through `window.opener`, which fails
 * in ways a site cannot see or fix: blocked popups, tracking prevention, and a
 * hang on Google's own /gsi/transfer page. Redirect mode avoids all of it —
 * Google POSTs the credential straight here as a normal form submission.
 *
 * Anyone can POST here, including a page an attacker controls — with the
 * attacker's own, perfectly valid credential. Signing the browser straight in
 * (as this used to) logged the victim into the attacker's account. Google's
 * `g_csrf_token` double-submit cookie cannot stop it: the cookie is missing on
 * many browsers for a cross-site POST, so it had to be optional.
 *
 * So this no longer signs anyone in. It checks the credential, parks it under a
 * one-time code, and sends the browser to /login#code=… . The login page then
 * exchanges the code together with the nonce it generated before leaving for
 * Google, and the exchange requires the ID token to carry that same nonce. An
 * attacker's credential carries their nonce, not the victim's, and fails.
 *
 * The fragment is never sent to a server, and the code is useless after two
 * minutes or one use — unlike the 90-day session token that used to sit there.
 */
const googleCallback = async (req, res) => {
    const appUrl = config.appUrl;
    try {
        const bodyToken = req.body?.g_csrf_token;
        const cookieToken = String(req.headers.cookie || '')
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('g_csrf_token='))
            ?.split('=')[1];

        if (cookieToken && bodyToken && cookieToken !== bodyToken) {
            return res.redirect(`${appUrl}/login?error=CSRF`);
        }

        const credential = req.body?.credential;
        await userService.verifyGoogleCredential(credential);

        const now = Date.now();
        for (const [k, v] of pendingGoogleCodes) if (v.expires < now) pendingGoogleCodes.delete(k);
        const code = crypto.randomBytes(24).toString('hex');
        pendingGoogleCodes.set(code, { credential, expires: now + GOOGLE_CODE_TTL_MS });

        return res.redirect(`${appUrl}/login#code=${code}`);
    } catch (error) {
        // A fixed code, never free text: the login page maps it to a message,
        // so a crafted link cannot put arbitrary words on our sign-in screen.
        return res.redirect(`${appUrl}/login?error=${encodeURIComponent(error.code || 'GOOGLE_FAILED')}`);
    }
};

/** POST /api/user/google-exchange — finish a redirect sign-in. Body: { code, nonce }. */
const googleExchange = async (req, res) => {
    try {
        const code = String(req.body?.code || '');
        const entry = pendingGoogleCodes.get(code);
        pendingGoogleCodes.delete(code);
        if (!entry || entry.expires < Date.now()) {
            const err = new userService.AuthError('EXPIRED_CODE', "That sign-in took too long. Please try again.");
            return sendError(res, 401, err.message, err);
        }
        const user = await userService.loginWithGoogle(entry.credential, {
            userAgent: userAgentOf(req),
            expectedNonce: req.body?.nonce ? String(req.body.nonce) : null,
        });
        return sendSuccess(res, 200, "Login successful", user);
    } catch (error) {
        return sendError(res, 401, error.message || "Google sign-in failed", error);
    }
};

/** POST /api/user/logout — end this session. */
const logoutUser = async (req, res) => {
    try {
        await userService.logout(req.sessionToken);
        return sendSuccess(res, 200, "Signed out", null);
    } catch (error) {
        return sendError(res, 400, "Could not sign out", error);
    }
};

const getUserDetail = async (req, res) => {
    try {
        // Reading somebody ELSE's account is an admin act. Anyone signed in
        // could previously pass a targetUserId and read any account on the
        // system, which now means any Gmail address reading any host's details.
        const requested = req.body.targetUserId;
        const isAdmin = req.userRole === 'boss' || req.userRole === 'super_user';
        if (requested && requested !== req.userId && !isAdmin) {
            return sendError(res, 403, "You do not have permission to view that user", new Error("forbidden"));
        }
        const targetUserId = requested || req.userId;
        const user = await userService.getUserDetail(targetUserId);
        return sendSuccess(res, 200, "User details fetched successfully", user);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch user details", error);
    }
};

const getUsersByCreator = async (req, res) => {
    try {
        const users = await userService.getUsersByCreator(req.body.creatorId);
        return sendSuccess(res, 200, "Users fetched successfully", users);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch users", error);
    }
};

const getUsersInHierarchy = async (req, res) => {
    try {
        // This uses the authenticated userId to show hierarchy relative to them
        const users = await userService.getUsersInHierarchy(req.userId);
        return sendSuccess(res, 200, "Users in hierarchy fetched successfully", users);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch users in hierarchy", error);
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers(req.body);
        return sendSuccess(res, 200, "All users fetched successfully", users);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch users", error);
    }
};

const updateUser = async (req, res) => {
    try {
        // The account changed is targetUserId, or the caller's own. A body
        // `userId` no longer names it — that let any admin aim this anywhere
        // without saying so.
        const updateData = { ...req.body, userId: req.body.targetUserId || req.userId };
        const user = await userService.updateUser(updateData, req.userId);
        return sendSuccess(res, 200, "User updated successfully", user);
    } catch (error) {
        return sendError(res, 400, "Failed to update user", error);
    }
};

const deleteUser = async (req, res) => {
    try {
        const targetUserId = req.body.targetUserId;
        if (!targetUserId) throw new Error("targetUserId is required");
        const result = await userService.deleteUser(targetUserId, req.body.hardDelete === true, req.userId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete user", error);
    }
};

module.exports = {
    createUser,
    loginUser,
    googleLoginUser,
    googleCallback,
    googleExchange,
    linkGoogle,
    unlinkGoogle,
    listSessions,
    logoutAll,
    logoutUser,
    searchUsers,
    setUserAccess,
    getUserDetail,
    getUsersByCreator,
    getUsersInHierarchy,
    getAllUsers,
    updateUser,
    deleteUser,
    // Legacy names for backward compatibility
    login: loginUser
};