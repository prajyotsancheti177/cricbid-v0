const crypto = require("crypto");
const prisma = require("../db/prisma");
const { encrypt, decrypt } = require("../utils/encryDecry");

const toInt = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
};
const toStr = (v) => (v === undefined || v === null ? undefined : String(v).trim());

const generateToken = () => crypto.randomBytes(32).toString("hex");

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
        data: { sessionToken: token },
    });

    const { password: _p, sessionToken: _t, ...safeProfile } = updated;
    return { token, profile: safeProfile };
};

// Get profile from session token
const getProfileByToken = async (token) => {
    if (!token) return null;
    const profile = await prisma.playerProfile.findUnique({ where: { sessionToken: token } });
    if (!profile) return null;
    const { password: _p, sessionToken: _t, ...safe } = profile;
    return safe;
};

// Update profile fields (requires profileId, validated upstream via token)
const updateProfile = async (profileId, data) => {
    const profileData = buildProfileData(data);
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
        data: { sessionToken: null },
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
    registerProfile,
    loginProfile,
    getProfileByToken,
    updateProfile,
    logoutProfile,
    lookupProfile,
    upsertProfile,
};
