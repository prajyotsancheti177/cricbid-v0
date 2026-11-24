const prisma = require("../db/prisma");
const { serializePlayer } = require("../utils/serialize");

const playerCategories = async (tournamentId) => {
    const tournamentData = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournamentData) {
        throw new Error("Tournament not found");
    }
    return tournamentData.playerCategories || [];
};

/**
 * Pick the next auction candidate. `orderMode`:
 *  - 'random' (default) — uniform random pick, current behavior.
 *  - 'serial' — lowest `auctionSerialNumber` first (nulls sort last in Postgres).
 * Category filtering (including the Regular/Icon re-entry rule) applies
 * identically in both modes — only the pick strategy within the filtered
 * pool changes.
 */
/**
 * Picks the next player to put on the block.
 *
 * `current` is the player already on the block, if any: { id, serial }.
 * Selecting a player does not mark them auctioned, so without this the serial
 * order kept returning the same lowest-serial player and "Next" appeared dead.
 */
/**
 * Uniform random pick among players matching `where`. The original random
 * strategy, unchanged: count, then skip to a random offset.
 */
const randomPick = async (where) => {
    const count = await prisma.player.count({ where });
    if (count === 0) return null;
    const skip = Math.floor(Math.random() * count);
    const [candidate] = await prisma.player.findMany({ where, skip, take: 1 });
    return candidate || null;
};

/**
 * Pick from a preset random order (the `presetRandomOrder` tournament feature).
 *
 * The order was shuffled once when the host chose Random; here we walk it:
 * the earliest listed player who is still eligible (same filter as always —
 * category, unsold, not yet called, payment verified) and not on the block.
 *
 * A player who became eligible after the shuffle (verified mid-auction, say)
 * is not in the list. Once every listed player is used up, those are drawn at
 * random — the caller appends them to the list so the download stays true.
 * Returns { candidate, offList }.
 */
const pickFromPresetOrder = async (where, notCurrent, presetOrder, currentId) => {
    const listed = await prisma.player.findMany({
        where: { AND: [where, notCurrent, { id: { in: presetOrder } }] },
        select: { id: true },
    });
    if (listed.length) {
        const position = new Map(presetOrder.map((id, i) => [id, i]));
        listed.sort((a, b) => position.get(a.id) - position.get(b.id));
        // "Next" without a result does not mark anyone called, so move forward
        // from whoever is on the block; wrap to the start for anyone skipped
        // earlier — the same way serial order advances.
        const from = currentId && position.has(currentId) ? position.get(currentId) : -1;
        const ahead = listed.find((r) => position.get(r.id) > from) || listed[0];
        const candidate = await prisma.player.findUnique({ where: { id: ahead.id } });
        return { candidate, offList: false };
    }
    const unlisted = await randomPick({ AND: [where, notCurrent, { id: { notIn: presetOrder } }] });
    if (unlisted) return { candidate: unlisted, offList: true };
    return { candidate: null, offList: false };
};

const nextAuctionPlayer = async (touranmentId, playerCategory, orderMode = 'random', current = {}, presetOrder = null) => {
    if (!touranmentId) {
        throw new Error("touranmentId is required");
    }

    // Build the candidate filter (mirrors the old $match)
    // paymentVerified gates entry to the auction: a player who registered but
    // has not been verified by the host is not callable for bidding.
    let where = {
        touranmentId,
        sold: false,
        auctionStatus: false,
        paymentVerified: true,
    };
    if (playerCategory && playerCategory !== "All" && playerCategory !== "Regular") {
        where.playerCategory = playerCategory;
    }
    if (playerCategory === "Regular") {
        where = {
            touranmentId,
            sold: false,
            paymentVerified: true,
            OR: [
                { auctionStatus: false, playerCategory: "Regular" },
                { auctionStatus: true, playerCategory: "Icon" },
            ],
        };
    }

    // Serial 0 is a real serial number, so test for null rather than falsiness.
    const currentSerial = (current && current.serial !== undefined && current.serial !== null)
        ? current.serial : null;
    const currentId = (current && current.id) ? String(current.id) : null;
    const notCurrent = currentId ? { NOT: { id: currentId } } : {};

    let candidate;
    if (orderMode === 'serial') {
        // Advance past whoever is on the block.
        if (currentSerial !== null) {
            [candidate] = await prisma.player.findMany({
                where: { ...where, auctionSerialNumber: { gt: currentSerial } },
                orderBy: { auctionSerialNumber: 'asc' },
                take: 1,
            });
        }
        // Nothing further along: wrap to the lowest remaining, so players
        // skipped earlier in the list can still be reached.
        if (!candidate) {
            [candidate] = await prisma.player.findMany({
                where: { ...where, ...notCurrent },
                orderBy: { auctionSerialNumber: 'asc' },
                take: 1,
            });
        }
        if (!candidate) {
            throw new Error("No more players available for auction.");
        }
    } else if (Array.isArray(presetOrder) && presetOrder.length > 0) {
        // Preset random order: walk the list shuffled when Random was chosen.
        ({ candidate } = await pickFromPresetOrder(where, notCurrent, presetOrder, currentId));
        if (!candidate) {
            // Only the player on the block is left — same fallback as below.
            candidate = await randomPick(where);
            if (!candidate) throw new Error("No more players available for auction.");
        }
    } else {
        // Random selection (replaces $sample): pick a random matching candidate,
        // never handing back the player already on the block.
        const randomWhere = { ...where, ...notCurrent };
        let count = await prisma.player.count({ where: randomWhere });
        if (count === 0) {
            // only the current player is left — fall back to the plain filter
            count = await prisma.player.count({ where });
            if (count === 0) throw new Error("No more players available for auction.");
            const skipOnly = Math.floor(Math.random() * count);
            [candidate] = await prisma.player.findMany({ where, skip: skipOnly, take: 1 });
        } else {
            const skip = Math.floor(Math.random() * count);
            [candidate] = await prisma.player.findMany({ where: randomWhere, skip, take: 1 });
        }
    }

    const nextPlayer = serializePlayer(candidate);

    // Attach base price for the player's category
    const tournamentData = await prisma.tournament.findUnique({ where: { id: touranmentId } });
    const map = tournamentData?.categoryBasePrices;
    nextPlayer.basePrice = (map && nextPlayer.playerCategory) ? (map[nextPlayer.playerCategory] || 0) : 0;

    return nextPlayer;
};

/**
 * Everyone who could be called right now, in any category: the pool a preset
 * random order is shuffled from. Same gate as nextAuctionPlayer's 'All'.
 */
const eligiblePlayerIds = async (touranmentId) => {
    const rows = await prisma.player.findMany({
        where: { touranmentId, sold: false, auctionStatus: false, paymentVerified: true },
        select: { id: true },
    });
    return rows.map((r) => r.id);
};

module.exports = {
    playerCategories,
    nextAuctionPlayer,
    eligiblePlayerIds,
};
