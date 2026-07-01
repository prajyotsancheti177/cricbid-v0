import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { post } from "../lib/api";
import { ArrowLeft, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player      { _id: string; name: string; teamId?: any }
interface BallEvt     { id: string; batRuns: number; extraType?: string; extraRuns: number; isWicket: boolean; wicketType?: string; isLegalDelivery: boolean; commentary?: string }
interface BatsmanRow  { playerId: string; runs: number; ballsFaced: number; fours: number; sixes: number; isOut: boolean; battingOrder: number }
interface BowlerRow   { playerId: string; balls: number; runs: number; wickets: number; maidens: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ballDot = (b: BallEvt) => {
  if (b.isWicket)               return { label: "W",  cls: "bg-red-500/20 text-red-400 border border-red-500/40" };
  if (b.extraType === "wide")   return { label: "Wd", cls: "bg-violet-500/20 text-violet-400 border border-violet-500/30" };
  if (b.extraType === "no_ball")return { label: "Nb", cls: "bg-orange-500/20 text-orange-400 border border-orange-500/30" };
  if (b.batRuns === 4)          return { label: "4",  cls: "bg-green-500/20 text-green-400 border border-green-500/40" };
  if (b.batRuns === 6)          return { label: "6",  cls: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" };
  if (b.batRuns === 0)          return { label: "•",  cls: "bg-[#1e293b] text-[#4a5568]" };
  return { label: String(b.batRuns), cls: "bg-[#1e293b] text-[#94a3b8]" };
};

// resolve teamId from player record (MongoDB returns object or string)
const resolveTeamId = (p: any): string => p?.teamId?._id || p?.teamId || "";

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScorerPanel() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate    = useNavigate();

  const [match, setMatch]           = useState<any>(null);
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);

  const [inningsNum,    setInningsNum]    = useState(1);
  const [innings,       setInnings]       = useState<any>(null);
  const [batters,       setBatters]       = useState<BatsmanRow[]>([]);
  const [bowlers,       setBowlers]       = useState<BowlerRow[]>([]);
  const [thisOver,      setThisOver]      = useState<BallEvt[]>([]);
  const [allBalls,      setAllBalls]      = useState<BallEvt[]>([]);
  const [lastCommentary,setLastCommentary]= useState("");

  // Active players
  const [strikerId,    setStrikerId]    = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId,     setBowlerId]     = useState("");

  // Track active batting/bowling teams (set on innings start, persists)
  const [battingTeamId, setBattingTeamId]   = useState("");

  // Setup modal
  const [showSetup, setShowSetup] = useState(false);
  const [setup, setSetup] = useState({ battingTeamId: "", striker1Id: "", striker2Id: "", openingBowlerId: "" });

  // Wicket modal
  const [showWicket, setShowWicket] = useState(false);
  const [wicket, setWicket] = useState({ type: "bowled", outBatsmanId: "", fielderId: "", newBatsmanId: "", newBowlerId: "" });

  // Extra modal
  const [showExtra, setShowExtra] = useState<{ type: string } | null>(null);
  const [extraRuns, setExtraRuns] = useState(1);

  // End-of-over bowler pick
  const [showNewBowler, setShowNewBowler] = useState(false);
  const [newBowlerId, setNewBowlerId] = useState("");

  const [saving, setSaving] = useState(false);

  // ── Load match + players ─────────────────────────────────────────────────

  useEffect(() => {
    post("match/detail", { matchId }).then(r => {
      if (!r.success) return;
      const m = r.data;
      setMatch(m);
      const aId = m.teamA?.id || m.teamAId;
      const bId = m.teamB?.id || m.teamBId;
      // Use player/all (not getPlayers) and handle teamId as object
      post("player/all", { touranmentId: m.tournamentId }).then(pr => {
        const all = pr.data || [];
        setTeamAPlayers(all.filter((p: any) => resolveTeamId(p) === aId));
        setTeamBPlayers(all.filter((p: any) => resolveTeamId(p) === bId));
      });
      resumeLiveState(m, 1);
    });
  }, [matchId]);

  const resumeLiveState = async (_m: any, inn: number) => {
    const r = await post("scoring/live", { matchId, inningsNumber: inn });
    if (r.success && r.data) {
      const { innings: inn_data, batters: b, bowlers: bow, thisOverBalls } = r.data;
      setInnings(inn_data);
      setBatters(b);
      setBowlers(bow);
      setThisOver(thisOverBalls || []);
      setAllBalls(r.data.balls || []);
      if (inn_data?.battingTeamId) setBattingTeamId(inn_data.battingTeamId);
      const lastBall = (r.data.balls || []).at(-1);
      if (lastBall) {
        setStrikerId(lastBall.batsmanId);
        setNonStrikerId(lastBall.nonStrikerId || "");
        setBowlerId(lastBall.bowlerId);
      }
    } else {
      setShowSetup(true);
    }
  };

  // ── Start innings ─────────────────────────────────────────────────────────

  const handleStartInnings = async () => {
    const { battingTeamId: btId, striker1Id, striker2Id, openingBowlerId } = setup;
    if (!btId || !striker1Id || !striker2Id || !openingBowlerId) return;
    setSaving(true);
    const r = await post("scoring/start-innings", {
      matchId, inningsNumber: inningsNum, battingTeamId: btId,
      striker1Id, striker2Id, openingBowlerId,
    });
    setSaving(false);
    if (r.success) {
      setBattingTeamId(btId);
      setInnings(r.data);
      setStrikerId(striker1Id);
      setNonStrikerId(striker2Id);
      setBowlerId(openingBowlerId);
      setShowSetup(false);
      setBatters([
        { playerId: striker1Id, runs:0, ballsFaced:0, fours:0, sixes:0, isOut:false, battingOrder:1 },
        { playerId: striker2Id, runs:0, ballsFaced:0, fours:0, sixes:0, isOut:false, battingOrder:2 },
      ]);
      setBowlers([{ playerId: openingBowlerId, balls:0, runs:0, wickets:0, maidens:0 }]);
    }
  };

  // ── Record a ball ─────────────────────────────────────────────────────────

  const sendBall = useCallback(async (payload: object) => {
    if (!strikerId || !bowlerId) return;
    setSaving(true);
    const r = await post("scoring/ball", {
      matchId, inningsNumber: inningsNum,
      batsmanId: strikerId, nonStrikerId, bowlerId,
      ...payload,
    });
    setSaving(false);
    if (!r.success) return;
    const { ball, commentary } = r.data;
    setLastCommentary(commentary);
    setThisOver(prev => [...prev, ball]);
    setAllBalls(prev => [...prev, ball]);
    refreshStats();
    const runs = ball.batRuns || 0;
    if (runs % 2 === 1) { setStrikerId(nonStrikerId); setNonStrikerId(strikerId); }
    const legalInOver = [...thisOver, ball].filter(b => b.isLegalDelivery).length;
    if (legalInOver >= 6) {
      setStrikerId(nonStrikerId); setNonStrikerId(strikerId);
      setThisOver([]); setShowNewBowler(true);
    }
  }, [strikerId, nonStrikerId, bowlerId, matchId, inningsNum, thisOver]);

  const refreshStats = () => {
    post("scoring/live", { matchId, inningsNumber: inningsNum }).then(r => {
      if (r.success && r.data) {
        setBatters(r.data.batters);
        setBowlers(r.data.bowlers);
        setInnings(r.data.innings);
      }
    });
  };

  const handleUndo = async () => {
    setSaving(true);
    await post("scoring/undo", { matchId, inningsNumber: inningsNum });
    setSaving(false);
    setThisOver(prev => prev.slice(0, -1));
    refreshStats();
    setLastCommentary("↩ Last ball undone");
  };

  // ── Wicket flow ───────────────────────────────────────────────────────────

  const handleWicket = async () => {
    const { type, outBatsmanId, fielderId, newBatsmanId, newBowlerId: nb } = wicket;
    setSaving(true);
    const ballResult = await post("scoring/ball", {
      matchId, inningsNumber: inningsNum,
      batsmanId: strikerId, nonStrikerId, bowlerId,
      batRuns: 0, isWicket: true, wicketType: type,
      outBatsmanId: outBatsmanId || strikerId,
      fielderId: fielderId || undefined,
    });
    if (newBatsmanId) {
      await post("scoring/add-batsman", {
        matchId, inningsNumber: inningsNum,
        playerId: newBatsmanId, teamId: battingTeamId,
        battingOrder: batters.length + 1,
      });
      setStrikerId(newBatsmanId);
    }
    if (nb) {
      const bowlingTeamId = match?.teamAId === battingTeamId ? match?.teamBId : match?.teamAId;
      await post("scoring/set-bowler", { matchId, inningsNumber: inningsNum, playerId: nb, teamId: bowlingTeamId || "" });
      setBowlerId(nb);
    }
    setSaving(false);
    setShowWicket(false);
    setWicket({ type: "bowled", outBatsmanId: "", fielderId: "", newBatsmanId: "", newBowlerId: "" });
    if (ballResult.success) {
      const ball = ballResult.data?.ball;
      if (ball) { setThisOver(prev => [...prev, ball]); setAllBalls(prev => [...prev, ball]); }
      setLastCommentary(ballResult.data?.commentary || "Wicket!");
    }
    refreshStats();
  };

  // ── New bowler ────────────────────────────────────────────────────────────

  const handleNewBowler = async () => {
    if (!newBowlerId) return;
    const bowlingTeamId = match?.teamAId === battingTeamId ? match?.teamBId : match?.teamAId;
    await post("scoring/set-bowler", { matchId, inningsNumber: inningsNum, playerId: newBowlerId, teamId: bowlingTeamId || "" });
    setBowlerId(newBowlerId);
    setNewBowlerId("");
    setShowNewBowler(false);
  };

  // ── Player helpers ────────────────────────────────────────────────────────

  const battingPlayers = battingTeamId
    ? (battingTeamId === (match?.teamA?.id || match?.teamAId) ? teamAPlayers : teamBPlayers)
    : setup.battingTeamId
    ? (setup.battingTeamId === (match?.teamA?.id || match?.teamAId) ? teamAPlayers : teamBPlayers)
    : [];

  const bowlingPlayers = battingTeamId
    ? (battingTeamId === (match?.teamA?.id || match?.teamAId) ? teamBPlayers : teamAPlayers)
    : setup.battingTeamId
    ? (setup.battingTeamId === (match?.teamA?.id || match?.teamAId) ? teamBPlayers : teamAPlayers)
    : [];

  const setupBattingPlayers = setup.battingTeamId
    ? (setup.battingTeamId === (match?.teamA?.id || match?.teamAId) ? teamAPlayers : teamBPlayers)
    : [];
  const setupBowlingPlayers = setup.battingTeamId
    ? (setup.battingTeamId === (match?.teamA?.id || match?.teamAId) ? teamBPlayers : teamAPlayers)
    : [];

  const pName = (id: string) => {
    const all = [...teamAPlayers, ...teamBPlayers];
    return all.find(p => p._id === id)?.name || `#${id.slice(-4)}`;
  };

  const activeBatters   = batters.filter(b => !b.isOut);
  const batter1         = batters.find(b => b.playerId === strikerId);
  const batter2         = batters.find(b => b.playerId === nonStrikerId);
  const currentBowler   = bowlers.find(b => b.playerId === bowlerId);

  if (!match) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <RefreshCw className="w-5 h-5 text-muted animate-spin" />
    </div>
  );

  const tA = match.teamA?.name || "Team A";
  const tB = match.teamB?.name || "Team B";

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Header */}
      <header className="bg-panel border-b border-bdr sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted hover:text-white shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-white text-sm truncate">{tA} vs {tB}</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-semibold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Scoring
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        {/* ── Live score ── */}
        {innings && (
          <div className="bg-panel border border-bdr rounded-2xl px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-muted mb-0.5">Innings {inningsNum}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-white leading-none">{innings.runs}</span>
                  <span className="text-2xl text-muted leading-none">/{innings.wickets}</span>
                  <span className="text-sm text-muted ml-1">({innings.oversBowled} ov)</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted">CRR</p>
                <p className="text-xl font-bold text-primary">
                  {innings.oversBowled ? (innings.runs / innings.oversBowled).toFixed(2) : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Batsmen ── */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { b: batter1, id: strikerId,    strike: true  },
            { b: batter2, id: nonStrikerId, strike: false },
          ].map(({ b, id, strike }) => (
            <div key={id} className={`bg-panel border rounded-xl p-3 ${strike ? "border-yellow-500/40" : "border-bdr"}`}>
              <p className="text-[10px] text-muted flex items-center gap-1">
                {strike && <span className="text-yellow-400">★</span>}
                {strike ? "On strike" : "Non-striker"}
              </p>
              <p className="font-bold text-white text-sm mt-0.5 truncate">{id ? pName(id) : "—"}</p>
              {b && (
                <p className="text-[11px] text-muted mt-1">
                  <span className="text-white font-bold text-sm">{b.runs}</span>
                  <span className="text-muted">({b.ballsFaced})</span>
                  <span className="ml-2">4s:<span className="text-white">{b.fours}</span></span>
                  <span className="ml-1">6s:<span className="text-white">{b.sixes}</span></span>
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Bowler ── */}
        {currentBowler && (
          <div className="bg-panel border border-bdr rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted">Bowling</p>
              <p className="font-bold text-white text-sm">{pName(bowlerId)}</p>
            </div>
            <p className="text-xs font-mono text-muted">
              {Math.floor(currentBowler.balls / 6)}.{currentBowler.balls % 6} – {currentBowler.runs} – {currentBowler.wickets}W
            </p>
          </div>
        )}

        {/* ── This over ── */}
        <div className="bg-panel border border-bdr rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-2">This over</p>
          <div className="flex gap-1.5 flex-wrap">
            {thisOver.map((b, i) => {
              const d = ballDot(b);
              return (
                <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${d.cls}`}>
                  {d.label}
                </div>
              );
            })}
            {thisOver.length === 0 && <span className="text-muted text-xs">—</span>}
          </div>
        </div>

        {/* ── Commentary ── */}
        {lastCommentary && (
          <div className="bg-panel2 border border-bdr rounded-xl px-4 py-2.5 text-sm text-white">
            {lastCommentary}
          </div>
        )}

        {/* ── Ball entry pad ── */}
        <div className="bg-panel border border-bdr rounded-2xl p-4 space-y-3">
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Ball entry</p>

          <div className="grid grid-cols-3 gap-2">
            {[0,1,2,3].map(r => (
              <button key={r} disabled={saving || !strikerId} onClick={() => sendBall({ batRuns: r })}
                className="py-5 rounded-xl font-black text-2xl bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#263043] disabled:opacity-40 transition active:scale-95">
                {r}
              </button>
            ))}
            <button disabled={saving || !strikerId} onClick={() => sendBall({ batRuns: 4 })}
              className="py-5 rounded-xl font-black text-2xl bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40 transition active:scale-95">
              4
            </button>
            <button disabled={saving || !strikerId} onClick={() => sendBall({ batRuns: 6 })}
              className="py-5 rounded-xl font-black text-2xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40 transition active:scale-95">
              6
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(["wide","no_ball","bye","leg_bye"] as const).map(et => (
              <button key={et} disabled={saving || !strikerId} onClick={() => { setShowExtra({ type: et }); setExtraRuns(1); }}
                className="py-3 rounded-xl text-[11px] font-bold bg-[#1e293b] text-[#94a3b8] hover:text-white disabled:opacity-40 transition">
                {et === "no_ball" ? "No Ball" : et === "leg_bye" ? "Leg Bye" : et.charAt(0).toUpperCase() + et.slice(1)}
              </button>
            ))}
          </div>

          <button disabled={saving || !strikerId} onClick={() => setShowWicket(true)}
            className="w-full py-4 rounded-xl font-black text-base bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition active:scale-95">
            ⚡ WICKET
          </button>

          <button disabled={saving || allBalls.length === 0} onClick={handleUndo}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-[#1e293b] text-muted hover:text-white disabled:opacity-40 transition">
            <RotateCcw className="w-3.5 h-3.5" /> Undo last ball
          </button>
        </div>

        {/* ── Innings controls ── */}
        <div className="flex gap-2">
          {!innings && (
            <button onClick={() => setShowSetup(true)}
              className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90">
              Start innings {inningsNum}
            </button>
          )}
          {innings && inningsNum === 1 && (
            <button onClick={() => {
              setInningsNum(2); setInnings(null); setBatters([]); setBowlers([]);
              setThisOver([]); setAllBalls([]); setBattingTeamId("");
              setSetup({ battingTeamId: "", striker1Id: "", striker2Id: "", openingBowlerId: "" });
              setShowSetup(true);
            }} className="flex-1 py-2.5 text-sm font-semibold bg-panel2 border border-bdr text-muted hover:text-white rounded-xl transition">
              Start 2nd innings
            </button>
          )}
        </div>
      </div>

      {/* ── Setup modal ── */}
      {showSetup && (
        <Modal title={`Setup Innings ${inningsNum}`} onClose={() => setShowSetup(false)}>
          <div className="space-y-3">
            <Field label="Batting team">
              <select value={setup.battingTeamId}
                onChange={e => setSetup(p => ({ ...p, battingTeamId: e.target.value, striker1Id: "", striker2Id: "", openingBowlerId: "" }))}
                className={sel}>
                <option value="">Select…</option>
                <option value={match?.teamA?.id || match?.teamAId}>{tA}</option>
                <option value={match?.teamB?.id || match?.teamBId}>{tB}</option>
              </select>
            </Field>
            {setup.battingTeamId && (<>
              <Field label="Opener 1 (on strike)">
                <select value={setup.striker1Id} onChange={e => setSetup(p => ({ ...p, striker1Id: e.target.value }))} className={sel}>
                  <option value="">Select…</option>
                  {setupBattingPlayers.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Opener 2 (non-striker)">
                <select value={setup.striker2Id} onChange={e => setSetup(p => ({ ...p, striker2Id: e.target.value }))} className={sel}>
                  <option value="">Select…</option>
                  {setupBattingPlayers.filter(p => p._id !== setup.striker1Id).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Opening bowler">
                <select value={setup.openingBowlerId} onChange={e => setSetup(p => ({ ...p, openingBowlerId: e.target.value }))} className={sel}>
                  <option value="">Select…</option>
                  {setupBowlingPlayers.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </Field>
              {setupBattingPlayers.length === 0 && (
                <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> No players registered for this team yet.
                </p>
              )}
            </>)}
            <button onClick={handleStartInnings} disabled={saving || !setup.battingTeamId || !setup.striker1Id || !setup.striker2Id || !setup.openingBowlerId}
              className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Starting…" : "Start innings"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Wicket modal ── */}
      {showWicket && (
        <Modal title="Record Wicket" onClose={() => setShowWicket(false)}>
          <div className="space-y-3">
            <Field label="Dismissal type">
              <select value={wicket.type} onChange={e => setWicket(p => ({ ...p, type: e.target.value }))} className={sel}>
                {["bowled","caught","lbw","run_out","stumped","hit_wicket","handled_ball","obstructing_field","timed_out","retired_hurt"].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </Field>
            <Field label="Batsman out">
              <select value={wicket.outBatsmanId} onChange={e => setWicket(p => ({ ...p, outBatsmanId: e.target.value }))} className={sel}>
                <option value="">Striker ({pName(strikerId)})</option>
                {activeBatters.map(b => <option key={b.playerId} value={b.playerId}>{pName(b.playerId)}</option>)}
              </select>
            </Field>
            {(wicket.type === "caught" || wicket.type === "stumped" || wicket.type === "run_out") && (
              <Field label={wicket.type === "caught" ? "Catcher" : wicket.type === "stumped" ? "Wicketkeeper" : "Fielder"}>
                <select value={wicket.fielderId} onChange={e => setWicket(p => ({ ...p, fielderId: e.target.value }))} className={sel}>
                  <option value="">Select…</option>
                  {bowlingPlayers.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="New batsman">
              <select value={wicket.newBatsmanId} onChange={e => setWicket(p => ({ ...p, newBatsmanId: e.target.value }))} className={sel}>
                <option value="">Select…</option>
                {battingPlayers.filter(p => !batters.find(b => b.playerId === p._id)).map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <button onClick={handleWicket} disabled={saving}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              {saving ? "Saving…" : "Confirm wicket"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Extra runs modal ── */}
      {showExtra && (
        <Modal title={`${showExtra.type.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())} — runs?`} onClose={() => setShowExtra(null)}>
          <div className="space-y-4">
            <div className="flex gap-2 justify-center">
              {[0,1,2,3,4,5].map(r => (
                <button key={r} onClick={() => setExtraRuns(r)}
                  className={`w-11 h-11 rounded-xl font-bold text-lg transition ${extraRuns === r ? "bg-primary text-white" : "bg-[#1e293b] text-muted hover:text-white"}`}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => {
              sendBall({ batRuns: 0, isExtra: true, extraType: showExtra.type, extraRuns });
              setShowExtra(null);
            }} className="w-full py-2.5 bg-primary text-white font-semibold rounded-xl text-sm">
              Confirm
            </button>
          </div>
        </Modal>
      )}

      {/* ── New bowler modal ── */}
      {showNewBowler && (
        <Modal title="Over complete — next bowler" onClose={() => {}}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-400">Same bowler cannot bowl consecutive overs.</p>
            </div>
            <Field label="New bowler">
              <select value={newBowlerId} onChange={e => setNewBowlerId(e.target.value)} className={sel}>
                <option value="">Select…</option>
                {bowlingPlayers.filter(p => p._id !== bowlerId).map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <button onClick={handleNewBowler} disabled={!newBowlerId}
              className="w-full py-2.5 bg-primary text-white font-semibold rounded-xl text-sm disabled:opacity-40">
              Continue
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4 pb-4 sm:pb-0">
      <div className="bg-panel border border-bdr rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          {onClose && <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">×</button>}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted font-medium">{label}</label>
      {children}
    </div>
  );
}

const sel = "w-full bg-panel2 border border-bdr rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary";
