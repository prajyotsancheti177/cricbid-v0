import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CalendarRange, Clock, TrendingUp } from "lucide-react";
import { DeltaBadge, EmptyState } from "../components/StatCard";
import { DAY_NAMES, formatBucket, hourChartConfig } from "../shared";
import type { AnalyticsData, HeatmapCell } from "../types";

interface MetricRow {
    label: string;
    current: number;
    previous: number;
    /** True when a decrease is the desirable direction. */
    invert?: boolean;
    format?: (value: number) => string;
}

/**
 * Activity grid: day of week down, hour across. Auction evenings show up as a
 * bright band, which is the point — it tells you when the site is actually used.
 */
const Heatmap = ({ cells }: { cells: HeatmapCell[] }) => {
    const { grid, max } = useMemo(() => {
        const lookup = new Map<string, number>();
        let peak = 0;

        for (const cell of cells) {
            lookup.set(`${cell.dayOfWeek}-${cell.hour}`, cell.pageViews);
            if (cell.pageViews > peak) peak = cell.pageViews;
        }

        return { grid: lookup, max: peak };
    }, [cells]);

    if (cells.length === 0) {
        return <EmptyState message="No activity data for the selected period" height="h-[260px]" />;
    }

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[680px]">
                <div className="mb-1 flex">
                    <div className="w-10 shrink-0" />
                    {Array.from({ length: 24 }, (_, hour) => (
                        <div key={hour} className="flex-1 text-center text-[10px] text-muted-foreground">
                            {hour % 3 === 0 ? hour : ""}
                        </div>
                    ))}
                </div>

                {DAY_NAMES.map((dayName, dayIndex) => (
                    <div key={dayName} className="mb-1 flex items-center">
                        <div className="w-10 shrink-0 text-xs text-muted-foreground">{dayName}</div>
                        {Array.from({ length: 24 }, (_, hour) => {
                            const views = grid.get(`${dayIndex}-${hour}`) || 0;
                            // Square-root scaling: a linear ramp makes everything but
                            // the single busiest hour look empty.
                            const intensity = max > 0 ? Math.sqrt(views / max) : 0;

                            return (
                                <div
                                    key={hour}
                                    className="mx-[1px] h-6 flex-1 rounded-[2px] transition-colors"
                                    style={{
                                        backgroundColor:
                                            views === 0
                                                ? "hsl(var(--muted))"
                                                : `hsl(221 83% 53% / ${0.12 + intensity * 0.88})`,
                                    }}
                                    title={`${dayName} ${hour}:00 — ${views.toLocaleString()} page views`}
                                />
                            );
                        })}
                    </div>
                ))}

                <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span>Less</span>
                    {[0, 0.25, 0.5, 0.75, 1].map((step) => (
                        <span
                            key={step}
                            className="h-3 w-6 rounded-[2px]"
                            style={{
                                backgroundColor:
                                    step === 0 ? "hsl(var(--muted))" : `hsl(221 83% 53% / ${0.12 + step * 0.88})`,
                            }}
                        />
                    ))}
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};

const DayOnDayTab = ({ data }: { data: AnalyticsData | null }) => {
    const hourly = useMemo(() => {
        if (!data) return [];

        const byHour = new Map<number, number>();
        for (const cell of data.heatmap) {
            byHour.set(cell.hour, (byHour.get(cell.hour) || 0) + cell.pageViews);
        }

        return Array.from({ length: 24 }, (_, hour) => ({
            hour: `${String(hour).padStart(2, "0")}:00`,
            pageViews: byHour.get(hour) || 0,
        }));
    }, [data]);

    const busiest = useMemo(() => {
        if (!data || data.heatmap.length === 0) return null;
        return data.heatmap.reduce((best, cell) => (cell.pageViews > best.pageViews ? cell : best));
    }, [data]);

    if (!data) return <EmptyState message="No analytics data available." height="h-[400px]" />;

    const previous = data.previous?.summary;

    const windowDays = Math.round(
        (new Date(data.dateRange.endDate).getTime() - new Date(data.dateRange.startDate).getTime()) / 86400000
    );

    const rows: MetricRow[] = previous
        ? [
              { label: "Page views", current: data.summary.totalPageViews, previous: previous.totalPageViews },
              { label: "Unique visitors", current: data.summary.uniqueVisitors, previous: previous.uniqueVisitors },
              { label: "Sessions", current: data.summary.sessions, previous: previous.sessions },
              { label: "New visitors", current: data.summary.newVisitors, previous: previous.newVisitors },
              { label: "Returning visitors", current: data.summary.returningVisitors, previous: previous.returningVisitors },
              {
                  label: "Views per session",
                  current: data.summary.viewsPerSession,
                  previous: previous.viewsPerSession,
                  format: (value) => value.toFixed(2),
              },
              { label: "Pages reached", current: data.summary.uniquePages, previous: previous.uniquePages },
          ]
        : [];

    const seriesData = data.series.map((point) => ({
        ...point,
        label: formatBucket(point.date, data.granularity),
    }));

    // Align the previous window onto the current one position-by-position, so
    // bucket N of this period sits against bucket N of the last.
    const comparisonData = seriesData.map((point, index) => ({
        ...point,
        previousPageViews: data.previous?.series[index]?.pageViews ?? 0,
    }));

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CalendarRange className="h-5 w-5 text-blue-500" />
                        <CardTitle>This period vs the one before</CardTitle>
                    </div>
                    <CardDescription>
                        {data.previous
                            ? `Compared against the preceding ${windowDays} days`
                            : "No comparison window available"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {rows.length === 0 ? (
                        <EmptyState message="No previous period to compare against" height="h-[160px]" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px]">
                                <thead>
                                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="py-2 pr-4 font-medium">Metric</th>
                                        <th className="py-2 pr-4 text-right font-medium">This period</th>
                                        <th className="py-2 pr-4 text-right font-medium">Previous</th>
                                        <th className="py-2 pr-4 text-right font-medium">Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const format = row.format || ((value: number) => value.toLocaleString());
                                        const diff = row.current - row.previous;

                                        return (
                                            <tr key={row.label} className="border-b border-border/50 last:border-0">
                                                <td className="py-3 pr-4 font-medium">{row.label}</td>
                                                <td className="py-3 pr-4 text-right tabular-nums">{format(row.current)}</td>
                                                <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                                                    {format(row.previous)}
                                                </td>
                                                <td className="py-3 pr-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="tabular-nums text-xs text-muted-foreground">
                                                            {diff > 0 ? "+" : ""}
                                                            {format(diff)}
                                                        </span>
                                                        <DeltaBadge
                                                            current={row.current}
                                                            previous={row.previous}
                                                            invert={row.invert}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-purple-500" />
                        <CardTitle>Bucket-by-bucket comparison</CardTitle>
                    </div>
                    <CardDescription>
                        Each {data.granularity} against the same position in the previous period
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {comparisonData.length > 0 ? (
                        <ChartContainer
                            config={{
                                pageViews: { label: "This period", color: "hsl(221, 83%, 53%)" },
                                previousPageViews: { label: "Previous period", color: "hsl(220, 9%, 60%)" },
                            }}
                            className="h-[320px] w-full"
                        >
                            <RechartsBarChart data={comparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="previousPageViews" fill="hsl(220, 9%, 60%)" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="pageViews" fill="hsl(221, 83%, 53%)" radius={[3, 3, 0, 0]} />
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
                        <CalendarRange className="h-5 w-5 text-emerald-500" />
                        <CardTitle>When the site is busy</CardTitle>
                    </div>
                    <CardDescription>
                        Page views by day of week and hour, in IST
                        {busiest &&
                            ` — busiest is ${DAY_NAMES[busiest.dayOfWeek]} at ${String(busiest.hour).padStart(2, "0")}:00`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Heatmap cells={data.heatmap} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        <CardTitle>Hour of day</CardTitle>
                    </div>
                    <CardDescription>Total page views per hour across the period (IST)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={hourChartConfig} className="h-[260px] w-full">
                        <RechartsBarChart data={hourly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="hour" tickLine={false} axisLine={false} className="text-xs" interval={2} />
                            <YAxis tickLine={false} axisLine={false} className="text-xs" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="pageViews" fill="hsl(221, 83%, 60%)" radius={[3, 3, 0, 0]} />
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
};

export default DayOnDayTab;
