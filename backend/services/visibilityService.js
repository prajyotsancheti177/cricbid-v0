const prisma = require("../db/prisma");
const eventService = require("./eventService");
const manifest = require("../../shared/visibility-manifest.json");

/**
 * Role visibility: which roles see which pages, workspace tabs and actions.
 *
 * The manifest (shared/visibility-manifest.json) is the source of truth for
 * what exists, what each role gets by default, and the most it could ever get
 * (the "ceiling"). The role_visibility table holds only a boss's changes.
 *
 * A role sees a resource when:
 *   it is within the ceiling, AND
 *   it is locked for that role, OR a boss switched it on, OR (no change and)
 *   the default includes it.
 *
 * So the page can take things away and give them back, but never hand a role
 * more than the server was written to allow — and a `player` never gets
 * anything, because no ceiling may contain it.
 *
 * This decides what is SHOWN, and — for resources marked `enforced` — what the
 * API accepts (requireVisible). It never replaces tournament-level permission:
 * a visible tab still needs canManageTournament on that tournament.
 */

const ROLES = manifest.roles;
const RESOURCES = manifest.resources;
const KEYS = Object.keys(RESOURCES);

/* Refuse to run on a manifest that could leak access. */
(() => {
    for (const key of KEYS) {
        const r = RESOURCES[key];
        const where = `visibility manifest: ${key}`;
        for (const field of ['ceiling', 'default']) {
            if (!Array.isArray(r[field])) throw new Error(`${where}: ${field} must be a list`);
        }
        const all = [...r.ceiling, ...r.default, ...(r.locked || [])];
        const unknown = all.find((role) => !ROLES.includes(role));
        if (unknown) throw new Error(`${where}: unknown role ${unknown}`);
        if (r.ceiling.includes('player')) throw new Error(`${where}: a player may never be given a managing resource`);
        if (r.default.some((role) => !r.ceiling.includes(role))) throw new Error(`${where}: default exceeds ceiling`);
        if ((r.locked || []).some((role) => !r.ceiling.includes(role))) throw new Error(`${where}: locked exceeds ceiling`);
    }
})();

/**
 * Overrides, cached. Production runs one process, and every write here clears
 * the cache, so the TTL only matters for a change made directly in the
 * database (or by a second process, should there ever be one).
 */
const CACHE_TTL_MS = 15 * 1000;
let cache = null; // { at, overrides: Map<"role|key", boolean>, version }

const loadOverrides = async () => {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
    const rows = await prisma.roleVisibility.findMany();
    const overrides = new Map();
    let latest = 0;
    for (const row of rows) {
        // Rows for resources that no longer exist are ignored, not deleted:
        // the page lists them as orphaned so a boss can see what went away.
        overrides.set(`${row.role}|${row.resourceKey}`, row.visible);
        latest = Math.max(latest, row.updatedAt.getTime());
    }
    cache = { at: Date.now(), overrides, rows, version: `${rows.length}-${latest}` };
    return cache;
};

const invalidate = () => { cache = null; };

/** The decision itself, given the overrides. */
const decide = (role, key, overrides) => {
    const r = RESOURCES[key];
    if (!r || !role) return false;
    if (!r.ceiling.includes(role)) return false;
    if ((r.locked || []).includes(role)) return true;
    const o = overrides.get(`${role}|${key}`);
    if (o !== undefined) return o;
    return r.default.includes(role);
};

/** Whether this role sees this resource. */
const isVisible = async (role, key) => decide(role, key, (await loadOverrides()).overrides);

/** Every key this role sees, plus a version for cache-busting. */
const resolvedFor = async (role) => {
    const { overrides, version } = await loadOverrides();
    return { version, visible: role ? KEYS.filter((k) => decide(role, k, overrides)) : [] };
};

/** The full picture for the control page. */
const matrix = async () => {
    const { overrides, rows, version } = await loadOverrides();
    const resources = KEYS.map((key) => {
        const r = RESOURCES[key];
        const cells = {};
        for (const role of ROLES) {
            const override = overrides.get(`${role}|${key}`);
            cells[role] = {
                visible: decide(role, key, overrides),
                default: r.default.includes(role),
                allowed: r.ceiling.includes(role),
                locked: (r.locked || []).includes(role),
                override: override === undefined ? null : override,
            };
        }
        return { key, ...r, cells };
    });
    const orphaned = rows.filter((row) => !RESOURCES[row.resourceKey]).map((row) => ({ role: row.role, key: row.resourceKey, visible: row.visible }));
    return { version, roles: ROLES, roleLabels: manifest.roleLabels, groups: manifest.groups, resources, orphaned };
};

/**
 * Apply a boss's changes.
 *
 * @param {{ id: string, role: string }} actor - from the session
 * @param {Array<{ role: string, key: string, visible: boolean|null }>} changes
 *   visible null resets that cell to the default (removes the row)
 */
const applyChanges = async (actor, changes) => {
    if (!actor || actor.role !== 'boss') throw new Error("Only a boss can change role visibility");
    if (!Array.isArray(changes) || !changes.length) throw new Error("No changes");
    if (changes.length > 500) throw new Error("Too many changes at once");

    // Validate everything before writing anything.
    for (const c of changes) {
        const r = RESOURCES[c.key];
        if (!r) throw new Error(`Unknown item: ${c.key}`);
        if (!ROLES.includes(c.role)) throw new Error(`Unknown role: ${c.role}`);
        if (!r.ceiling.includes(c.role)) throw new Error(`${r.label} can never be given to ${manifest.roleLabels[c.role] || c.role}`);
        if ((r.locked || []).includes(c.role)) throw new Error(`${r.label} is always on for ${manifest.roleLabels[c.role] || c.role}`);
        if (c.visible !== null && typeof c.visible !== 'boolean') throw new Error("visible must be true, false or null");
    }

    const before = (await loadOverrides()).overrides;
    const audit = changes.map((c) => ({
        role: c.role,
        key: c.key,
        from: decide(c.role, c.key, before),
        to: c.visible === null ? RESOURCES[c.key].default.includes(c.role) : c.visible,
        reset: c.visible === null,
    }));

    await prisma.$transaction(changes.map((c) => {
        const where = { role_resourceKey: { role: c.role, resourceKey: c.key } };
        if (c.visible === null) {
            return prisma.roleVisibility.deleteMany({ where: { role: c.role, resourceKey: c.key } });
        }
        // A change back to the default is stored as "no change", so a later
        // edit to the manifest's default still reaches this role.
        if (c.visible === RESOURCES[c.key].default.includes(c.role)) {
            return prisma.roleVisibility.deleteMany({ where: { role: c.role, resourceKey: c.key } });
        }
        return prisma.roleVisibility.upsert({
            where,
            create: { role: c.role, resourceKey: c.key, visible: c.visible, updatedById: actor.id },
            update: { visible: c.visible, updatedById: actor.id },
        });
    }));
    invalidate();

    // Durable record of who changed what (pm2 logs rotate).
    eventService.trackEvent({
        userId: actor.id,
        eventType: 'visibility_changed',
        page: '/site-settings/visibility',
        eventData: { changes: audit },
    }).catch(() => {});

    return matrix();
};

/** Recent changes, newest first, with who made them. */
const history = async (limit = 30) => {
    const events = await prisma.userEvent.findMany({
        where: { eventType: 'visibility_changed' },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 30, 100),
        select: { createdAt: true, eventData: true, user: { select: { name: true, email: true } } },
    });
    return events.map((e) => ({
        at: e.createdAt,
        by: e.user ? (e.user.name || e.user.email) : null,
        changes: (e.eventData && e.eventData.changes) || [],
    }));
};

module.exports = { RESOURCES, ROLES, isVisible, resolvedFor, matrix, applyChanges, history, invalidate };
