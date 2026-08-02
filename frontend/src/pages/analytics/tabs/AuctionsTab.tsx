import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { Clock, Eye, Gavel, Loader2, Radio, Users } from "lucide-react";
import { StatCard, EmptyState } from "../components/StatCard";
import { auctionRoomChartConfig, formatPoints, formatDate, formatDateTime, formatDuration } from "../shared";
import { fetchAnalyticsJson } from "../useAnalyticsData";
import type { AuctionRoomAnalytics, AuctionTimeline } from "../types";

/**
 * One auction's viewer curve with every player sale placed on it. Reading the
 * two together is the point: it shows whether the marquee lots actually drew
 * the crowd, or whether the room had already emptied by then.
 */
const TimelinePanel = ({ sessionId }: { sessionId: string }) => {
    const [timeline, setTimeline] = useState<AuctionTimeline | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);

        fetchAnalyticsJson(`/api/event/auctions/${sessionId}/timeline`)
            .then((data) => {
                if (!cancelled) setTimeline(data);
            })
            .catch(() => {
                if (!cancelled) setTimeline(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    if (isLoading) {
        return (
            <div className="flex h-[320px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!timeline) return <EmptyState message="Could not load this auction's timeline" />;

    const curveData = timeline.curve.map((point) => ({
        elapsedMinutes: point.elapsedMinutes,
        viewerCount: point.viewerCount,
    }));

    const sales = timeline.markers
        .filter((marker) => marker.status === "sold")
        .map((marker) => ({
            elapsedMinutes: marker.elapsedMinutes,
            finalPrice: marker.finalPrice || 0,
            playerName: marker.playerName,
            winningTeamName: marker.winningTeamName,
            totalBids: marker.totalBids,
        }));

    const topSales = [...sales].sort((a, b) => b.finalPrice - a.finalPrice).slice(0, 5);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                    title="Peak viewers"
                    value={timeline.session.peakConcurrentViewers}
                    valueClass="text-pink-500"
                    hint={`${timeline.session.totalJoins.toLocaleString()} joins`}
                />
                <StatCard
                    title="Money spent"
                    value={formatPoints(timeline.moneySpent)}
                    valueClass="text-emerald-500"
                    hint={`${timeline.session.playersSold} sold`}
                />
                <StatCard
                    title="Total bids"
                    value={timeline.session.totalBids.toLocaleString()}
                    valueClass="text-purple-500"
                    hint={`${timeline.session.playersUnsold} unsold`}
                />
                <StatCard
                    title="Held to the end"
                    value={`${timeline.retention.at100}%`}
                    valueClass="text-amber-500"
                    hint={`${timeline.retention.at50}% at halfway`}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Viewers through the auction</CardTitle>
                    <CardDescription>Concurrent viewers, sampled once a minute</CardDescription>
                </CardHeader>
                <CardContent>
                    {curveData.length > 0 ? (
                        <ChartContainer
                            config={{ viewerCount: { label: "Viewers", color: "hsl(200, 83%, 53%)" } }}
                            className="h-[260px] w-full"
                        >
                            <AreaChart data={curveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTimelineViewers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(200, 83%, 53%)" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="hsl(200, 83%, 53%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="elapsedMinutes"
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                    tickFormatter={(value) => `${value}m`}
                                />
                                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Area
                                    type="monotone"
                                    dataKey="viewerCount"
                                    stroke="hsl(200, 83%, 53%)"
                                    fill="url(#colorTimelineViewers)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <EmptyState message="No viewer samples recorded for this auction" height="h-[260px]" />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Sales through the auction</CardTitle>
                    <CardDescription>
                        Each dot is a player sold, positioned by time and priced on the vertical axis
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sales.length > 0 ? (
                        <ChartContainer
                            config={{ finalPrice: { label: "Sale price", color: "hsl(152, 65%, 45%)" } }}
                            className="h-[260px] w-full"
                        >
                            <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    type="number"
                                    dataKey="elapsedMinutes"
                                    name="Minutes in"
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                    tickFormatter={(value) => `${value}m`}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="finalPrice"
                                    name="Price"
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                                />
                                <ZAxis type="number" dataKey="totalBids" range={[30, 220]} name="Bids" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Scatter data={sales} fill="hsl(152, 65%, 45%)" fillOpacity={0.65} />
                            </ScatterChart>
                        </ChartContainer>
                    ) : (
                        <EmptyState message="No sales recorded in this session" height="h-[260px]" />
                    )}

                    {topSales.length > 0 && (
                        <div className="mt-6">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Biggest buys
                            </p>
                            <ul className="space-y-2">
                                {topSales.map((sale) => (
                                    <li
                                        key={`${sale.playerName}-${sale.elapsedMinutes}`}
                                        className="flex items-center justify-between gap-4 text-sm"
                                    >
                                        <span className="truncate font-medium">{sale.playerName}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {sale.winningTeamName} · {sale.totalBids} bids ·{" "}
                                            {formatDuration(sale.elapsedMinutes)} in
                                        </span>
                                        <span className="shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {formatPoints(sale.finalPrice)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const AuctionsTab = ({ data }: { data: AuctionRoomAnalytics | null }) => {
    const [selectedSession, setSelectedSession] = useState<string | null>(null);

    if (!data) return <EmptyState message="No auction data available." height="h-[400px]" />;

    const dailyData = data.daily.map((point) => ({ ...point, date: formatDate(point.date) }));

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Auction Rooms"
                    value={data.summary.totalSessions.toLocaleString()}
                    icon={<Radio className="h-5 w-5 text-purple-500" />}
                    accent="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20"
                    valueClass="text-purple-500"
                    hint="Rooms run in period"
                />
                <StatCard
                    title="Total Joins"
                    value={data.summary.totalJoins.toLocaleString()}
                    icon={<Users className="h-5 w-5 text-blue-500" />}
                    accent="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20"
                    valueClass="text-blue-500"
                    hint="Room joins across all auctions"
                />
                <StatCard
                    title="Avg Duration"
                    value={formatDuration(data.summary.avgSessionDuration)}
                    icon={<Clock className="h-5 w-5 text-amber-500" />}
                    accent="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20"
                    valueClass="text-amber-500"
                    hint="Average room length"
                />
                <StatCard
                    title="Peak Concurrent"
                    value={data.summary.maxPeakViewers.toLocaleString()}
                    icon={<Eye className="h-5 w-5 text-pink-500" />}
                    accent="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20"
                    valueClass="text-pink-500"
                    hint={`${data.summary.avgPeakViewers} average peak`}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <StatCard title="Total Bids" value={data.summary.totalBids.toLocaleString()} valueClass="text-purple-500" />
                <StatCard title="Players Sold" value={data.summary.totalPlayersSold.toLocaleString()} valueClass="text-green-500" />
                <StatCard title="Players Unsold" value={data.summary.totalPlayersUnsold.toLocaleString()} valueClass="text-amber-500" />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-purple-500" />
                        <CardTitle>Auction Room Activity</CardTitle>
                    </div>
                    <CardDescription>Rooms run and viewer participation over time</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailyData.length > 0 ? (
                        <ChartContainer config={auctionRoomChartConfig} className="h-[300px] w-full">
                            <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" />
                                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area
                                    type="monotone"
                                    dataKey="sessionsCreated"
                                    stroke="hsl(280, 83%, 53%)"
                                    fill="url(#colorSessions)"
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="avgPeakViewers"
                                    stroke="hsl(200, 83%, 53%)"
                                    fill="url(#colorRoomViewers)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <EmptyState message="No auction room data available for the selected period" />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Gavel className="h-5 w-5 text-emerald-500" />
                        <CardTitle>Auctions in this period</CardTitle>
                    </div>
                    <CardDescription>Select one to see its minute-by-minute timeline</CardDescription>
                </CardHeader>
                <CardContent>
                    {data.topSessions.length === 0 ? (
                        <EmptyState message="No auctions in the selected period" height="h-[160px]" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px]">
                                <thead>
                                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="py-2 pr-4 font-medium">Tournament</th>
                                        <th className="py-2 pr-4 font-medium">Started</th>
                                        <th className="py-2 pr-4 text-right font-medium">Duration</th>
                                        <th className="py-2 pr-4 text-right font-medium">Peak</th>
                                        <th className="py-2 pr-4 text-right font-medium">Sold</th>
                                        <th className="py-2 pr-4 text-right font-medium">Bids</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topSessions.map((session) => (
                                        <tr
                                            key={session.id}
                                            onClick={() =>
                                                setSelectedSession((current) =>
                                                    current === session.id ? null : session.id
                                                )
                                            }
                                            className={`cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40 ${
                                                selectedSession === session.id ? "bg-muted/60" : ""
                                            }`}
                                        >
                                            <td className="max-w-[240px] truncate py-3 pr-4 font-medium">
                                                {session.tournamentName}
                                            </td>
                                            <td className="py-3 pr-4 text-sm text-muted-foreground">
                                                {formatDateTime(session.sessionStartedAt)}
                                            </td>
                                            <td className="py-3 pr-4 text-right tabular-nums">
                                                {formatDuration(session.sessionDurationMinutes)}
                                            </td>
                                            <td className="py-3 pr-4 text-right tabular-nums">
                                                {session.peakConcurrentViewers}
                                            </td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{session.playersSold}</td>
                                            <td className="py-3 pr-4 text-right tabular-nums">{session.totalBids}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedSession && <TimelinePanel sessionId={selectedSession} />}
        </div>
    );
};

export default AuctionsTab;
