const userService = require("../services/userService");
const { sendSuccess, sendError } = require("../utils");

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

const getUserDetail = async (req, res) => {
    try {
        // Use targetUserId if provided (for viewing other users), otherwise fallback to authenticated userId
        const targetUserId = req.body.targetUserId || req.body.userId;
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
        const users = await userService.getUsersInHierarchy(req.body.userId);
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
        const targetUserId = req.body.targetUserId || req.body.userId;
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