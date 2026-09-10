import { cn } from "@/lib/utils";
import type { CricHeroesStat } from "@/hooks/useCricHeroesStats";

/**
 * CricHeroes career numbers, in the two places a bidder looks at a player.
 *
 * `strip` sits at the foot of a card in the players grid; `band` sits between
 * the name and the current bid on the auction screen. Both render nothing at
 * all when there is no confirmed CricHeroes match — an empty frame or a row of
 * dashes would be louder than the data, and on a 40-player grid most players
 * have no profile.
 *
 * Only the strike rate takes the orange accent. It is the number that moves a
 * bid, and on the auction screen nothing may compete with the bid itself.
 */

interface Props {
  stat?: CricHeroesStat;
  variant: "strip" | "band";
  className?: string;
}

const CricHeroesMark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M4 20 L14 10" />
    <path d="M12 4 L20 12" />
    <circle cx="17.5" cy="6.5" r="2.6" fill="currentColor" stroke="none" />
  </svg>
);

/** One decimal, and never a trailing ".0" that costs a character for nothing. */
const num = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/**
 * Whole numbers only.
 *
 * A grid card is ~124px wide, which gives a four-column strip about 28px per
 * value — not enough for "196.5", which clipped to "19…". The decimal on a
 * strike rate is noise at thumbnail size; the auction band keeps it.
 */
const roundNum = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return String(Math.round(v));
};

const Cell = ({ value, label, accent, band }: {
  value: string; label: string; accent?: boolean; band?: boolean;
}) => (
  <div className={cn("flex flex-col gap-px min-w-0", band && "items-center gap-0.5")}>
    <span className={cn("font-extrabold leading-none tracking-tight truncate",
      band ? "text-lg md:text-2xl" : "text-[13px] sm:text-[15px]",
      accent ? "text-secondary" : "text-foreground")}>
      {value}
    </span>
    <span className={cn("font-semibold uppercase tracking-wider text-muted-foreground/70 truncate",
      band ? "text-[10px]" : "text-[9px]")}>
      {label}
    </span>
  </div>
);

export const CricHeroesStats = ({ stat, variant, className }: Props) => {
  if (!stat) return null;

  const band = variant === "band";

  // A player who has never bowled drops the wicket cell rather than printing a
  // zero, and the grid reflows to whatever is left.
  const cells: { value: string; label: string; accent?: boolean }[] = [];
  const push = (value: string | null, label: string, accent?: boolean) => {
    if (value !== null) cells.push({ value, label, accent });
  };

  if (band) {
    push(num(stat.runs), "Runs");
    push(num(stat.average), "Avg");
    push(num(stat.strikeRate), "Strike rate", true);
    push(stat.highestScore || null, "Best");
    if (stat.wickets) push(num(stat.wickets), "Wickets");
  } else {
    push(num(stat.matches), "Mat");
    push(num(stat.runs), "Runs");
    push(roundNum(stat.strikeRate), "SR", true);
    if (stat.wickets) push(num(stat.wickets), "Wkts");
  }

  if (cells.length === 0) return null;

  return (
    <div className={cn(
      band
        ? "border-y border-border py-2.5 px-1 flex-shrink-0"
        : "border-t border-border bg-white/[0.035] px-2 py-1.5 sm:px-4 sm:py-2 flex flex-col gap-1.5",
      className
    )}>
      <div className={cn("flex items-center gap-1.5 text-muted-foreground/70",
        band ? "justify-center gap-2 mb-2" : "gap-1")}>
        <CricHeroesMark size={band ? 13 : 11} />
        <span className={cn("font-bold uppercase tracking-[0.12em]", band ? "text-[10px]" : "text-[9px]")}>
          CricHeroes
        </span>
        {/* Only on the band — the strip's own Mat cell already says this. */}
        {band && stat.matches !== null && (
          <>
            <span className="w-[3px] h-[3px] rounded-full bg-current opacity-50" aria-hidden="true" />
            <span className="text-[10px] font-semibold">
              {stat.matches} {stat.matches === 1 ? "match" : "matches"}
            </span>
          </>
        )}
      </div>

      <div className={cn("grid gap-1", band && "gap-2")}
           style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map(c => (
          <Cell key={c.label} value={c.value} label={c.label} accent={c.accent} band={band} />
        ))}
      </div>
    </div>
  );
};
