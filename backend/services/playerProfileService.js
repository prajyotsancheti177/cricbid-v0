const crypto = require("crypto");
const prisma = require("../db/prisma");
const { encrypt, decrypt } = require("../utils/encryDecry");
const { OAuth2Client } = require("google-auth-library");
const config = require("../config");

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

// Clean mobile to digits only
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
    return d;
};

// Register a new player profile with password
const registerProfile = async ({ mobile, password, name, age, gender, skill, email, address }) => {
    const mob = cleanMobile(mobile);
    if (!mob || mob.length < 10) throw new Error("Valid 10-digit mobile number is required");
    if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");
    if (!name || !name.trim()) throw new Error("Name is required");

    const existing = await prisma.playerProfile.findUnique({ where: { mobile: mob } });
    if (existing) throw new Error("A profile already exists for this mobile number. Please login.");

    const hashed = encrypt(password);
    const profileData = buildProfileData({ name, age, gender, skill, email, address });

    return prisma.playerProfile.create({
        data: { mobile: mob, password: hashed, ...profileData },
    });
};

// Login and return a session token
const loginProfile = async ({ mobile, password }) => {
    const mob = cleanMobile(mobile);
    if (!mob) throw new Error("Mobile number is required");
    if (!password) throw new Error("Password is required");

    const profile = await prisma.playerProfile.findUnique({ where: { mobile: mob } });
    if (!profile || !profile.password) throw new Error("No account found for this mobile number");

    const valid = decrypt(password, profile.password);
    if (!valid) throw new Error("Incorrect password");

    const token = generateToken();
    const updated = await prisma.playerProfile.update({
        where: { id: profile.id },
        data: { sessionToken: token, sessionExpiresAt: sessionExpiry() },
    });

    const { password: _p, sessionToken: _t, ...safeProfile } = updated;
    return { token, profile: safeProfile };
};

/**
 * Sign in with Google.
 *
 * Verifies the ID token against Google's own keys — never trust a `sub` or an
 * email the client hands us — then finds or creates the profile keyed on the
 * Google account id.
 *
 * Deliberately does NOT adopt one of the profiles auto-created from public
 * registrations, even when the emails match. Those rows have no owner and
 * contain another person's name, photo and address; inheriting one on an
 * unproven signal is an account takeover with extra steps. A new Google user
 * starts from scratch and their profile becomes useful from their next
 * registration onwards.
 *
 * @param {string} credential - the ID token from Google Identity Services
 * @returns {Promise<{token: string, profile: Object, needsMobile: boolean}>}
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
    // never treated as verified.
    const emailVerified = payload.email_verified === true;

    let profile = await prisma.playerProfile.findUnique({ where: { googleSub: payload.sub } });

    if (!profile) {
        profile = await prisma.playerProfile.create({
            data: {
                googleSub: payload.sub,
                email: payload.email || null,
                emailVerified,
                name: payload.name || null,
                photo: payload.picture || null,
            },
        });
    } else {
        // Keep the Google-owned fields current; leave anything the player has
        // edited themselves alone.
        profile = await prisma.playerProfile.update({
            where: { id: profile.id },
            data: { email: payload.email || profile.email, emailVerified },
        });
    }

    const token = generateToken();
    const updated = await prisma.playerProfile.update({
        where: { id: profile.id },
        data: { sessionToken: token, sessionExpiresAt: sessionExpiry() },
    });

    const { password: _p, sessionToken: _t, ...safeProfile } = updated;
    return {
        token,
        profile: safeProfile,
        // The front end asks for a number once; phone is what ties a profile to
        // registrations and to WhatsApp.
        needsMobile: !updated.mobile && !updated.pendingMobile,
    };
};

// Get profile from session token
const getProfileByToken = async (token) => {
    if (!token) return null;
    const profile = await prisma.playerProfile.findUnique({ where: { sessionToken: token } });
    if (!profile) return null;

    // A token with no expiry predates sessions having one; treat it as valid so
    // the two existing logins are not broken, and stamp an expiry on it.
    if (profile.sessionExpiresAt && profile.sessionExpiresAt.getTime() < Date.now()) {
        await prisma.playerProfile.update({
            where: { id: profile.id },
            data: { sessionToken: null, sessionExpiresAt: null },
        });
        return null;
    }

    const { password: _p, sessionToken: _t, ...safe } = profile;
    return safe;
};

// Update profile fields (requires profileId, validated upstream via token)
const updateProfile = async (profileId, data) => {
    const profileData = buildProfileData(data);

    // The number a player types about themselves is a claim, not a fact, so it
    // lands in pendingMobile. Only an OTP may write `mobile` and set
    // mobileVerified — nothing on this path can.
    if (data.mobile !== undefined || data.pendingMobile !== undefined) {
        const claimed = cleanMobile(data.pendingMobile ?? data.mobile);
        if (claimed && claimed.length < 10) throw new Error("Enter a valid 10-digit mobile number");
        profileData.pendingMobile = claimed || null;
    }
    const updated = await prisma.playerProfile.update({
        where: { id: profileId },
        data: profileData,
    });
    const { password: _p, sessionToken: _t, ...safe } = updated;
    return safe;
};

// Logout — clear session token
const logoutProfile = async (profileId) => {
    await prisma.playerProfile.update({
        where: { id: profileId },
        data: { sessionToken: null, sessionExpiresAt: null },
    });
};

// Simple lookup by mobile (used during public registration auto-fill)
const lookupProfile = async (mobile) => {
    const mob = cleanMobile(mobile);
    if (!mob) throw new Error("Mobile number is required");
    const profile = await prisma.playerProfile.findUnique({ where: { mobile: mob } });
    if (!profile) return null;
    const { password: _p, sessionToken: _t, ...safe } = profile;
    return safe;
};

// Upsert profile after public registration (updates core fields, no auth needed)
const upsertProfile = async (data) => {
    const mobile = cleanMobile(data.mobile);
    if (!mobile) return null;

    const profileData = buildProfileData(data);

    return prisma.playerProfile.upsert({
        where: { mobile },
        update: profileData,
        create: { mobile, ...profileData },
    });
};

module.exports = {
    loginWithGoogle,
    registerProfile,
    loginProfile,
    getProfileByToken,
    updateProfile,
    logoutProfile,
    lookupProfile,
    upsertProfile,
};
