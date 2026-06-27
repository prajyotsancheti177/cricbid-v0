const User = require("../models/user");
const { decrypt } = require('../utils/encryDecry');

/**
 * Create a new user (role-based)
 * @param {Object} userData - User creation data
 * @param {string} userData.name - User's name
 * @param {string} userData.email - User's email
 * @param {string} userData.password - User's password
 * @param {string} userData.role - User's role (boss, super_user, tournament_host)
 * @param {string} userData.createdBy - ID of user creating this account
 * @param {string} userData.logo - Logo (for tournament hosts)
 * @returns {Object} Created user data
 */
const createUser = async (userData) => {
    const { name, email, password, role, createdBy, logo } = userData;

    if (!name || !email || !password || !role) {
        throw new Error("Name, email, password, and role are required");
    }

    // Validate role
    const validRoles = ['boss', 'super_user', 'tournament_host'];
    if (!validRoles.includes(role)) {
        throw new Error("Invalid role. Must be: boss, super_user, or tournament_host");
    }

    // Check permissions of creator
    if (createdBy) {
        const creator = await User.findById(createdBy);
        if (!creator) {
            throw new Error("Creator user not found");
        }

        // Boss can create super users and tournament hosts
        // Super users can only create tournament hosts
        // Tournament hosts cannot create other users
        if (role === 'super_user' && !creator.permissions.canCreateSuperUser) {
            throw new Error("You don't have permission to create super users");
        }
        
        if (role === 'tournament_host' && !creator.permissions.canCreateTournamentHost) {
            throw new Error("You don't have permission to create tournament hosts");
        }

        if (role === 'boss') {
            throw new Error("Cannot create boss users");
        }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw new Error("User with this email already exists");
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

    const newUser = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password, // Will be encrypted by the pre-save hook
        role,
        createdBy: createdBy || null,
        logo: logo || null
    });

    const savedUser = await newUser.save();

    // Return user data without password
    return {
        _id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        createdBy: savedUser.createdBy,
        logo: savedUser.logo,
        permissions: savedUser.permissions,
        isActive: savedUser.isActive,
        createdAt: savedUser.createdAt
    };
};

/**
 * Login user with email and password
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - User's email
 * @param {string} credentials.password - User's password
 * @returns {Object} User data without password
 */
const loginUser = async (credentials) => {
    const { email, password } = credentials;

    if (!email || !password) {
        throw new Error("Email and password are required");
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new Error("Invalid email or password");
    }

    // Check if user is active
    if (!user.isActive) {
        throw new Error("Your account has been deactivated. Please contact support.");
    }

    // Verify password
    const isPasswordValid = decrypt(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }

    // Return user data without password
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        logo: user.logo,
        isActive: user.isActive,
        createdAt: user.createdAt
    };
};

/**
 * Get user details by ID
 * @param {string} userId - User ID
 * @returns {Object} User data without password
 */
const getUserDetail = async (userId) => {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const user = await User.findById(userId).select('-password').populate('createdBy', 'name email role');
    if (!user) {
        throw new Error("User not found");
    }

    return user;
};

/**
 * Get all users created by a specific user
 * @param {string} creatorId - Creator user ID
 * @returns {Array} List of users
 */
const getUsersByCreator = async (creatorId) => {
    if (!creatorId) {
        throw new Error("Creator ID is required");
    }

    const users = await User.find({ createdBy: creatorId })
        .select('-password')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 });
    
    return users;
};

/**
 * Get all users in hierarchy (created by user and their descendants)
 * @param {string} userId - User ID
 * @returns {Array} List of users in hierarchy
 */
const getUsersInHierarchy = async (userId) => {
    if (!userId) {
        throw new Error("User ID is required");
    }

    // Get the current user to check their role
    const currentUser = await User.findById(userId);
    if (!currentUser) {
        throw new Error("User not found");
    }

    // Boss can see all users
    if (currentUser.role === 'boss') {
        return await getAllUsers();
    }

    // For super_user and tournament_host, get their created users and descendants
    const hierarchy = [];
    const processedIds = new Set();

    // Recursive function to get users and their descendants
    const getDescendants = async (parentId) => {
        if (processedIds.has(parentId.toString())) {
            return;
        }
        processedIds.add(parentId.toString());

        const users = await User.find({ createdBy: parentId })
            .select('-password')
            .populate('createdBy', 'name email role')
            .sort({ createdAt: -1 });

        for (const user of users) {
            hierarchy.push(user);
            // Recursively get descendants of this user
            await getDescendants(user._id);
        }
    };

    await getDescendants(userId);
    return hierarchy;
};

/**
 * Get all users (for boss user)
 * @param {Object} filters - Optional filters
 * @returns {Array} List of users
 */
const getAllUsers = async (filters = {}) => {
    const query = {};
    
    if (filters.role) {
        query.role = filters.role;
    }
    
    if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
    }

    const users = await User.find(query)
        .select('-password')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 });
    
    return users;
};

/**
 * Update user details
 * @param {Object} updateData - User update data
 * @returns {Object} Updated user data
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

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true }
    ).select('-password');

    if (!updatedUser) {
        throw new Error("User not found");
    }

    return updatedUser;
};

/**
 * Delete/deactivate user
 * @param {string} userId - User ID
 * @param {boolean} hardDelete - Whether to permanently delete
 * @returns {Object} Result
 */
const deleteUser = async (userId, hardDelete = false) => {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    if (user.role === 'boss') {
        throw new Error("Cannot delete boss user");
    }

    if (hardDelete) {
        await User.findByIdAndDelete(userId);
        return { message: "User permanently deleted" };
    } else {
        await User.findByIdAndUpdate(userId, { isActive: false });
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
    deleteUser
};
