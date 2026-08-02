/**
 * User-agent classification.
 *
 * Analytics previously stored userAgent but never used it, so crawler traffic
 * was counted as real visitors on every metric. Events are classified once on
 * ingest and the flag is stored, so the analytics queries stay cheap.
 */

// Substrings that identify automated traffic. Matched case-insensitively.
const BOT_PATTERNS = [
    'bot', 'crawler', 'spider', 'crawling',
    'slurp', 'mediapartners', 'adsbot', 'feedfetcher',
    // 'whatsapp/' with the slash matches only the link-preview fetcher — CricBid
    // links are shared via WhatsApp constantly and those real clicks open in a
    // normal browser UA, which must not be filtered out.
    'facebookexternalhit', 'whatsapp/', 'telegrambot', 'twitterbot',
    'linkedinbot', 'discordbot', 'slackbot', 'embedly',
    'pingdom', 'uptimerobot', 'statuscake', 'site24x7',
    'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
    'curl/', 'wget/', 'python-requests', 'axios/', 'go-http-client',
    'okhttp', 'java/', 'apache-httpclient', 'postmanruntime',
    'lighthouse', 'gtmetrix', 'ahrefs', 'semrush', 'mj12', 'dotbot',
];

const TABLET_PATTERNS = ['ipad', 'tablet', 'playbook', 'silk'];
const MOBILE_PATTERNS = ['mobi', 'iphone', 'ipod', 'android', 'blackberry', 'windows phone', 'opera mini'];

/**
 * @param {string|undefined} userAgent
 * @returns {{ isBot: boolean, deviceType: string }}
 */
const classifyUserAgent = (userAgent) => {
    if (!userAgent || typeof userAgent !== 'string') {
        // No UA at all is itself a strong bot signal — real browsers always send one.
        return { isBot: true, deviceType: 'unknown' };
    }

    const ua = userAgent.toLowerCase();

    if (BOT_PATTERNS.some((pattern) => ua.includes(pattern))) {
        return { isBot: true, deviceType: 'bot' };
    }

    // Order matters: Android tablets also match 'android', and iPads match
    // neither 'mobi' nor 'iphone' on modern iPadOS.
    if (TABLET_PATTERNS.some((pattern) => ua.includes(pattern))) {
        return { isBot: false, deviceType: 'tablet' };
    }

    if (MOBILE_PATTERNS.some((pattern) => ua.includes(pattern))) {
        return { isBot: false, deviceType: 'mobile' };
    }

    return { isBot: false, deviceType: 'desktop' };
};

/**
 * Known mobile-carrier ISPs. IP geolocation places these at the carrier's
 * gateway rather than the user, which in India means a large share of real
 * traffic lands on a handful of metros. City-level results from these are
 * marked low-confidence rather than shown as precise.
 */
const MOBILE_CARRIER_PATTERNS = [
    'jio', 'reliance', 'bharti', 'airtel', 'vodafone', 'idea', 'vi ',
    'bsnl', 'mtnl', 'tata teleservices', 'aircel',
    'cellular', 'wireless', 'mobile', 'telecom', 'gsm', 'lte',
];

/**
 * @param {string|undefined} isp
 * @returns {boolean} true when city-level geo for this ISP should not be trusted
 */
const isMobileCarrier = (isp) => {
    if (!isp || typeof isp !== 'string') return false;
    const value = isp.toLowerCase();
    return MOBILE_CARRIER_PATTERNS.some((pattern) => value.includes(pattern));
};

module.exports = { classifyUserAgent, isMobileCarrier };
