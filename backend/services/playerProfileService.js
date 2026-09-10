const crypto = require("crypto");
const prisma = require("../db/prisma");
const { OAuth2Client } = require("google-auth-library");
const config = require("../config");

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

/** An account and its players, with nothing secret in it. */
const publicAccount = (account) => ({
    id: account.id,
    email: account.email,
    emailVerified: account.emailVerified,
    mobile: account.mobile,
    mobileVerified: account.mobileVerified,
    profiles: account.profiles || [],
});

/**
 * Sign in with Google.
 *
 * Verifies the ID token against Google's own keys — a `sub` or an email the
 * client hands us proves nothing — then finds or creates the account.
 *
 * Deliberately does NOT adopt one of the profiles auto-created by public
 * registration, even when the emails or numbers match. Those rows are unowned
 * and hold another person's name, photo and address; claiming one on an
 * unproven signal is an account takeover with extra steps.
 *
 * @param {string} credential - ID token from Google Identity Services
 * @returns {Promise<{token: string, account: Object}>}
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
        // Deliberately vague: a caller does not need to know which check failed.
        throw new Error("Could not verify that Google sign-in");
    }
    if (!payload?.sub) throw new Error("Could not verify that Google sign-in");

    // An unverified Google email is not proof of anything, so it is stored but
    // never marked verified.
    const emailVerified = payload.email_verified === true;

    let account = await prisma.playerAccount.findUnique({ where: { googleSub: payload.sub } });
    if (!account) {
        account = await prisma.playerAccount.create({
            data: { googleSub: payload.sub, email: payload.email || null, emailVerified },
        });
    }

    const token = generateToken();
    const updated = await prisma.playerAccount.update({
        where: { id: account.id },
        data: {
            email: payload.email || account.email,
            emailVerified,
            sessionToken: token,
            sessionExpiresAt: sessionExpiry(),
        },
        include: { profiles: { orderBy: { createdAt: 'asc' } } },
    });

    return { token, account: publicAccount(updated) };
};

/**
 * Resolve a session token to its account and players.
 * @returns {Promise<Object|null>} null when the token is unknown or expired
 */
const getAccountByToken = async (token) => {
    if (!token) return null;
    const account = await prisma.playerAccount.findUnique({
        where: { sessionToken: token },
        include: { profiles: { orderBy: { createdAt: 'asc' } } },
    });
    if (!account) return null;

    if (account.sessionExpiresAt && account.sessionExpiresAt.getTime() < Date.now()) {
        await prisma.playerAccount.update({
            where: { id: account.id },
            data: { sessionToken: null, sessionExpiresAt: null },
        });
        return null;
    }

    return publicAccount(account);
};

/** Every player this account owns. */
const listProfiles = (accountId) =>
    prisma.playerProfile.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' } });

/**
 * Add a player to an account — a second child, say.
 *
 * No uniqueness check on name or mobile: two siblings sharing one parent's
 * number is the case this split exists to support.
 */
const createProfile = async (accountId, data) => {
    const profileData = buildProfileData(data);
    if (!profileData.name) throw new Error("Player name is required");
    return prisma.playerProfile.create({ data: { accountId, ...profileData } });
};

/**
 * Edit a player.
 *
 * Ownership is checked here rather than trusted from the caller: a profile id
 * is guessable, and a session only proves which account is asking.
 */
const updateProfile = async (accountId, profileId, data) => {
    const existing = await prisma.playerProfile.findUnique({ where: { id: profileId } });
    if (!existing || existing.accountId !== accountId) throw new Error("Player not found");
    return prisma.playerProfile.update({
        where: { id: profileId },
        data: buildProfileData(data),
    });
};

/** Remove a player from an account. */
const deleteProfile = async (accountId, profileId) => {
    const existing = await prisma.playerProfile.findUnique({ where: { id: profileId } });
    if (!existing || existing.accountId !== accountId) throw new Error("Player not found");
    await prisma.playerProfile.delete({ where: { id: profileId } });
};

const logoutAccount = async (accountId) => {
    await prisma.playerAccount.update({
        where: { id: accountId },
        data: { sessionToken: null, sessionExpiresAt: null },
    });
};

module.exports = {
    loginWithGoogle,
    getAccountByToken,
    listProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    logoutAccount,
};
