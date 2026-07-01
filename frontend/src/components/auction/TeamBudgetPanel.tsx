import { Team } from "@/types/auction";
import { getDriveThumbnail } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface TeamBudgetPanelProps {
  teams: Team[];
  currentBid: number;
  bidPrice: number;
  leadingTeam: string | null;
}

export const TeamBudgetPanel = ({
  teams,
  currentBid,
  bidPrice,
  leadingTeam,
}: TeamBudgetPanelProps) => {
  if (!teams || teams.length === 0) return null;

  const nextBidAmount = leadingTeam === null ? currentBid : currentBid + bidPrice;

  const getTeamState = (team: Team) => {
    const slotsLeft = (team.maxPlayersPerTeam || 0) - (team.playersCount || 0);
    const noSlots = slotsLeft <= 0;
    const insufficientBudget = (team.remainingBudget ?? 0) < nextBidAmount;
    const exceedsMaxBiddable = (team.maxBiddableAmount ?? 0) < nextBidAmount;
    const isWarning = noSlots || insufficientBudget || exceedsMaxBiddable;
    const isLeading = leadingTeam === team._id;
    return { slotsLeft, isWarning, isLeading };
  };

  return (
    <>
      {/* Desktop: 2-column grid panel */}
      <div className="hidden md:flex flex-col shrink-0 w-[420px] lg:w-[460px] bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl shadow-elevated overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <h3 className="text-sm font-bold text-foreground text-center tracking-wide uppercase">
            Max Bid Amount
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => {
              const { slotsLeft, isWarning, isLeading } = getTeamState(team);

              return (
                <div
                  key={team._id}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2.5 rounded-xl border transition-all duration-200",
                    isWarning
                      ? "border-red-500/60 bg-red-500/10"
                      : isLeading
                        ? "border-primary/60 bg-primary/10 shadow-glow animate-shimmer-border"
                        : "border-border/50 bg-background/40 hover:bg-muted/30"
                  )}
                >
                  <img
                    src={getDriveThumbnail(team.logo) || "placeholder.png"}
                    alt={team.name}
                    className="h-10 w-10 rounded-full object-cover shadow-sm flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(team.name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=36&fontWeight=600`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground mb-0.5 line-clamp-2 leading-tight">
                      {team.name}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-black tabular-nums",
                        isWarning ? "text-red-400" : "text-secondary"
                      )}
                    >
                      <AnimatedNumber value={team.maxBiddableAmount ?? 0} suffix=" Pts" duration={300} />
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex-shrink-0 text-center px-2 py-1 rounded-lg",
                      slotsLeft <= 0
                        ? "bg-red-500/20 text-red-400"
                        : slotsLeft <= 2
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <p className="text-base font-black leading-none tabular-nums">{slotsLeft}</p>
                    <p className="text-[9px] font-medium leading-tight mt-0.5">slots</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: Wrapping grid at the bottom */}
      <div className="md:hidden w-full bg-card/80 backdrop-blur-sm border-2 border-border rounded-xl shadow-elevated overflow-hidden mx-2">
        <div className="px-3 py-1.5 border-b border-border bg-muted/30">
          <h3 className="text-xs font-bold text-foreground text-center tracking-wide uppercase">
            Max Bid Amount
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-2">
          {teams.map((team) => {
            const { slotsLeft, isWarning, isLeading } = getTeamState(team);

            return (
              <div
                key={team._id}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg border transition-all duration-200",
                  isWarning
                    ? "border-red-500/60 bg-red-500/10"
                    : isLeading
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/50 bg-background/40"
                )}
              >
                <img
                  src={getDriveThumbnail(team.logo) || "placeholder.png"}
                  alt={team.name}
                  className="h-7 w-7 rounded-full object-cover shadow-sm"
                  onError={(e) => {
                    e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(team.name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=36&fontWeight=600`;
                  }}
                />
                <p className="text-[9px] font-bold text-foreground text-center truncate w-full leading-tight">
                  {team.name}
                </p>
                <p
                  className={cn(
                    "text-[10px] font-black leading-tight tabular-nums",
                    isWarning ? "text-red-400" : "text-secondary"
                  )}
                >
                  {team.maxBiddableAmount ?? 0} Pts
                </p>
                <p className="text-[8px] text-muted-foreground leading-tight">
                  {slotsLeft} slots
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
