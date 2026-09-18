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
    // No tournament named: only an admin can be acting on "any" tournament.
    if (!tournamentId) return isAdminRole(role);

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { tournamentHostId: true, isPrivate: true },
    });
    if (!tournament) return false;
    if (String(tournament.tournamentHostId) === String(userId)) return true;

    const granted = await prisma.tournamentAccess.findUnique({
        where: { userId_tournamentId: { userId, tournamentId } },
        select: { id: true },
    });
    if (granted) return true;

    // A private tournament belongs to the people named on it. The boss and
    // super_user shortcut deliberately does not apply, or every admin account
    // would see the one tournament meant to be unseen.
    return !tournament.isPrivate && isAdminRole(role);
};

/**
 * Whether this caller may SEE the tournament at all.
 *
 * Everything public — the tournament list, a tournament's detail, its players,
 * teams, registration form and auction room — is readable by anyone. That is
 * right for a real event and wrong for a private one, so those endpoints ask
 * this first.
 *
 * An unknown tournament returns true: the handler's own "not found" is a better
 * answer than a permission error, and it leaks nothing.
 */
const canViewTournament = async (userId, role, tournamentId) => {
    if (!tournamentId) return true;

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { isPrivate: true, tournamentHostId: true },
    });
    if (!tournament) return true;
    if (!tournament.isPrivate) return true;
    if (!userId) return false;
    if (String(tournament.tournamentHostId) === String(userId)) return true;

    const granted = await prisma.tournamentAccess.findUnique({
        where: { userId_tournamentId: { userId, tournamentId } },
        select: { id: true },
    });
    return Boolean(granted);
};

/**
 * Who is calling a PUBLIC endpoint.
 *
 * These routes have no authMiddleware in front — they must keep working for
 * someone signed out — so the session token is read here when one is sent.
 * Nothing is trusted from the body: an unreadable or expired token is simply
 * treated as signed out.
 */
const resolveOptionalUser = async (req) => {
    if (req.userId) return { userId: req.userId, role: req.userRole };

    const token = req.headers['x-session-token'] || req.headers['x-player-token'];
    if (!token) return { userId: null, role: null };

    try {
        const session = await prisma.userSession.findUnique({
            where: { token: String(token) },
            select: { expiresAt: true, user: { select: { id: true, role: true, isActive: true } } },
        });
        if (!session || session.expiresAt.getTime() < Date.now()) return { userId: null, role: null };
        if (!session.user || !session.user.isActive) return { userId: null, role: null };
        return { userId: session.user.id, role: session.user.role };
    } catch {
        return { userId: null, role: null };
    }
};

/** The tournament a public request is about, including via a player or team id. */
const tournamentIdFromRequest = async (req) => {
    const direct = req.body?.tournamentId || req.body?.touranmentId
        || req.params?.tournamentId || req.params?.id || req.query?.tournamentId;
    if (direct) return String(direct);

    if (req.body?.playerId) {
        const player = await prisma.player.findUnique({
            where: { id: String(req.body.playerId) },
            select: { touranmentId: true },
        }).catch(() => null);
        if (player?.touranmentId) return player.touranmentId;
    }
    if (req.body?.teamId) {
        const team = await prisma.team.findUnique({
            where: { id: String(req.body.teamId) },
            select: { touranmentId: true },
        }).catch(() => null);
        if (team?.touranmentId) return team.touranmentId;
    }
    return null;
};

/**
 * Guard for a public read. Answers "not found" rather than "not allowed", so a
 * private tournament does not announce its own existence to a stranger holding
 * the link.
 */
const requireTournamentVisible = async (req, res, next) => {
    try {
        const tournamentId = await tournamentIdFromRequest(req);
        const { userId, role } = await resolveOptionalUser(req);

        if (await canViewTournament(userId, role, tournamentId)) return next();

        return res.status(404).json({
            success: false,
            message: "Tournament not found",
        });
    } catch (error) {
        return res.status(404).json({ success: false, message: "Tournament not found" });
    }
};

/**
 * Express guard for any route that manages one tournament.
 *
 * Reads the tournament id from wherever the existing routes put it, so it can
 * be dropped in without changing their request shapes.
 */
const requireTournamentAccess = async (req, res, next) => {
    const claimed =
        req.body?.tournamentId || req.body?.touranmentId
        || req.params?.tournamentId || req.query?.tournamentId;

    // Edits to one player or team (the player dialog, the sheet) send only that
    // record's id. Without a tournament id every host was refused — only boss
    // and super_user got through, as they skip the per-tournament check. So the
    // tournament comes from the record itself, and it wins over any id the
    // caller sent: otherwise a host could name their own tournament while
    // editing someone else's player.
    let owning = null;
    try {
        if (req.body?.playerId) {
            const player = await prisma.player.findUnique({
                where: { id: String(req.body.playerId) },
                select: { touranmentId: true },
            });
            owning = player?.touranmentId || null;
        } else if (req.body?.teamId && !claimed) {
            const team = await prisma.team.findUnique({
                where: { id: String(req.body.teamId) },
                select: { touranmentId: true },
            });
            owning = team?.touranmentId || null;
        }
    } catch {
        owning = null;
    }

    const tournamentId = owning || claimed;
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
    canViewTournament,
    resolveOptionalUser,
    requireTournamentAccess,
    requireTournamentVisible,
};
