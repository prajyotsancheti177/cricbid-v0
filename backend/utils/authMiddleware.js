const prisma = require('../db/prisma');

/**
 * Authentication middleware.
 *
 * Still identifies the caller from an unverified `x-user-id`. That is a known
 * weakness and this file is where a real signed session belongs — see the note
 * on roleMiddleware below.
 */
const authMiddleware = (req, res, next) => {
    try {
        const userId = (req.body && req.body.userId) || req.query.userId || req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login to perform this action."
            });
        }

        req.userId = userId;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Authentication failed",
            error: error.message
        });
    }
};

/**
 * Role-based authorization.
 *
 * The role is read from the DATABASE, never from the request. It used to come
 * from an `x-user-role` header, which meant anyone could send
 * `x-user-role: boss` and pass every role check in the app. That was survivable
 * while twelve people had accounts; it is not now that signing in with Google
 * gives everyone one, and it would make granting roles meaningless.
 *
 * This does not fix identity — `x-user-id` is still unverified, so someone who
 * knows a boss's id can still act as them. That needs a real session and is the
 * next thing to do here.
 *
 * @param {Array} allowedRoles
 */
const roleMiddleware = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const userId = req.userId
                || (req.body && req.body.userId) || req.query.userId || req.headers['x-user-id'];

            if (!userId) {
                return res.status(403).json({ success: false, message: "Role information required" });
            }

            const user = await prisma.user.findUnique({
                where: { id: String(userId) },
                select: { role: true, isActive: true },
            });

            if (!user || !user.isActive) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action"
                });
            }

            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action"
                });
            }

            req.userRole = user.role;
            next();
        } catch (error) {
            return res.status(403).json({
                success: false,
                message: "Authorization failed",
                error: error.message
            });
        }
    };
};

module.exports = {
    authMiddleware,
    roleMiddleware
};
