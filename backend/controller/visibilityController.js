const visibilityService = require("../services/visibilityService");
const { resolveOptionalUser } = require("../utils/tournamentAccess");
const { sendSuccess, sendError } = require("../utils");

/**
 * GET /api/visibility/me — the items the caller's role sees.
 *
 * Only the caller's own answer, never the whole matrix: a host has no need to
 * learn what super users can see. Signed out → nothing.
 */
const getMine = async (req, res) => {
    try {
        const { role } = await resolveOptionalUser(req);
        const resolved = await visibilityService.resolvedFor(role);
        return sendSuccess(res, 200, "Visibility", { role: role || null, ...resolved });
    } catch (error) {
        return sendError(res, 500, "Could not load visibility", error);
    }
};

/** GET /api/visibility/matrix — boss and super_user (read-only for the latter). */
const getMatrix = async (req, res) => {
    try {
        return sendSuccess(res, 200, "Visibility matrix", await visibilityService.matrix());
    } catch (error) {
        return sendError(res, 500, "Could not load visibility", error);
    }
};

/** PUT /api/visibility — boss only. Body: { changes: [{ role, key, visible: true|false|null }] } */
const updateMatrix = async (req, res) => {
    try {
        const result = await visibilityService.applyChanges({ id: req.userId, role: req.userRole }, req.body?.changes);
        // Tell open browsers to refetch, so a host's sidebar updates without a reload.
        const io = req.app.get("io");
        if (io) io.of("/auction").emit("visibility:changed", { version: result.version });
        return sendSuccess(res, 200, "Visibility updated", result);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not update visibility", error);
    }
};

/** GET /api/visibility/history — recent changes. */
const getHistory = async (req, res) => {
    try {
        return sendSuccess(res, 200, "Visibility history", await visibilityService.history(req.query.limit));
    } catch (error) {
        return sendError(res, 500, "Could not load history", error);
    }
};

module.exports = { getMine, getMatrix, updateMatrix, getHistory };
