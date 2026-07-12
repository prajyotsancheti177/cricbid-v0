import { memo } from "react";
import { Team } from "@/types/auction";
import { getDriveThumbnail } from "@/lib/imageUtils";

interface TeamBidGridProps {
  teams: Team[];
  currentBid: number;
  bidPrice: number;
  leadingTeam: string | null;
  teamBids: Record<string, number>;
  onBid: (teamId: string) => void;
}

/**
 * The auctioneer's "Click on Team to Bid" grid.
 * Memoized so it only re-renders when auction state that actually affects it
 * changes — not on every countdown-timer tick or viewer-count update, which
 * otherwise restart the leading team's `animate-glow-pulse` CSS animation
 * from frame 0 on a ~1s cadence and make a slow, soft glow look like a flicker.
 *
 * Note: no `duration-*` class on the button. `tailwindcss-animate` defines
 * its own `.duration-N { animation-duration: Ns }` utility sharing the same
 * class name as the core transition-duration utility, which silently
 * overrides animate-glow-pulse's real duration to whatever duration-N is on
 * the element. `transition-all` alone already carries a 150ms default and
 * doesn't touch animation-duration, so it's safe here.
 */
export const TeamBidGrid = memo(({ teams, currentBid, bidPrice, leadingTeam, teamBids, onBid }: TeamBidGridProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3 mb-3 md:mb-4">
      {teams.map((team) => {
        const nextBidAmount = leadingTeam === null ? currentBid : currentBid + bidPrice;
        const noSlots = (team.maxPlayersPerTeam ?? 0) - (team.playersCount ?? 0) <= 0;
        const insufficientBudget = (team.remainingBudget ?? 0) < nextBidAmount;
        const exceedsMaxBiddable = (team.maxBiddableAmount ?? 0) < nextBidAmount;
        const isWarning = noSlots || insufficientBudget || exceedsMaxBiddable;

        return (
          <div key={team._id} className="flex flex-col items-center">
            <button
              onClick={() => onBid(team._id)}
              className={`w-full p-3 md:p-4 min-h-[56px] rounded-xl border-2 transition-all
                active:scale-[0.93] select-none
                ${isWarning
                  ? "border-red-500 bg-red-500/20 hover:scale-[1.02] active:scale-[0.95]"
                  : leadingTeam === team._id
                    ? "border-primary bg-primary/20 scale-105 animate-glow-pulse"
                    : "border-border hover:border-primary/60 hover:scale-[1.06] hover:shadow-glow hover:bg-primary/5"
                }`}
            >
              <div className="mb-2">
                <img
                  src={getDriveThumbnail(team.logo) || 'placeholder.png'}
                  alt={team.name}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-full shadow-md object-cover mx-auto"
                  onError={(e) => {
                    e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(team.name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=36&fontWeight=600`;
                  }}
                />
              </div>
              <p className="font-bold text-xs md:text-sm text-foreground mb-1 text-center truncate">{team.name}</p>
              <div className="text-[11px] md:text-xs text-muted-foreground text-center">
                {team.remainingBudget} Pts • {(team.maxPlayersPerTeam || 0) - (team.playersCount || 0)} slots
              </div>
              {teamBids[team._id] && (
                <p className="text-[11px] md:text-xs text-primary font-bold mt-1 text-center">{teamBids[team._id]} Pts</p>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
});

TeamBidGrid.displayName = "TeamBidGrid";
