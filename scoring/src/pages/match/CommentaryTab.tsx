import { useEffect, useState, Fragment } from "react";
import { post } from "../../lib/api";
import { useMatch } from "./MatchCenter";
import BallChip from "../../components/match/BallChip";

/**
 * Cricbuzz-style ball-by-ball commentary feed — latest first, with
 * end-of-over and innings separators.
 */
export default function CommentaryTab() {
  const { match, refreshKey } = useMatch();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    post("scoring/commentary", { matchId: match.id }).then(r => {
      if (r.success) setData(r.data);
    });
  }, [match.id, refreshKey]);

  if (!data) return <p className="text-muted text-sm text-center py-16">Loading commentary…</p>;

  const { innings = [], balls = [], nameMap = {} } = data;
  const n = (id?: string) => (id ? nameMap[id] || "—" : "—");

  if (balls.length === 0) {
    return <p className="text-muted text-sm text-center py-16">No deliveries bowled yet.</p>;
  }

  const teamNameFor = (inningsNumber: number) => {
    const inn = innings.find((i: any) => i.inningsNumber === inningsNumber);
    return inn?.battingTeam?.name || `Innings ${inningsNumber}`;
  };

  // Compute running score + per-over totals per innings (balls are newest-first,
  // so build from a chronological copy).
  const chrono = [...balls].reverse();
  const runningScore: Record<string, { runs: number; wickets: number }> = {};
  const overTotals: Record<string, number> = {}; // `${innNum}:${overNumber}` -> runs
  const scoreAfterBall: Record<string, string> = {}; // ballId -> "112/3"
  chrono.forEach((b: any) => {
    const key = String(b.inningsNumber);
    runningScore[key] ??= { runs: 0, wickets: 0 };
    runningScore[key].runs += b.totalRuns;
    if (b.isWicket) runningScore[key].wickets += 1;
    scoreAfterBall[b.id] = `${runningScore[key].runs}/${runningScore[key].wickets}`;
    const ovKey = `${b.inningsNumber}:${b.overNumber}`;
    overTotals[ovKey] = (overTotals[ovKey] || 0) + b.totalRuns;
  });

  // A ball is "end of over" if it's the last legal delivery (ballInOver 6+) of its over
  // — detected in feed order: newest-first means the end-of-over row goes ABOVE the over's balls.
  const isLastBallOfOver = (b: any, idx: number) => {
    const prev = balls[idx - 1]; // the ball that came after b chronologically
    if (!prev) return false; // newest ball overall — over may be in progress
    return prev.inningsNumber !== b.inningsNumber || prev.overNumber !== b.overNumber;
  };

  let lastInnings: number | null = null;

  return (
    <div className="space-y-1">
      {balls.map((b: any, idx: number) => {
        const rows = [];

        // Innings separator
        if (b.inningsNumber !== lastInnings) {
          rows.push(
            <div key={`inn-${b.inningsNumber}`} className="flex items-center gap-3 py-3">
              <div className="h-px bg-bdr flex-1" />
              <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                {teamNameFor(b.inningsNumber)} innings
              </span>
              <div className="h-px bg-bdr flex-1" />
            </div>
          );
          lastInnings = b.inningsNumber;
        }

        // End-of-over separator (appears above the over's last ball in the feed)
        if (isLastBallOfOver(b, idx)) {
          const ovRuns = overTotals[`${b.inningsNumber}:${b.overNumber}`] || 0;
          rows.push(
            <div key={`ov-${b.inningsNumber}-${b.overNumber}`}
              className="bg-panel2 border border-bdr rounded-lg px-3 py-2 my-2 flex items-center justify-between text-[11px]">
              <span className="font-bold text-white">End of over {b.overNumber + 1}</span>
              <span className="text-muted">{ovRuns} run{ovRuns !== 1 ? "s" : ""} · {teamNameFor(b.inningsNumber)} {scoreAfterBall[b.id]}</span>
            </div>
          );
        }

        rows.push(
          <div key={b.id} className={`flex gap-3 px-1 py-2 ${b.isWicket ? "bg-red-500/5 rounded-lg" : ""}`}>
            <div className="flex flex-col items-center gap-1 shrink-0 w-10">
              <span className="text-[10px] text-muted font-mono">{b.overNumber}.{b.ballInOver}</span>
              <BallChip ball={b} size="sm" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <p className={`${b.isWicket ? "text-red-400 font-semibold" : "text-[#cbd5e1]"} leading-relaxed`}>
                <span className="text-muted">{n(b.bowlerId)} to {n(b.batsmanId)}: </span>
                {b.commentary || (b.isWicket ? "WICKET!" : `${b.totalRuns} run${b.totalRuns !== 1 ? "s" : ""}`)}
              </p>
            </div>
          </div>
        );

        return <Fragment key={`grp-${b.id}`}>{rows}</Fragment>;
      })}
    </div>
  );
}
