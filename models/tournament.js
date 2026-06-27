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
    }],
    registrationFormConfig: {
        isActive: { type: Boolean, default: false },
        fields: {
            age: { required: { type: Boolean, default: true }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Age' } },
            gender: { required: { type: Boolean, default: true }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Gender' } },
            photo: { required: { type: Boolean, default: false }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Photo URL' } },
            skill: { required: { type: Boolean, default: true }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Skill' } },
            mobile: { required: { type: Boolean, default: true }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Mobile Number' } },
            email: { required: { type: Boolean, default: true }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Email Address' } },
            address: { required: { type: Boolean, default: false }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Address' } },
            playerCategory: { required: { type: Boolean, default: true }, enabled: { type: Boolean, default: true }, showToPublic: { type: Boolean, default: true }, defaultValue: { type: Schema.Types.Mixed, default: '' }, label: { type: String, default: 'Player Category' } }
        },
        customFields: [{
            id: { type: String, required: true },
            label: { type: String, required: true },
            type: { type: String, enum: ['text', 'number', 'textarea', 'dropdown', 'checkbox', 'file'], default: 'text' },
            required: { type: Boolean, default: false },
            showToPublic: { type: Boolean, default: true },
            defaultValue: { type: Schema.Types.Mixed, default: '' },
            options: [{ type: String }]
        }],
        googleSheetId: { type: String },
        googleSheetUrl: { type: String }
    }
}, { collection: "tournament", timestamps: true });

module.exports = model(tournamentSchema.options.collection, tournamentSchema);