const { Schema, model } = require('mongoose');

/**
 * WhatsApp Log Schema
 * Tracks all WhatsApp messages sent for analytics and debugging
 */
const whatsappLogSchema = new Schema({
    // Message details
    messageType: { 
        type: String, 
        required: true,
        enum: ['player_sold', 'player_unsold', 'auction_announcement', 'team_purchase_summary', 'test'],
        index: true
    },
    templateName: { type: String },
    recipientMobile: { type: String, required: true },
    
    // Context
    playerId: { type: Schema.Types.ObjectId, ref: 'players', index: true },
    playerName: { type: String },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'tournament', index: true },
    tournamentName: { type: String },
    teamName: { type: String },
    amtSold: { type: Number },
    
    // Status
    status: { 
        type: String, 
        required: true,
        enum: ['success', 'failed'],
        index: true
    },
    messageId: { type: String },  // WhatsApp API message ID on success
    errorMessage: { type: String }, // Error details on failure
    
    // Timestamps
    timestamp: { type: Date, default: Date.now, index: true }
}, { 
    collection: "whatsapp_log", 
    timestamps: true 
});

// Compound indexes for efficient querying
whatsappLogSchema.index({ status: 1, timestamp: -1 });
whatsappLogSchema.index({ messageType: 1, timestamp: -1 });
whatsappLogSchema.index({ tournamentId: 1, timestamp: -1 });

module.exports = model(whatsappLogSchema.options.collection, whatsappLogSchema);
