import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2 } from "lucide-react";
import LiveActiveUsers from "@/components/analytics/LiveActiveUsers";
import { useAnalyticsData, useAnalyticsFilters } from "./useAnalyticsData";
import TrafficTab from "./tabs/TrafficTab";
import DayOnDayTab from "./tabs/DayOnDayTab";
import AuctionsTab from "./tabs/AuctionsTab";
import ComparisonTab from "./tabs/ComparisonTab";
import GeoTab from "./tabs/GeoTab";
import WhatsAppTab from "./tabs/WhatsAppTab";

const TABS = [
    { value: "traffic", label: "Traffic" },
    { value: "day-on-day", label: "Day-on-Day" },
    { value: "auctions", label: "Auctions" },
    { value: "compare", label: "Compare Auctions" },
    { value: "geography", label: "Geography" },
    { value: "whatsapp", label: "WhatsApp" },
];

const AnalyticsPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { filters, setFilter } = useAnalyticsFilters();
    const { analytics, auctionRooms, geo, isLoading, isGeoLoading, error } = useAnalyticsData(filters);

    useEffect(() => {
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
        }
    }, [navigate, toast]);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-4xl font-bold text-transparent">
                        Site Analytics
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Traffic, auctions and reach — all times in IST
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Select value={filters.days} onValueChange={(value) => setFilter("days", value)}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                            <SelectItem value="180">Last 6 months</SelectItem>
                            <SelectItem value="365">Last year</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.granularity} onValueChange={(value) => setFilter("granularity", value)}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Bucket" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hour">Hourly</SelectItem>
                            <SelectItem value="day">Daily</SelectItem>
                            <SelectItem value="week">Weekly</SelectItem>
                            <SelectItem value="month">Monthly</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.deviceType} onValueChange={(value) => setFilter("deviceType", value)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Device" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All devices</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="tablet">Tablet</SelectItem>
                            <SelectItem value="desktop">Desktop</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="mb-8">
                <LiveActiveUsers />
            </div>

            {error && (
                <Card className="mb-8 border-destructive/40 bg-destructive/5">
                    <CardContent className="flex items-center gap-3 py-4 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>{error}</span>
                    </CardContent>
                </Card>
            )}

            {filters.deviceType !== "all" && (
                <p className="mb-4 text-xs text-muted-foreground">
                    Device filtering only applies to visits recorded after device detection shipped — earlier
                    traffic has no device recorded and is excluded.
                </p>
            )}

            <Tabs value={filters.tab} onValueChange={(value) => setFilter("tab", value)}>
                <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
                    {TABS.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {isLoading ? (
                    <div className="flex h-[400px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <TabsContent value="traffic">
                            <TrafficTab data={analytics} />
                        </TabsContent>
                        <TabsContent value="day-on-day">
                            <DayOnDayTab data={analytics} />
                        </TabsContent>
                        <TabsContent value="auctions">
                            <AuctionsTab data={auctionRooms} />
                        </TabsContent>
                        <TabsContent value="compare">
                            {/* Not bound to the date filter: comparing auctions across
                                seasons is the whole point of this view. */}
                            <ComparisonTab />
                        </TabsContent>
                        <TabsContent value="geography">
                            <GeoTab data={geo} isLoading={isGeoLoading} />
                        </TabsContent>
                        <TabsContent value="whatsapp">
                            <WhatsAppTab data={analytics} />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
};

export default AnalyticsPage;
