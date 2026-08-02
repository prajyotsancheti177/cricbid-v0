import { useEffect, useState } from "react";
import { post } from "../../lib/api";
import { useMatch } from "./MatchCenter";
import { crr, rrr, oversToBalls } from "../../lib/cricket";
import BallChip from "../../components/match/BallChip";

/**
 * Cricbuzz "Live" tab: score banner with CRR/RRR, current batsmen, current
 * bowler, this over, recent overs, fall of wickets.
 */
export default function LiveTab() {
  const { match, names, refreshKey } = useMatch();
  const [live, setLive] = useState<any>(null);
  const n = (id?: string) => (id ? names[id] || "—" : "—");

  const currentInnings =
    match.innings?.find((i: any) => !i.isCompleted) ||
    match.innings?.[match.innings.length - 1];

  useEffect(() => {
    if (!currentInnings) return;
    post("scoring/live", { matchId: match.id, inningsNumber: currentInnings.inningsNumber }).then(r => {
      if (r.success && r.data) setLive(r.data);
    });
  }, [match.id, currentInnings?.inningsNumber, refreshKey]);

  if (!currentInnings) {
    return <p className="text-muted text-sm text-center py-16">Match hasn't started yet. Check the Info tab for details.</p>;
  }
  if (!live) {
    return <p className="text-muted text-sm text-center py-16">Loading live state…</p>;
  }

  const { innings, batters = [], bowlers = [], balls = [], fow = [], thisOverBalls = [] } = live;
  const isChase = innings.inningsNumber === 2;
  const inn1 = match.innings?.find((i: any) => i.inningsNumber === 1);
  const target = isChase && inn1 ? inn1.runs + 1 : null;
  const reqRate = target ? rrr(target, innings.runs, innings.oversBowled, match.totalOvers) : null;

  const lastBall = [...balls].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).at(-1);
  const strikerId = lastBall?.batsmanId;
  const activeBatters = batters.filter((b: any) => !b.isOut);
  const b1 = activeBatters.find((b: any) => b.playerId === strikerId) || activeBatters[0];
  const b2 = activeBatters.find((b: any) => b.playerId !== (b1?.playerId)) || activeBatters[1];
  const currentBowler = bowlers.find((b: any) => b.playerId === lastBall?.bowlerId) || bowlers.at(-1);

  // Recent overs: group balls by overNumber, show the last 4
  const byOver: Record<number, any[]> = {};
  balls.forEach((b: any) => { (byOver[b.overNumber] ??= []).push(b); });
  const overNums = Object.keys(byOver).map(Number).sort((a, b) => b - a).slice(0, 4);

  return (
    <div className="space-y-3">
      {/* Score banner */}
      <div className="card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] text-muted">{match.innings && innings.battingTeamId === match.teamA?.id ? match.teamA?.name : match.teamB?.name} — Innings {innings.inningsNumber}</p>
            <p className="text-4xl font-black text-white leading-tight">
              {innings.runs}<span className="text-2xl text-muted">/{innings.wickets}</span>
              <span className="text-base text-muted font-normal ml-2">({innings.oversBowled} ov)</span>
            </p>
          </div>
          <div className="text-right text-xs space-y-1">
            <p className="text-muted">CRR <span className="text-white font-bold">{crr(innings.runs, innings.oversBowled)}</span></p>
            {reqRate && <p className="text-muted">RRR <span className="text-orange-400 font-bold">{reqRate}</span></p>}
          </div>
        </div>
        {target && (
          <p className="text-xs text-primary mt-2 pt-2 border-t border-bdr">
            Target {target} — need {Math.max(0, target - innings.runs)} runs in {match.totalOvers * 6 - oversToBalls(innings.oversBowled)} balls
          </p>
        )}
      </div>

      {/* Batsmen */}
      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-bdr bg-panel2">
              <th className="text-left px-4 py-2 font-medium">Batter</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">B</th>
              <th className="px-2 py-2 text-right font-medium">4s</th>
              <th className="px-2 py-2 text-right font-medium">6s</th>
              <th className="px-3 py-2 text-right font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {[b1, b2].filter(Boolean).map((b: any) => (
              <tr key={b.id} className="border-t border-bdr/50">
                <td className="px-4 py-2.5 font-semibold text-white">
                  {n(b.playerId)}{b.playerId === strikerId && <span className="text-yellow-400 ml-1">*</span>}
                </td>
                <td className="px-2 py-2.5 text-right font-bold text-white">{b.runs}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.ballsFaced}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.fours}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.sixes}</td>
                <td className="px-3 py-2.5 text-right text-muted">{b.ballsFaced ? ((b.runs / b.ballsFaced) * 100).toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {currentBowler && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-bdr text-xs bg-panel2/50">
            <span className="text-muted">Bowling <span className="text-white font-semibold">{n(currentBowler.playerId)}</span></span>
            <span className="font-mono text-muted">
              {Math.floor(currentBowler.balls / 6)}.{currentBowler.balls % 6}–{currentBowler.runs}–<span className="text-white font-bold">{currentBowler.wickets}W</span>
            </span>
          </div>
        )}
      </div>

      {/* This over */}
      <div className="card p-4">
        <p className="section-label mb-2.5">This over</p>
        <div className="flex gap-1.5 items-center flex-wrap">
          {thisOverBalls.map((ball: any, i: number) => <BallChip key={i} ball={ball} />)}
          {thisOverBalls.length === 0 && <span className="text-muted text-xs">New over about to start</span>}
        </div>
      </div>

      {/* Recent overs */}
      {overNums.length > 0 && (
        <div className="card p-4">
          <p className="section-label mb-2.5">Recent overs</p>
          <div className="space-y-2.5">
            {overNums.map(ov => {
              const ovBalls = byOver[ov].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              const runs = ovBalls.reduce((s: number, b: any) => s + b.totalRuns, 0);
              return (
                <div key={ov} className="flex items-center gap-3">
                  <span className="text-[11px] text-muted w-10 shrink-0">Ov {ov + 1}</span>
                  <div className="flex gap-1 flex-wrap flex-1">
                    {ovBalls.map((b: any, i: number) => <BallChip key={i} ball={b} size="sm" />)}
                  </div>
                  <span className="text-[11px] text-muted shrink-0">{runs} run{runs !== 1 ? "s" : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fall of wickets */}
      {fow.length > 0 && (
        <div className="card p-4">
          <p className="section-label mb-2">Fall of wickets</p>
          <p className="text-[11px] text-muted leading-relaxed">
            {fow.map((f: any) => `${f.wicketNumber}-${f.runs} (${n(f.playerId)}, ${f.overNumber}.${f.ballInOver})`).join("  ·  ")}
          </p>
        </div>
      )}
    </div>
  );
}
