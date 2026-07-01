import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Activity, Trophy, ChevronRight } from "lucide-react";
import { post } from "../lib/api";

interface Tournament { _id: string; name: string }

/**
 * Root landing: if a tournament was previously selected, jump straight to it;
 * otherwise show the tournament list.
 */
export default function TournamentPicker() {
  const lastTid = localStorage.getItem("scoring_last_tid");
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (lastTid) return;
    post("tournament/all", {}).then(r => setTournaments(r.success ? (r.data || []) : []));
  }, [lastTid]);

  if (lastTid) return <Navigate to={`/t/${lastTid}/matches`} replace />;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bdr bg-panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <Activity className="w-5 h-5 text-live" />
          <span className="font-bold text-white text-lg">Cric Scoring</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="section-label mb-3">Select a tournament</p>
        {tournaments === null && <p className="text-muted text-sm py-8 text-center">Loading tournaments…</p>}
        <div className="space-y-2">
          {tournaments?.map(t => (
            <button key={t._id} onClick={() => navigate(`/t/${t._id}/matches`)}
              className="card w-full flex items-center gap-3 p-4 text-left hover:border-primary/50 transition">
              <Trophy className="w-5 h-5 text-primary shrink-0" />
              <span className="flex-1 font-semibold text-white text-sm truncate">{t.name}</span>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </button>
          ))}
          {tournaments?.length === 0 && <p className="text-muted text-sm py-8 text-center">No tournaments found.</p>}
        </div>
      </main>
    </div>
  );
}
