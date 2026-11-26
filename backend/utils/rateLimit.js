const { sendError } = require('./index');

/**
 * Fixed-window rate limiting for the sign-in endpoints, in memory.
 *
 * Production runs one Node process, so a Map is enough and adds no dependency.
 * The limits are deliberately loose per IP: Indian mobile carriers put many
 * phones behind one address, and a whole team registering at the ground must
 * not lock itself out. The limit that matters is per account — ten password
 * attempts on one email per fifteen minutes — which is what stops guessing.
 *
 * Note: `trust proxy` is `true`, so req.ip is the left-most X-Forwarded-For
 * entry, which a client can set. The per-IP limits are therefore a speed bump,
 * not a wall; the per-email limit does not depend on the IP at all.
 */

const buckets = new Map();

const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60 * 1000);
if (sweep.unref) sweep.unref();

/** Count one hit; returns seconds until reset when over the limit, else 0. */
const hit = (key, windowMs, max) => {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) {
        b = { count: 0, reset: now + windowMs };
        buckets.set(key, b);
    }
    b.count += 1;
    return b.count > max ? Math.ceil((b.reset - now) / 1000) : 0;
};

const envInt = (name, fallback) => {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * @param {string} name - bucket namespace
 * @param {{ windowMs: number, max: number|(() => number), key?: (req) => string|null }} opts
 *   key returning null skips limiting for that request
 */
const rateLimit = (name, { windowMs, max, key = (req) => req.ip }) => (req, res, next) => {
    const k = key(req);
    if (!k) return next();
    const limit = typeof max === 'function' ? max() : max;
    const retryAfter = hit(`${name}:${k}`, windowMs, limit);
    if (retryAfter) {
        res.set('Retry-After', String(retryAfter));
        const err = new Error('Too many attempts');
        err.code = 'RATE_LIMITED';
        return sendError(res, 429, "Too many attempts. Please wait a few minutes and try again.", err);
    }
    next();
};

const FIFTEEN_MIN = 15 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

/** Password sign-in: per email, then per IP. */
const passwordLoginLimits = [
    rateLimit('pw-email', {
        windowMs: FIFTEEN_MIN,
        max: () => envInt('AUTH_RL_PASSWORD_PER_EMAIL', 10),
        key: (req) => (req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : null),
    }),
    rateLimit('pw-ip', { windowMs: FIFTEEN_MIN, max: () => envInt('AUTH_RL_PASSWORD_PER_IP', 200) }),
];

/** Google sign-in, callback and exchange: per IP. */
const googleLoginLimit = rateLimit('google-ip', { windowMs: FIVE_MIN, max: () => envInt('AUTH_RL_GOOGLE_PER_IP', 300) });

module.exports = { rateLimit, passwordLoginLimits, googleLoginLimit };
