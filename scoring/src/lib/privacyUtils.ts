import { useEffect, useState } from "react";
import { post } from "./api";
import { useSiteSettings } from "./siteSettings";

/** Site-wide privacy masking for female players (admin-controlled). Frontend-only. */
export const shouldMaskPlayer = (
  player: { gender?: string | null } | null | undefined,
  maskingEligible: boolean
): boolean => maskingEligible && (player?.gender || "").trim().toLowerCase() === "female";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const isConductedAWeekAgoOrEarlier = (createdAt: string | null | undefined): boolean => {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() >= WEEK_MS;
};

const tournamentCreatedAtCache = new Map<string, Promise<string | null>>();

const fetchTournamentCreatedAt = (tournamentId: string): Promise<string | null> => {
  if (!tournamentCreatedAtCache.has(tournamentId)) {
    const promise = post("tournament/detail", { tournamentId })
      .then((r) => r?.data?.createdAt ?? null)
      .catch(() => null);
    tournamentCreatedAtCache.set(tournamentId, promise);
  }
  return tournamentCreatedAtCache.get(tournamentId)!;
};

/** Site-wide toggle is on AND the tournament was conducted a week ago or earlier. */
export function useMaskingEligible(tournamentId: string | undefined): boolean {
  const settings = useSiteSettings();
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
    return () => { cancelled = true; };
  }, [tournamentId]);

  return settings.maskFemalePlayers && isConductedAWeekAgoOrEarlier(createdAt);
}
