const { Schema, default: mongoose } = require("mongoose");
const tournament = require("../models/tournament");
const players = require("../models/players");

const playerCategories = async (tournamentId) => {
    const tournamentData = await tournament.findById(tournamentId);

    if (!tournamentData) {
        const err = new Error("Tournament not found");
        throw err;
    }
    return tournamentData.playerCategories || [];
};

const nextAuctionPlayer = async (touranmentId, playerCategory) => {

    if (!touranmentId) {
        const err = new Error("touranmentId is required");
        throw err;
    }

      // Randomize selection: use aggregation with $match + $sample
      let match = {
        touranmentId: new mongoose.Types.ObjectId(touranmentId),
        sold: false,
        auctionStatus: false,
      };
      if (playerCategory && playerCategory !== "All") match.playerCategory = playerCategory;

      if (playerCategory === "Regular") {
        match = {
          $or: [
            {
              touranmentId: new mongoose.Types.ObjectId(touranmentId),
              sold: false,
              auctionStatus: false,
                playerCategory: "Regular",
            },
            {
              touranmentId: new mongoose.Types.ObjectId(touranmentId),
              sold: false,
              auctionStatus: true,
              playerCategory: "Icon",
            },
          ],
        };
      }

      const pipeline = [{ $match: match }, { $sample: { size: 1 } }];

      const result = await players.aggregate(pipeline);
      const nextPlayer =
        Array.isArray(result) && result.length > 0 ? result[0] : null;

    if (!nextPlayer) {
        const err = new Error("No more players available for auction.");
        throw err;
    }

    // Fetch tournament to get base price for player's category
    const tournamentData = await tournament.findById(touranmentId);
    if (tournamentData && tournamentData.categoryBasePrices) {
        const basePrice = tournamentData.categoryBasePrices.get(nextPlayer.playerCategory);
        nextPlayer.basePrice = basePrice || 0;
    } else {
        nextPlayer.basePrice = 0;
    }

    return nextPlayer;
};

module.exports = {
    playerCategories,
    nextAuctionPlayer
};
