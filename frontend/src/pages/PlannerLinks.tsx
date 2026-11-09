import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Copy, Loader2, RotateCcw } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { jsonAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Host-side: one planner link per team, to send over WhatsApp.
 *
 * Deliberately not linked from the tournament workspace yet — the planner is
 * meant to be run alongside a real auction first, so this page is reachable
 * only by typing its URL.
 */

interface PlannerLink {
  teamId: string;
  teamName: string | null;
  token: string;
}

const PlannerLinks = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [links, setLinks] = useState<PlannerLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/planner/links`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ tournamentId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Failed to load");
      setLinks(json.data as PlannerLink[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load planner links");
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const urlFor = (token: string) => `${window.location.origin}/plan/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      toast.success("Planner link copied");
    } catch {
      toast.error("Could not copy — long-press the link instead");
    }
  };

  const reset = async (teamId: string) => {
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/planner/link-reset`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ teamId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Failed to reset");
      toast.success("Link reset — the old one no longer works");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset that link");
    }
  };

  if (error) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>;
  }

  if (!links) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-xl font-bold">Owner planner links</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        One link per team. Whoever holds it plans for that team and sees nobody else's list. The
        planner cannot bid, sell or change anything in the auction.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {links.map((l) => (
          <div
            key={l.teamId}
            className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.teamName}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(l.token)}
              className="transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy link
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => reset(l.teamId)}
              aria-label={`Reset link for ${l.teamName}`}
              className="transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlannerLinks;
