import { useMatch } from "./MatchCenter";

/**
 * Full scorecard tab — batting/bowling tables, extras, fall of wickets per
 * innings. Restyled port of the old Scorecard page tables.
 */
export default function ScorecardTab() {
  const { match, names, battingTeamName } = useMatch();

  if (!match.innings || match.innings.length === 0) {
    return <p className="text-muted text-sm text-center py-16">Scorecard will appear once the match starts.</p>;
  }

  return (
    <div className="space-y-4">
      {match.innings.map((inn: any) => (
        <InningsCard key={inn.id} innings={inn} names={names} battingTeam={battingTeamName(inn)} />
      ))}
    </div>
  );
}

function InningsCard({ innings, names, battingTeam }: { innings: any; names: Record<string, string>; battingTeam: string }) {
  const batters = innings.batsmanInnings || [];
  const bowlers = innings.bowlerInnings || [];
  const fow = innings.fallOfWickets || [];
  const n = (id?: string) => (id ? names[id] || "—" : "—");
  const eco = (b: any) => (b.balls ? ((b.runs / b.balls) * 6).toFixed(2) : "—");
  const sr = (b: any) => (b.ballsFaced ? ((b.runs / b.ballsFaced) * 100).toFixed(1) : "—");
  const didNotBat = batters.filter((b: any) => b.didNotBat);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 bg-panel2 border-b border-bdr flex items-center justify-between">
        <span className="text-sm font-bold text-white">{battingTeam}</span>
        <span className="text-sm font-mono text-white">{innings.runs}/{innings.wickets} <span className="text-muted text-xs">({innings.oversBowled} ov)</span></span>
      </div>

      {/* Batting */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-bdr">
              <th className="text-left px-4 py-2 font-medium">Batter</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">B</th>
              <th className="px-2 py-2 text-right font-medium">4s</th>
              <th className="px-2 py-2 text-right font-medium">6s</th>
              <th className="px-3 py-2 text-right font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {batters.filter((b: any) => !b.didNotBat).map((b: any) => (
              <tr key={b.id} className="border-t border-bdr/50">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-white">{n(b.playerId)}</p>
                  {b.isOut
                    ? <p className="text-muted text-[10px] leading-tight">{b.howOut || "out"}</p>
                    : <p className="text-live text-[10px]">not out</p>}
                </td>
                <td className="px-2 py-2.5 text-right font-bold text-white">{b.runs}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.ballsFaced}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.fours}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.sixes}</td>
                <td className="px-3 py-2.5 text-right text-muted">{sr(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-bdr text-[11px] text-muted flex flex-wrap gap-x-4 gap-y-1">
        <span>Extras <span className="text-white font-semibold">{innings.extras ?? 0}</span></span>
        <span>Total <span className="text-white font-semibold">{innings.runs}/{innings.wickets}</span> ({innings.oversBowled} ov)</span>
      </div>

      {didNotBat.length > 0 && (
        <div className="px-4 py-2.5 border-t border-bdr text-[11px] text-muted">
          Did not bat: <span className="text-[#cbd5e1]">{didNotBat.map((b: any) => n(b.playerId)).join(", ")}</span>
        </div>
      )}

      {fow.length > 0 && (
        <div className="px-4 py-2.5 border-t border-bdr">
          <p className="section-label mb-1.5">Fall of wickets</p>
          <p className="text-[11px] text-muted leading-relaxed">
            {fow.map((f: any) => `${f.wicketNumber}-${f.runs} (${n(f.playerId)}, ${f.overNumber}.${f.ballInOver})`).join("  ·  ")}
          </p>
        </div>
      )}

      {/* Bowling */}
      <div className="px-4 py-2.5 bg-panel2 border-t border-bdr text-xs font-bold text-white">Bowling</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-bdr">
              <th className="text-left px-4 py-2 font-medium">Bowler</th>
              <th className="px-2 py-2 text-right font-medium">O</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">W</th>
              <th className="px-3 py-2 text-right font-medium">Eco</th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map((b: any) => (
              <tr key={b.id} className="border-t border-bdr/50">
                <td className="px-4 py-2.5 font-semibold text-white">{n(b.playerId)}</td>
                <td className="px-2 py-2.5 text-right text-muted">{Math.floor(b.balls / 6)}.{b.balls % 6}</td>
                <td className="px-2 py-2.5 text-right text-muted">{b.runs}</td>
                <td className="px-2 py-2.5 text-right font-bold text-white">{b.wickets}</td>
                <td className="px-3 py-2.5 text-right text-muted">{eco(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
