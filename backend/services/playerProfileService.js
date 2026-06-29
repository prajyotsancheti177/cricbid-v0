const prisma = require("../db/prisma");

const toInt = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

const toStr = (v) => (v === undefined || v === null ? undefined : String(v).trim());

const lookupProfile = async (mobile) => {
    const cleaned = String(mobile || '').trim().replace(/\D/g, '');
    if (!cleaned) throw new Error("Mobile number is required");

    const profile = await prisma.playerProfile.findUnique({
        where: { mobile: cleaned },
    });
    return profile;
};

// Creates or updates a player profile by mobile. Called after a successful registration.
const upsertProfile = async (data) => {
    const mobile = String(data.mobile || '').trim().replace(/\D/g, '');
    if (!mobile) return null;

    const profileData = {};
    if (data.name !== undefined) profileData.name = toStr(data.name);
    if (data.age !== undefined) { const v = toInt(data.age); if (v !== undefined) profileData.age = v; }
    if (data.gender !== undefined) profileData.gender = toStr(data.gender);
    if (data.skill !== undefined) profileData.skill = toStr(data.skill);
    if (data.email !== undefined) profileData.email = toStr(data.email);
    if (data.address !== undefined) profileData.address = toStr(data.address);
    // Only update photo if a new one was uploaded (non-empty)
    if (data.photo) profileData.photo = toStr(data.photo);

    return prisma.playerProfile.upsert({
        where: { mobile },
        update: profileData,
        create: { mobile, ...profileData },
    });
};

module.exports = { lookupProfile, upsertProfile };
