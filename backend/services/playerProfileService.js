const crypto = require("crypto");
const prisma = require("../db/prisma");
const userService = require("./userService");

/**
 * Player accounts and the players they own.
 *
 * An account is a login; a profile is a player. One account owns several
 * profiles, because a parent signs in once and registers two children.
 *
 * There is no password. Google is the way in today and WhatsApp OTP will join
 * it; nothing here accepts a secret a player has to remember.
 */

const toInt = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
};
const toStr = (v) => (v === undefined || v === null ? undefined : String(v).trim());

const generateToken = () => crypto.randomBytes(32).toString("hex");

// Long enough that a player registering for next season is not asked to sign in
// again, short enough that a leaked token is not a permanent key.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);

const cleanMobile = (mobile) => String(mobile || '').trim().replace(/\D/g, '');

const buildProfileData = (data) => {
    const d = {};
    if (data.name !== undefined) d.name = toStr(data.name);
    if (data.age !== undefined) { const v = toInt(data.age); if (v !== undefined) d.age = v; }
    if (data.gender !== undefined) d.gender = toStr(data.gender);
    if (data.skill !== undefined) d.skill = toStr(data.skill);
    if (data.email !== undefined) d.email = toStr(data.email);
    if (data.address !== undefined) d.address = toStr(data.address);
    if (data.photo) d.photo = toStr(data.photo);
    if (data.mobile !== undefined) {
        const mob = cleanMobile(data.mobile);
        if (mob && mob.length < 10) throw new Error("Enter a valid 10-digit mobile number");
        d.mobile = mob || null;
    }
    return d;
};

/**
 * Resolve a session token to its account and players.
 * @returns {Promise<Object|null>} null when the token is unknown or expired
 */
const getAccountByToken = async (token) => {
    const user = await userService.getUserBySessionToken(token);
    if (!user) return null;
    const profiles = await prisma.playerProfile.findMany({
        where: { userId: user._id || user.id },
        orderBy: { createdAt: 'asc' },
    });
    return {
        id: user._id || user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        profiles,
    };
};

/** Every player this user owns. */
const listProfiles = (userId) =>
    prisma.playerProfile.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

/**
 * Add a player to an account — a second child, say.
 *
 * No uniqueness check on name or mobile: two siblings sharing one parent's
 * number is the case this split exists to support.
 */
const createProfile = async (userId, data) => {
    const profileData = buildProfileData(data);
    if (!profileData.name) throw new Error("Player name is required");
    return prisma.playerProfile.create({ data: { userId, ...profileData } });
};

/**
 * Edit a player.
 *
 * Ownership is checked here rather than trusted from the caller: a profile id
 * is guessable, and a session only proves which account is asking.
 */
const updateProfile = async (userId, profileId, data) => {
    const existing = await prisma.playerProfile.findUnique({ where: { id: profileId } });
    if (!existing || existing.userId !== userId) throw new Error("Player not found");
    return prisma.playerProfile.update({
        where: { id: profileId },
        data: buildProfileData(data),
    });
};

/** Remove a player from an account. */
const deleteProfile = async (userId, profileId) => {
    const existing = await prisma.playerProfile.findUnique({ where: { id: profileId } });
    if (!existing || existing.userId !== userId) throw new Error("Player not found");
    await prisma.playerProfile.delete({ where: { id: profileId } });
};

const logoutAccount = async (userId) => {
    await prisma.user.update({
        where: { id: userId },
        data: { sessionToken: null, sessionExpiresAt: null },
    });
};

module.exports = {
    getAccountByToken,
    listProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    logoutAccount,
};
