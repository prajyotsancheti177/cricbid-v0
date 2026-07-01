import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Activity, LogOut, LogIn, CalendarPlus, ChevronDown } from "lucide-react";
import { post } from "../../lib/api";
import TabBar from "./TabBar";

interface Tournament { _id: string; name: string }

/**
 * App shell for tournament-level pages: sticky top bar with tournament
 * switcher + tournament tab bar (Matches | Points Table | Stats).
 */
export default function AppShell() {
  const { tid } = useParams<{ tid: string }>();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isAuth = localStorage.getItem("scoring_auth") === "true";
  const user = (() => { try { return JSON.parse(localStorage.getItem("scoring_user") || "null"); } catch { return null; } })();

  useEffect(() => {
    post("tournament/all", {}).then(r => { if (r.success) setTournaments(r.data || []); });
  }, []);

  useEffect(() => {
    if (tid) localStorage.setItem("scoring_last_tid", tid);
  }, [tid]);

  const current = tournaments.find(t => t._id === tid);

  const switchTournament = (newTid: string) => {
    setPickerOpen(false);
    navigate(`/t/${newTid}/matches`);
  };

  const logout = () => {
    localStorage.removeItem("scoring_auth");
    localStorage.removeItem("scoring_user");
    navigate(0);
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bdr bg-panel sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Activity className="w-5 h-5 text-live shrink-0" />

          {/* Tournament switcher */}
          <button
            onClick={() => setPickerOpen(p => !p)}
            className="flex items-center gap-1.5 min-w-0 text-left"
          >
            <span className="font-bold text-white text-sm truncate">
              {current?.name || "Select tournament"}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
          </button>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {isAuth && (
              <button onClick={() => navigate("/schedule-builder")} title="Build schedule"
                className="flex items-center gap-1 text-[11px] bg-primary/15 border border-primary/30 text-primary px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary/25 transition">
                <CalendarPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Schedule</span>
              </button>
            )}
            {isAuth
              ? <button onClick={logout} title={user?.name} className="text-muted hover:text-white transition"><LogOut className="w-4 h-4" /></button>
              : <button onClick={() => navigate("/login")}
                  className="flex items-center gap-1 text-[11px] bg-primary text-white px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary/90 transition">
                  <LogIn className="w-3.5 h-3.5" /> Scorer
                </button>}
          </div>
        </div>

        {/* Tournament dropdown */}
        {pickerOpen && (
          <div className="absolute left-0 right-0 top-14 bg-panel border-b border-bdr shadow-2xl max-h-80 overflow-y-auto z-30">
            <div className="max-w-2xl mx-auto py-1">
              {tournaments.map(t => (
                <button key={t._id} onClick={() => switchTournament(t._id)}
                  className={`w-full text-left px-4 py-3 text-sm transition ${t._id === tid ? "text-primary font-bold bg-primary/5" : "text-white hover:bg-panel2"}`}>
                  {t.name}
                </button>
              ))}
              {tournaments.length === 0 && <p className="px-4 py-3 text-sm text-muted">No tournaments found</p>}
            </div>
          </div>
        )}
      </header>

      {tid && (
        <TabBar
          tabs={[
            { label: "Matches", to: `/t/${tid}/matches` },
            { label: "Points Table", to: `/t/${tid}/points` },
            { label: "Stats", to: `/t/${tid}/stats` },
          ]}
        />
      )}

      <main className="max-w-2xl mx-auto px-3 py-4 pb-12">
        <Outlet />
      </main>
    </div>
  );
}
