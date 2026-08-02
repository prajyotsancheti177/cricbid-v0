/** Shared shapes for the analytics workspace. */

export interface SeriesPoint {
    date: string;
    pageViews: number;
    uniqueVisitors: number;
    sessions: number;
}

export interface MonthlyPoint extends SeriesPoint {
    year: number;
    month: number;
}

export interface PageTrafficData {
    page: string;
    pageViews: number;
    uniqueVisitors: number;
}

export interface AnalyticsSummary {
    totalPageViews: number;
    uniqueVisitors: number;
    sessions: number;
    uniquePages: number;
    returningVisitors: number;
    newVisitors: number;
    viewsPerSession: number;
}

export interface HeatmapCell {
    /** 0 = Sunday, matching Postgres EXTRACT(DOW). */
    dayOfWeek: number;
    hour: number;
    pageViews: number;
    uniqueVisitors: number;
}

export interface WhatsAppDailyData {
    date: string;
    total: number;
    success: number;
    failed: number;
}

export interface WhatsAppSummary {
    totalMessages: number;
    successCount: number;
    failedCount: number;
    soldNotifications: number;
    unsoldNotifications: number;
    successRate: number;
}

export interface WhatsAppTypeData {
    messageType: string;
    count: number;
    successCount: number;
    failedCount: number;
}

export interface DateRange {
    startDate: string;
    endDate: string;
}

export interface AnalyticsData {
    series: SeriesPoint[];
    granularity: string;
    daily: SeriesPoint[];
    monthly: MonthlyPoint[];
    pageTraffic: PageTrafficData[];
    summary: AnalyticsSummary;
    heatmap: HeatmapCell[];
    previous: {
        summary: AnalyticsSummary;
        series: SeriesPoint[];
        dateRange: DateRange;
    } | null;
    whatsapp?: {
        daily: WhatsAppDailyData[];
        summary: WhatsAppSummary;
        messageTypes: WhatsAppTypeData[];
    };
    dateRange: DateRange;
}

export interface AuctionRoomSummary {
    totalSessions: number;
    totalUniqueViewers: number;
    totalJoins: number;
    avgSessionDuration: number;
    avgPeakViewers: number;
    maxPeakViewers: number;
    totalPlayersSold: number;
    totalPlayersUnsold: number;
    totalBids: number;
}

export interface AuctionRoomDailyData {
    date: string;
    sessionsCreated: number;
    uniqueViewers: number;
    avgPeakViewers: number;
}

export interface AuctionRoomTopSession {
    id: string;
    tournamentId: string;
    tournamentName: string;
    peakConcurrentViewers: number;
    totalUniqueViewers: number;
    totalJoins: number;
    sessionDurationMinutes: number;
    sessionStartedAt: string;
    playersSold: number;
    totalBids: number;
}

export interface AuctionRoomAnalytics {
    summary: AuctionRoomSummary;
    daily: AuctionRoomDailyData[];
    topSessions: AuctionRoomTopSession[];
    dateRange: DateRange;
}

export interface ComparableSession {
    id: string;
    tournamentId: string;
    tournamentName: string;
    sessionStartedAt: string;
    sessionDurationMinutes: number;
    peakConcurrentViewers: number;
    playersSold: number;
    totalBids: number;
}

export interface CurvePoint {
    timestamp: string;
    elapsedMinutes: number;
    progressPct: number;
    viewerCount: number;
}

export interface Retention {
    at25: number;
    at50: number;
    at75: number;
    at100: number;
}

export interface AuctionStats {
    peakViewers: number;
    timeToPeakMinutes: number;
    totalJoins: number;
    playersSold: number;
    playersUnsold: number;
    sellThroughPct: number;
    totalBids: number;
    avgBidsPerPlayer: number;
    /** False when no AuctionLog rows matched this session's time window. */
    salesRecorded: boolean;
    moneySpent: number | null;
    avgPrice: number | null;
    highestPrice: number | null;
}

export interface AuctionComparison {
    sessionId: string;
    tournamentId: string;
    tournamentName: string;
    sessionStartedAt: string;
    durationMinutes: number;
    curve: CurvePoint[];
    stats: AuctionStats;
    retention: Retention;
}

export interface SaleMarker {
    id: string;
    playerName: string;
    playerCategory: string;
    basePrice: number;
    finalPrice: number | null;
    status: string;
    winningTeamName: string | null;
    totalBids: number;
    auctionEndedAt: string;
    elapsedMinutes: number;
}

export interface AuctionTimeline {
    session: {
        id: string;
        tournamentId: string;
        tournamentName: string;
        sessionStartedAt: string;
        sessionDurationMinutes: number;
        peakConcurrentViewers: number;
        totalJoins: number;
        playersSold: number;
        playersUnsold: number;
        totalBids: number;
    };
    curve: CurvePoint[];
    markers: SaleMarker[];
    moneySpent: number;
    retention: Retention;
}

export interface GeoCityData {
    city: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    count: number;
    confidence?: "high" | "low";
}

export interface GeoAnalyticsData {
    cityData: GeoCityData[];
    allCityData: GeoCityData[];
    totalUniqueIPs: number;
    indiaUniqueIPs: number;
    dateRange: DateRange;
}
