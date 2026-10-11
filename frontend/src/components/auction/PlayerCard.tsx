import { Player } from "@/types/auction";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDriveThumbnail } from "@/lib/imageUtils";
import { shouldMaskPlayer, useMaskingEligible } from "@/lib/privacyUtils";
import { CricHeroesStats } from "@/components/player/CricHeroesStats";
import { Pencil } from "lucide-react";
import type { CricHeroesStat } from "@/hooks/useCricHeroesStats";

interface PlayerCardProps {
  player: Player;
  isAnimated?: boolean;
  isSold?: boolean;
  className?: string;
  /**
   * Makes the card a button. Given one, the card shows a pencil and becomes
   * keyboard-reachable; without one it stays a plain figure, so a viewer who
   * may not edit is never offered a control the server would refuse.
   */
  onClick?: (player: Player) => void;
  categories?: string[]; // Array of categories from tournament for dynamic coloring
  /** CricHeroes career numbers, when this player has a confirmed match. */
  cricHeroes?: CricHeroesStat;
}

// Color palette for categories - subtle, theme-consistent colors
const CATEGORY_COLORS = [
  "bg-rose-500/80 text-white border border-rose-400",       // 1st - Subtle rose
  "bg-emerald-500/80 text-white border border-emerald-400", // 2nd - Subtle emerald  
  "bg-amber-500/80 text-white border border-amber-400",     // 3rd - Subtle amber
  "bg-sky-500/80 text-white border border-sky-400",         // 4th - Subtle sky
  "bg-violet-500/80 text-white border border-violet-400",   // 5th - Subtle violet
  "bg-fuchsia-500/80 text-white border border-fuchsia-400", // 6th - Subtle fuchsia
];

export const PlayerCard = ({ player, isAnimated, isSold, className, onClick, categories = [], cricHeroes }: PlayerCardProps) => {
  const formatPrice = (price: number) => {
    if (price >= 100) {
      return `${price} Pts`;
    }
    return `${price} Pts`;
  };

  const logoSrc = getDriveThumbnail(player.photo as unknown as string);
  const maskingEligible = useMaskingEligible(player.touranmentId);
  const masked = shouldMaskPlayer(player, maskingEligible);

  const handleClick = () => {
    if (onClick) {
      onClick(player);
    }
  };

  // A real <button> when it does something, a <div> when it does not — rather
  // than a div with a click handler, which the keyboard cannot reach.
  const interactive = !!onClick;
  const Root = (interactive ? "button" : "div") as React.ElementType;

  return (
    <Root
      {...(interactive
        ? { type: "button", onClick: handleClick, "aria-label": `Edit ${player.name}` }
        : {})}
      className={cn(
        "relative overflow-hidden rounded-lg sm:rounded-2xl bg-card border border-border sm:border-2 shadow-elevated transition-all duration-300 w-full",
        // mobile: column layout for compact cards. md+: stacked column with larger image
        "flex flex-col",
        // Satisfying hover + press feel
        interactive && "group text-left cursor-pointer hover:shadow-2xl hover:scale-[1.03] hover:border-primary/60 active:scale-[0.97]",
        interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isAnimated && "animate-pop-in",
        isSold && "animate-celebrate",
        className
      )}
    >
      {interactive && (
        // Shown on hover and on keyboard focus. On a touch screen there is no
        // hover to reveal it, so there it simply stays visible.
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 z-30 grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100 sm:right-2 sm:top-2 sm:h-8 sm:w-8"
        >
          <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      )}
      {/* Player Image - Instagram style: full image with blurred background */}
      <div className="relative flex-shrink-0 w-full h-36 sm:h-32 md:h-48 lg:h-64 overflow-hidden">
        {/* Blurred background image */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-80"
          style={{ backgroundImage: `url(${logoSrc})` }}
        />
        {/* Main image - fits entirely without cropping */}
        <img
          src={logoSrc}
          alt={player.name}
          className={cn("relative h-full w-full object-contain z-10", masked && "blur-xl scale-110")}
          onError={(e) => {
            e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=40&fontWeight=600`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent z-20" />

        {/* Status Badge - Top left */}
        <div className="absolute top-0.5 sm:top-2 md:top-4 left-0.5 sm:left-2 md:left-4 z-30">
          {(() => {
            const isSold = !!player.sold;
            const isAuctioned = !!player.auctionStatus;
            if (isSold) {
              return <Badge className="bg-accent text-accent-foreground font-bold shadow-lg text-[8px] sm:text-xs px-1 py-0 sm:px-2 sm:py-1 leading-tight">SOLD</Badge>;
            }
            if (isAuctioned && !isSold) {
              return <Badge className="bg-destructive text-destructive-foreground font-bold shadow-lg text-[8px] sm:text-xs px-1 py-0 sm:px-2 sm:py-1 leading-tight">UNSOLD</Badge>;
            }
            return null;
          })()}
        </div>

        {/* Category Badge - Top right */}
        <div className="absolute top-0.5 sm:top-2 md:top-4 right-0.5 sm:right-2 md:right-4 flex flex-col items-end gap-1 z-30">
          <div className="hidden sm:block">
            {(() => {
              const categoryIndex = categories.indexOf(player.playerCategory || "");
              const colorClass = categoryIndex >= 0
                ? CATEGORY_COLORS[categoryIndex % CATEGORY_COLORS.length]
                : "bg-gray-500 text-white"; // Fallback for unknown categories
              return (
                <Badge
                  className={`${colorClass} text-[10px] sm:text-xs font-bold shadow-lg px-1.5 py-0.5 sm:px-2 sm:py-1`}
                >
                  {player.playerCategory}
                </Badge>
              );
            })()}
          </div>
          {player.auctionSerialNumber != null && (
            <Badge variant="outline" className="text-[10px] sm:text-xs font-bold shadow-lg bg-background/50 backdrop-blur-md border-primary/50 text-foreground px-1.5 py-0.5 sm:px-2 sm:py-1">
              #{player.auctionSerialNumber}
            </Badge>
          )}
        </div>
      </div>

      {/* Player Details - Compact on mobile */}
      <div className="p-1.5 sm:p-2 md:p-4 flex-1 w-full">
        {/* Player Name */}
        <h3 className="text-xs sm:text-sm md:text-lg lg:text-xl font-bold text-foreground truncate leading-tight">
          {player.name}
        </h3>

        {/* Team name when player is sold */}
        {player.sold && player.teamName && (
          <p className="text-[10px] sm:text-xs text-secondary truncate mt-0.5 text-center">
            Sold to "<span className="font-semibold">{player.teamName}</span>"
          </p>
        )}

        {/* Price info - Single row on mobile */}
        <div className="mt-1 sm:mt-2 flex items-center justify-between gap-1 sm:gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Base</p>
            <p className="text-xs sm:text-sm md:text-base font-bold text-foreground truncate">
              {player.basePrice !== undefined ? formatPrice(player.basePrice) : "-"}
            </p>
          </div>

          {player.amtSold > 0 && (
            <div className="text-right min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Sold</p>
              <p className="text-xs sm:text-sm md:text-base font-bold text-secondary truncate">
                {formatPrice(player.amtSold)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CricHeroes career numbers — renders nothing without a confirmed match */}
      <CricHeroesStats stat={cricHeroes} variant="strip" />

      {/* Skill subsection - accent bottom strip */}
      {player.skill && (
        <div className="w-full px-2 py-1 sm:px-3 sm:py-1.5 bg-orange-500/10 border-t border-orange-500/20">
          <p className="text-[10px] sm:text-xs font-semibold text-orange-400 truncate text-center">
            {player.skill}
          </p>
        </div>
      )}
    </Root>
  );
};

