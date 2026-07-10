const prisma = require("../db/prisma");

const DEFAULT_SETTINGS = {
    maskFemalePlayers: false,
};

/**
 * Get the site-wide settings singleton, merged over defaults so new keys
 * added later don't need a migration to backfill existing rows.
 */
const getSiteSettings = async () => {
    const row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    return { ...DEFAULT_SETTINGS, ...(row?.settings || {}) };
};

/**
 * Update the site-wide settings singleton. Only boss/super_user accounts may
 * change site-wide settings, since this affects every tournament, not just
 * ones the requesting user owns.
 */
const updateSiteSettings = async (patch, userId) => {
    if (!userId) {
        throw new Error("userId is required");
    }
    const requester = await prisma.user.findUnique({ where: { id: userId } });
    if (!requester || !["boss", "super_user"].includes(requester.role)) {
        throw new Error("You don't have permission to change site-wide settings");
    }

    const current = await getSiteSettings();
    const merged = { ...current, ...patch };

    await prisma.siteSettings.upsert({
        where: { id: 1 },
        update: { settings: merged },
        create: { id: 1, settings: merged },
    });

    return merged;
};

module.exports = { getSiteSettings, updateSiteSettings };
