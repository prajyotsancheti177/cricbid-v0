const CRICHEROES_BASE = 'https://api.cricheroes.in/api/v1';

/**
 * CricHeroes client.
 *
 * CricHeroes publishes no developer API. This talks to the same endpoints their
 * own website calls, with the api-key that ships hardcoded in their public
 * JavaScript bundle. Two consequences worth keeping in mind:
 *
 *   1. It can change or start requiring a signed token without notice. Every
 *      call here is best-effort — callers must degrade to "no stats" rather
 *      than fail whatever they were doing.
 *   2. A WAF in front of it rejects anything that does not look like their own
 *      website, with a 403 and code 20250404. All five headers below are
 *      required; dropping the Origin or the browser User-Agent is enough to be
 *      blocked. It answers 200 with `status:false` for genuine misses, so the
 *      HTTP status alone is not a success check.
 *
 * Requests are serialised through a shared delay so a 300-player sync never
 * looks like an attack.
 */

const API_KEY = 'cr!CkH3r0s';
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

// No published rate limit, so pick a rate a human browsing the site could
// plausibly produce. 1.5s matches what geoService uses against ip-api.
const REQUEST_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;

// Search result types, from their own bundle's enum.
const SEARCH_TYPE = { TEAM: 1, PLAYER: 2, TOURNAMENT: 3, MATCH: 4 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Serialises every outbound call, so concurrent callers still queue politely. */
let requestChain = Promise.resolve();
let lastRequestAt = 0;

const headers = () => ({
    'api-key': API_KEY,
    'device-type': '3',
    udid: 'cricbid-sync',
    Origin: 'https://cricheroes.com',
    Referer: 'https://cricheroes.com/',
    Accept: 'application/json',
    'User-Agent': USER_AGENT
});

/**
 * GET a CricHeroes path, rate-limited and retried.
 *
 * @param {string} path - path below /api/v1, already encoded
 * @returns {Promise<Object|null>} the `data` payload, or null when CricHeroes
 *   reported no result (a miss is not an error — plenty of players simply are
 *   not on CricHeroes)
 * @throws when the request could not be completed at all
 */
const get = async (path) => {
    const run = async () => {
        const wait = REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
        if (wait > 0) await sleep(wait);
        lastRequestAt = Date.now();

        let lastErr;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            try {
                const response = await fetch(`${CRICHEROES_BASE}/${path}`, {
                    headers: headers(),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
                });

                // 403 is the WAF, not a missing player. Retrying helps when it
                // is a burst throttle and is harmless when it is not.
                if (response.status === 403) {
                    lastErr = new Error('CricHeroes rejected the request (WAF 403)');
                } else if (!response.ok) {
                    lastErr = new Error(`CricHeroes returned HTTP ${response.status}`);
                } else {
                    const body = await response.json();
                    if (body && body.status === true) return body.data ?? null;
                    // status:false with an error code is a legitimate "nothing
                    // here" for lookups — surface it as a miss, not a failure.
                    return null;
                }
            } catch (err) {
                lastErr = err;
            }

            if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt);
        }
        throw lastErr || new Error('CricHeroes request failed');
    };

    // Chain onto the previous request whether it resolved or rejected, so one
    // failure does not stall the queue.
    const queued = requestChain.then(run, run);
    requestChain = queued.catch(() => {});
    return queued;
};

/**
 * Search CricHeroes players by name.
 * @param {string} name
 * @returns {Promise<Array<{user_id:number,name:string,city_name:string,...}>>}
 */
const searchPlayers = async (name) => {
    const data = await get(`search/v2/global-search-all/${SEARCH_TYPE.PLAYER}/${encodeURIComponent(name)}`);
    // An empty result comes back as `data: {}` rather than an empty list.
    return (data && Array.isArray(data.players)) ? data.players : [];
};

/**
 * Profile header: name, city, style, and career totals.
 * @param {number} cricheroesPlayerId
 */
const getPlayerProfile = (cricheroesPlayerId) =>
    get(`player/get-player-profile-web/${cricheroesPlayerId}`);

/**
 * Full batting / bowling / fielding / captain statistics.
 * @param {number} cricheroesPlayerId
 * @returns {Promise<Object|null>} `{ batting, bowling, fielding, captain }`
 */
const getPlayerStatistics = async (cricheroesPlayerId) => {
    const data = await get(`player/get-player-statistic/${cricheroesPlayerId}`);
    return (data && data.statistics) ? data.statistics : null;
};

/**
 * Pull a `{ title, value }` array's value by title.
 *
 * The API returns stats as ordered label/value pairs rather than named fields,
 * so every read is a title lookup. Titles are stable but casing is not.
 *
 * @param {Array<{title:string,value:*}>} rows
 * @param {string} title
 */
const statValue = (rows, title) => {
    if (!Array.isArray(rows)) return null;
    const wanted = String(title).toLowerCase();
    const row = rows.find((r) => String(r.title || '').toLowerCase() === wanted);
    return row ? row.value : null;
};

/** Parse a stat value that should be a number; "-" and "" become null. */
const statNumber = (rows, title) => {
    const raw = statValue(rows, title);
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
};

module.exports = {
    searchPlayers,
    getPlayerProfile,
    getPlayerStatistics,
    statValue,
    statNumber,
    SEARCH_TYPE
};
