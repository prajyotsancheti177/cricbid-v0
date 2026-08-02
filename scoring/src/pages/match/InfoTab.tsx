import { MapPin, Calendar, Trophy, Coins, Hash, Timer } from "lucide-react";
import { useMatch } from "./MatchCenter";

/** Match info tab: venue, round, format, toss, schedule, result. */
export default function InfoTab() {
  const { match } = useMatch();

  const teamName = (id?: string | null) => {
    if (!id) return null;
    if (id === match.teamA?.id) return match.teamA?.name;
    if (id === match.teamB?.id) return match.teamB?.name;
    return null;
  };

  const tossText = match.tossWonById
    ? `${teamName(match.tossWonById) || "—"} won the toss and chose to ${match.tossDecision === "bat" ? "bat" : "field"}`
    : null;

  const rows: { icon: any; label: string; value: string | null }[] = [
    { icon: Hash,     label: "Match",    value: match.matchNumber != null ? `Match ${match.matchNumber}${match.round ? ` · ${match.round}` : ""}` : match.round },
    { icon: Timer,    label: "Format",   value: `${match.format} · ${match.totalOvers} overs per side` },
    { icon: Calendar, label: "Schedule", value: match.scheduledAt ? new Date(match.scheduledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }) : null },
    { icon: MapPin,   label: "Venue",    value: match.venue || null },
    { icon: Coins,    label: "Toss",     value: tossText },
    { icon: Trophy,   label: "Result",   value: match.resultNote || null },
  ];

  return (
    <div className="card divide-y divide-bdr/60">
      {rows.filter(r => r.value).map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-start gap-3 px-4 py-3.5">
          <Icon className="w-4 h-4 text-muted mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted uppercase tracking-wide font-semibold">{label}</p>
            <p className="text-sm text-white mt-0.5">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
