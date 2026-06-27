import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartConfig } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { BarChart, LineChart, Activity, Users, Eye, TrendingUp, Loader2, MessageCircle, CheckCircle, XCircle, Radio, Clock, Gavel, MapPin, Globe } from "lucide-react";
import { Area, AreaChart, Bar, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import apiConfig from "@/config/apiConfig";
import IndiaMap from "@/components/IndiaMap";

interface DailyData {
    date: string;
    pageViews: number;
    uniqueVisitors: number;
}

interface MonthlyData {
    date: string;
    year: number;
    month: number;
    pageViews: number;
    uniqueVisitors: number;
}

interface PageTrafficData {
    page: string;
    pageViews: number;
    uniqueVisitors: number;
}

interface AnalyticsSummary {
    totalPageViews: number;
    uniqueVisitors: number;
    uniquePages: number;
}

interface WhatsAppDailyData {
    date: string;
    total: number;
    success: number;
    failed: number;
}

interface WhatsAppSummary {
    totalMessages: number;
    successCount: number;
    failedCount: number;
    soldNotifications: number;
    unsoldNotifications: number;
    successRate: number;
}

interface WhatsAppTypeData {
    messageType: string;
    count: number;
    successCount: number;
    failedCount: number;
}

interface WhatsAppAnalytics {
    daily: WhatsAppDailyData[];
    summary: WhatsAppSummary;
    messageTypes: WhatsAppTypeData[];
}

// Auction Room Analytics Interfaces
interface AuctionRoomDailyData {
    date: string;
    sessionsCreated: number;
    uniqueViewers: number;
    avgPeakViewers: number;
}

interface AuctionRoomSummary {
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

interface AuctionRoomTopSession {
    tournamentId: string;
    tournamentName: string;
    peakConcurrentViewers: number;
    totalUniqueViewers: number;
    sessionDurationMinutes: number;
    sessionStartedAt: string;
}

interface AuctionRoomAnalytics {
    summary: AuctionRoomSummary;
    daily: AuctionRoomDailyData[];
    topSessions: AuctionRoomTopSession[];
    dateRange: {
        startDate: string;
        endDate: string;
    };
}

interface AnalyticsData {
    daily: DailyData[];
    monthly: MonthlyData[];
    pageTraffic: PageTrafficData[];
    summary: AnalyticsSummary;
    whatsapp?: WhatsAppAnalytics;
    dateRange: {
        startDate: string;
        endDate: string;
    };
}

// Geo Analytics Interfaces
interface GeoCityData {
    city: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    count: number;
}

interface GeoAnalyticsData {
    cityData: GeoCityData[];
    allCityData: GeoCityData[];
    totalUniqueIPs: number;
    indiaUniqueIPs: number;
    dateRange: {
        startDate: string;
        endDate: string;
    };
}

const dailyChartConfig = {
    pageViews: {
        label: "Page Views",
        color: "hsl(221, 83%, 53%)",
    },
    uniqueVisitors: {
        label: "Unique Visitors",
        color: "hsl(262, 83%, 58%)",
    },
} satisfies ChartConfig;

const monthlyChartConfig = {
    pageViews: {
        label: "Page Views",
        color: "hsl(142, 76%, 36%)",
    },
    uniqueVisitors: {
        label: "Unique Visitors",
        color: "hsl(38, 92%, 50%)",
    },
} satisfies ChartConfig;

const pageChartConfig = {
    pageViews: {
        label: "Page Views",
        color: "hsl(346, 77%, 49%)",
    },
} satisfies ChartConfig;

const whatsappChartConfig = {
    success: {
        label: "Delivered",
        color: "hsl(142, 76%, 36%)",
    },
    failed: {
        label: "Failed",
        color: "hsl(0, 84%, 60%)",
    },
} satisfies ChartConfig;

const auctionRoomChartConfig = {
    sessionsCreated: {
        label: "Rooms Created",
        color: "hsl(280, 83%, 53%)",
    },
    uniqueViewers: {
        label: "Unique Viewers",
        color: "hsl(200, 83%, 53%)",
    },
    avgPeakViewers: {
        label: "Avg Peak Viewers",
        color: "hsl(340, 83%, 53%)",
    },
} satisfies ChartConfig;

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const formatPageName = (page: string) => {
    if (!page) return "Unknown";
    // Clean up page names for display
    const cleanPage = page.replace(/^\//, "").replace(/\//g, " / ") || "Home";
    return cleanPage.charAt(0).toUpperCase() + cleanPage.slice(1);
};

const Analytics = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState("30");
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [auctionRoomData, setAuctionRoomData] = useState<AuctionRoomAnalytics | null>(null);
    const [geoData, setGeoData] = useState<GeoAnalyticsData | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);

    useEffect(() => {
        // Check if user has permission
        const userStr = localStorage.getItem("user");
        if (!userStr) {
            navigate("/login");
            return;
        }

        const user = JSON.parse(userStr);
        if (user.role !== "boss" && user.role !== "super_user") {
            toast({
                title: "Access Denied",
                description: "You don't have permission to access this page.",
                variant: "destructive",
            });
            navigate("/tournaments");
            return;
        }

        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const userStr = localStorage.getItem("user");
            if (!userStr) return;

            const user = JSON.parse(userStr);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(dateRange));

            const response = await fetch(
                `${apiConfig.baseUrl}/api/event/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&userId=${user._id}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = await response.json();
            if (data.success) {
                setAnalyticsData(data.data);
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch analytics",
                    variant: "destructive",
                });
            }

            // Fetch auction room analytics
            const auctionResponse = await fetch(
                `${apiConfig.baseUrl}/api/event/auction-room-analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&userId=${user._id}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const auctionData = await auctionResponse.json();
            console.log("[Analytics] Auction room API response:", auctionData);

            if (auctionData.success) {
                console.log("[Analytics] Setting auction room data:", auctionData.data);
                setAuctionRoomData(auctionData.data);
            } else {
                console.error("[Analytics] Auction room API failed:", auctionData.message);
            }

            // Fetch geo analytics
            setGeoLoading(true);
            try {
                const geoResponse = await fetch(
                    `${apiConfig.baseUrl}/api/event/geo-analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&userId=${user._id}`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                const geoDataResult = await geoResponse.json();
                if (geoDataResult.success) {
                    setGeoData(geoDataResult.data);
                }
            } catch (geoError) {
                console.error("Failed to fetch geo analytics:", geoError);
            } finally {
                setGeoLoading(false);
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
            toast({
                title: "Error",
                description: "Failed to fetch analytics data",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const dailyData = analyticsData?.daily.map((d) => ({
        ...d,
        date: formatDate(d.date),
    })) || [];

    const monthlyData = analyticsData?.monthly.map((d) => ({
        ...d,
        month: formatMonth(d.date),
    })) || [];

    const pageData = analyticsData?.pageTraffic.map((d) => ({
        ...d,
        pageName: formatPageName(d.page),
    })) || [];

    const whatsappDailyData = analyticsData?.whatsapp?.daily.map((d) => ({
        ...d,
        date: formatDate(d.date),
    })) || [];

    return (
        <div className="container mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                        Site Analytics
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Monitor website traffic and user engagement
                    </p>
                </div>

                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="180">Last 6 months</SelectItem>
                        <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Page Views
                        </CardTitle>
                        <Eye className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-500">
                            {analyticsData?.summary.totalPageViews.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            In the last {dateRange} days
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Unique Visitors
                        </CardTitle>
                        <Users className="h-5 w-5 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-500">
                            {analyticsData?.summary.uniqueVisitors.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Unique sessions tracked
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Unique Pages
                        </CardTitle>
                        <Activity className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">
                            {analyticsData?.summary.uniquePages.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Different pages visited
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Traffic Chart */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        <CardTitle>Daily Traffic</CardTitle>
                    </div>
                    <CardDescription>
                        Page views and unique visitors over time
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {dailyData.length > 0 ? (
                        <ChartContainer config={dailyChartConfig} className="h-[300px] w-full">
                            <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area
                                    type="monotone"
                                    dataKey="pageViews"
                                    stroke="hsl(221, 83%, 53%)"
                                    fillOpacity={1}
                                    fill="url(#colorPageViews)"
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="uniqueVisitors"
                                    stroke="hsl(262, 83%, 58%)"
                                    fillOpacity={1}
                                    fill="url(#colorVisitors)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                            No data available for the selected period
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Traffic Chart */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <BarChart className="h-5 w-5 text-green-500" />
                            <CardTitle>Monthly Traffic</CardTitle>
                        </div>
                        <CardDescription>
                            Aggregate page views by month
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {monthlyData.length > 0 ? (
                            <ChartContainer config={monthlyChartConfig} className="h-[300px] w-full">
                                <RechartsBarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        dataKey="month"
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar
                                        dataKey="pageViews"
                                        fill="hsl(142, 76%, 36%)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="uniqueVisitors"
                                        fill="hsl(38, 92%, 50%)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </RechartsBarChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No data available for the selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Page-wise Traffic */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <LineChart className="h-5 w-5 text-rose-500" />
                            <CardTitle>Traffic by Page</CardTitle>
                        </div>
                        <CardDescription>
                            Top pages by views
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {pageData.length > 0 ? (
                            <ChartContainer config={pageChartConfig} className="h-[300px] w-full">
                                <RechartsBarChart
                                    data={pageData.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ top: 10, right: 30, left: 80, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        type="number"
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="pageName"
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                        width={75}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey="pageViews"
                                        fill="hsl(346, 77%, 49%)"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </RechartsBarChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No data available for the selected period
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* WhatsApp Analytics Section */}
            <div className="mt-12">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent mb-6">
                    WhatsApp Notifications
                </h2>

                {/* WhatsApp Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Messages
                            </CardTitle>
                            <MessageCircle className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-500">
                                {analyticsData?.whatsapp?.summary.totalMessages?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Total notifications sent
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Delivered
                            </CardTitle>
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-emerald-500">
                                {analyticsData?.whatsapp?.summary.successCount?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Successfully delivered
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Failed
                            </CardTitle>
                            <XCircle className="h-5 w-5 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-500">
                                {analyticsData?.whatsapp?.summary.failedCount?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Failed to deliver
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Success Rate
                            </CardTitle>
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-500">
                                {analyticsData?.whatsapp?.summary.successRate?.toFixed(1) || 0}%
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Delivery success rate
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* WhatsApp Daily Chart */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-green-500" />
                            <CardTitle>Daily WhatsApp Messages</CardTitle>
                        </div>
                        <CardDescription>
                            Sent notifications over time (delivered vs failed)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {whatsappDailyData.length > 0 ? (
                            <ChartContainer config={whatsappChartConfig} className="h-[300px] w-full">
                                <RechartsBarChart data={whatsappDailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar
                                        dataKey="success"
                                        stackId="a"
                                        fill="hsl(142, 76%, 36%)"
                                        radius={[0, 0, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="failed"
                                        stackId="a"
                                        fill="hsl(0, 84%, 60%)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </RechartsBarChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No WhatsApp data available for the selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Message Type Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sold Notifications</CardTitle>
                            <CardDescription>Players sold message stats</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-green-500">
                                {analyticsData?.whatsapp?.summary.soldNotifications?.toLocaleString() || 0}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                Notifications sent when players are sold
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Unsold Notifications</CardTitle>
                            <CardDescription>Players unsold message stats</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-amber-500">
                                {analyticsData?.whatsapp?.summary.unsoldNotifications?.toLocaleString() || 0}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                Notifications sent when players go unsold
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Live Auction Analytics Section */}
            <div className="mt-12">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent mb-6">
                    Live Auction Analytics
                </h2>

                {/* Auction Room Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Auction Rooms
                            </CardTitle>
                            <Radio className="h-5 w-5 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-purple-500">
                                {auctionRoomData?.summary?.totalSessions?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Rooms created in period
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Unique Viewers
                            </CardTitle>
                            <Users className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-500">
                                {auctionRoomData?.summary?.totalUniqueViewers?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Unique viewers across all rooms
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Avg Session Duration
                            </CardTitle>
                            <Clock className="h-5 w-5 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-amber-500">
                                {Math.round(auctionRoomData?.summary?.avgSessionDuration || 0)} min
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Average room duration
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Peak Concurrent Viewers
                            </CardTitle>
                            <Eye className="h-5 w-5 text-pink-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-pink-500">
                                {auctionRoomData?.summary?.maxPeakViewers?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Maximum viewers at once
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Daily Room Activity Chart */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Radio className="h-5 w-5 text-purple-500" />
                            <CardTitle>Daily Auction Room Activity</CardTitle>
                        </div>
                        <CardDescription>
                            Rooms created and viewer participation over time
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(auctionRoomData?.daily?.length || 0) > 0 ? (
                            <ChartContainer config={auctionRoomChartConfig} className="h-[300px] w-full">
                                <AreaChart data={auctionRoomData?.daily?.map(d => ({ ...d, date: formatDate(d.date) })) || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(280, 83%, 53%)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(280, 83%, 53%)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorRoomViewers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(200, 83%, 53%)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(200, 83%, 53%)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        dataKey="date"
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Area
                                        type="monotone"
                                        dataKey="sessionsCreated"
                                        stroke="hsl(280, 83%, 53%)"
                                        fillOpacity={1}
                                        fill="url(#colorSessions)"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="uniqueViewers"
                                        stroke="hsl(200, 83%, 53%)"
                                        fillOpacity={1}
                                        fill="url(#colorRoomViewers)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No auction room data available for the selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Activity Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Total Bids</CardTitle>
                            <CardDescription>Bids placed in auction rooms</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-purple-500">
                                {auctionRoomData?.summary?.totalBids?.toLocaleString() || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Players Sold</CardTitle>
                            <CardDescription>Successful auction completions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-green-500">
                                {auctionRoomData?.summary?.totalPlayersSold?.toLocaleString() || 0}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Players Unsold</CardTitle>
                            <CardDescription>Players that went unsold</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-amber-500">
                                {auctionRoomData?.summary?.totalPlayersUnsold?.toLocaleString() || 0}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Visitor Geography Section */}
            <div className="mt-12">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent mb-6">
                    Visitor Geography
                </h2>

                {/* Geo Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Unique IPs
                            </CardTitle>
                            <Globe className="h-5 w-5 text-cyan-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-cyan-500">
                                {geoData?.totalUniqueIPs?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Unique visitors worldwide
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                India Visitors
                            </CardTitle>
                            <MapPin className="h-5 w-5 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-500">
                                {geoData?.indiaUniqueIPs?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Visitors from India
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Cities Reached
                            </CardTitle>
                            <Activity className="h-5 w-5 text-teal-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-teal-500">
                                {geoData?.cityData?.length || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Unique cities in India
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* India Map and City Table */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* India Map */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-cyan-500" />
                                <CardTitle>Visitor Locations - India</CardTitle>
                            </div>
                            <CardDescription>
                                Geographic distribution of visitors
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {geoLoading ? (
                                <div className="flex items-center justify-center h-[500px]">
                                    <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                                </div>
                            ) : geoData && geoData.cityData.length > 0 ? (
                                <IndiaMap
                                    cityData={geoData.cityData}
                                    maxCount={Math.max(...geoData.cityData.map(c => c.count), 1)}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                                    No location data available for the selected period
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* City Table */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart className="h-5 w-5 text-orange-500" />
                                <CardTitle>Top Cities</CardTitle>
                            </div>
                            <CardDescription>
                                Visitors by city (India)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {geoLoading ? (
                                <div className="flex items-center justify-center h-[500px]">
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                                </div>
                            ) : geoData && geoData.cityData.length > 0 ? (
                                <div className="h-[500px] overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="sticky top-0 bg-background border-b">
                                            <tr>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">#</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">City</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">State</th>
                                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Visitors</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {geoData.cityData.map((city, index) => (
                                                <tr
                                                    key={`${city.city}-${index}`}
                                                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                                                >
                                                    <td className="py-3 px-2 text-muted-foreground">{index + 1}</td>
                                                    <td className="py-3 px-2 font-medium">{city.city}</td>
                                                    <td className="py-3 px-2 text-muted-foreground">{city.region}</td>
                                                    <td className="py-3 px-2 text-right">
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm font-medium">
                                                            {city.count}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                                    No city data available for the selected period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Analytics;

