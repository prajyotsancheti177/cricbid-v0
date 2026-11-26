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
/**
 * Every tournament a managing request touches.
 *
 * The claimed tournament id, plus the tournament each named record really
 * belongs to: a player, a team (including a match's two teams), a budget
 * top-up, a match, and each entry of a bulk `matches` list. Edits to one record
 * (the player dialog, the sheet, the scorer) often send only that record's id,
 * so it has to be looked up.
 *
 * It used to resolve one id and let it win, and skipped the team lookup when a
 * tournament id was also sent — so a host could name their own tournament while
 * renaming or deleting another tournament's team. Now the caller must be
 * allowed on all of them. An id that matches nothing adds nothing; the handler
 * reports "not found" itself.
 */
const tournamentsTouched = async (req) => {
    const b = req.body || {};
    const ids = new Set();
    const add = (v) => { if (v) ids.add(String(v)); };

    add(b.tournamentId || b.touranmentId || req.params?.tournamentId || req.query?.tournamentId);

    const lookups = [];
    const viaTeam = (id) => id && lookups.push(
        prisma.team.findUnique({ where: { id: String(id) }, select: { touranmentId: true } }).then(r => add(r?.touranmentId))
    );
    if (b.playerId) {
        lookups.push(prisma.player.findUnique({ where: { id: String(b.playerId) }, select: { touranmentId: true } }).then(r => add(r?.touranmentId)));
    }
    viaTeam(b.teamId);
    viaTeam(b.teamAId);
    viaTeam(b.teamBId);
    if (b.topupId) {
        lookups.push(prisma.teamBudgetTopup.findUnique({ where: { id: String(b.topupId) }, select: { touranmentId: true } }).then(r => add(r?.touranmentId)));
    }
    if (b.matchId) {
        lookups.push(prisma.match.findUnique({ where: { id: String(b.matchId) }, select: { tournamentId: true } }).then(r => add(r?.tournamentId)));
    }
    if (Array.isArray(b.matches)) {
        for (const m of b.matches) {
            add(m && m.tournamentId);
            viaTeam(m && m.teamAId);
            viaTeam(m && m.teamBId);
        }
    }
    await Promise.all(lookups.map(p => p.catch(() => {})));
    return [...ids];
};

/**
 * Express guard for any route that manages one tournament.
 *
 * Reads the tournament id from wherever the existing routes put it, so it can
 * be dropped in without changing their request shapes.
 */
const requireTournamentAccess = async (req, res, next) => {
    const deny = () => res.status(403).json({
        success: false,
        message: "You do not have permission to manage this tournament",
    });
    try {
        const ids = await tournamentsTouched(req);
        // No tournament at all: only an admin can be acting on "any" one.
        if (!ids.length) {
            return (await canManageTournament(req.userId, req.userRole, null)) ? next() : deny();
        }
        for (const id of ids) {
            if (!(await canManageTournament(req.userId, req.userRole, id))) return deny();
        }
        next();
    } catch {
        return deny();
    }
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
