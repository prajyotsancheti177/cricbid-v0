import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CheckCircle, MessageCircle, TrendingUp, XCircle } from "lucide-react";
import { StatCard, EmptyState } from "../components/StatCard";
import { formatDate, whatsappChartConfig } from "../shared";
import type { AnalyticsData } from "../types";

const WhatsAppTab = ({ data }: { data: AnalyticsData | null }) => {
    const whatsapp = data?.whatsapp;

    if (!whatsapp) return <EmptyState message="No WhatsApp data available." height="h-[400px]" />;

    const dailyData = whatsapp.daily.map((point) => ({ ...point, date: formatDate(point.date) }));

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Messages"
                    value={whatsapp.summary.totalMessages?.toLocaleString() || 0}
                    icon={<MessageCircle className="h-5 w-5 text-green-500" />}
                    accent="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20"
                    valueClass="text-green-500"
                    hint="Total notifications sent"
                />
                <StatCard
                    title="Delivered"
                    value={whatsapp.summary.successCount?.toLocaleString() || 0}
                    icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
                    accent="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
                    valueClass="text-emerald-500"
                    hint="Successfully delivered"
                />
                <StatCard
                    title="Failed"
                    value={whatsapp.summary.failedCount?.toLocaleString() || 0}
                    icon={<XCircle className="h-5 w-5 text-red-500" />}
                    accent="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20"
                    valueClass="text-red-500"
                    hint="Failed to deliver"
                />
                <StatCard
                    title="Success Rate"
                    value={`${whatsapp.summary.successRate?.toFixed(1) || 0}%`}
                    icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
                    accent="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20"
                    valueClass="text-blue-500"
                    hint="Delivery success rate"
                />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-500" />
                        <CardTitle>Daily WhatsApp Messages</CardTitle>
                    </div>
                    <CardDescription>Sent notifications over time (delivered vs failed)</CardDescription>
                </CardHeader>
                <CardContent>
                    {dailyData.length > 0 ? (
                        <ChartContainer config={whatsappChartConfig} className="h-[300px] w-full">
                            <RechartsBarChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" />
                                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="success" stackId="a" fill="hsl(142, 76%, 36%)" />
                                <Bar dataKey="failed" stackId="a" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ChartContainer>
                    ) : (
                        <EmptyState message="No WhatsApp data available for the selected period" />
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Sold Notifications</CardTitle>
                        <CardDescription>Notifications sent when players are sold</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-500">
                            {whatsapp.summary.soldNotifications?.toLocaleString() || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Unsold Notifications</CardTitle>
                        <CardDescription>Notifications sent when players go unsold</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-amber-500">
                            {whatsapp.summary.unsoldNotifications?.toLocaleString() || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default WhatsAppTab;
