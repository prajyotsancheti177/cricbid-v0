const crypto = require('crypto');

/**
 * Authentication for the Assistant runner.
 *
 * The runner is a machine — a scheduled job or a GitHub Action — so it has no
 * session to present. It sends a shared secret instead, and it is allowed only
 * to move work through the queue, never to approve anything.
 *
 * Fails closed: with no AGENT_RUNNER_TOKEN configured, every runner endpoint is
 * refused, so deploying this code does not open an unauthenticated door.
 */

/** Constant-time compare, so a wrong token cannot be found a byte at a time. */
const sameSecret = (a, b) => {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    if (left.length !== right.length || left.length === 0) return false;
    return crypto.timingSafeEqual(left, right);
};

const requireRunnerToken = (req, res, next) => {
    const expected = process.env.AGENT_RUNNER_TOKEN;
    if (!expected) {
        return res.status(503).json({
            success: false,
            message: "The assistant runner is not configured on this server",
            code: "RUNNER_DISABLED",
        });
    }

    const provided = req.headers['x-agent-token'];
    if (!sameSecret(provided, expected)) {
        return res.status(401).json({
            success: false,
            message: "Invalid runner token",
            code: "RUNNER_UNAUTHORISED",
        });
    }

    next();
};

module.exports = { requireRunnerToken };
