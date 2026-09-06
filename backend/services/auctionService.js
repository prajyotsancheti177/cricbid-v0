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
const nextAuctionPlayer = async (touranmentId, playerCategory, orderMode = 'random', current = {}) => {
    if (!touranmentId) {
        throw new Error("touranmentId is required");
    }

    // Build the candidate filter (mirrors the old $match)
    let where = {
        touranmentId,
        sold: false,
        auctionStatus: false,
    };
    if (playerCategory && playerCategory !== "All" && playerCategory !== "Regular") {
        where.playerCategory = playerCategory;
    }
    if (playerCategory === "Regular") {
        where = {
            touranmentId,
            sold: false,
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

module.exports = {
    playerCategories,
    nextAuctionPlayer,
};
