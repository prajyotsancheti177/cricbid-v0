import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { jsonAuthHeaders } from "@/lib/auth";
import { useWorkspace } from "./TournamentWorkspace";
import { getDriveThumbnail } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Check, SlashIcon, Search, ExternalLink, Undo2 } from "lucide-react";

/**
 * Resolving CricHeroes matches.
 *
 * The nightly matcher links only what it is certain of — a whole-name match in
 * the right city — and parks everything else as `ambiguous` with its ranked
 * runners-up. Those rows were being written and never shown: Jain Unity Cup
 * sat on 97 unresolved players because there was nowhere to look at them.
 *
 * This is that screen. A reviewer sees the candidates the matcher found and
 * says which one is the player, or that none of them are. A decision here is
 * final: the sync skips anything a person has confirmed, so it will not be
 * undone at 6am.
 */

type Status = "linked" | "ambiguous" | "not_found" | "pending" | "error";

interface Candidate {
  id: number;
  name: string;
  city?: string;
  score?: number;
  isPro?: boolean;
}

interface ReviewPlayer {
  _id: string;
  name: string;
  photo?: string | null;
  playerCategory?: string | null;
  skill?: string | null;
  serial?: number | null;
  status: Status;
  confidence: number | null;
  matchedName: string | null;
  matchedCity: string | null;
  cricheroesPlayerId: number | null;
  confirmedAt: string | null;
  candidates: Candidate[];
  lastError: string | null;
  stats: Record<string, unknown> | null;
}

const STATUS_STYLE: Record<Status, string> = {
  linked: "bg-emerald-500/15 text-emerald-500",
  ambiguous: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
  not_found: "bg-muted text-muted-foreground",
  pending: "bg-blue-500/15 text-blue-500",
  error: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<Status, string> = {
  linked: "Linked",
  ambiguous: "Needs a decision",
  not_found: "No match",
  pending: "Not checked yet",
  error: "Error",
};

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "ambiguous", label: "Needs a decision" },
  { key: "linked", label: "Linked" },
  { key: "not_found", label: "No match" },
  { key: "pending", label: "Not checked" },
  { key: "all", label: "Everyone" },
];

const TournamentCricHeroesSection = () => {
  const { tournament } = useWorkspace();
  const { toast } = useToast();

  const [players, setPlayers] = useState<ReviewPlayer[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("ambiguous");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/cricheroes/review`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ tournamentId: tournament._id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not load");
      setPlayers(body.data?.players || []);
      setCounts(body.data?.counts || {});
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tournament._id, toast]);

  useEffect(() => { load(); }, [load]);

  // While a sync runs, the numbers move on their own.
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(load, 5000);
    const stop = setTimeout(() => setSyncing(false), 1000 * 60 * 10);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [syncing, load]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/cricheroes/sync`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ tournamentId: tournament._id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not start");
      toast({
        title: "Matching started",
        description: `${body.data?.queued ?? 0} player(s) queued. It calls CricHeroes once per player, so this takes a few minutes — the counts update as it goes.`,
      });
    } catch (e) {
      setSyncing(false);
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  const resolve = async (playerId: string, cricheroesPlayerId: number | null) => {
    setSaving(playerId);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/cricheroes/resolve`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ tournamentId: tournament._id, playerId, cricheroesPlayerId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not save");
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => filter === "all" || p.status === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [players, filter, query]);

  const total = players.length;
  const linked = counts.linked || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg">CricHeroes stats</CardTitle>
          <CardDescription>
            Career numbers come from CricHeroes, matched by name and city. The matcher links
            only what it is sure of — everything else waits here for you to decide, because a
            wrong link puts a stranger's record on a player's card.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(({ key, label }) => {
              const n = key === "all" ? total : (counts[key] || 0);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  )}
                >
                  {label} <span className="font-semibold">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Find a player" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button onClick={runSync} disabled={syncing} variant="outline" className="gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? "Matching…" : "Run matching now"}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{linked}</span> of {total} players have stats.
            {(counts.ambiguous || 0) > 0 && ` ${counts.ambiguous} still need a decision.`}
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {filter === "ambiguous" ? "Nothing left to decide here." : "No players match."}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => (
            <Card key={p._id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={getDriveThumbnail(p.photo || "")}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover bg-muted"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.serial != null && <span className="text-muted-foreground">#{p.serial} </span>}
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[p.playerCategory, p.skill].filter(Boolean).join(" · ") || "—"}
                        {p.matchedName && ` · matched to ${p.matchedName}${p.matchedCity ? `, ${p.matchedCity}` : ""}`}
                      </p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[p.status])}>
                    {STATUS_LABEL[p.status]}
                    {p.confirmedAt ? " · by hand" : ""}
                  </span>
                </div>

                {p.status === "ambiguous" && p.candidates.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Which of these is {p.name}?
                    </p>
                    <div className="space-y-1.5">
                      {p.candidates.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
                          <div className="min-w-0 text-sm">
                            <span className="font-medium">{c.name}</span>
                            {c.city && <span className="text-muted-foreground"> · {c.city}</span>}
                            {typeof c.score === "number" && (
                              <span className="ml-2 text-xs text-muted-foreground">name match {Math.round(c.score * 100)}%</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://cricheroes.com/player-profile/${c.id}/x`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                              <ExternalLink className="h-3 w-3" /> Open
                            </a>
                            <Button size="sm" disabled={saving === p._id} onClick={() => resolve(p._id, c.id)} className="h-8 gap-1.5">
                              {saving === p._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              This one
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={saving === p._id}
                      onClick={() => resolve(p._id, null)}
                      className="gap-1.5 text-muted-foreground"
                    >
                      <SlashIcon className="h-3.5 w-3.5" /> None of these
                    </Button>
                  </div>
                )}

                {p.status === "ambiguous" && p.candidates.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No candidates were stored. Run matching again to search for this player.
                  </p>
                )}

                {(p.status === "linked" || p.status === "not_found") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving === p._id}
                    onClick={() => resolve(p._id, null)}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    {p.status === "linked" ? "Wrong person — unlink" : "Mark as unresolved"}
                  </Button>
                )}

                {p.lastError && <p className="text-xs text-destructive">{p.lastError}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentCricHeroesSection;
