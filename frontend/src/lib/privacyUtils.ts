/**
 * Site-wide privacy masking for female players (admin-controlled, see
 * SiteSettings / useSiteSettings). Frontend-only: blurs photos and masks
 * mobile numbers in the UI, but the underlying values are still present in
 * API responses.
 *
 * Only applies to tournaments conducted a week ago or earlier — there's no
 * explicit "event date" field on Tournament, so `createdAt` is used (it's
 * the same field the Tournaments list already displays as each card's date).
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import apiConfig from "@/config/apiConfig";
import { useSiteSettings } from "@/lib/siteSettings";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const isFemalePlayer = (player: { gender?: string | null } | null | undefined): boolean =>
  (player?.gender || "").trim().toLowerCase() === "female";

export const shouldMaskPlayer = (
  player: { gender?: string | null } | null | undefined,
  maskingEligible: boolean
): boolean => maskingEligible && isFemalePlayer(player);

export const isConductedAWeekAgoOrEarlier = (createdAt: string | null | undefined): boolean => {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() >= WEEK_MS;
};

// Module-level cache so multiple components rendering players from the same
// tournament don't each fire their own /tournament/detail request.
const tournamentCreatedAtCache = new Map<string, Promise<string | null>>();

const fetchTournamentCreatedAt = (tournamentId: string): Promise<string | null> => {
  if (!tournamentCreatedAtCache.has(tournamentId)) {
    const promise = fetch(`${apiConfig.baseUrl}/api/tournament/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId }),
    })
      .then((res) => res.json())
      .then((data) => data?.data?.createdAt ?? null)
      .catch(() => null);
    tournamentCreatedAtCache.set(tournamentId, promise);
  }
  return tournamentCreatedAtCache.get(tournamentId)!;
};

/**
 * Whether female-player masking should actually be applied right now for a
 * given tournament: the site-wide toggle is on AND the tournament was
 * conducted a week ago or earlier. Pass this (not the raw site setting) into
 * shouldMaskPlayer().
 */
export const useMaskingEligible = (tournamentId: string | null | undefined): boolean => {
  const { settings } = useSiteSettings();
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setCreatedAt(null);
      return;
    }
    let cancelled = false;
    fetchTournamentCreatedAt(tournamentId).then((value) => {
      if (!cancelled) setCreatedAt(value);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return settings.maskFemalePlayers && isConductedAWeekAgoOrEarlier(createdAt);
};

/** Tailwind classes to blur a player photo when masking is active. */
export const maskedPhotoClass = (masked: boolean): string =>
  masked ? "blur-xl scale-110" : "";

/** Inline style equivalent, for components (e.g. OBS overlays) that use style objects. */
export const maskedPhotoStyle = (masked: boolean): CSSProperties =>
  masked ? { filter: "blur(16px)", transform: "scale(1.1)" } : {};

/** Mask all but the last 2 digits of a phone number, e.g. "••••••••21". */
export const maskMobile = (mobile?: string | null): string => {
  if (!mobile) return "";
  if (mobile.length <= 2) return "•".repeat(mobile.length);
  return `${"•".repeat(mobile.length - 2)}${mobile.slice(-2)}`;
};
