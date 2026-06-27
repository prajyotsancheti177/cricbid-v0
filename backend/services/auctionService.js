const prisma = require("../db/prisma");
const { serializePlayer } = require("../utils/serialize");

const playerCategories = async (tournamentId) => {
    const tournamentData = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournamentData) {
        throw new Error("Tournament not found");
    }
    return tournamentData.playerCategories || [];
};

const nextAuctionPlayer = async (touranmentId, playerCategory) => {
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

    // Random selection (replaces $sample): pick a random matching candidate
    const count = await prisma.player.count({ where });
    if (count === 0) {
        throw new Error("No more players available for auction.");
    }
    const skip = Math.floor(Math.random() * count);
    const [candidate] = await prisma.player.findMany({ where, skip, take: 1 });

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
