/**
 * Authentication middleware to protect routes
 * For now, this is a simple check that a userId is provided in the request body
 * In production, this should verify JWT tokens or session cookies
 */

const authMiddleware = (req, res, next) => {
    try {
        // Check if userId is provided in request body, query, or headers
        // This is a basic implementation - in production you'd verify JWT tokens
        const userId = (req.body && req.body.userId) || req.query.userId || req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login to perform this action."
            });
        }

        // Attach userId to request for use in controllers
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
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of roles allowed to access the route
 */
const roleMiddleware = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const userRole = req.body.userRole || req.query.userRole || req.headers['x-user-role'];
            
            if (!userRole) {
                return res.status(403).json({
                    success: false,
                    message: "Role information required"
                });
            }

            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action"
                });
            }

            req.userRole = userRole;
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
