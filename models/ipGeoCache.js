const { Schema, model } = require('mongoose');

/**
 * IP Geolocation Cache Schema
 * Caches IP-to-location lookups to avoid repeated API calls
 */
const ipGeoCacheSchema = new Schema({
    ipAddress: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    city: { type: String },
    region: { type: String },      // State/Province
    country: { type: String },
    countryCode: { type: String },
    lat: { type: Number },
    lon: { type: Number },
    isp: { type: String },
    isValid: { type: Boolean, default: true }, // False if IP lookup failed
    cachedAt: { 
        type: Date, 
        default: Date.now,
        index: { expires: '30d' }   // TTL: Auto-delete after 30 days
    }
}, { 
    collection: "ip_geo_cache", 
    timestamps: true 
});

module.exports = model(ipGeoCacheSchema.options.collection, ipGeoCacheSchema);
