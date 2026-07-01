import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { post } from "../lib/api";

type CategoryKey = "mostRuns" | "mostWickets" | "bestStrikeRate" | "bestEconomy" | "mostSixes" | "mostFours";

interface StatRow {
  playerId: string; name: string; photo?: string | null;
  teamName: string; innings: number;
  runs?: number; balls?: number; fours?: number; sixes?: number; strikeRate?: number;
  wickets?: number; overs?: number; economy?: number;
}

const CATEGORIES: { key: CategoryKey; label: string; stat: (r: StatRow) => string | number; statLabel: string; sub: (r: StatRow) => string }[] = [
  { key: "mostRuns",       label: "Most Runs",   stat: r => r.runs ?? 0,        statLabel: "Runs", sub: r => `${r.innings} inns · SR ${r.strikeRate}` },
  { key: "mostWickets",    label: "Most Wickets",stat: r => r.wickets ?? 0,     statLabel: "Wkts", sub: r => `${r.innings} inns · Eco ${r.economy}` },
  { key: "bestStrikeRate", label: "Best SR",     stat: r => r.strikeRate ?? 0,  statLabel: "SR",   sub: r => `${r.runs} runs (${r.balls} balls)` },
  { key: "bestEconomy",    label: "Best Economy",stat: r => r.economy ?? 0,     statLabel: "Eco",  sub: r => `${r.wickets} wkts · ${r.overs} ov` },
  { key: "mostSixes",      label: "Most 6s",     stat: r => r.sixes ?? 0,       statLabel: "6s",   sub: r => `${r.runs} runs · ${r.innings} inns` },
  { key: "mostFours",      label: "Most 4s",     stat: r => r.fours ?? 0,       statLabel: "4s",   sub: r => `${r.runs} runs · ${r.innings} inns` },
];

function Avatar({ r, size }: { r: StatRow; size: string }) {
  const [imgOk, setImgOk] = useState(true);
  return r.photo && imgOk
    ? <img src={r.photo} alt="" onError={() => setImgOk(false)}
        className={`${size} rounded-full object-cover border-2 border-primary/40 shrink-0`} />
    : <div className={`${size} rounded-full bg-primary/20 flex items-center justify-center font-black text-primary shrink-0`}>{r.name[0]?.toUpperCase()}</div>;
}

/** CricHeroes-style leaderboards: #1 hero card, #2–3 mini cards, rest in a table. */
export default function Stats() {
  const { tid } = useParams<{ tid: string }>();
  const [data, setData] = useState<Record<CategoryKey, StatRow[]> | null>(null);
  const [cat, setCat] = useState<CategoryKey>("mostRuns");

  useEffect(() => {
    if (!tid) return;
    setData(null);
    post("scoring/stats", { tournamentId: tid }).then(r => {
      if (r.success) setData(r.data);
    });
  }, [tid]);

  const category = CATEGORIES.find(c => c.key === cat)!;
  const rows = data?.[cat] || [];
  const [first, second, third, ...rest] = rows;

  return (
    <div className="space-y-4">
      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 pb-1">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
              cat === c.key ? "bg-primary border-primary text-white" : "bg-panel border-bdr text-muted hover:text-white"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {data === null ? (
        <div className="card p-4 animate-pulse space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-panel2 rounded" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm text-center py-16">
          No stats yet — leaderboards fill up as matches are scored.
        </p>
      ) : (
        <>
          {/* #1 hero card */}
          {first && (
            <div className="card p-5 border-primary/40 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden">
              <span className="absolute -bottom-2 left-3 text-6xl font-black text-primary/10 select-none">#1</span>
              <div className="flex items-center gap-4 relative">
                <Avatar r={first} size="w-16 h-16 text-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-lg truncate">{first.name}</p>
                  <p className="text-xs text-muted truncate">{first.teamName}</p>
                  <p className="text-[11px] text-muted mt-0.5">{category.sub(first)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-black text-primary">{category.stat(first)}</p>
                  <p className="text-[10px] text-muted uppercase tracking-wide">{category.statLabel}</p>
                </div>
              </div>
            </div>
          )}

          {/* #2 and #3 */}
          {(second || third) && (
            <div className="grid grid-cols-2 gap-3">
              {[second, third].filter(Boolean).map((r, i) => (
                <div key={r!.playerId} className="card p-4 relative overflow-hidden">
                  <span className="absolute top-2 right-3 text-3xl font-black text-muted/10">#{i + 2}</span>
                  <Avatar r={r!} size="w-10 h-10 text-base" />
                  <p className="font-bold text-white text-sm truncate mt-2">{r!.name}</p>
                  <p className="text-[10px] text-muted truncate">{r!.teamName}</p>
                  <p className="text-xl font-black text-white mt-1">{category.stat(r!)} <span className="text-[10px] text-muted font-normal uppercase">{category.statLabel}</span></p>
                </div>
              ))}
            </div>
          )}

          {/* Rest of the table */}
          {rest.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted border-b border-bdr bg-panel2">
                    <th className="text-left pl-4 pr-2 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">Player</th>
                    <th className="pl-2 pr-4 py-2 text-right font-medium">{category.statLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((r, i) => (
                    <tr key={r.playerId} className="border-t border-bdr/50">
                      <td className="pl-4 pr-2 py-2.5 text-muted font-mono">{i + 4}</td>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold text-white truncate">{r.name}</p>
                        <p className="text-[10px] text-muted truncate">{r.teamName} · {category.sub(r)}</p>
                      </td>
                      <td className="pl-2 pr-4 py-2.5 text-right font-bold text-white">{category.stat(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
