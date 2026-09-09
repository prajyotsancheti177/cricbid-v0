/**
 * Player edit history.
 *
 * Every change to a player is recorded field by field, and everything done by
 * one action shares a batchId — so "undo" operates on the action a host
 * recognises ("renumbered 149 players") rather than on 149 separate rows.
 *
 * Undo is itself recorded rather than deleting history, so the trail always
 * reads forwards and an undo can be undone.
 */

const prisma = require("../db/prisma");
const { randomUUID } = require("crypto");

/** Values are stored as text; objects as JSON. null stays null. */
const encode = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
};

/** Fields worth remembering. Timestamps and ids are noise. */
const TRACKED = new Set([
    "name", "age", "gender", "photo", "skill", "mobile", "email", "address",
    "playerCategory", "auctionSerialNumber", "paymentVerified",
    "sold", "amtSold", "teamId", "customFields",
]);

const newBatchId = () => randomUUID();

/**
 * Record what an action changed.
 * @param {object} p
 * @param {Array<{playerId, playerName, field, oldValue, newValue}>} p.changes
 */
const record = async ({ tournamentId, changes, label, actorUserId = null, batchId = null, undoOfBatchId = null }) => {
    if (!tournamentId || !changes || changes.length === 0) return null;
    const id = batchId || newBatchId();
    try {
        await prisma.playerChange.createMany({
            data: changes.map(c => ({
                tournamentId,
                playerId: c.playerId,
                playerName: c.playerName ?? null,
                field: c.field,
                oldValue: encode(c.oldValue),
                newValue: encode(c.newValue),
                batchId: id,
                batchLabel: label,
                actorUserId,
                undoOfBatchId,
            })),
        });
    } catch (err) {
        // History must never be the reason an edit fails.
        console.error("[history] could not record changes:", err.message);
    }
    return id;
};

/** Diff a player before/after an update into recordable changes. */
const diff = (before, after) => {
    const changes = [];
    for (const field of TRACKED) {
        const a = before?.[field];
        const b = after?.[field];
        const same = (typeof a === "object" || typeof b === "object")
            ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
            : (a ?? null) === (b ?? null);
        if (!same) changes.push({ field, oldValue: a ?? null, newValue: b ?? null });
    }
    return changes;
};

/**
 * Recent actions, newest first, grouped into the batches a host sees.
 */
const listBatches = async (tournamentId, { limit = 40 } = {}) => {
    const rows = await prisma.playerChange.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "desc" },
        take: limit * 60,          // enough rows to fill `limit` batches
    });

    const batches = new Map();
    for (const r of rows) {
        if (!batches.has(r.batchId)) {
            batches.set(r.batchId, {
                batchId: r.batchId,
                label: r.batchLabel,
                at: r.createdAt,
                actorUserId: r.actorUserId,
                undoOfBatchId: r.undoOfBatchId,
                changeCount: 0,
                players: new Set(),
                sample: [],
            });
        }
        const b = batches.get(r.batchId);
        b.changeCount += 1;
        b.players.add(r.playerId);
        if (b.sample.length < 4) {
            b.sample.push({ playerName: r.playerName, field: r.field, oldValue: r.oldValue, newValue: r.newValue });
        }
    }

    const list = [...batches.values()].slice(0, limit);

    // Resolve who did what, in one query
    const actorIds = [...new Set(list.map(b => b.actorUserId).filter(Boolean))];
    const actors = actorIds.length
        ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
        : [];
    const actorById = new Map(actors.map(u => [u.id, u.name || u.email]));

    return list.map(b => ({
        batchId: b.batchId,
        label: b.label,
        at: b.at,
        actor: b.actorUserId ? (actorById.get(b.actorUserId) || "Unknown user") : null,
        isUndo: !!b.undoOfBatchId,
        changeCount: b.changeCount,
        playerCount: b.players.size,
        sample: b.sample,
    }));
};

module.exports = { record, diff, listBatches, newBatchId, encode, TRACKED };
