/** Shared visual encoding for a delivery — same scheme as the scorer panel. */
export default function BallChip({ ball, size = "md" }: { ball: any; size?: "sm" | "md" }) {
  let label: string, cls: string;
  if (ball.isWicket)                     { label = "W";  cls = "bg-red-500/20 text-red-400 border border-red-500/40"; }
  else if (ball.extraType === "wide")    { label = "Wd"; cls = "bg-violet-500/20 text-violet-400 border border-violet-500/30"; }
  else if (ball.extraType === "no_ball") { label = "Nb"; cls = "bg-orange-500/20 text-orange-400 border border-orange-500/30"; }
  else if (ball.batRuns === 4)           { label = "4";  cls = "bg-green-500/20 text-green-400 border border-green-500/40"; }
  else if (ball.batRuns === 6)           { label = "6";  cls = "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"; }
  else if ((ball.totalRuns ?? ball.batRuns) === 0) { label = "•"; cls = "bg-[#1e293b] text-[#4a5568]"; }
  else                                   { label = String(ball.totalRuns ?? ball.batRuns); cls = "bg-[#1e293b] text-[#94a3b8]"; }

  const sz = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0 ${cls}`}>
      {label}
    </div>
  );
}
