import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Pencil } from "lucide-react";
import LiveBadge from "../ui/LiveBadge";
import { inningsFor, scoreLine, statusLine } from "../../lib/cricket";
import type { MatchLite } from "../../lib/cricket";

interface MatchFull extends MatchLite {
  matchNumber?: number;
  round?: string;
  venue?: string;
  scheduledAt?: string;
  format: string;
  winnerId?: string | null;
}

/**
 * Cricbuzz-style match card: two team rows with mini scores, status strip.
 */
export default function MatchCard({ match }: { match: MatchFull }) {
  const navigate = useNavigate();
  const isAuth = localStorage.getItem("scoring_auth") === "true";
  const isLive = match.status === "live";
  const isDone = match.status === "completed";
  const canScore = isAuth && (match.status === "upcoming" || isLive);

  const innA = inningsFor(match, match.teamA.id);
  const innB = inningsFor(match, match.teamB.id);

  const open = () => navigate(isDone || isLive ? `/match/${match.id}/live` : `/match/${match.id}/info`);

  const TeamRow = ({ team, inn }: { team: { id: string; name: string }; inn?: ReturnType<typeof inningsFor> }) => {
    const won = isDone && match.winnerId === team.id;
    return (
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm truncate ${won ? "font-bold text-white" : isDone ? "text-muted" : "font-semibold text-white"}`}>
          {team.name}
        </span>
        {inn
          ? <span className={`text-sm font-mono shrink-0 ${won ? "font-bold text-white" : "text-[#cbd5e1]"}`}>{scoreLine(inn)}</span>
          : (isLive || isDone) && <span className="text-xs text-muted shrink-0">Yet to bat</span>}
      </div>
    );
  };

  return (
    <div onClick={open}
      className={`card p-4 cursor-pointer transition hover:border-primary/40 ${isLive ? "border-live/30" : ""}`}>
      {/* Meta strip */}
      <div className="flex items-center gap-2 text-[11px] text-muted mb-2.5">
        {match.matchNumber != null && <span className="font-semibold">M{match.matchNumber}</span>}
        {match.round && <span>· {match.round}</span>}
        {match.venue && <span className="flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3 shrink-0" />{match.venue}</span>}
        <span className="ml-auto shrink-0">{match.format} · {match.totalOvers} ov</span>
      </div>

      {/* Teams + scores */}
      <div className="space-y-1.5">
        <TeamRow team={match.teamA} inn={innA} />
        <TeamRow team={match.teamB} inn={innB} />
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-bdr/60">
        {isLive
          ? <span className="flex items-center gap-2 min-w-0"><LiveBadge />{statusLine(match) !== "Live" && <span className="text-xs text-live truncate">{statusLine(match)}</span>}</span>
          : isDone
            ? <span className="text-xs font-semibold text-orange-400 truncate">{match.resultNote || "Completed"}</span>
            : <span className="flex items-center gap-1 text-xs text-muted">
                <Calendar className="w-3 h-3" />
                {match.scheduledAt
                  ? new Date(match.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                  : "Not scheduled"}
              </span>}

        {canScore && (
          <button onClick={e => { e.stopPropagation(); navigate(`/score/${match.id}`); }}
            className="flex items-center gap-1 text-[11px] bg-primary text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-primary/90 transition shrink-0">
            <Pencil className="w-3 h-3" /> Score
          </button>
        )}
      </div>
    </div>
  );
}
