// Pure cricket math/display helpers shared across pages.

export interface InningsLite {
  inningsNumber: number;
  battingTeamId: string;
  runs: number;
  wickets: number;
  oversBowled: number; // float form e.g. 18.4 = 18 overs 4 balls
  isCompleted: boolean;
}

export interface MatchLite {
  id: string;
  status: string;
  totalOvers: number;
  resultNote?: string | null;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  innings?: InningsLite[];
}

/** 18.4 (overs float) → legal balls bowled */
export const oversToBalls = (overs: number): number => {
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  return whole * 6 + balls;
};

/** legal balls → "18.4" display */
export const oversDisplay = (balls: number): string =>
  `${Math.floor(balls / 6)}.${balls % 6}`;

/** current run rate from runs + overs float */
export const crr = (runs: number, oversFloat: number): string => {
  const balls = oversToBalls(oversFloat);
  if (balls === 0) return "0.00";
  return ((runs / balls) * 6).toFixed(2);
};

/** required run rate in a chase */
export const rrr = (target: number, runs: number, oversFloat: number, totalOvers: number): string | null => {
  const ballsBowled = oversToBalls(oversFloat);
  const ballsLeft = totalOvers * 6 - ballsBowled;
  if (ballsLeft <= 0) return null;
  const needed = target - runs;
  if (needed <= 0) return null;
  return ((needed / ballsLeft) * 6).toFixed(2);
};

/** "156/7 (18.4)" from an innings row */
export const scoreLine = (inn: InningsLite): string =>
  `${inn.runs}/${inn.wickets} (${inn.oversBowled})`;

/** innings for a given team id, if it batted */
export const inningsFor = (match: MatchLite, teamId: string): InningsLite | undefined =>
  match.innings?.find(i => i.battingTeamId === teamId);

/** short human status line for a match card */
export const statusLine = (match: MatchLite): string => {
  if (match.status === "completed") return match.resultNote || "Completed";
  if (match.status === "live") {
    const inns = match.innings || [];
    const current = inns.find(i => !i.isCompleted) || inns[inns.length - 1];
    if (!current) return "Live — innings starting";
    if (current.inningsNumber === 2) {
      const first = inns.find(i => i.inningsNumber === 1);
      if (first) {
        const target = first.runs + 1;
        const need = target - current.runs;
        const ballsLeft = match.totalOvers * 6 - oversToBalls(current.oversBowled);
        if (need > 0 && ballsLeft > 0) {
          const battingName = current.battingTeamId === match.teamA.id ? match.teamA.name : match.teamB.name;
          return `${battingName} need ${need} in ${ballsLeft} balls`;
        }
      }
    }
    return "Live";
  }
  if (match.status === "cancelled") return "Cancelled";
  if (match.status === "no_result") return "No result";
  return "Upcoming";
};
