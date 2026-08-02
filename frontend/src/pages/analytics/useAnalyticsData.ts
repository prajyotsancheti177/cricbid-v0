import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiConfig from "@/config/apiConfig";
import { REPORTING_TZ } from "./shared";
import type { AnalyticsData, AuctionRoomAnalytics, GeoAnalyticsData } from "./types";

/**
 * Filter state lives in the URL so a particular view — period, granularity,
 * device, tab — can be shared or bookmarked rather than re-selected by hand.
 */
export interface AnalyticsFilters {
    days: string;
    granularity: string;
    deviceType: string;
    tab: string;
}

const DEFAULTS: AnalyticsFilters = {
    days: "30",
    granularity: "day",
    deviceType: "all",
    tab: "traffic",
};

export const useAnalyticsFilters = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters: AnalyticsFilters = {
        days: searchParams.get("days") || DEFAULTS.days,
        granularity: searchParams.get("granularity") || DEFAULTS.granularity,
        deviceType: searchParams.get("device") || DEFAULTS.deviceType,
        tab: searchParams.get("tab") || DEFAULTS.tab,
    };

    const setFilter = useCallback(
        (key: keyof AnalyticsFilters, value: string) => {
            const next = new URLSearchParams(searchParams);
            const paramName = key === "deviceType" ? "device" : key;

            // Keep the URL clean: a filter sitting at its default isn't worth a param.
            if (value === DEFAULTS[key]) {
                next.delete(paramName);
            } else {
                next.set(paramName, value);
            }

            setSearchParams(next, { replace: true });
        },
        [searchParams, setSearchParams]
    );

    return { filters, setFilter };
};

const authHeaders = () => {
    try {
        const userStr = localStorage.getItem("user");
        const userId = userStr ? JSON.parse(userStr)?._id : null;
        return userId ? { "x-user-id": userId } : {};
    } catch {
        return {};
    }
};

const getJson = async (path: string) => {
    const response = await fetch(`${apiConfig.baseUrl}${path}`, { headers: authHeaders() });
    const body = await response.json();

    if (!body?.success) {
        throw new Error(body?.message || "Request failed");
    }
    return body.data;
};

export { getJson as fetchAnalyticsJson };

interface AnalyticsBundle {
    analytics: AnalyticsData | null;
    auctionRooms: AuctionRoomAnalytics | null;
    geo: GeoAnalyticsData | null;
    isLoading: boolean;
    /** Geo lookups hit a rate-limited external API, so they settle separately. */
    isGeoLoading: boolean;
    error: string | null;
}

/**
 * Fetch everything the dashboard needs for the active filters.
 *
 * Traffic and auction data are awaited together; geo is deliberately not, since
 * uncached IP lookups are rate-limited upstream and would otherwise hold the
 * whole page on a spinner.
 */
export const useAnalyticsData = (filters: AnalyticsFilters): AnalyticsBundle => {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [auctionRooms, setAuctionRooms] = useState<AuctionRoomAnalytics | null>(null);
    const [geo, setGeo] = useState<GeoAnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeoLoading, setIsGeoLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { days, granularity, deviceType } = filters;

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days, 10));

            const range = `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
            const deviceParam = deviceType === "all" ? "" : `&deviceType=${deviceType}`;

            try {
                const [analyticsData, auctionData] = await Promise.all([
                    getJson(
                        `/api/event/analytics?${range}&granularity=${granularity}&tz=${encodeURIComponent(
                            REPORTING_TZ
                        )}${deviceParam}`
                    ),
                    getJson(`/api/event/auction-room-analytics?${range}`),
                ]);

                if (cancelled) return;
                setAnalytics(analyticsData);
                setAuctionRooms(auctionData);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
            } finally {
                if (!cancelled) setIsLoading(false);
            }

            setIsGeoLoading(true);
            try {
                const geoData = await getJson(`/api/event/geo-analytics?${range}`);
                if (!cancelled) setGeo(geoData);
            } catch {
                // Geo is supplementary — its absence shouldn't surface as a page error.
            } finally {
                if (!cancelled) setIsGeoLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [days, granularity, deviceType]);

    return { analytics, auctionRooms, geo, isLoading, isGeoLoading, error };
};
