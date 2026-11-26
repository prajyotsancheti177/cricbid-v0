const visibilityService = require('../services/visibilityService');
const { sendError } = require('./index');

/**
 * Refuse an API call when a boss has switched its feature off for the
 * caller's role on the Role visibility page — so hiding a tab is not only
 * cosmetic for features marked `enforced` in shared/visibility-manifest.json.
 *
 * Mount AFTER authMiddleware + roleMiddleware (it reads req.userRole) and
 * alongside requireTournamentAccess, never instead of it: this answers "may
 * this role use the feature at all", not "may this person touch this
 * tournament".
 *
 * Restriction only: it can refuse what the route's role guard allows, never
 * allow what that guard refuses.
 *
 * @param {string|string[]} keys - resource key(s); any one visible is enough
 *   (a feature reachable from two places, e.g. Bulk upload)
 */
const requireVisible = (keys) => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
        if (!visibilityService.RESOURCES[k]) throw new Error(`requireVisible: unknown resource ${k}`);
    }
    return async (req, res, next) => {
        try {
            for (const k of list) {
                if (await visibilityService.isVisible(req.userRole, k)) return next();
            }
            const err = new Error('Feature turned off for this role');
            err.code = 'FEATURE_HIDDEN';
            const label = visibilityService.RESOURCES[list[0]].label;
            return sendError(res, 403, `${label} is turned off for your account. Ask an administrator if you need it.`, err);
        } catch (error) {
            return sendError(res, 403, "Could not check access", error);
        }
    };
};

module.exports = { requireVisible };
