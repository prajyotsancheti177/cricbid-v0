const prisma = require('../db/prisma');

/**
 * Who may manage a tournament.
 *
 * Deny by default. The checks this replaces were the other way round — they
 * only restricted callers whose role was exactly `tournament_host`, so every
 * other role fell straight through and was allowed. That was survivable while
 * the only accounts were twelve trusted people; it stopped being survivable the
 * moment signing in with Google gave everyone an account, at which point any
 * Gmail address could update or delete any tournament.
 *
 * The role must come from the database (authMiddleware puts it on the request),
 * never from the body — the old controllers read `req.body.userRole`, which the
 * caller chooses.
 */

/** Roles allowed to manage anything at all. A `player` is not one. */
const MANAGING_ROLES = ['boss', 'super_user', 'tournament_host'];

const canManageAnything = (role) => MANAGING_ROLES.includes(role);

/** boss and super_user see every tournament; a host sees only their own. */
const isAdminRole = (role) => role === 'boss' || role === 'super_user';

/**
 * Whether this user may manage this specific tournament.
 *
 * A host qualifies by owning it (`tournamentHostId`) or by being granted it in
 * `tournament_access`, which is what the Grant access screen writes.
 *
 * @param {string} userId
 * @param {string} role - from the database, via authMiddleware
 * @param {string} tournamentId
 * @returns {Promise<boolean>}
 */
const canManageTournament = async (userId, role, tournamentId) => {
    if (!userId || !canManageAnything(role)) return false;
    if (isAdminRole(role)) return true;
    if (!tournamentId) return false;

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { tournamentHostId: true },
    });
    if (!tournament) return false;
    if (String(tournament.tournamentHostId) === String(userId)) return true;

    const granted = await prisma.tournamentAccess.findUnique({
        where: { userId_tournamentId: { userId, tournamentId } },
        select: { id: true },
    });
    return Boolean(granted);
};

/**
 * Express guard for any route that manages one tournament.
 *
 * Reads the tournament id from wherever the existing routes put it, so it can
 * be dropped in without changing their request shapes.
 */
const requireTournamentAccess = async (req, res, next) => {
    const tournamentId =
        req.body?.tournamentId || req.body?.touranmentId
        || req.params?.tournamentId || req.query?.tournamentId;

    const allowed = await canManageTournament(req.userId, req.userRole, tournamentId);
    if (!allowed) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to manage this tournament",
        });
    }
    next();
};

module.exports = {
    MANAGING_ROLES,
    canManageAnything,
    isAdminRole,
    canManageTournament,
    requireTournamentAccess,
};
