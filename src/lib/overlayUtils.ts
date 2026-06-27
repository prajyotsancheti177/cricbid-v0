import { Player, Team } from "@/types/auction";
import { getDriveThumbnail } from "@/lib/imageUtils";

/**
 * Predefined team color palette — vibrant, high-contrast colors
 * for use in overlay backgrounds and accents
 */
const TEAM_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#14b8a6", // teal
  "#ef4444", // red
  "#eab308", // yellow
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#f43f5e", // rose
];

/**
 * Generate a consistent color for a team based on its name or ID.
 * Uses a simple hash to pick from a curated palette.
 */
export const getTeamColor = (teamNameOrId: string): string => {
  if (!teamNameOrId) return TEAM_COLORS[0];
  let hash = 0;
  for (let i = 0; i < teamNameOrId.length; i++) {
    hash = teamNameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
};

/**
 * Format a bid amount for large overlay display.
 * Uses the "Pts." suffix consistent with the rest of the app.
 */
export const formatOverlayPrice = (amount: number): string => {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(2)} L`;
  }
  return `${amount.toLocaleString("en-IN")} Pts.`;
};

/**
 * Get the player photo URL with fallback to DiceBear avatar.
 */
export const getPlayerPhotoUrl = (player: Player | null): string => {
  if (!player) {
    return `https://api.dicebear.com/7.x/initials/svg?seed=Player&backgroundColor=6366f1&backgroundType=gradientLinear&fontSize=40&fontWeight=600`;
  }
  const url = getDriveThumbnail(player.photo as string);
  return url;
};

/**
 * Get fallback avatar URL for a player name
 */
export const getFallbackAvatar = (name: string): string => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=40&fontWeight=600`;
};

/**
 * Get fallback avatar URL for a team name
 */
export const getTeamFallbackAvatar = (name: string): string => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=6366f1,8b5cf6,ec4899&backgroundType=gradientLinear&fontSize=36&fontWeight=600`;
};
