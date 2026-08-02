import apiConfig from "@/config/apiConfig";

/**
 * Visitor / session identity
 * -------------------------
 * Two separate ids, because they answer two different questions:
 *
 *   visitorId — localStorage, ~400 days. Survives tab close and return visits,
 *               so "unique visitors" and "new vs returning" are counted on this.
 *   sessionId — a visit. Rolls over after 30 minutes of inactivity (the usual
 *               analytics convention), so "sessions" and session duration work.
 *
 * Both live in localStorage: sessionStorage is per-tab, so a user with the
 * auction room open in two tabs used to be counted as two people.
 */
const VISITOR_KEY = "cricbid_visitor_id";
const VISITOR_CREATED_KEY = "cricbid_visitor_created";
const SESSION_KEY = "cricbid_session_id";
const SESSION_LAST_SEEN_KEY = "cricbid_session_last_seen";

const VISITOR_TTL_MS = 400 * 24 * 60 * 60 * 1000; // 400d — Chrome's cookie cap
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30m of inactivity ends a session

const randomId = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Storage can throw (Safari private mode, storage disabled). Tracking must never
 * break the page, so every access degrades to an in-memory id for this tab.
 */
let memoryFallback: Record<string, string> = {};

const readStore = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return memoryFallback[key] ?? null;
    }
};

const writeStore = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        memoryFallback[key] = value;
    }
};

/**
 * Persistent per-browser id. Rotates once past the TTL so we aren't holding an
 * identifier indefinitely.
 */
export const getVisitorId = (): string => {
    const existing = readStore(VISITOR_KEY);
    const createdAt = Number(readStore(VISITOR_CREATED_KEY) || 0);

    if (existing && createdAt && Date.now() - createdAt < VISITOR_TTL_MS) {
        return existing;
    }

    const visitorId = randomId();
    writeStore(VISITOR_KEY, visitorId);
    writeStore(VISITOR_CREATED_KEY, String(Date.now()));
    return visitorId;
};

/**
 * Current session id, rolling over after SESSION_IDLE_MS of inactivity.
 * Calling this counts as activity.
 */
export const getSessionId = (): string => {
    const existing = readStore(SESSION_KEY);
    const lastSeen = Number(readStore(SESSION_LAST_SEEN_KEY) || 0);
    const now = Date.now();

    const sessionId =
        existing && lastSeen && now - lastSeen < SESSION_IDLE_MS ? existing : randomId();

    if (sessionId !== existing) writeStore(SESSION_KEY, sessionId);
    writeStore(SESSION_LAST_SEEN_KEY, String(now));
    return sessionId;
};

/**
 * Get current user ID from localStorage
 */
const getUserId = (): string | null => {
    try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            const user = JSON.parse(userStr);
            return user._id || null;
        }
    } catch {
        // ignore parse errors
    }
    return null;
};

/**
 * Client-side context the server cannot infer reliably. `timezone` in particular
 * is used to sanity-check IP geolocation, which is poor for Indian mobile
 * carriers (CGNAT routes whole regions through a few metro gateways).
 */
const getClientContext = () => {
    let timezone: string | undefined;
    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        timezone = undefined;
    }

    // Only keep the referrer when it is off-site; internal navigation is already
    // covered by the page sequence within a session.
    let referrer: string | undefined;
    try {
        if (document.referrer && new URL(document.referrer).host !== window.location.host) {
            referrer = document.referrer;
        }
    } catch {
        referrer = undefined;
    }

    return {
        timezone,
        language: typeof navigator !== "undefined" ? navigator.language : undefined,
        referrer,
    };
};

interface QueuedEvent {
    userId: string | null;
    visitorId: string;
    sessionId: string;
    tournamentId?: string;
    eventType: string;
    eventData?: Record<string, unknown>;
    page: string;
    timestamp: string;
    timezone?: string;
    language?: string;
    referrer?: string;
}

/**
 * Events are queued and flushed in batches — previously every page view was its
 * own HTTP request. Flushes on a timer, and on pagehide via sendBeacon so the
 * last events of a visit aren't lost when the tab closes.
 */
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE = 25;

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const trackUrl = `${apiConfig.baseUrl}/api/event/track-batch`;

const flush = (useBeacon = false): void => {
    if (queue.length === 0) return;

    const events = queue;
    queue = [];

    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    const body = JSON.stringify({ events });

    // On pagehide the page is going away — only sendBeacon is guaranteed to run.
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        try {
            navigator.sendBeacon(trackUrl, new Blob([body], { type: "application/json" }));
            return;
        } catch {
            // fall through to fetch
        }
    }

    fetch(trackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
    }).catch(() => {
        // Silently fail - event tracking should not disrupt user experience
    });
};

const scheduleFlush = (): void => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => flush(), FLUSH_INTERVAL_MS);
};

if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => flush(true));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush(true);
    });
}

/**
 * Track a single user event
 */
export const trackEvent = (
    eventType: string,
    eventData?: Record<string, unknown>,
    tournamentId?: string
): void => {
    try {
        queue.push({
            userId: getUserId(),
            visitorId: getVisitorId(),
            sessionId: getSessionId(),
            tournamentId,
            eventType,
            eventData,
            page: window.location.pathname,
            timestamp: new Date().toISOString(),
            ...getClientContext(),
        });

        if (queue.length >= MAX_QUEUE) {
            flush();
        } else {
            scheduleFlush();
        }
    } catch (error) {
        // Silently fail - event tracking should not disrupt user experience
        console.error("Event tracking error:", error);
    }
};

/**
 * Track page view event
 */
export const trackPageView = (page: string, tournamentId?: string): void => {
    trackEvent("page_view", { page }, tournamentId);
};

/**
 * Track auction-related events
 */
export const trackAuctionEvent = (
    eventType: "auction_start" | "auction_completed" | "player_sold" | "player_unsold" | "category_selected",
    eventData: Record<string, unknown>,
    tournamentId: string
): void => {
    trackEvent(eventType, eventData, tournamentId);
};

/**
 * Presence heartbeat backing the live "active users" counter. Deliberately not
 * a UserEvent write — the server keeps presence in memory and expires it, so a
 * 20s heartbeat costs nothing in the database.
 */
const HEARTBEAT_INTERVAL_MS = 20000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const sendHeartbeat = (): void => {
    // Don't report a backgrounded tab as an active user.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    fetch(`${apiConfig.baseUrl}/api/event/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            visitorId: getVisitorId(),
            sessionId: getSessionId(),
            page: window.location.pathname,
        }),
        keepalive: true,
    }).catch(() => {
        /* presence is best-effort */
    });
};

export const startHeartbeat = (): (() => void) => {
    if (heartbeatTimer) return () => undefined;

    // Beat immediately when the tab becomes visible again, so someone returning
    // to the site reappears in the counter at once rather than up to a full
    // interval later.
    const onVisibilityChange = () => {
        if (document.visibilityState === "visible") sendHeartbeat();
    };

    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        document.removeEventListener("visibilitychange", onVisibilityChange);
    };
};

/**
 * Auction bid log interface
 */
export interface AuctionBid {
    teamId: string;
    teamName: string;
    bidAmount: number;
    bidIncrement?: number;
    timestamp: Date;
    bidOrder: number;
}

/**
 * Save complete auction log when auction ends
 * This sends all bid history in a single request
 */
export const saveAuctionLog = async (auctionData: {
    tournamentId: string;
    playerId: string;
    playerName: string;
    playerCategory: string;
    basePrice: number;
    auctionMode: "category" | "manual" | "serial";
    status: "sold" | "unsold";
    winningTeamId?: string;
    winningTeamName?: string;
    finalPrice?: number;
    bids: AuctionBid[];
    auctionStartedAt: Date;
    auctionEndedAt: Date;
}): Promise<boolean> => {
    try {
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;

        const response = await fetch(`${apiConfig.baseUrl}/api/auction-log/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...auctionData,
                conductedBy: user?._id,
                userId: user?._id, // For auth middleware
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to save auction log");
        }

        return true;
    } catch (error) {
        console.error("Error saving auction log:", error);
        return false;
    }
};
