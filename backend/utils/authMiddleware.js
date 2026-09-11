const prisma = require('../db/prisma');

/**
 * Session authentication.
 *
 * The caller is identified by a session token issued at login and stored as a
 * row in `user_session` — never by a header naming who they claim to be.
 *
 * One row per device, so a phone and a laptop can both be signed in. It used to
 * be a single column on the user, which meant signing in anywhere silently
 * invalidated everywhere else and the other device was told, on every request,
 * that its session had expired.
 *
 * This replaces `x-user-id`, which the server used to take at face value: send
 * someone else's id and you were them. That was tolerable when twelve people
 * had accounts and all of them were trusted; it stopped being tolerable the
 * moment signing in with Google gave everyone an account.
 *
 * The token arrives as `x-session-token`, or as `x-player-token` from the
 * player-facing screens. They are the same token — there is one identity now —
 * and both are accepted so the player flow keeps working unchanged.
 *
 * A body's `userId` is still read by some services for business logic, but it
 * no longer establishes who you are: `req.userId` always comes from the token.
 */

const readToken = (req) =>
    req.headers['x-session-token']
    || req.headers['x-player-token']
    || (req.body && req.body.sessionToken)
    || req.query.sessionToken
    || null;

const authMiddleware = async (req, res, next) => {
    try {
        const token = readToken(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login to perform this action.",
                code: "NO_SESSION",
            });
        }

        const session = await prisma.userSession.findUnique({
            where: { token: String(token) },
            select: {
                id: true,
                expiresAt: true,
                user: { select: { id: true, role: true, isActive: true } },
            },
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Your session has expired. Please sign in again.",
                code: "SESSION_INVALID",
            });
        }

        if (session.expiresAt.getTime() < Date.now()) {
            await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
            return res.status(401).json({
                success: false,
                message: "Your session has expired. Please sign in again.",
                code: "SESSION_EXPIRED",
            });
        }

        const user = session.user;

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact support.",
                code: "DEACTIVATED",
            });
        }

        // Identity comes from here and nowhere else.
        req.userId = user.id;
        req.userRole = user.role;
        req.sessionToken = String(token);

        // Cheap liveness for the "signed in on" list; not awaited so it never
        // adds latency to a request.
        prisma.userSession.update({
            where: { id: session.id },
            data: { lastSeenAt: new Date() },
        }).catch(() => {});

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Authentication failed",
            error: error.message,
        });
    }
};

/**
 * Role-based authorization.
 *
 * Runs after authMiddleware, so the role is already the one on the user's row.
 * It is never read from the request — an `x-user-role` header used to be enough
 * to pass every role check in the app.
 *
 * @param {Array} allowedRoles
 */
const roleMiddleware = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            let role = req.userRole;

            // Defensive: if this is ever mounted without authMiddleware in
            // front, resolve the role rather than trusting anything sent.
            if (!role) {
                const token = readToken(req);
                if (!token) {
                    return res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
                }
                const session = await prisma.userSession.findUnique({
                    where: { token: String(token) },
                    select: { expiresAt: true, user: { select: { role: true, isActive: true } } },
                });
                const user = session && session.expiresAt.getTime() > Date.now() ? session.user : null;
                if (!user || !user.isActive) {
                    return res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
                }
                role = user.role;
                req.userRole = role;
            }

            if (!allowedRoles.includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action",
                });
            }

            next();
        } catch (error) {
            return res.status(403).json({
                success: false,
                message: "Authorization failed",
                error: error.message,
            });
        }
    };
};

module.exports = {
    authMiddleware,
    roleMiddleware,
};
