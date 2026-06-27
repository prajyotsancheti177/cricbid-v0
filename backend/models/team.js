const { Schema, model } = require('mongoose')


const teamSchema = new Schema({
    name: { type: String },
    logo: { type: String },
    owner: {
        name: { type: String },
        email: { type: String },
        mobile: { type: String }
    },
    touranmentId: { type: Schema.Types.ObjectId }
}, { collection: "team", timestamps: true });

module.exports = model(teamSchema.options.collection, teamSchema)