/**
 * Live presence tracking — backs the "active users right now" counter.
 *
 * Deliberately in-memory, in the same spirit as auctionStateManager: a heartbeat
 * every 20s from every open tab would be a large write volume for data that is
 * worthless 60 seconds later. Nothing here is durable, and it does not need to
 * be — presence is a now-only metric and rebuilds itself within one heartbeat
 * interval after a restart.
 *
 * Caveat: this is per-process. If the API is ever scaled past a single PM2
 * instance, these counts become per-instance and would need Redis.
 */

// visitorId -> { lastSeen: number, page: string, sessionId: string }
const activeVisitors = new Map();

// A visitor is "active" if seen within this window. The client heartbeats every
// 20s, so 60s tolerates two missed beats before dropping someone.
const ACTIVE_WINDOW_MS = 60 * 1000;

// Rolling record of the counter so the UI can draw a sparkline of the last hour.
const HISTORY_INTERVAL_MS = 60 * 1000;
const HISTORY_MAX_POINTS = 60;
const history = [];

let peakToday = 0;
let peakDateKey = null;

/**
 * Record a heartbeat from a visitor.
 * @param {{ visitorId: string, sessionId?: string, page?: string }} beat
 */
const recordHeartbeat = ({ visitorId, sessionId, page }) => {
    if (!visitorId) return;

    activeVisitors.set(visitorId, {
        lastSeen: Date.now(),
        page: page || null,
        sessionId: sessionId || null,
    });
};

/**
 * Drop visitors whose last heartbeat has aged out.
 */
const prune = () => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    for (const [visitorId, entry] of activeVisitors) {
        if (entry.lastSeen < cutoff) activeVisitors.delete(visitorId);
    }
};

/**
 * Current active-user snapshot, including a per-page breakdown.
 * @returns {{ activeUsers: number, byPage: Array, peakToday: number, history: Array }}
 */
const getSnapshot = () => {
    prune();

    const byPage = new Map();
    for (const entry of activeVisitors.values()) {
        const page = entry.page || 'unknown';
        byPage.set(page, (byPage.get(page) || 0) + 1);
    }

    const activeUsers = activeVisitors.size;

    // Reset the daily peak when the date rolls over.
    const dateKey = new Date().toISOString().slice(0, 10);
    if (dateKey !== peakDateKey) {
        peakDateKey = dateKey;
        peakToday = 0;
    }
    if (activeUsers > peakToday) peakToday = activeUsers;

    return {
        activeUsers,
        peakToday,
        byPage: Array.from(byPage.entries())
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        history: [...history],
    };
};

/**
 * Sample the active count once a minute so the counter can show a trend.
 */
const startHistorySampling = () => {
    setInterval(() => {
        prune();
        history.push({ timestamp: new Date().toISOString(), activeUsers: activeVisitors.size });
        if (history.length > HISTORY_MAX_POINTS) history.shift();
    }, HISTORY_INTERVAL_MS).unref?.();
};

module.exports = {
    recordHeartbeat,
    getSnapshot,
    startHistorySampling,
    ACTIVE_WINDOW_MS,
};
