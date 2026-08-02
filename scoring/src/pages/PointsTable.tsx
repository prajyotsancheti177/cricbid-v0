import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { post } from "../lib/api";

interface Standing {
  teamId: string; teamName: string; logo?: string;
  played: number; won: number; lost: number; tied: number;
  points: number; nrr: number;
}

/** Cricbuzz-style points table with NRR. */
export default function PointsTable() {
  const { tid } = useParams<{ tid: string }>();
  const [table, setTable] = useState<Standing[] | null>(null);

  useEffect(() => {
    if (!tid) return;
    setTable(null);
    post("match/points-table", { tournamentId: tid }).then(r => {
      setTable(r.success ? (r.data || []) : []);
    });
  }, [tid]);

  if (table === null) {
    return (
      <div className="card p-4 animate-pulse space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-6 bg-panel2 rounded" />)}
      </div>
    );
  }

  if (table.length === 0) {
    return <p className="text-muted text-sm text-center py-16">Points table will appear once matches are completed.</p>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-bdr bg-panel2">
              <th className="text-left pl-4 pr-2 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-2 py-2.5 font-medium">Team</th>
              <th className="px-2 py-2.5 text-right font-medium">M</th>
              <th className="px-2 py-2.5 text-right font-medium">W</th>
              <th className="px-2 py-2.5 text-right font-medium">L</th>
              <th className="px-2 py-2.5 text-right font-medium">Pts</th>
              <th className="pl-2 pr-4 py-2.5 text-right font-medium">NRR</th>
            </tr>
          </thead>
          <tbody>
            {table.map((t, i) => (
              <tr key={t.teamId} className={`border-t border-bdr/50 ${i < 4 ? "bg-primary/5" : ""}`}>
                <td className="pl-4 pr-2 py-3 text-muted font-mono">{i + 1}</td>
                <td className="px-2 py-3">
                  <span className="flex items-center gap-2 min-w-0">
                    {t.logo && <img src={t.logo} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />}
                    <span className="font-semibold text-white truncate">{t.teamName}</span>
                  </span>
                </td>
                <td className="px-2 py-3 text-right text-muted">{t.played}</td>
                <td className="px-2 py-3 text-right text-live font-semibold">{t.won}</td>
                <td className="px-2 py-3 text-right text-red-400">{t.lost}</td>
                <td className="px-2 py-3 text-right font-bold text-white">{t.points}</td>
                <td className={`pl-2 pr-4 py-3 text-right font-mono ${t.nrr >= 0 ? "text-live" : "text-red-400"}`}>
                  {t.nrr >= 0 ? "+" : ""}{Number(t.nrr).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 border-t border-bdr text-[10px] text-muted">
        Top rows tinted = playoff positions · 2 pts per win, 1 pt per tie/no-result · NRR = net run rate
      </p>
    </div>
  );
}
