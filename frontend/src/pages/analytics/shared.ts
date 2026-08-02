import { ChartConfig } from "@/components/ui/chart";

/** Reporting timezone. Bucketing happens server-side in this zone. */
export const REPORTING_TZ = "Asia/Kolkata";

export const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

export const formatMonth = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/**
 * Label a time bucket according to the active granularity — an hourly chart
 * needs the hour, a monthly one must not repeat "Jan 1" twelve times.
 */
export const formatBucket = (dateStr: string, granularity: string) => {
    const date = new Date(dateStr);

    if (granularity === "hour") {
        return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
    }
    if (granularity === "month") {
        return formatMonth(dateStr);
    }
    return formatDate(dateStr);
};

export const formatPageName = (page: string) => {
    if (!page) return "Unknown";
    const cleanPage = page.replace(/^\//, "").replace(/\//g, " / ") || "Home";
    return cleanPage.charAt(0).toUpperCase() + cleanPage.slice(1);
};

/**
 * Auction amounts are points, not rupees — every screen in the live auction room
 * renders them as "N Pts", so the analytics must agree rather than implying these
 * are currency figures.
 */
export const formatPoints = (amount: number) => `${(amount || 0).toLocaleString("en-IN")} Pts`;

export const formatDuration = (minutes: number) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

/**
 * Percentage change between two periods. Returns null when there is no baseline
 * — "+100%" from zero is meaningless and shouldn't be rendered as growth.
 */
export const percentChange = (current: number, previous: number): number | null => {
    if (!previous) return null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Palette for overlaying several auctions on one chart. Hues are spaced far
 * enough apart to stay distinguishable at thin stroke widths.
 */
export const COMPARISON_COLORS = [
    "hsl(221, 83%, 60%)",
    "hsl(28, 92%, 58%)",
    "hsl(152, 65%, 45%)",
    "hsl(322, 75%, 62%)",
    "hsl(262, 78%, 66%)",
    "hsl(190, 80%, 48%)",
    "hsl(48, 92%, 55%)",
    "hsl(0, 78%, 62%)",
];

export const dailyChartConfig = {
    pageViews: { label: "Page Views", color: "hsl(221, 83%, 53%)" },
    uniqueVisitors: { label: "Unique Visitors", color: "hsl(262, 83%, 58%)" },
    sessions: { label: "Sessions", color: "hsl(190, 80%, 48%)" },
} satisfies ChartConfig;

export const monthlyChartConfig = {
    pageViews: { label: "Page Views", color: "hsl(142, 76%, 36%)" },
    uniqueVisitors: { label: "Unique Visitors", color: "hsl(38, 92%, 50%)" },
} satisfies ChartConfig;

export const pageChartConfig = {
    pageViews: { label: "Page Views", color: "hsl(346, 77%, 49%)" },
} satisfies ChartConfig;

export const whatsappChartConfig = {
    success: { label: "Delivered", color: "hsl(142, 76%, 36%)" },
    failed: { label: "Failed", color: "hsl(0, 84%, 60%)" },
} satisfies ChartConfig;

export const auctionRoomChartConfig = {
    sessionsCreated: { label: "Rooms Created", color: "hsl(280, 83%, 53%)" },
    uniqueViewers: { label: "Unique Viewers", color: "hsl(200, 83%, 53%)" },
    avgPeakViewers: { label: "Avg Peak Viewers", color: "hsl(340, 83%, 53%)" },
} satisfies ChartConfig;

export const hourChartConfig = {
    pageViews: { label: "Page Views", color: "hsl(221, 83%, 60%)" },
} satisfies ChartConfig;
