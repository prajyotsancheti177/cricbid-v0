const { Schema, model } = require('mongoose')


const tournamentSchema = new Schema({
    name: { type: String, require: true },
    tournamentHostId: { type: Schema.Types.ObjectId },
    noOfTeams: { type: Number },
    maxPlayersPerTeam: { type: Number },
    minPlayersPerTeam: { type: Number },
    totalBudget: { type: Number },
    playerCategories: [{ type: String }],
    categoryBasePrices: { type: Map, of: Number },
    bidIncrementSlabs: [{
        minBid: { type: Number, required: true },
        maxBid: { type: Number, default: null },
        increment: { type: Number, required: true }
    }]
}, { collection: "tournament", timestamps: true });

module.exports = model(tournamentSchema.options.collection, tournamentSchema);