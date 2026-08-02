import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { GitCompare, Loader2 } from "lucide-react";
import { EmptyState } from "../components/StatCard";
import { COMPARISON_COLORS, formatPoints, formatDuration, formatDateTime } from "../shared";
import { fetchAnalyticsJson } from "../useAnalyticsData";
import type { AuctionComparison, ComparableSession } from "../types";

type Axis = "progressPct" | "elapsedMinutes";

interface StatRow {
    label: string;
    /** Null means the figure was never recorded for that auction. */
    get: (auction: AuctionComparison) => number | null;
    format: (value: number) => string;
    /** Lower is better — used to decide which cell gets highlighted. */
    lowerIsBetter?: boolean;
}

const STAT_ROWS: StatRow[] = [
    { label: "Peak viewers", get: (a) => a.stats.peakViewers, format: (v) => v.toLocaleString() },
    {
        label: "Time to peak",
        get: (a) => a.stats.timeToPeakMinutes,
        format: (v) => formatDuration(v),
        lowerIsBetter: true,
    },
    { label: "Duration", get: (a) => a.durationMinutes, format: (v) => formatDuration(v) },
    { label: "Total joins", get: (a) => a.stats.totalJoins, format: (v) => v.toLocaleString() },
    { label: "Players sold", get: (a) => a.stats.playersSold, format: (v) => v.toLocaleString() },
    { label: "Sell-through", get: (a) => a.stats.sellThroughPct, format: (v) => `${v}%` },
    { label: "Total bids", get: (a) => a.stats.totalBids, format: (v) => v.toLocaleString() },
    { label: "Avg bids / player", get: (a) => a.stats.avgBidsPerPlayer, format: (v) => v.toFixed(1) },
    { label: "Money spent", get: (a) => a.stats.moneySpent, format: formatPoints },
    { label: "Highest price", get: (a) => a.stats.highestPrice, format: formatPoints },
    { label: "Retention at halfway", get: (a) => a.retention.at50, format: (v) => `${v}%` },
    { label: "Retention at end", get: (a) => a.retention.at100, format: (v) => `${v}%` },
];

const ComparisonTab = () => {
    const [sessions, setSessions] = useState<ComparableSession[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [auctions, setAuctions] = useState<AuctionComparison[]>([]);
    const [axis, setAxis] = useState<Axis>("progressPct");
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isComparing, setIsComparing] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchAnalyticsJson("/api/event/auctions?limit=60")
            .then((data) => {
                if (cancelled) return;
                setSessions(data.sessions);

                // Preselect the two biggest auctions so the tab is useful on open
                // rather than showing an empty chart.
                const biggest = [...data.sessions]
                    .sort(
                        (a: ComparableSession, b: ComparableSession) =>
                            b.peakConcurrentViewers - a.peakConcurrentViewers
                    )
                    .slice(0, 2)
                    .map((session: ComparableSession) => session.id);
                setSelected(biggest);
            })
            .catch(() => setSessions([]))
            .finally(() => {
                if (!cancelled) setIsLoadingList(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (selected.length === 0) {
            setAuctions([]);
            return;
        }

        let cancelled = false;
        setIsComparing(true);

        fetchAnalyticsJson(`/api/event/auctions/compare?sessionIds=${selected.join(",")}`)
            .then((data) => {
                if (!cancelled) setAuctions(data.auctions);
            })
            .catch(() => {
                if (!cancelled) setAuctions([]);
            })
            .finally(() => {
                if (!cancelled) setIsComparing(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selected]);

    const toggle = (sessionId: string) => {
        setSelected((current) =>
            current.includes(sessionId)
                ? current.filter((id) => id !== sessionId)
                : // The comparison endpoint caps at 8; more lines than that is
                  // unreadable anyway.
                  current.length >= 8
                  ? current
                  : [...current, sessionId]
        );
    };

    /**
     * Merge every auction's curve onto one dataset keyed by the shared axis.
     * Auctions of different lengths and dates only become comparable once they
     * are placed on a common x-axis — percentage progress by default.
     */
    const chartData = useMemo(() => {
        if (auctions.length === 0) return [];

        const step = axis === "progressPct" ? 2 : 5;
        const maxValue = Math.max(
            ...auctions.map((auction) =>
                auction.curve.length > 0 ? auction.curve[auction.curve.length - 1][axis] : 0
            )
        );

        const buckets: Record<string, number | null>[] = [];

        for (let position = 0; position <= maxValue; position += step) {
            const row: Record<string, number | null> = { position };

            for (const auction of auctions) {
                // Nearest sample within half a step; null leaves a gap rather
                // than inventing a value past the end of a shorter auction.
                const nearby = auction.curve.filter(
                    (point) => Math.abs(point[axis] - position) <= step / 2
                );

                row[auction.sessionId] =
                    nearby.length > 0
                        ? Math.round(nearby.reduce((sum, point) => sum + point.viewerCount, 0) / nearby.length)
                        : null;
            }

            buckets.push(row);
        }

        return buckets;
    }, [auctions, axis]);

    const chartConfig = useMemo(
        () =>
            Object.fromEntries(
                auctions.map((auction, index) => [
                    auction.sessionId,
                    {
                        label: `${auction.tournamentName} · ${new Date(auction.sessionStartedAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short" }
                        )}`,
                        color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
                    },
                ])
            ),
        [auctions]
    );

    /** Index of the auction that wins each stat row, for highlighting. */
    const bestByRow = useMemo(
        () =>
            STAT_ROWS.map((row) => {
                if (auctions.length < 2) return -1;

                let bestIndex = -1;
                auctions.forEach((auction, index) => {
                    const value = row.get(auction);
                    if (value === null) return;

                    const best = bestIndex === -1 ? null : row.get(auctions[bestIndex]);
                    if (best === null || (row.lowerIsBetter ? value < best : value > best)) {
                        bestIndex = index;
                    }
                });

                // Nothing to celebrate when every auction scored zero.
                if (bestIndex === -1) return -1;
                return row.get(auctions[bestIndex]) === 0 ? -1 : bestIndex;
            }),
        [auctions]
    );

    if (isLoadingList) {
        return (
            <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <GitCompare className="h-5 w-5 text-purple-500" />
                        <CardTitle>Pick auctions to compare</CardTitle>
                    </div>
                    <CardDescription>
                        Auctions with at least one player sold, or lasting 10 minutes or more. Select up to 8.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <EmptyState message="No completed auctions to compare yet" height="h-[120px]" />
                    ) : (
                        <div className="flex max-h-[260px] flex-wrap gap-2 overflow-y-auto">
                            {sessions.map((session) => {
                                const isSelected = selected.includes(session.id);
                                const colorIndex = selected.indexOf(session.id);

                                return (
                                    <button
                                        key={session.id}
                                        type="button"
                                        onClick={() => toggle(session.id)}
                                        aria-pressed={isSelected}
                                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                            isSelected
                                                ? "border-transparent bg-muted"
                                                : "border-border hover:bg-muted/50"
                                        }`}
                                        style={
                                            isSelected
                                                ? {
                                                      boxShadow: `inset 3px 0 0 ${
                                                          COMPARISON_COLORS[colorIndex % COMPARISON_COLORS.length]
                                                      }`,
                                                  }
                                                : undefined
                                        }
                                    >
                                        <div className="max-w-[220px] truncate text-sm font-medium">
                                            {session.tournamentName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDateTime(session.sessionStartedAt)}
                                        </div>
                                        <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                                            {formatDuration(session.sessionDurationMinutes)} · peak{" "}
                                            {session.peakConcurrentViewers} · {session.playersSold} sold
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Viewer curves</CardTitle>
                            <CardDescription>
                                {axis === "progressPct"
                                    ? "Normalised to auction progress, so different-length auctions line up"
                                    : "Absolute minutes since each auction started"}
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={axis === "progressPct" ? "default" : "outline"}
                                onClick={() => setAxis("progressPct")}
                            >
                                % progress
                            </Button>
                            <Button
                                size="sm"
                                variant={axis === "elapsedMinutes" ? "default" : "outline"}
                                onClick={() => setAxis("elapsedMinutes")}
                            >
                                Elapsed time
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isComparing ? (
                        <div className="flex h-[340px] items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : chartData.length === 0 ? (
                        <EmptyState message="Select at least one auction above" height="h-[340px]" />
                    ) : (
                        <ChartContainer config={chartConfig} className="h-[340px] w-full">
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="position"
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                    tickFormatter={(value) =>
                                        axis === "progressPct" ? `${value}%` : `${value}m`
                                    }
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    className="text-xs"
                                    label={{ value: "Viewers", angle: -90, position: "insideLeft", fontSize: 11 }}
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                {auctions.map((auction, index) => (
                                    <Line
                                        key={auction.sessionId}
                                        type="monotone"
                                        dataKey={auction.sessionId}
                                        stroke={COMPARISON_COLORS[index % COMPARISON_COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Side by side</CardTitle>
                    <CardDescription>Best value in each row is highlighted</CardDescription>
                </CardHeader>
                <CardContent>
                    {auctions.length === 0 ? (
                        <EmptyState message="Select auctions to compare" height="h-[160px]" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px]">
                                <thead>
                                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="py-2 pr-4 font-medium">Metric</th>
                                        {auctions.map((auction, index) => (
                                            <th key={auction.sessionId} className="py-2 pr-4 text-right font-medium">
                                                <span
                                                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                                                    style={{
                                                        backgroundColor:
                                                            COMPARISON_COLORS[index % COMPARISON_COLORS.length],
                                                    }}
                                                />
                                                <span className="align-middle">
                                                    {new Date(auction.sessionStartedAt).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {STAT_ROWS.map((row, rowIndex) => (
                                        <tr key={row.label} className="border-b border-border/50 last:border-0">
                                            <td className="py-3 pr-4 font-medium">{row.label}</td>
                                            {auctions.map((auction, index) => (
                                                <td
                                                    key={auction.sessionId}
                                                    className={`py-3 pr-4 text-right tabular-nums ${
                                                        bestByRow[rowIndex] === index
                                                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                                            : ""
                                                    }`}
                                                >
                                                    {(() => {
                                                        const value = row.get(auction);
                                                        return value === null ? (
                                                            <span
                                                                className="text-muted-foreground"
                                                                title="Not recorded for this auction"
                                                            >
                                                                &mdash;
                                                            </span>
                                                        ) : (
                                                            row.format(value)
                                                        );
                                                    })()}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ComparisonTab;
