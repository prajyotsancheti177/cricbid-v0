const prisma = require("../db/prisma");
const { encrypt, decrypt } = require('../utils/encryDecry');

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
    createUser,
    loginUser,
    getUserDetail,
    getUsersByCreator,
    getUsersInHierarchy,
    getAllUsers,
    updateUser,
    deleteUser,
};
