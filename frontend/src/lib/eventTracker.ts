import apiConfig from "@/config/apiConfig";

/**
 * Generate a unique session ID for tracking anonymous users
 */
const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem("auctioner_session_id");
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem("auctioner_session_id", sessionId);
    }
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
 * Track a single user event
 */
export const trackEvent = async (
    eventType: string,
    eventData?: Record<string, unknown>,
    tournamentId?: string
): Promise<void> => {
    try {
        await fetch(`${apiConfig.baseUrl}/api/event/track`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: getUserId(),
                sessionId: getSessionId(),
                tournamentId,
                eventType,
                eventData,
                page: window.location.pathname,
                timestamp: new Date().toISOString(),
            }),
        });
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
    auctionMode: "category" | "manual";
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
