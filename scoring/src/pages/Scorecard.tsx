import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { post } from "../lib/api";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Activity, Wifi } from "lucide-react";

// Fix: use localhost in dev so socket connects to local backend, not production
const SOCKET_BASE = import.meta.env.DEV
  ? "http://localhost:3001"
  : (import.meta.env.VITE_API_URL || "https://cricbid.online");

interface PlayerName { [id: string]: string }

export default function Scorecard() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();
  const [data, setData]         = useState<any>(null);
  const [names, setNames]       = useState<PlayerName>({});
  const [liveState, setLiveState] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchScorecard = useCallback(() => {
    post("scoring/scorecard", { matchId }).then(r => {
      if (r.success) { setData(r.data.match); setNames(r.data.nameMap); }
    });
  }, [matchId]);

  const fetchLive = useCallback((innNum: number) => {
    post("scoring/live", { matchId, inningsNumber: innNum }).then(r => {
      if (r.success && r.data) setLiveState(r.data);
    });
  }, [matchId]);

  useEffect(() => {
    fetchScorecard();

    const socket = io(SOCKET_BASE, { transports: ["websocket"], reconnectionAttempts: 5 });
    socketRef.current = socket;
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.emit("scoring:join", matchId);
    socket.on("scoring:ball", () => { fetchScorecard(); });
    socket.on("scoring:undo", () => { fetchScorecard(); });
    return () => { socket.disconnect(); };
  }, [matchId, fetchScorecard]);

  // When scorecard loads, fetch live state for any live innings
  useEffect(() => {
    if (!data) return;
    const liveInnings = data.innings?.find((i: any) => !i.completedAt);
    if (liveInnings) fetchLive(liveInnings.inningsNumber);
  }, [data, fetchLive]);

  if (!data) return (
    <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-sm">Loading scorecard…</div>
  );

  const inn1   = data.innings?.find((i: any) => i.inningsNumber === 1);
  const inn2   = data.innings?.find((i: any) => i.inningsNumber === 2);
  const isLive = data.status === "live";

  const battingTeamName = (inn: any) => {
    if (!inn) return "";
    return inn.battingTeamId === (data.teamA?.id || data.teamAId) ? data.teamA?.name : data.teamB?.name;
  };

  return (
    <div className="min-h-screen bg-bg pb-10">
      <header className="border-b border-bdr bg-panel sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted hover:text-white transition shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Activity className="w-4 h-4 text-green-400 shrink-0" />
          <span className="font-bold text-white truncate">{data.teamA?.name} vs {data.teamB?.name}</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs shrink-0">
            {isLive ? (
              <>
                <Wifi className={`w-3.5 h-3.5 ${connected ? "text-green-400" : "text-muted"}`} />
                <span className="text-green-400 font-semibold">LIVE</span>
              </>
            ) : (
              <span className="text-muted">Completed</span>
            )}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-3">

        {/* ── Scoreboard card ── */}
        <div className="bg-panel border border-bdr rounded-2xl p-5">
          <p className="text-[11px] text-muted mb-3 uppercase tracking-wide font-semibold">{data.format} · {data.totalOvers} ov</p>
          <div className="flex gap-8">
            {inn1 && (
              <div>
                <p className="text-[11px] text-muted">{battingTeamName(inn1)}</p>
                <p className="text-3xl font-black text-white leading-none">
                  {inn1.runs}<span className="text-xl text-muted">/{inn1.wickets}</span>
                </p>
                <p className="text-xs text-muted">{inn1.oversBowled} ov</p>
              </div>
            )}
            {inn2 && (
              <div>
                <p className="text-[11px] text-muted">{battingTeamName(inn2)}</p>
                <p className="text-3xl font-black text-white leading-none">
                  {inn2.runs}<span className="text-xl text-muted">/{inn2.wickets}</span>
                </p>
                <p className="text-xs text-muted">{inn2.oversBowled} ov</p>
                {inn1 && (
                  <p className="text-[11px] text-primary mt-0.5">
                    Target: {inn1.runs + 1}
                  </p>
                )}
              </div>
            )}
          </div>
          {data.resultNote && (
            <p className="mt-3 text-sm font-semibold text-orange-400 border-t border-bdr pt-3">{data.resultNote}</p>
          )}
        </div>

        {/* ── Live card (shown only during active match) ── */}
        {isLive && liveState && <LiveCard liveState={liveState} names={names} />}

        {/* ── Per-innings scorecards ── */}
        {data.innings?.map((inn: any) => (
          <InningsCard key={inn.id} innings={inn} names={names}
            battingTeam={battingTeamName(inn)} />
        ))}
      </main>
    </div>
  );
}

// ── Live card ─────────────────────────────────────────────────────────────────

function LiveCard({ liveState, names }: { liveState: any; names: PlayerName }) {
  const { innings, batters = [], bowlers = [], thisOverBalls = [] } = liveState;
  const n = (id?: string) => id ? (names[id] || `…${id.slice(-4)}`) : "—";

  const activeBatters = batters.filter((b: any) => !b.isOut);
  const lastBall      = [...(liveState.balls || [])].reverse()[0];
  const strikerId     = lastBall?.batsmanId;
  const bowlerId      = lastBall?.bowlerId;
  const lastBowler    = bowlers.find((b: any) => b.playerId === bowlerId) || bowlers.at(-1);

  const b1 = activeBatters.find((b: any) => b.playerId === strikerId) || activeBatters[0];
  const b2 = activeBatters.find((b: any) => b.playerId !== strikerId) || activeBatters[1];

  return (
    <div className="bg-panel border border-green-500/20 rounded-2xl overflow-hidden">
      <div className="px-4 py-2 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-bold text-green-400">Live</span>
        <span className="text-xs text-muted ml-auto">Innings {innings?.inningsNumber} · {innings?.oversBowled} ov</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Current batsmen */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { b: b1, striker: true },
            { b: b2, striker: false },
          ].map(({ b, striker }, i) => b && (
            <div key={i} className={`rounded-xl p-3 ${striker ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-[#1e293b] border border-bdr"}`}>
              <p className="text-[10px] text-muted">{striker ? "★ Striker" : "Non-striker"}</p>
              <p className="font-bold text-white text-sm truncate mt-0.5">{n(b.playerId)}</p>
              <p className="text-[11px] mt-1 text-white font-bold">
                {b.runs}<span className="text-muted font-normal">({b.ballsFaced})</span>
                <span className="text-muted ml-2 font-normal text-[10px]">4s:{b.fours} 6s:{b.sixes}</span>
              </p>
            </div>
          ))}
        </div>

        {/* This over */}
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wide mb-2">This over</p>
          <div className="flex gap-1.5 items-center flex-wrap">
            {thisOverBalls.map((ball: any, i: number) => (
              <BallChip key={i} ball={ball} />
            ))}
            {thisOverBalls.length === 0 && <span className="text-muted text-xs">New over</span>}
          </div>
        </div>

        {/* Current bowler */}
        {lastBowler && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-bdr">
            <span className="text-muted">Bowling: <span className="text-white font-semibold">{n(lastBowler.playerId)}</span></span>
            <span className="font-mono text-muted">
              {Math.floor(lastBowler.balls / 6)}.{lastBowler.balls % 6}–{lastBowler.runs}–{lastBowler.wickets}W
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ball chip ─────────────────────────────────────────────────────────────────

function BallChip({ ball }: { ball: any }) {
  let label: string, cls: string;
  if (ball.isWicket)               { label = "W";  cls = "bg-red-500/20 text-red-400 border border-red-500/40"; }
  else if (ball.extraType === "wide")   { label = "Wd"; cls = "bg-violet-500/20 text-violet-400 border border-violet-500/30"; }
  else if (ball.extraType === "no_ball"){ label = "Nb"; cls = "bg-orange-500/20 text-orange-400 border border-orange-500/30"; }
  else if (ball.batRuns === 4)     { label = "4";  cls = "bg-green-500/20 text-green-400 border border-green-500/40"; }
  else if (ball.batRuns === 6)     { label = "6";  cls = "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"; }
  else if (ball.batRuns === 0)     { label = "•";  cls = "bg-[#1e293b] text-[#4a5568]"; }
  else                             { label = String(ball.batRuns); cls = "bg-[#1e293b] text-[#94a3b8]"; }

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${cls}`}>
      {label}
    </div>
  );
}

// ── Innings scorecard ─────────────────────────────────────────────────────────

function InningsCard({ innings, names, battingTeam }: { innings: any; names: PlayerName; battingTeam: string }) {
  const batters = innings.batsmanInnings || [];
  const bowlers = innings.bowlerInnings  || [];
  const fow     = innings.fallOfWickets  || [];
  const n       = (id?: string) => id ? (names[id] || "—") : "—";
  const eco     = (b: any) => b.balls ? ((b.runs / b.balls) * 6).toFixed(2) : "—";
  const sr      = (b: any) => b.ballsFaced ? ((b.runs / b.ballsFaced) * 100).toFixed(1) : "—";

  return (
    <div className="bg-panel border border-bdr rounded-2xl overflow-hidden">
      {/* Section title */}
      <div className="px-4 py-2.5 bg-panel2 border-b border-bdr flex items-center justify-between">
        <span className="text-xs font-bold text-white">{battingTeam} — Innings {innings.inningsNumber}</span>
        <span className="text-xs text-muted">{innings.runs}/{innings.wickets} ({innings.oversBowled} ov)</span>
      </div>

      {/* Batting table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-bdr">
              <th className="text-left px-4 py-2 font-medium">Batsman</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">B</th>
              <th className="px-2 py-2 text-right font-medium">4s</th>
              <th className="px-2 py-2 text-right font-medium">6s</th>
              <th className="px-2 py-2 text-right font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {batters.filter((b: any) => !b.didNotBat).map((b: any) => (
              <tr key={b.id} className="border-t border-bdr/50">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-white">{n(b.playerId)}</p>
                  {b.isOut
                    ? <p className="text-muted text-[10px] leading-tight">{b.howOut || "out"}</p>
                    : <p className="text-green-400 text-[10px]">not out</p>}
                </td>
                <td className="px-2 py-2.5 text-right font-bold text-white">{b.runs}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.ballsFaced}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.fours}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.sixes}</td>
                <td className="px-2 py-2.5 text-right text-muted">{sr(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-bdr text-[11px] text-muted">
        Extras: <span className="text-white">{innings.extras ?? 0}</span>
        &nbsp;·&nbsp; Total: <span className="text-white">{innings.runs}/{innings.wickets}</span> ({innings.oversBowled} ov)
      </div>

      {fow.length > 0 && (
        <div className="px-4 py-2.5 border-t border-bdr">
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">Fall of Wickets</p>
          <p className="text-[11px] text-muted leading-relaxed">
            {fow.map((f: any) =>
              `${f.wicketNumber}-${f.runs} (${n(f.playerId)}, ${f.overNumber}.${f.ballInOver})`
            ).join("  ")}
          </p>
        </div>
      )}

      {/* Bowling label */}
      <div className="px-4 py-2.5 bg-panel2 border-t border-bdr text-xs font-bold text-white">
        Bowling
      </div>

      {/* Bowling table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-bdr">
              <th className="text-left px-4 py-2 font-medium">Bowler</th>
              <th className="px-2 py-2 text-right font-medium">O</th>
              <th className="px-2 py-2 text-right font-medium">M</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">W</th>
              <th className="px-2 py-2 text-right font-medium">Eco</th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map((b: any) => (
              <tr key={b.id} className="border-t border-bdr/50">
                <td className="px-4 py-2.5 font-semibold text-white">{n(b.playerId)}</td>
                <td className="px-2 py-2.5 text-right text-muted">{Math.floor(b.balls/6)}.{b.balls%6}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.maidens}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.runs}</td>
                <td className="px-2 py-2.5 text-right font-bold text-white">{b.wickets}</td>
                <td className="px-2 py-2.5 text-right text-muted">{eco(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
