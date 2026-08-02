import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Radio } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import SplitFlapCounter from "./SplitFlapCounter";

const POLL_INTERVAL_MS = 10000;

interface ActivePage {
    page: string;
    count: number;
}

interface ActiveUsersSnapshot {
    activeUsers: number;
    peakToday: number;
    byPage: ActivePage[];
    history: { timestamp: string; activeUsers: number }[];
}

/**
 * Live "people on the site right now" board.
 *
 * Backed by an in-memory presence map on the server (a 20s heartbeat from every
 * open tab), so this is a true now-count rather than a database aggregate.
 */
const LiveActiveUsers = () => {
    const [snapshot, setSnapshot] = useState<ActiveUsersSnapshot | null>(null);
    const [isStale, setIsStale] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchSnapshot = async () => {
            try {
                const userStr = localStorage.getItem("user");
                const userId = userStr ? JSON.parse(userStr)?._id : undefined;

                const response = await fetch(`${apiConfig.baseUrl}/api/event/active-users`, {
                    headers: userId ? { "x-user-id": userId } : undefined,
                });
                const body = await response.json();

                if (cancelled) return;

                if (body?.success) {
                    setSnapshot(body.data);
                    setIsStale(false);
                } else {
                    setIsStale(true);
                }
            } catch {
                if (!cancelled) setIsStale(true);
            }
        };

        fetchSnapshot();
        timerRef.current = setInterval(fetchSnapshot, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const activeUsers = snapshot?.activeUsers ?? 0;
    const peakToday = snapshot?.peakToday ?? 0;
    const topPages = snapshot?.byPage?.slice(0, 4) ?? [];

    return (
        <Card className="overflow-hidden border-slate-800 bg-slate-950 text-slate-100">
            <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-4 flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                {!isStale && (
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                )}
                                <span
                                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                                        isStale ? "bg-slate-500" : "bg-emerald-400"
                                    }`}
                                />
                            </span>
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                {isStale ? "Reconnecting" : "Live now"}
                            </span>
                        </div>

                        <SplitFlapCounter
                            value={activeUsers}
                            minDigits={2}
                            label="people on the site right now"
                            className="text-5xl sm:text-6xl"
                        />

                        <p className="mt-4 text-sm text-slate-400">
                            {activeUsers === 1 ? "person" : "people"} on the site right now
                            <span className="mx-2 text-slate-700">|</span>
                            peak today <span className="font-semibold text-slate-200">{peakToday}</span>
                        </p>
                    </div>

                    <div className="min-w-[13rem]">
                        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            Where they are
                        </p>

                        {topPages.length === 0 ? (
                            <p className="text-sm text-slate-500">Nobody on the site right now.</p>
                        ) : (
                            <ul className="space-y-2">
                                {topPages.map(({ page, count }) => (
                                    <li key={page} className="flex items-center justify-between gap-4 text-sm">
                                        <span className="truncate font-mono text-xs text-slate-300" title={page}>
                                            {page}
                                        </span>
                                        <span className="flex items-center gap-1.5 tabular-nums text-slate-400">
                                            <Radio className="h-3 w-3 text-emerald-400" />
                                            {count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default LiveActiveUsers;
