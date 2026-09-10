import { useEffect, useState } from "react";
import apiConfig from "@/config/apiConfig";

export interface CricHeroesStat {
  cricheroesPlayerId: number;
  name: string | null;
  matches: number | null;
  runs: number | null;
  wickets: number | null;
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  economy: number | null;
  bestBowling: string | null;
  catches: number | null;
  fetchedAt: string;
}

/** Keyed by CricBid player id. Only players with a confirmed match appear. */
export type CricHeroesStatMap = Record<string, CricHeroesStat>;

/**
 * CricHeroes stats for one tournament's players.
 *
 * Enrichment, so it fails silently: a player sheet or an auction room must
 * never break because a third party is slow or gone. Callers get an empty map
 * and render exactly what they rendered before.
 */
export const useCricHeroesStats = (tournamentId?: string | null): CricHeroesStatMap => {
  const [stats, setStats] = useState<CricHeroesStatMap>({});

  useEffect(() => {
    if (!tournamentId) { setStats({}); return; }
    let cancelled = false;

    fetch(`${apiConfig.baseUrl}/api/player/cricheroes-stats/${tournamentId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (!cancelled && body?.success && body.data) setStats(body.data as CricHeroesStatMap);
      })
      .catch(() => { /* no stats is a fine outcome; the cards render without them */ });

    return () => { cancelled = true; };
  }, [tournamentId]);

  return stats;
};
