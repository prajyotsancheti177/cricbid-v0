const userService = require("../services/userService");
const { sendSuccess, sendError } = require("../utils");
const config = require("../config");

const createUser = async (req, res) => {
    try {
        const user = await userService.createUser(req.body);
        return sendSuccess(res, 201, "User created successfully", user);
    } catch (error) {
        return sendError(res, 400, "Failed to create user", error);
    }
};

const loginUser = async (req, res) => {
    try {
        const user = await userService.loginUser(req.body);
        return sendSuccess(res, 200, "Login successful", user);
    } catch (error) {
        return sendError(res, 401, "Login failed", error);
    }
};

/** POST /api/user/google-login — sign in an existing host with Google. */
const googleLoginUser = async (req, res) => {
    try {
        const user = await userService.loginWithGoogle(req.body?.credential);
        return sendSuccess(res, 200, "Login successful", user);
    } catch (error) {
        // The message matters here: "not registered" is actionable, and there
        // is no account to enumerate that an administrator did not already make.
        return sendError(res, 401, error.message || "Google sign-in failed", error);
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
 * POST /api/user/google-callback — Google's redirect-mode sign-in.
 *
 * The popup flow hands the credential back through `window.opener`, which fails
 * in ways a site cannot see or fix: blocked popups, tracking prevention, and a
 * hang on Google's own /gsi/transfer page. Redirect mode avoids all of it —
 * Google POSTs the credential straight here as a normal form submission.
 *
 * Google sends `g_csrf_token` in both a cookie and the body; they must match.
 * The cookie is absent on some browsers for a cross-site POST, so a missing
 * cookie is tolerated while a MISMATCH is refused. The real control is the ID
 * token itself, which is signed by Google and bound to our client id.
 *
 * Ends with a redirect carrying the session token in the URL FRAGMENT, which
 * browsers never send to a server and which the login page strips immediately.
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
            return res.redirect(`${appUrl}/login?error=csrf`);
        }

        const user = await userService.loginWithGoogle(req.body?.credential);
        return res.redirect(`${appUrl}/login#token=${encodeURIComponent(user.sessionToken)}`);
    } catch (error) {
        // The message is shown to the user, so keep it short and readable.
        const msg = encodeURIComponent(error.message || "Google sign-in failed");
        return res.redirect(`${appUrl}/login?error=${msg}`);
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
        // Use targetUserId if provided (for viewing other users), otherwise fallback to authenticated userId
        const targetUserId = req.body.targetUserId || req.userId;
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
        const updateData = { ...req.body };
        // If targetUserId is provided, use it as the userId for the update service
        if (req.body.targetUserId) {
            updateData.userId = req.body.targetUserId;
        }
        const user = await userService.updateUser(updateData);
        return sendSuccess(res, 200, "User updated successfully", user);
    } catch (error) {
        return sendError(res, 400, "Failed to update user", error);
    }
};

const deleteUser = async (req, res) => {
    try {
        // Use targetUserId if provided, otherwise fallback to userId (though usually we want targetUserId for deletion)
        const targetUserId = req.body.targetUserId || req.userId;
        const result = await userService.deleteUser(targetUserId, req.body.hardDelete);
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