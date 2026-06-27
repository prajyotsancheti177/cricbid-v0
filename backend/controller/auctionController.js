const auctionService = require("../services/auctionService");
const { sendSuccess, sendError } = require("../utils");

const playerCategories = async (req, res) => {
    try {
        const categories = await auctionService.playerCategories(req.body.touranmentId);
        return sendSuccess(res, 200, "Player categories fetched successfully", categories);
    }
    catch (error) {
        return sendError(res, 500, "Failed to fetch player categories", error);
    }
};

const nextAuctionPlayer = async (req, res) => {
    try {
        const player = await auctionService.nextAuctionPlayer(req.body.touranmentId, req.body.playerCategory);
        return sendSuccess(res, 200, "Next auction player fetched successfully", player);
    }
    catch (error) {
        return sendError(res, 500, "Failed to fetch next auction player", error);
    }
};

module.exports = {
    playerCategories,
    nextAuctionPlayer
};








// module.exports = {
//     playerCategories : async (req, res) => {
//         try {
//             const { touranmentId } = req.body;

//             if (!touranmentId) {
//                 return res.status(400).json({ message: "touranmentId is required" });
//             }

//             const tournamnetData = await tournament.findById(touranmentId);

//             if (!tournamnetData) {
//                 return res.status(404).json({ message: "Tournament not found" });
//             }

//             return res.status(200).json({
//                 message: "Player categories fetched successfully",
//                 data: tournamnetData.playerCategories || []
//             });
//         } catch (error) {
//             console.log("Error while fetching player categories", error);
//             return res.status(500).json({
//                 message: (error && error.message) || 'Oops! Failed to fetch player categories.'
//             });
//         }
//     }
// };