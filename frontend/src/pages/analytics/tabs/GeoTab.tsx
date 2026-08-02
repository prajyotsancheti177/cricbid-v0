import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BarChart, Globe, Loader2, MapPin } from "lucide-react";
import IndiaMap from "@/components/IndiaMap";
import { StatCard, EmptyState } from "../components/StatCard";
import type { GeoAnalyticsData } from "../types";

interface GeoTabProps {
    data: GeoAnalyticsData | null;
    isLoading: boolean;
}

const GeoTab = ({ data, isLoading }: GeoTabProps) => {
    const hasCities = (data?.cityData?.length || 0) > 0;

    // Mobile-carrier IPs geolocate to the carrier's gateway, not the user, so
    // those rows are rolled up to region and flagged rather than shown as a city.
    const approximateCount = data?.cityData?.filter((city) => city.confidence === "low").length || 0;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <StatCard
                    title="Total Unique IPs"
                    value={data?.totalUniqueIPs?.toLocaleString() || 0}
                    icon={<Globe className="h-5 w-5 text-cyan-500" />}
                    accent="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20"
                    valueClass="text-cyan-500"
                    hint="Distinct addresses seen"
                />
                <StatCard
                    title="India Visitors"
                    value={data?.indiaUniqueIPs?.toLocaleString() || 0}
                    icon={<MapPin className="h-5 w-5 text-orange-500" />}
                    accent="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20"
                    valueClass="text-orange-500"
                    hint="Addresses resolving to India"
                />
                <StatCard
                    title="Locations Reached"
                    value={data?.cityData?.length || 0}
                    icon={<Activity className="h-5 w-5 text-teal-500" />}
                    accent="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20"
                    valueClass="text-teal-500"
                    hint={
                        approximateCount > 0
                            ? `${approximateCount} approximate (mobile networks)`
                            : "Distinct cities in India"
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-cyan-500" />
                            <CardTitle>Visitor Locations — India</CardTitle>
                        </div>
                        <CardDescription>Geographic distribution of visitors</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex h-[500px] items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                            </div>
                        ) : hasCities ? (
                            <IndiaMap
                                cityData={data!.cityData}
                                maxCount={Math.max(...data!.cityData.map((city) => city.count), 1)}
                            />
                        ) : (
                            <EmptyState message="No location data available for the selected period" height="h-[500px]" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <BarChart className="h-5 w-5 text-orange-500" />
                            <CardTitle>Top Locations</CardTitle>
                        </div>
                        <CardDescription>
                            Visitors by city. Entries marked approximate come from mobile networks, where the IP
                            resolves to the carrier gateway rather than the user.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex h-[500px] items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                            </div>
                        ) : hasCities ? (
                            <div className="h-[500px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="sticky top-0 border-b bg-background">
                                        <tr>
                                            <th className="px-2 py-3 text-left font-medium text-muted-foreground">#</th>
                                            <th className="px-2 py-3 text-left font-medium text-muted-foreground">City</th>
                                            <th className="px-2 py-3 text-left font-medium text-muted-foreground">State</th>
                                            <th className="px-2 py-3 text-right font-medium text-muted-foreground">
                                                Visitors
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data!.cityData.map((city, index) => (
                                            <tr
                                                key={`${city.city}-${index}`}
                                                className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                            >
                                                <td className="px-2 py-3 text-muted-foreground">{index + 1}</td>
                                                <td className="px-2 py-3 font-medium">
                                                    {city.city}
                                                    {city.confidence === "low" && (
                                                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                            approx
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-3 text-muted-foreground">{city.region}</td>
                                                <td className="px-2 py-3 text-right">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-sm font-medium text-cyan-600 dark:text-cyan-400">
                                                        {city.count}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState message="No city data available for the selected period" height="h-[500px]" />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default GeoTab;
