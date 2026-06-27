const { Schema, model } = require('mongoose')


const playerSchema = new Schema({
    name: { type: String },
    age: { type: Number },
    gender : { type: String },
    photo: { type: String },
    skill: { type: String },
    mobile: { type: Number },
    email: { type: String },
    address: { type: String },
    touranmentId: { type: Schema.Types.ObjectId },
    teamId: { type: Schema.Types.ObjectId },
    sold: { type: Boolean },
    auctionStatus: { type: Boolean },
    basePrice: { type: Number },
    amtSold: { type: Number },
    playerCategory: { type: String }
}, { collection: "player_test", timestamps: true })

module.exports = model(playerSchema.options.collection, playerSchema);