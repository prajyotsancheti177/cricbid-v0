const prisma = require("../db/prisma");
const { encrypt, decrypt } = require('../utils/encryDecry');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');

// Matches the player session length.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

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

    const validRoles = ['boss', 'super_user', 'tournament_host'];
    if (!validRoles.includes(role)) {
        throw new Error("Invalid role. Must be: boss, super_user, or tournament_host");
    }

    // Check permissions of creator
    if (createdBy) {
        const creator = await prisma.user.findUnique({ where: { id: createdBy } });
        if (!creator) {
            throw new Error("Creator user not found");
        }
        if (role === 'super_user' && !creator.canCreateSuperUser) {
            throw new Error("You don't have permission to create super users");
        }
        if (role === 'tournament_host' && !creator.canCreateTournamentHost) {
            throw new Error("You don't have permission to create tournament hosts");
        }
        if (role === 'boss') {
            throw new Error("Cannot create boss users");
        }
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
const loginUser = async (credentials) => {
    const { email, password } = credentials;

    if (!email || !password) {
        throw new Error("Email and password are required");
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
        throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
        throw new Error("Your account has been deactivated. Please contact support.");
    }

    const isPasswordValid = decrypt(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }

    const s = serializeUser(user);
    delete s.createdBy;
    delete s.updatedAt;
    return s;
};

/**
 * Sign in with Google.
 *
 * A host is never CREATED by signing in — the Google account is matched to a
 * user an administrator already made. Without that rule anyone with a Google
 * account could sign in and be handed a tournament_host role, which is the
 * whole reason this is not the same flow as a player account.
 *
 * The match is on the Google-verified email. An unverified one proves nothing
 * about who controls the address, so it is refused.
 *
 * @param {string} credential - ID token from Google Identity Services
 * @returns {Promise<Object>} the same serialized user shape as loginUser
 */
const loginWithGoogle = async (credential) => {
    if (!config.googleClientId) throw new Error("Google sign-in is not configured");
    if (!credential) throw new Error("Missing Google credential");

    const client = new OAuth2Client(config.googleClientId);
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: config.googleClientId,
        });
        payload = ticket.getPayload();
    } catch {
        throw new Error("Could not verify that Google sign-in");
    }

    if (!payload?.sub) throw new Error("Could not verify that Google sign-in");
    if (payload.email_verified !== true || !payload.email) {
        throw new Error("That Google account has no verified email address");
    }

    const email = String(payload.email).toLowerCase();

    // Prefer the recorded link; fall back to the email for a first sign-in.
    let user = await prisma.user.findUnique({ where: { googleSub: payload.sub } });
    if (!user) {
        user = await prisma.user.findUnique({ where: { email } });

        if (user && user.googleSub && user.googleSub !== payload.sub) {
            throw new Error("Another Google account is already linked to this CricBid user");
        }

        if (user) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleSub: payload.sub, emailVerified: true, name: user.name || payload.name || null },
            });
        } else {
            // Anyone may sign in, and everyone starts as a player. A role is
            // something a boss grants afterwards to someone who already exists
            // — signing in never confers access to anything.
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
        }
    }

    if (!user.isActive) {
        throw new Error("Your account has been deactivated. Please contact support.");
    }

    const token = crypto.randomBytes(32).toString('hex');
    const withSession = await prisma.user.update({
        where: { id: user.id },
        data: { sessionToken: token, sessionExpiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });

    const s = serializeUser(withSession);
    delete s.createdBy;
    delete s.updatedAt;
    return { ...s, sessionToken: token };
};

/**
 * Resolve a session token to its user, or null when unknown or expired.
 */
const getUserBySessionToken = async (token) => {
    if (!token) return null;
    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (!user) return null;
    if (user.sessionExpiresAt && user.sessionExpiresAt.getTime() < Date.now()) {
        await prisma.user.update({
            where: { id: user.id },
            data: { sessionToken: null, sessionExpiresAt: null },
        });
        return null;
    }
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
const updateUser = async (updateData) => {
    const { userId, name, logo, isActive } = updateData;

    if (!userId) {
        throw new Error("User ID is required");
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
const deleteUser = async (userId, hardDelete = false) => {
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

    if (hardDelete) {
        await prisma.user.delete({ where: { id: userId } });
        return { message: "User permanently deleted" };
    } else {
        await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
        return { message: "User deactivated successfully" };
    }
};

module.exports = {
    loginWithGoogle,
    searchUsers,
    setUserAccess,
    getUserBySessionToken,
    createUser,
    loginUser,
    getUserDetail,
    getUsersByCreator,
    getUsersInHierarchy,
    getAllUsers,
    updateUser,
    deleteUser,
};
