import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { post } from "../lib/api";
import MatchCard from "../components/match/MatchCard";

/**
 * Tournament matches home — Cricbuzz style: Live section on top, then
 * Upcoming, then Recent results. Polls every 30s while any match is live.
 */
export default function Home() {
  const { tid } = useParams<{ tid: string }>();
  const [matches, setMatches] = useState<any[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMatches = useCallback(() => {
    if (!tid) return;
    post("match/list", { tournamentId: tid }).then(r => {
      if (r.success) setMatches(r.data || []);
    });
  }, [tid]);

  useEffect(() => {
    setMatches(null);
    fetchMatches();
  }, [fetchMatches]);

  // Poll while any match is live
  useEffect(() => {
    const anyLive = matches?.some(m => m.status === "live");
    if (anyLive && !pollRef.current) {
      pollRef.current = setInterval(fetchMatches, 30_000);
    }
    if (!anyLive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [matches, fetchMatches]);

  if (matches === null) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4 animate-pulse space-y-3">
            <div className="h-3 w-32 bg-panel2 rounded" />
            <div className="h-4 w-3/4 bg-panel2 rounded" />
            <div className="h-4 w-2/3 bg-panel2 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const live = matches.filter(m => m.status === "live");
  const upcoming = matches
    .filter(m => m.status === "upcoming")
    .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
  const recent = matches
    .filter(m => ["completed", "cancelled", "no_result"].includes(m.status))
    .sort((a, b) => new Date(b.scheduledAt || b.updatedAt || 0).getTime() - new Date(a.scheduledAt || a.updatedAt || 0).getTime());

  if (matches.length === 0) {
    return <p className="text-muted text-sm text-center py-16">No matches scheduled yet for this tournament.</p>;
  }

  const Section = ({ label, items }: { label: string; items: any[] }) =>
    items.length === 0 ? null : (
      <section>
        <p className="section-label mb-2">{label}</p>
        <div className="space-y-2.5">
          {items.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      </section>
    );

  return (
    <div className="space-y-6">
      <Section label="Live" items={live} />
      <Section label="Upcoming" items={upcoming} />
      <Section label="Recent" items={recent} />
    </div>
  );
}
