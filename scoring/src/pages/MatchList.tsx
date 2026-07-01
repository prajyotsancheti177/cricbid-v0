import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../lib/api";
import { Activity, Calendar, MapPin, ChevronRight, LogOut, LogIn, CalendarPlus } from "lucide-react";

interface Tournament { _id: string; name: string }
interface Match {
  id: string; matchNumber?: number; round?: string; venue?: string;
  scheduledAt?: string; format: string; totalOvers: number;
  status: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  resultNote?: string;
}

const STATUS_COLOR: Record<string, string> = {
  upcoming:  "bg-[#1e293b] text-[#94a3b8]",
  live:      "bg-green-500/15 text-green-400 border border-green-500/30",
  completed: "bg-indigo-500/15 text-indigo-400",
  cancelled: "bg-red-500/15 text-red-400",
  no_result: "bg-yellow-500/15 text-yellow-400",
};

export default function MatchList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTid, setSelectedTid] = useState<string>("");
  const [matches, setMatches]         = useState<Match[]>([]);
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();
  const isAuth = localStorage.getItem("scoring_auth") === "true";
  const user   = (() => { try { return JSON.parse(localStorage.getItem("scoring_user") || "null"); } catch { return null; } })();

  useEffect(() => {
    post("tournament/all", {}).then(r => { if (r.success) setTournaments(r.data || []); });
  }, []);

  useEffect(() => {
    if (!selectedTid) return;
    setLoading(true);
    post("match/list", { tournamentId: selectedTid })
      .then(r => { if (r.success) setMatches(r.data || []); })
      .finally(() => setLoading(false));
  }, [selectedTid]);

  const logout = () => {
    localStorage.removeItem("scoring_auth");
    localStorage.removeItem("scoring_user");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <header className="border-b border-bdr bg-panel sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="font-bold text-white text-lg">Cric Scoring</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuth && user && <span className="text-xs text-muted hidden sm:block">{user.name}</span>}
            {isAuth && (
              <button onClick={() => navigate("/schedule-builder")}
                className="flex items-center gap-1.5 text-xs bg-primary/15 border border-primary/30 text-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/25 transition">
                <CalendarPlus className="w-3.5 h-3.5" /> Build Schedule
              </button>
            )}
            {isAuth
              ? <button onClick={logout} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition"><LogOut className="w-4 h-4" />Logout</button>
              : <button onClick={() => navigate("/login")} className="flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition"><LogIn className="w-4 h-4" />Scorer login</button>
            }
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Tournament picker */}
        <div>
          <label className="text-xs text-muted font-semibold uppercase tracking-wide">Tournament</label>
          <select
            value={selectedTid} onChange={e => setSelectedTid(e.target.value)}
            className="w-full mt-2 bg-panel border border-bdr rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="">Select a tournament…</option>
            {tournaments.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>

        {/* Match list */}
        {loading && <div className="text-center py-12 text-muted text-sm">Loading matches…</div>}

        {!loading && selectedTid && matches.length === 0 && (
          <div className="text-center py-12 text-muted text-sm">No matches scheduled yet for this tournament.</div>
        )}

        {!loading && matches.length > 0 && (
          <div className="space-y-3">
            {matches.map(m => (
              <div key={m.id} className="bg-panel border border-bdr rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-base font-bold text-white">
                    <span className="truncate">{m.teamA.name}</span>
                    <span className="text-muted text-xs font-normal shrink-0">vs</span>
                    <span className="truncate">{m.teamB.name}</span>
                  </div>
                  {m.resultNote && <p className="text-xs text-orange-400 mt-0.5">{m.resultNote}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                    {m.matchNumber && <span>M{m.matchNumber}</span>}
                    {m.round       && <span>{m.round}</span>}
                    {m.scheduledAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.scheduledAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                    {m.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.venue}</span>}
                    <span>{m.format} · {m.totalOvers} ov</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[m.status] || STATUS_COLOR.upcoming}`}>
                    {m.status === "live" ? "● LIVE" : m.status.charAt(0).toUpperCase() + m.status.slice(1).replace("_", " ")}
                  </span>
                  {m.status === "completed"
                    ? <button onClick={() => navigate(`/scorecard/${m.id}`)}
                        className="flex items-center gap-1 text-xs bg-[#1e293b] border border-bdr text-[#94a3b8] px-3 py-1.5 rounded-lg hover:text-white transition">
                        Scorecard <ChevronRight className="w-3 h-3" />
                      </button>
                    : isAuth
                      ? <button onClick={() => navigate(`/score/${m.id}`)}
                          className="flex items-center gap-1 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition">
                          Score <ChevronRight className="w-3 h-3" />
                        </button>
                      : <button onClick={() => navigate(`/scorecard/${m.id}`)}
                          className="flex items-center gap-1 text-xs bg-[#1e293b] border border-bdr text-[#94a3b8] px-3 py-1.5 rounded-lg hover:text-white transition">
                          View <ChevronRight className="w-3 h-3" />
                        </button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
