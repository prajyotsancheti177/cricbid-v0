const { Schema, model } = require('mongoose');

/**
 * Auction Room Session Schema
 * Tracks complete lifecycle and analytics for each live auction room session.
 * A new session is created each time an auction room is opened.
 */
const auctionRoomSessionSchema = new Schema({
    // Core identifiers
    tournamentId: { 
        type: Schema.Types.ObjectId, 
        ref: 'tournament', 
        required: true, 
        index: true 
    },
    tournamentName: { type: String }, // Denormalized for quick access
    
    // Session lifecycle
    sessionStartedAt: { type: Date, default: Date.now, index: true },
    sessionEndedAt: { type: Date },
    sessionDurationMinutes: { type: Number },
    
    // Host information
    hostUserId: { type: Schema.Types.ObjectId, ref: 'user', index: true },
    hostUserName: { type: String },
    
    // Unique viewers (logged-in users)
    uniqueViewerUserIds: [{ type: Schema.Types.ObjectId, ref: 'user' }],
    
    // Anonymous viewers tracked by IP
    anonymousViewerIPs: [{ type: String }],
    
    // Aggregate counts
    totalUniqueViewers: { type: Number, default: 0 }, // userIds + IPs combined
    totalJoins: { type: Number, default: 0 }, // Total join events (including re-joins)
    
    // Peak metrics
    peakConcurrentViewers: { type: Number, default: 0 },
    peakViewerTimestamp: { type: Date },
    
    // Activity metrics
    playersAuctioned: { type: Number, default: 0 },
    playersSold: { type: Number, default: 0 },
    playersUnsold: { type: Number, default: 0 },
    totalBids: { type: Number, default: 0 },
    
    // Time-series viewer count (sampled every 1 minute)
    viewerHistory: [{
        timestamp: { type: Date, default: Date.now },
        viewerCount: { type: Number, default: 0 }
    }],
    
    // Session status
    status: { 
        type: String, 
        enum: ['active', 'ended', 'abandoned'],
        default: 'active',
        index: true
    }
}, { 
    collection: "auction_room_session", 
    timestamps: true 
});

// Compound indexes for efficient querying
auctionRoomSessionSchema.index({ tournamentId: 1, sessionStartedAt: -1 });
auctionRoomSessionSchema.index({ status: 1, sessionStartedAt: -1 });
auctionRoomSessionSchema.index({ hostUserId: 1, sessionStartedAt: -1 });

module.exports = model(auctionRoomSessionSchema.options.collection, auctionRoomSessionSchema);
