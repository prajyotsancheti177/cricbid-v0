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
    touranmentId: { type: Schema.Types.ObjectId, ref: 'tournament' },
    teamId: { type: Schema.Types.ObjectId, ref: 'team' },
    sold: { type: Boolean },
    auctionStatus: { type: Boolean },
    amtSold: { type: Number },
    playerCategory: { type: String },
    auctionSerialNumber: { type: Number }
}, { collection: "player", timestamps: true })

module.exports = model(playerSchema.options.collection, playerSchema);