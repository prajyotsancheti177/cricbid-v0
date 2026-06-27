const { Schema, model } = require('mongoose');

/**
 * Auction Log Schema
 * Tracks complete auction history for each player including all bids
 * All bids stored as embedded array for atomic writes and efficient reads
 */
const auctionLogSchema = new Schema({
    // Core identifiers
    tournamentId: { type: Schema.Types.ObjectId, ref: 'tournament', required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'player', required: true, index: true },
    
    // Player info (denormalized for quick access)
    playerName: { type: String },
    playerCategory: { type: String },
    basePrice: { type: Number, required: true },
    
    // Auction metadata
    auctionMode: { type: String, enum: ['category', 'manual'], required: true },
    
    // Final outcome
    status: { 
        type: String, 
        enum: ['sold', 'unsold'], 
        required: true,
        index: true 
    },
    winningTeamId: { type: Schema.Types.ObjectId, ref: 'team' },
    winningTeamName: { type: String },
    finalPrice: { type: Number },
    
    // Bid history - embedded array (sent from frontend when auction ends)
    bids: [{
        teamId: { type: Schema.Types.ObjectId, ref: 'team', required: true },
        teamName: { type: String, required: true },
        bidAmount: { type: Number, required: true },
        bidIncrement: { type: Number },           // Increment used for this bid
        timestamp: { type: Date, default: Date.now },
        bidOrder: { type: Number, required: true } // Sequence number of bid (1, 2, 3...)
    }],
    
    // Statistics
    totalBids: { type: Number, default: 0 },
    uniqueTeamsBidding: { type: Number, default: 0 },
    
    // Auction timing
    auctionStartedAt: { type: Date },
    auctionEndedAt: { type: Date, default: Date.now },
    totalDurationSeconds: { type: Number },
    
    // Conducted by
    conductedBy: { type: Schema.Types.ObjectId, ref: 'user' }
}, { 
    collection: "auction_log", 
    timestamps: true 
});

// Compound indexes for analytics queries
auctionLogSchema.index({ tournamentId: 1, status: 1 });
auctionLogSchema.index({ tournamentId: 1, playerCategory: 1 });
auctionLogSchema.index({ playerId: 1, auctionStartedAt: -1 });
auctionLogSchema.index({ tournamentId: 1, auctionEndedAt: -1 });

module.exports = model(auctionLogSchema.options.collection, auctionLogSchema);
