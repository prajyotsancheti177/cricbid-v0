const prisma = require("../db/prisma");
const { encrypt, decrypt } = require('../utils/encryDecry');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');

// Matches the player session length.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * An auth failure the client can act on. `code` is stable and safe to put in a
 * URL (the redirect sign-in reports failures as `?error=<code>`); the message
 * is for people.
 */
class AuthError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const MANAGING_ROLES = ['boss', 'super_user', 'tournament_host'];
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * The Gmail mailbox an address delivers to. Gmail ignores dots and anything
 * after a `+` in the local part, and googlemail.com is the same service, so
 * john.doe+cricbid@googlemail.com and johndoe@gmail.com are one inbox — and
 * one person. Other domains are left alone: their dots are significant.
 */
const canonicalEmail = (email) => {
    const lower = String(email || '').trim().toLowerCase();
    const at = lower.lastIndexOf('@');
    if (at < 0) return lower;
    const local = lower.slice(0, at);
    const domain = lower.slice(at + 1);
    if (!GMAIL_DOMAINS.has(domain)) return lower;
    return `${local.split('+')[0].replace(/\./g, '')}@gmail.com`;
};

/**
 * Whether Google is the authority for this address, so its "verified" means
 * the signer-in controls the mailbox today. True for Gmail and for Workspace
 * accounts (`hd`). For any other address Google only proves someone could read
 * it once, when the Google account was made — an ex-employee may still hold
 * that Google account after losing the mailbox.
 */
const isAuthoritativeGoogleEmail = (payload) => {
    const domain = String(payload.email || '').toLowerCase().split('@')[1] || '';
    return GMAIL_DOMAINS.has(domain) || Boolean(payload.hd);
};

/**
 * Google ID tokens already exchanged for a session, so one credential cannot
 * mint several (the token stays valid for an hour). In memory: production runs
 * a single process, and a restart only forgets tokens that are about to expire.
 */
const usedGoogleTokens = new Map();
const markGoogleTokenUsed = (payload, credential) => {
    const now = Date.now();
    if (usedGoogleTokens.size > 1000) {
        for (const [k, exp] of usedGoogleTokens) if (exp < now) usedGoogleTokens.delete(k);
    }
    const key = payload.jti || crypto.createHash('sha256').update(String(credential)).digest('hex');
    if (usedGoogleTokens.has(key)) {
        throw new AuthError('REPLAYED', "That Google sign-in was already used. Please sign in again.");
    }
    usedGoogleTokens.set(key, (Number(payload.exp) || now / 1000) * 1000 + 5 * 60 * 1000);
    // Marked before any await, so two simultaneous uses cannot both pass.
    // The release is for a sign-in that ends in "now prove it with your
    // password": that credential is spent on linkGoogleToUser instead.
    return () => usedGoogleTokens.delete(key);
};

// Permission columns -> permissions{} object (preserves the old API shape)
const permsOf = (u) => ({
    canCreateSuperUser: u.canCreateSuperUser,
    canCreateTournamentHost: u.canCreateTournamentHost,
    canManageTournaments: u.canManageTournaments,
    canManageTeams: u.canManageTeams,
    canManagePlayers: u.canManagePlayers,
});

// Role -> permission columns (was the Mongoose pre-save hook)
const permsForRole = (role) => {
    if (role === 'boss') {
        return { canCreateSuperUser: true, canCreateTournamentHost: true, canManageTournaments: true, canManageTeams: true, canManagePlayers: true };
    }
    if (role === 'super_user') {
        return { canCreateSuperUser: false, canCreateTournamentHost: true, canManageTournaments: true, canManageTeams: true, canManagePlayers: true };
    }
    // tournament_host
    return { canCreateSuperUser: false, canCreateTournamentHost: false, canManageTournaments: true, canManageTeams: true, canManagePlayers: true };
};

// Prisma user row -> old Mongoose-shaped object (aliases id -> _id, rebuilds
// permissions{}, and createdBy as a populated object or raw id).
const serializeUser = (u) => {
    if (!u) return u;
    let createdBy = u.createdById ?? null;
    if (u.createdBy && typeof u.createdBy === 'object') {
        createdBy = { _id: u.createdBy.id, name: u.createdBy.name, email: u.createdBy.email, role: u.createdBy.role };
    }
    return {
        _id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        permissions: permsOf(u),
        createdBy,
        logo: u.logo,
        isActive: u.isActive,
        // Whether Google sign-in is linked — never the Google id itself.
        googleLinked: Boolean(u.googleSub),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    };
};

const createdBySelect = { select: { id: true, name: true, email: true, role: true } };

/**
 * Create a new user (role-based)
 */
const createUser = async (userData) => {
    const { name, email, password, role, createdBy, logo } = userData;

    if (!name || !email || !password || !role) {
        throw new Error("Name, email, password, and role are required");
    }

    // A boss is never created over the API — scripts/createBossUser.js is the
    // only way, so no account can mint one.
    const validRoles = ['super_user', 'tournament_host'];
    if (!validRoles.includes(role)) {
        throw new Error("Invalid role. Must be: super_user or tournament_host");
    }

    // The creator is the signed-in caller (the controller sets it from the
    // session). This check used to run only `if (createdBy)`, and createdBy came
    // from the request body — so leaving it out skipped every check, and a
    // super_user could create a boss.
    if (!createdBy) throw new Error("Not permitted");
    const creator = await prisma.user.findUnique({ where: { id: createdBy } });
    if (!creator || !creator.isActive) {
        throw new Error("Not permitted");
    }
    if (role === 'super_user' && creator.role !== 'boss') {
        throw new Error("Only a boss can create super users");
    }
    if (role === 'tournament_host' && !['boss', 'super_user'].includes(creator.role)) {
        throw new Error("You don't have permission to create tournament hosts");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
    }

    // Validate password length
    if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
        throw new Error("User with this email already exists");
    }

    const savedUser = await prisma.user.create({
        data: {
            name: name.trim(),
            email: normalizedEmail,
            password: encrypt(password),
            role,
            createdById: createdBy || null,
            logo: logo || null,
            ...permsForRole(role),
        },
    });

    const s = serializeUser(savedUser);
    delete s.updatedAt; // match original create response shape
    return s;
};

/**
 * Login user with email and password
 */
const loginUser = async (credentials, { userAgent } = {}) => {
    const { email, password } = credentials;

    if (!email || !password) {
        throw new Error("Email and password are required");
    }

    // Trimmed as well as lowercased: accounts are created trimmed, and a phone
    // keyboard's autocomplete often adds a trailing space.
    const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user) {
        throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
        throw new Error("Your account has been deactivated. Please contact support.");
    }

    if (!user.password) {
        // Google-only account. Say so plainly rather than "invalid password" —
        // there is no password to get right.
        throw new Error("This account signs in with Google");
    }

    const isPasswordValid = decrypt(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }

    const token = await createSession(user.id, userAgent);

    const s = serializeUser(user);
    delete s.createdBy;
    delete s.updatedAt;
    return { ...s, sessionToken: token };
};

/**
 * Start a session for one device.
 *
 * Adds a row rather than replacing a column, so signing in on a phone does not
 * sign out a laptop.
 */
const createSession = async (userId, userAgent) => {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.userSession.create({
        data: {
            userId,
            token,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
        },
    });
    return token;
};

/** End one session — this device only. Other devices stay signed in. */
const logout = async (token) => {
    if (!token) return;
    await prisma.userSession.deleteMany({ where: { token: String(token) } });
};

/** End every session for a user. */
const logoutEverywhere = async (userId) => {
    await prisma.userSession.deleteMany({ where: { userId } });
};

/** The devices a user is currently signed in on. */
const listSessions = (userId) =>
    prisma.userSession.findMany({
        where: { userId, expiresAt: { gt: new Date() } },
        select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
    });

const DEACTIVATED_MESSAGE = "Your account has been deactivated. Please contact support.";

/**
 * Check a Google ID token and return its payload. Does not mark it used, so
 * the redirect callback can validate early and leave the exchange to spend it.
 *
 * The underlying reason a token fails (expired, clock skew, wrong audience,
 * certificate fetch) is logged here: the person only ever sees "could not
 * verify", and without the log a skewed server clock looks like Google being
 * broken for everyone.
 */
const verifyGoogleCredential = async (credential) => {
    if (!config.googleClientId) throw new AuthError('NOT_CONFIGURED', "Google sign-in is not configured");
    if (!credential) throw new AuthError('INVALID_TOKEN', "Missing Google credential");

    const client = new OAuth2Client(config.googleClientId);
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: String(credential),
            audience: config.googleClientId,
        });
        payload = ticket.getPayload();
    } catch (err) {
        console.warn(`[google sign-in] token verification failed: ${err && err.message}`);
        throw new AuthError('INVALID_TOKEN', "Could not verify that Google sign-in");
    }

    if (!payload?.sub) throw new AuthError('INVALID_TOKEN', "Could not verify that Google sign-in");
    if (payload.email_verified !== true || !payload.email) {
        throw new AuthError('UNVERIFIED_EMAIL', "That Google account has no verified email address");
    }
    return payload;
};

/**
 * The existing user a first Google sign-in belongs to, if any: the exact email,
 * or for Gmail the same mailbox under another spelling (dots, +tag,
 * googlemail.com). Without the second lookup a host an admin created as
 * johndoe@gmail.com who signs in as john.doe@gmail.com silently got a second,
 * powerless `player` account.
 */
const findUserForGoogleEmail = async (email) => {
    const exact = await prisma.user.findUnique({ where: { email } });
    if (exact) return exact;

    const canonical = canonicalEmail(email);
    if (!canonical.endsWith('@gmail.com')) return null;
    const local = canonical.split('@')[0];

    const rows = await prisma.$queryRaw`
        SELECT id FROM "user"
        WHERE lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
          AND replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') = ${local}
        ORDER BY "createdAt" ASC
        LIMIT 2`;
    if (!rows.length) return null;
    if (rows.length > 1) {
        console.warn(`[google sign-in] ${rows.length}+ accounts share the Gmail mailbox ${canonical}; using the oldest`);
    }
    return prisma.user.findUnique({ where: { id: rows[0].id } });
};

/**
 * Sign in with Google.
 *
 * Anyone may sign in; a first sign-in creates a `player`, and a role is only
 * ever granted afterwards by a boss. An existing account is found by its linked
 * Google id, else by email, and linked on the way.
 *
 * Linking is refused in two cases that used to go through:
 *  - the account is suspended: nothing is written to it at all;
 *  - the account manages something and the email is one Google is not the
 *    authority for (see isAuthoritativeGoogleEmail). The person proves it is
 *    theirs by signing in with the password once, which links Google
 *    (linkGoogleToUser).
 *
 * @param {string} credential - ID token from Google Identity Services
 * @param {{ userAgent?: string, expectedNonce?: string|null }} [options]
 *   expectedNonce — set by the redirect exchange: the token must carry the
 *   nonce the browser that started the sign-in generated, which is what stops
 *   an attacker's credential being planted on someone else's browser.
 * @returns {Promise<Object>} the same serialized user shape as loginUser
 */
const loginWithGoogle = async (credential, { userAgent, expectedNonce } = {}) => {
    const payload = await verifyGoogleCredential(credential);

    if (expectedNonce !== undefined && (!expectedNonce || payload.nonce !== expectedNonce)) {
        throw new AuthError('CSRF', "That sign-in could not be verified. Please try again.");
    }
    const releaseToken = markGoogleTokenUsed(payload, credential);

    const email = String(payload.email).trim().toLowerCase();

    // Prefer the recorded link; fall back to the email for a first sign-in.
    let user = await prisma.user.findUnique({ where: { googleSub: payload.sub } });

    if (user) {
        if (!user.isActive) throw new AuthError('DEACTIVATED', DEACTIVATED_MESSAGE);

        // The Google account's address changed. Keep ours current so WhatsApp
        // and registration lookups by email still find this person — unless
        // another account already holds the new address.
        if (user.email !== email) {
            const holder = await prisma.user.findUnique({ where: { email }, select: { id: true } });
            if (!holder) {
                user = await prisma.user.update({ where: { id: user.id }, data: { email, emailVerified: true } });
            } else {
                console.warn(`[google sign-in] ${user.id} now signs in as ${email}, which belongs to ${holder.id}; email left as ${user.email}`);
            }
        }
    } else {
        user = await findUserForGoogleEmail(email);

        if (user) {
            if (!user.isActive) throw new AuthError('DEACTIVATED', DEACTIVATED_MESSAGE);
            if (user.googleSub && user.googleSub !== payload.sub) {
                throw new AuthError('SUB_CONFLICT', "Another Google account is already linked to this CricBid user. Ask an administrator to unlink it.");
            }
            if (MANAGING_ROLES.includes(user.role) && !isAuthoritativeGoogleEmail(payload)) {
                releaseToken();
                throw new AuthError('LINK_REQUIRES_PASSWORD', "This email belongs to an admin account. Sign in with your password once to link Google to it.");
            }
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleSub: payload.sub, emailVerified: true, name: user.name || payload.name || null },
            });
        } else {
            try {
                user = await prisma.user.create({
                    data: {
                        email,
                        name: payload.name || null,
                        googleSub: payload.sub,
                        emailVerified: true,
                        role: 'player',
                        password: null,
                    },
                });
            } catch (e) {
                // Two first sign-ins for one person racing (two tabs, a
                // double tap): the loser finds the row the winner made.
                if (e.code !== 'P2002') throw e;
                user = await prisma.user.findUnique({ where: { googleSub: payload.sub } })
                    || await prisma.user.findUnique({ where: { email } });
                if (!user) throw e;
            }
        }
    }

    const token = await createSession(user.id, userAgent);

    const s = serializeUser(user);
    delete s.createdBy;
    delete s.updatedAt;
    return { ...s, sessionToken: token };
};

/**
 * Link a Google account to the signed-in user — the second half of the
 * LINK_REQUIRES_PASSWORD flow, after the password sign-in proved ownership.
 * The Google address must be the account's own mailbox.
 */
const linkGoogleToUser = async (userId, credential) => {
    const payload = await verifyGoogleCredential(credential);
    markGoogleTokenUsed(payload, credential);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new AuthError('DEACTIVATED', DEACTIVATED_MESSAGE);
    if (canonicalEmail(user.email) !== canonicalEmail(payload.email)) {
        throw new AuthError('EMAIL_MISMATCH', "That Google account's email does not match this CricBid account.");
    }
    if (user.googleSub === payload.sub) return serializeUser(user);
    if (user.googleSub) {
        throw new AuthError('SUB_CONFLICT', "Another Google account is already linked to this CricBid user. Ask an administrator to unlink it.");
    }
    const other = await prisma.user.findUnique({ where: { googleSub: payload.sub }, select: { id: true } });
    if (other) throw new AuthError('SUB_CONFLICT', "That Google account is already linked to a different CricBid user.");

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { googleSub: payload.sub, emailVerified: true },
    });
    return serializeUser(updated);
};

/**
 * Remove someone's Google link, so their next Google sign-in links afresh by
 * email. The recovery for "Another Google account is already linked" — a
 * Workspace account deleted and recreated, or a Gmail address recycled.
 */
const unlinkGoogle = async (actorId, targetUserId) => {
    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || !actor.isActive || !['boss', 'super_user'].includes(actor.role)) throw new Error("Not permitted");
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error("User not found");
    if (['boss', 'super_user'].includes(target.role) && actor.role !== 'boss' && target.id !== actor.id) {
        throw new Error("Only a boss can change another administrator's sign-in");
    }
    const updated = await prisma.user.update({ where: { id: target.id }, data: { googleSub: null } });
    return serializeUser(updated);
};

/**
 * Resolve a session token to its user, or null when unknown or expired.
 */
const getUserBySessionToken = async (token) => {
    if (!token) return null;
    const session = await prisma.userSession.findUnique({
        where: { token: String(token) },
        include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
        await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
        return null;
    }
    const user = session.user;
    // Same rule as authMiddleware. Without it a suspended person's open
    // sessions kept working on every player-profile route.
    if (!user || !user.isActive) return null;
    const s = serializeUser(user);
    delete s.createdBy;
    delete s.updatedAt;
    return s;
};

/**
 * Search people to grant access to.
 *
 * Only finds people who have already signed in at least once — a role is
 * granted to an account that exists, so someone who has never signed in cannot
 * be promoted in advance. Worth knowing before hunting for a colleague who is
 * not there yet.
 *
 * @param {string} query - matched against name and email, case-insensitively
 * @param {{ role?: string, limit?: number }} options
 */
const searchUsers = async (query, { role, limit = 25 } = {}) => {
    const q = String(query || '').trim();
    const where = {};
    if (q) {
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
        ];
    }
    if (role) where.role = role;

    const users = await prisma.user.findMany({
        where,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        take: Math.min(Number(limit) || 25, 100),
        include: {
            tournamentAccess: {
                select: { tournamentId: true, tournament: { select: { name: true } } },
            },
        },
    });

    return users.map((u) => {
        const s = serializeUser(u);
        delete s.createdBy;
        s.tournamentAccess = (u.tournamentAccess || []).map((a) => ({
            tournamentId: a.tournamentId,
            tournamentName: a.tournament?.name || null,
        }));
        return s;
    });
};

/**
 * Set someone's role, and — for a tournament host — exactly which tournaments
 * they may work on.
 *
 * Grants are additive to ownership: a host keeps whatever they created. Passing
 * `tournamentIds` replaces the granted set, so unticking one revokes it.
 *
 * @param {string} actorId - the boss/super_user making the change
 * @param {{ userId: string, role?: string, tournamentIds?: string[] }} input
 */
const setUserAccess = async (actorId, { userId, role, tournamentIds }) => {
    if (!userId) throw new Error("User is required");

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || !actor.isActive) throw new Error("Not permitted");
    if (actor.role !== 'boss' && actor.role !== 'super_user') throw new Error("Not permitted");

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("User not found");

    // Only a boss may create or unmake another boss, and nobody may demote
    // themselves out of the role that lets them fix it afterwards.
    if (role && role !== target.role) {
        if ((role === 'boss' || target.role === 'boss') && actor.role !== 'boss') {
            throw new Error("Only a boss can change boss access");
        }
        // Same line as createUser: a super_user may hand out hosting, not
        // administration. Otherwise this screen was a way round the rule that
        // super users cannot create super users.
        if ((role === 'super_user' || target.role === 'super_user') && actor.role !== 'boss') {
            throw new Error("Only a boss can grant or remove super user access");
        }
        if (target.id === actor.id) {
            throw new Error("You cannot change your own role");
        }
    }

    const validRoles = ['boss', 'super_user', 'tournament_host', 'player'];
    if (role && !validRoles.includes(role)) throw new Error("Unknown role");

    await prisma.$transaction(async (tx) => {
        if (role && role !== target.role) {
            await tx.user.update({ where: { id: userId }, data: { role } });
        }

        if (Array.isArray(tournamentIds)) {
            const effectiveRole = role || target.role;
            // A boss or super_user already sees everything, and a player sees
            // nothing, so per-tournament grants only mean anything for a host.
            const keep = effectiveRole === 'tournament_host' ? tournamentIds : [];

            await tx.tournamentAccess.deleteMany({
                where: { userId, tournamentId: { notIn: keep.length ? keep : ['__none__'] } },
            });

            for (const tournamentId of keep) {
                await tx.tournamentAccess.upsert({
                    where: { userId_tournamentId: { userId, tournamentId } },
                    create: { userId, tournamentId, grantedById: actorId },
                    update: {},
                });
            }
        }
    });

    const updated = await prisma.user.findUnique({
        where: { id: userId },
        include: { tournamentAccess: { select: { tournamentId: true, tournament: { select: { name: true } } } } },
    });

    const s = serializeUser(updated);
    delete s.createdBy;
    s.tournamentAccess = (updated.tournamentAccess || []).map((a) => ({
        tournamentId: a.tournamentId,
        tournamentName: a.tournament?.name || null,
    }));
    return s;
};

/**
 * Get user details by ID
 */
const getUserDetail = async (userId) => {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        omit: { password: true },
        include: { createdBy: createdBySelect },
    });
    if (!user) {
        throw new Error("User not found");
    }

    return serializeUser(user);
};

/**
 * Get all users created by a specific user
 */
const getUsersByCreator = async (creatorId) => {
    if (!creatorId) {
        throw new Error("Creator ID is required");
    }

    const users = await prisma.user.findMany({
        where: { createdById: creatorId },
        omit: { password: true },
        include: { createdBy: createdBySelect },
        orderBy: { createdAt: 'desc' },
    });

    return users.map(serializeUser);
};

/**
 * Get all users in hierarchy (created by user and their descendants)
 */
const getUsersInHierarchy = async (userId) => {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
        throw new Error("User not found");
    }

    // Boss can see all users
    if (currentUser.role === 'boss') {
        return await getAllUsers();
    }

    const hierarchy = [];
    const processedIds = new Set();

    const getDescendants = async (parentId) => {
        if (processedIds.has(parentId)) return;
        processedIds.add(parentId);

        const users = await prisma.user.findMany({
            where: { createdById: parentId },
            omit: { password: true },
            include: { createdBy: createdBySelect },
            orderBy: { createdAt: 'desc' },
        });

        for (const user of users) {
            hierarchy.push(serializeUser(user));
            await getDescendants(user.id);
        }
    };

    await getDescendants(userId);
    return hierarchy;
};

/**
 * Get all users (for boss user)
 */
const getAllUsers = async (filters = {}) => {
    const where = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const users = await prisma.user.findMany({
        where,
        omit: { password: true },
        include: { createdBy: createdBySelect },
        orderBy: { createdAt: 'desc' },
    });

    return users.map(serializeUser);
};

/**
 * Update user details
 */
/**
 * Whether `actor` may change or remove `target`'s account.
 *
 * A boss may act on anyone but another boss; a super_user only on hosts and
 * players. Both route guards admitted any boss or super_user, and nothing here
 * looked at who the target was — so a super_user could suspend the boss.
 */
const assertMayAdminister = (actor, target) => {
    if (!actor || !actor.isActive || !['boss', 'super_user'].includes(actor.role)) throw new Error("Not permitted");
    if (target.role === 'boss' && target.id !== actor.id) throw new Error("A boss account cannot be changed here");
    if (target.role === 'super_user' && actor.role !== 'boss' && target.id !== actor.id) {
        throw new Error("Only a boss can change a super user");
    }
};

const updateUser = async (updateData, actorId) => {
    const { userId, name, logo, isActive } = updateData;

    if (!userId) {
        throw new Error("User ID is required");
    }

    const [actor, target] = await Promise.all([
        prisma.user.findUnique({ where: { id: actorId } }),
        prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!target) throw new Error("User not found");
    assertMayAdminister(actor, target);
    if (isActive !== undefined && target.id === actor.id) {
        throw new Error("You cannot suspend or reactivate your own account");
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (logo !== undefined) updates.logo = logo;
    if (isActive !== undefined) updates.isActive = isActive;

    let updatedUser;
    try {
        updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updates,
            omit: { password: true },
        });
    } catch (e) {
        if (e.code === 'P2025') throw new Error("User not found");
        throw e;
    }

    return serializeUser(updatedUser);
};

/**
 * Delete/deactivate user
 */
const deleteUser = async (userId, hardDelete = false, actorId) => {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error("User not found");
    }

    if (user.role === 'boss') {
        throw new Error("Cannot delete boss user");
    }

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (user.id === actorId) throw new Error("You cannot remove your own access");
    assertMayAdminister(actor, user);
    // Permanent deletion cascades to the person's player profiles and orphans
    // tournaments that name them as host, so it stays with the boss.
    if (hardDelete && actor.role !== 'boss') {
        throw new Error("Only a boss can permanently delete an account");
    }

    if (hardDelete) {
        await prisma.user.delete({ where: { id: userId } });
        return { message: "User permanently deleted" };
    }

    // Removing someone's access is not the same as banning them from CricBid.
    //
    // `isActive: false` blocks sign-in outright, which made sense when the only
    // accounts were twelve hand-made admin logins. Now every person who signs in
    // with Google has an account, so blocking one locks that human out of the
    // public product entirely — they cannot even register their own child for a
    // tournament, because their email already belongs to a disabled row.
    //
    // So this demotes instead: no role, no tournaments, no live sessions. They
    // can sign in tomorrow and see exactly what any other member of the public
    // sees. `isActive` is left alone and now means only one thing — suspended —
    // which nothing in the UI sets.
    await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { role: 'player' } }),
        prisma.tournamentAccess.deleteMany({ where: { userId } }),
        prisma.userSession.deleteMany({ where: { userId } }),
    ]);
    return { message: "Access removed. They can still sign in, with no admin access." };
};

module.exports = {
    AuthError,
    canonicalEmail,
    verifyGoogleCredential,
    loginWithGoogle,
    linkGoogleToUser,
    unlinkGoogle,
    searchUsers,
    setUserAccess,
    getUserBySessionToken,
    createSession,
    logout,
    logoutEverywhere,
    listSessions,
    createUser,
    loginUser,
    getUserDetail,
    getUsersByCreator,
    getUsersInHierarchy,
    getAllUsers,
    updateUser,
    deleteUser,
};
