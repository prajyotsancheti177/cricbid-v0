const IpGeoCache = require('../models/ipGeoCache');

/**
 * Geo Service
 * Handles IP-to-location lookups with caching
 */

// Rate limiting: ip-api.com allows 45 requests/minute
const RATE_LIMIT_DELAY = 1500; // 1.5 seconds between requests to stay safe

/**
 * Sleep utility for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch geolocation from ip-api.com
 * @param {string} ip - IP address
 * @returns {Object|null} Location data or null on failure
 */
const fetchGeoFromAPI = async (ip) => {
    try {
        // Skip private/local IPs
        if (isPrivateIP(ip)) {
            return { isValid: false, city: 'Local', region: 'Local', country: 'Local' };
        }

        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp`);
        const data = await response.json();

        if (data.status === 'success') {
            return {
                city: data.city || 'Unknown',
                region: data.regionName || data.region || 'Unknown',
                country: data.country || 'Unknown',
                countryCode: data.countryCode || '',
                lat: data.lat,
                lon: data.lon,
                isp: data.isp || '',
                isValid: true
            };
        } else {
            console.warn(`[GeoService] Failed to lookup IP ${ip}: ${data.message}`);
            return { isValid: false };
        }
    } catch (error) {
        console.error(`[GeoService] API error for IP ${ip}:`, error.message);
        return { isValid: false };
    }
};

/**
 * Check if IP is private/local
 */
const isPrivateIP = (ip) => {
    if (!ip) return true;
    
    // Handle ::1 (IPv6 localhost) and ::ffff: prefix
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    
    // Common private ranges
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./,
        /^fc00:/i,
        /^fe80:/i
    ];
    
    return privateRanges.some(range => range.test(ip));
};

/**
 * Get location from cache or fetch from API
 * @param {string} ip - IP address
 * @returns {Object} Location data
 */
const getLocationFromIP = async (ip) => {
    if (!ip) return { isValid: false };

    // Normalize IP
    let normalizedIP = ip;
    if (ip.startsWith('::ffff:')) {
        normalizedIP = ip.substring(7);
    }

    // Check cache first
    const cached = await IpGeoCache.findOne({ ipAddress: normalizedIP });
    if (cached) {
        return {
            city: cached.city,
            region: cached.region,
            country: cached.country,
            countryCode: cached.countryCode,
            lat: cached.lat,
            lon: cached.lon,
            isValid: cached.isValid
        };
    }

    // Fetch from API
    const geoData = await fetchGeoFromAPI(normalizedIP);

    // Cache the result
    try {
        await IpGeoCache.create({
            ipAddress: normalizedIP,
            ...geoData,
            cachedAt: new Date()
        });
    } catch (error) {
        // Ignore duplicate key errors (race condition)
        if (error.code !== 11000) {
            console.error('[GeoService] Cache save error:', error.message);
        }
    }

    return geoData;
};

/**
 * Batch lookup locations for multiple IPs
 * Respects rate limits and uses caching
 * @param {string[]} ips - Array of IP addresses
 * @returns {Map<string, Object>} Map of IP to location data
 */
const batchGetLocations = async (ips) => {
    const results = new Map();
    const uncachedIPs = [];

    // Normalize IPs
    const normalizedIPs = ips.map(ip => 
        ip.startsWith('::ffff:') ? ip.substring(7) : ip
    );

    // Check cache for all IPs
    const cached = await IpGeoCache.find({ 
        ipAddress: { $in: normalizedIPs } 
    });

    cached.forEach(doc => {
        results.set(doc.ipAddress, {
            city: doc.city,
            region: doc.region,
            country: doc.country,
            countryCode: doc.countryCode,
            lat: doc.lat,
            lon: doc.lon,
            isValid: doc.isValid
        });
    });

    // Find IPs not in cache
    normalizedIPs.forEach(ip => {
        if (!results.has(ip)) {
            uncachedIPs.push(ip);
        }
    });

    // Fetch uncached IPs with rate limiting
    for (const ip of uncachedIPs) {
        const geoData = await fetchGeoFromAPI(ip);
        results.set(ip, geoData);

        // Cache the result
        try {
            await IpGeoCache.create({
                ipAddress: ip,
                ...geoData,
                cachedAt: new Date()
            });
        } catch (error) {
            if (error.code !== 11000) {
                console.error('[GeoService] Cache save error:', error.message);
            }
        }

        // Rate limit delay (skip for last item)
        if (uncachedIPs.indexOf(ip) < uncachedIPs.length - 1) {
            await sleep(RATE_LIMIT_DELAY);
        }
    }

    return results;
};

/**
 * Aggregate locations by city
 * @param {Map<string, Object>} locationMap - Map of IP to location
 * @returns {Array} Array of city aggregates sorted by count
 */
const aggregateByCity = (locationMap) => {
    const cityMap = new Map();

    locationMap.forEach((location, ip) => {
        if (!location.isValid || !location.city || location.city === 'Local') return;

        const key = `${location.city}|${location.region}|${location.country}`;
        
        if (cityMap.has(key)) {
            const existing = cityMap.get(key);
            existing.count++;
        } else {
            cityMap.set(key, {
                city: location.city,
                region: location.region,
                country: location.country,
                lat: location.lat,
                lon: location.lon,
                count: 1
            });
        }
    });

    // Convert to array and sort by count descending
    return Array.from(cityMap.values()).sort((a, b) => b.count - a.count);
};

module.exports = {
    getLocationFromIP,
    batchGetLocations,
    aggregateByCity,
    isPrivateIP
};
