const { Schema, model } = require('mongoose');

/**
 * User Event Schema
 * Tracks user-level events for analytics and auditing
 * Supports both authenticated and anonymous users
 */
const userEventSchema = new Schema({
    // Core identifiers
    userId: { type: Schema.Types.ObjectId, ref: 'user', index: true }, // null for anonymous
    sessionId: { type: String, index: true },       // Browser session ID
    tournamentId: { type: Schema.Types.ObjectId, ref: 'tournament', index: true },
    
    // Event details
    eventType: { 
        type: String, 
        required: true,
        enum: [
            'page_view',          // User navigated to a page
            'auction_start',      // User started an auction
            'auction_completed',  // Auction for a player completed
            'player_sold',        // Player was sold
            'player_unsold',      // Player marked unsold
            'player_search',      // Player search performed
            'category_selected',  // Auction category selected
            'login',              // User logged in
            'logout',             // User logged out
            'team_created',       // Team created
            'player_registered',  // Player registered
            'tournament_created', // Tournament created
            'settings_changed',   // Settings modified
            'tournament_view',    // Tournament details viewed
            'teams_view',         // Teams list viewed
            'players_view',       // Players list viewed
            // Auction room events
            'auction_room_created',  // Room opened
            'auction_room_joined',   // User joined room
            'auction_room_left',     // User left room
            'auction_room_closed',   // Room closed
        ],
        index: true
    },
    eventData: { type: Schema.Types.Mixed },        // Flexible payload for event-specific data
    
    // Context
    page: { type: String },                          // Route/page where event occurred
    userAgent: { type: String },                     // Browser info
    ipAddress: { type: String },                     // Client IP
    
    // Timestamps
    timestamp: { type: Date, default: Date.now, index: true }
}, { 
    collection: "user_event", 
    timestamps: true 
});

// Compound indexes for efficient querying
userEventSchema.index({ tournamentId: 1, eventType: 1, timestamp: -1 });
userEventSchema.index({ userId: 1, timestamp: -1 });
userEventSchema.index({ sessionId: 1, timestamp: -1 });

module.exports = model(userEventSchema.options.collection, userEventSchema);
