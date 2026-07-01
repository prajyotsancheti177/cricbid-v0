import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Wifi } from "lucide-react";
import { post } from "../../lib/api";
import { useLiveMatch } from "../../lib/useLiveMatch";
import LiveBadge from "../../components/ui/LiveBadge";
import LiveTab from "./LiveTab";
import ScorecardTab from "./ScorecardTab";
import CommentaryTab from "./CommentaryTab";
import InfoTab from "./InfoTab";

interface MatchCtx {
  match: any;
  names: Record<string, string>;
  refreshKey: number;
  battingTeamName: (inn: any) => string;
}

const MatchContext = createContext<MatchCtx | null>(null);
export const useMatch = () => useContext(MatchContext)!;

const TABS = ["live", "scorecard", "commentary", "info"] as const;

export default function MatchCenter() {
  const { matchId, tab } = useParams<{ matchId: string; tab: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<any>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchScorecard = useCallback(() => {
    post("scoring/scorecard", { matchId }).then(r => {
      if (r.success) { setMatch(r.data.match); setNames(r.data.nameMap); }
    });
  }, [matchId]);

  const connected = useLiveMatch(matchId, () => {
    fetchScorecard();
    setRefreshKey(k => k + 1);
  });

  useEffect(() => { fetchScorecard(); }, [fetchScorecard]);

  if (!tab || !TABS.includes(tab as any)) return <Navigate to={`/match/${matchId}/live`} replace />;

  if (!match) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-sm">
        Loading match…
      </div>
    );
  }

  const isLive = match.status === "live";
  const inn1 = match.innings?.find((i: any) => i.inningsNumber === 1);
  const inn2 = match.innings?.find((i: any) => i.inningsNumber === 2);

  const battingTeamName = (inn: any) => {
    if (!inn) return "";
    return inn.battingTeamId === match.teamA?.id ? match.teamA?.name : match.teamB?.name;
  };

  const back = () => {
    const lastTid = localStorage.getItem("scoring_last_tid");
    navigate(lastTid ? `/t/${lastTid}/matches` : "/");
  };

  return (
    <MatchContext.Provider value={{ match, names, refreshKey, battingTeamName }}>
      <div className="min-h-screen bg-bg pb-12">
        {/* Sticky match header */}
        <header className="border-b border-bdr bg-panel sticky top-0 z-20">
          <div className="max-w-2xl mx-auto px-4 pt-3 pb-2.5">
            <div className="flex items-center gap-3">
              <button onClick={back} className="text-muted hover:text-white transition shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {match.teamA?.name} <span className="text-muted font-normal text-xs">vs</span> {match.teamB?.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-xs">
                  {inn1 && (
                    <span className="text-[#cbd5e1] font-mono">
                      <span className="text-muted">{battingTeamName(inn1).slice(0, 12)}</span> {inn1.runs}/{inn1.wickets} ({inn1.oversBowled})
                    </span>
                  )}
                  {inn2 && (
                    <span className="text-[#cbd5e1] font-mono">
                      <span className="text-muted">{battingTeamName(inn2).slice(0, 12)}</span> {inn2.runs}/{inn2.wickets} ({inn2.oversBowled})
                    </span>
                  )}
                  {!inn1 && <span className="text-muted">{match.format} · {match.totalOvers} ov</span>}
                </div>
              </div>
              <span className="shrink-0 flex items-center gap-1.5">
                {isLive
                  ? <><Wifi className={`w-3.5 h-3.5 ${connected ? "text-live" : "text-muted"}`} /><LiveBadge /></>
                  : <span className="text-[11px] text-muted font-semibold">{match.status === "completed" ? "ENDED" : match.status.toUpperCase()}</span>}
              </span>
            </div>
            {match.resultNote && (
              <p className="text-xs font-semibold text-orange-400 mt-1.5 pl-8 truncate">{match.resultNote}</p>
            )}
          </div>

          {/* Tabs inside sticky header so they stay visible */}
          <div className="max-w-2xl mx-auto flex overflow-x-auto no-scrollbar border-t border-bdr/60">
            {TABS.map(t => (
              <button key={t} onClick={() => navigate(`/match/${matchId}/${t}`, { replace: true })}
                className={`tab-link flex-1 capitalize ${tab === t ? "tab-link-active" : "hover:text-white"}`}>
                {t}
              </button>
            ))}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-3 py-4">
          {tab === "live" && <LiveTab />}
          {tab === "scorecard" && <ScorecardTab />}
          {tab === "commentary" && <CommentaryTab />}
          {tab === "info" && <InfoTab />}
        </main>
      </div>
    </MatchContext.Provider>
  );
}
