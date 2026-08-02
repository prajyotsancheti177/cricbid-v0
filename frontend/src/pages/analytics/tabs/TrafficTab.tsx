import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Activity, BarChart, Eye, LineChart, TrendingUp, Users } from "lucide-react";
import { StatCard, DeltaBadge, EmptyState } from "../components/StatCard";
import { dailyChartConfig, formatBucket, formatMonth, formatPageName, monthlyChartConfig, pageChartConfig } from "../shared";
import type { AnalyticsData } from "../types";

const TrafficTab = ({ data }: { data: AnalyticsData | null }) => {
    if (!data) return <EmptyState message="No analytics data available." height="h-[400px]" />;

    const previous = data.previous?.summary;

    const seriesData = data.series.map((point) => ({
        ...point,
        label: formatBucket(point.date, data.granularity),
    }));

    const monthlyData = data.monthly.map((point) => ({ ...point, month: formatMonth(point.date) }));

    const pageData = data.pageTraffic.map((point) => ({ ...point, pageName: formatPageName(point.page) }));

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Page Views"
                    value={data.summary.totalPageViews.toLocaleString()}
                    icon={<Eye className="h-5 w-5 text-blue-500" />}
                    accent="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20"
                    valueClass="text-blue-500"
                    hint={previous && <DeltaBadge current={data.summary.totalPageViews} previous={previous.totalPageViews} />}
                />
                <StatCard
                    title="Unique Visitors"
                    value={data.summary.uniqueVisitors.toLocaleString()}
                    icon={<Users className="h-5 w-5 text-purple-500" />}
                    accent="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20"
                    valueClass="text-purple-500"
                    hint={previous && <DeltaBadge current={data.summary.uniqueVisitors} previous={previous.uniqueVisitors} />}
                />
                <StatCard
                    title="Sessions"
                    value={data.summary.sessions.toLocaleString()}
                    icon={<Activity className="h-5 w-5 text-cyan-500" />}
                    accent="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20"
                    valueClass="text-cyan-500"
                    hint={`${data.summary.viewsPerSession} views per session`}
                />
                <StatCard
                    title="Unique Pages"
                    value={data.summary.uniquePages.toLocaleString()}
                    icon={<Activity className="h-5 w-5 text-green-500" />}
                    accent="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20"
                    valueClass="text-green-500"
                    hint="Different pages visited"
                />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        <CardTitle>Traffic Over Time</CardTitle>
                    </div>
                    <CardDescription>
                        Page views, unique visitors and sessions, bucketed by {data.granularity}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {seriesData.length > 0 ? (
                        <ChartContainer config={dailyChartConfig} className="h-[320px] w-full">
                            <AreaChart data={seriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                                <YAxis tickLine={false} axisLine={false} className="text-xs" />
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
                        <EmptyState message="No data available for the selected period" />
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <BarChart className="h-5 w-5 text-green-500" />
                            <CardTitle>Monthly Traffic</CardTitle>
                        </div>
                        <CardDescription>Aggregate page views by month</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {monthlyData.length > 0 ? (
                            <ChartContainer config={monthlyChartConfig} className="h-[300px] w-full">
                                <RechartsBarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar dataKey="pageViews" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="uniqueVisitors" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                                </RechartsBarChart>
                            </ChartContainer>
                        ) : (
                            <EmptyState message="No data available for the selected period" />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <LineChart className="h-5 w-5 text-rose-500" />
                            <CardTitle>Traffic by Page</CardTitle>
                        </div>
                        <CardDescription>Top pages by views</CardDescription>
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
                                    <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                                    <YAxis
                                        type="category"
                                        dataKey="pageName"
                                        tickLine={false}
                                        axisLine={false}
                                        className="text-xs"
                                        width={75}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="pageViews" fill="hsl(346, 77%, 49%)" radius={[0, 4, 4, 0]} />
                                </RechartsBarChart>
                            </ChartContainer>
                        ) : (
                            <EmptyState message="No data available for the selected period" />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TrafficTab;
