import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/form/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Check, Loader2, RefreshCw, Send, X } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { jsonAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * The Assistant page: type what you want done, read the plan, approve it.
 *
 * Nothing here runs a request. Submitting queues it; a runner picks it up,
 * works out a plan and puts it back on this page; only an approval sets it
 * going. The gap between plan and approval is the whole point — it is where a
 * misread request gets caught before it touches a live tournament.
 */

interface AgentPlan {
  summary?: string;
  steps?: string[];
  affected?: number;
  writes?: boolean;
  files?: string[];
  diff?: string;
  warnings?: string[];
  [key: string]: unknown;
}

interface AgentRequest {
  _id: string;
  requestText: string;
  kind: string;
  status: string;
  plan: AgentPlan | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  tournamentName: string | null;
  createdAt: string;
}

interface TournamentOption { _id: string; name?: string }

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  planning: "bg-blue-500/15 text-blue-500",
  awaiting_approval: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
  approved: "bg-primary/15 text-primary",
  running: "bg-blue-500/15 text-blue-500",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-500",
  failed: "bg-destructive/15 text-destructive",
  rejected: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const label = (status: string) => status.replace(/_/g, " ");

const AssistantRequests = () => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [tournamentId, setTournamentId] = useState<string>("none");
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => jsonAuthHeaders(), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/agent-request/list`, {
        method: "POST", headers, body: JSON.stringify({ limit: 30 }),
      });
      const data = await res.json();
      if (res.ok) setRequests(data.data || []);
    } catch { /* a failed poll just leaves the last list on screen */ }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => {
    load();
    // A request moves through planning on its own, so the page follows it.
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    fetch(`${apiConfig.baseUrl}/api/tournament/managed`, { method: "POST", headers, body: "{}" })
      .then(r => (r.ok ? r.json() : null))
      .then(b => { if (b?.data) setTournaments(b.data); })
      .catch(() => { /* the picker just stays empty */ });
  }, [headers]);

  const submit = async () => {
    const requestText = text.trim();
    if (!requestText) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/agent-request/create`, {
        method: "POST", headers,
        body: JSON.stringify({ requestText, tournamentId: tournamentId === "none" ? null : tournamentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not queue that request");
      setText("");
      toast({ title: "Queued", description: "The assistant will read it and come back with a plan." });
      load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not queue", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const decide = async (id: string, approve: boolean) => {
    setDeciding(id);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/agent-request/decide`, {
        method: "POST", headers, body: JSON.stringify({ requestId: id, approve }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not answer the plan");
      toast({ title: approve ? "Approved" : "Rejected", description: approve ? "It will run shortly." : "Nothing will be done." });
      load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setDeciding(null); }
  };

  return (
    <div className="container mx-auto px-3 py-6 md:px-4 md:py-8">
      <div className="mb-6 flex items-center gap-3">
        <Bot className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask for a change or an export. You see the plan before anything happens.
          </p>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg">New request</CardTitle>
          <CardDescription>
            Plain English. "Export a CSV of Unity Cup with serial, name and phone", "renumber the
            Icon players alphabetically", "hide the Live Auction link in the navbar".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
          <Textarea
            rows={4}
            placeholder="What would you like done?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2 sm:max-w-xl">
            <div className="space-y-2">
              <Label>Tournament (optional)</Label>
              <Select value={tournamentId} onValueChange={setTournamentId}>
                <SelectTrigger><SelectValue placeholder="Not about one tournament" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not about one tournament</SelectItem>
                  {tournaments.map(t => (
                    <SelectItem key={t._id} value={t._id}>{t.name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={submit} disabled={busy || !text.trim()} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send request
          </Button>
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Requests</h2>
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : requests.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">Nothing yet. Your requests will appear here.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r._id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{r.requestText}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      {r.createdBy ? ` · ${r.createdBy}` : ""}
                      {r.tournamentName ? ` · ${r.tournamentName}` : ""}
                      {r.kind && r.kind !== "unknown" ? ` · ${r.kind}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[r.status] || "bg-muted")}>
                    {label(r.status)}
                  </span>
                </div>

                {r.plan && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    {r.plan.summary && <p className="font-medium">{r.plan.summary}</p>}
                    {!!r.plan.steps?.length && (
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                        {r.plan.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    )}
                    {(r.plan.affected != null || r.plan.writes != null) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {r.plan.affected != null && <>Affects <span className="font-medium text-foreground">{r.plan.affected}</span> record(s). </>}
                        {r.plan.writes === false && "Reads only — nothing is changed."}
                        {r.plan.writes === true && "This writes to live data."}
                      </p>
                    )}
                    {!!r.plan.warnings?.length && (
                      <ul className="mt-2 space-y-1 text-xs text-amber-600 dark:text-amber-500">
                        {r.plan.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                      </ul>
                    )}
                    {r.plan.diff && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">{r.plan.diff}</pre>
                    )}
                  </div>
                )}

                {r.status === "awaiting_approval" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" disabled={deciding === r._id} onClick={() => decide(r._id, true)}>
                      {deciding === r._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={deciding === r._id} onClick={() => decide(r._id, false)}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                )}

                {r.result && (
                  <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-2 text-[11px]">
                    {JSON.stringify(r.result, null, 1)}
                  </pre>
                )}
                {r.error && <p className="text-sm text-destructive">{r.error}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssistantRequests;
