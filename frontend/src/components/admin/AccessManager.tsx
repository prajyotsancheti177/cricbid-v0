import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/form/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ShieldCheck, UserCog } from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { cn } from "@/lib/utils";
import { jsonAuthHeaders } from "@/lib/auth";

/**
 * Grant access to someone who already signed in.
 *
 * Roles are no longer created alongside a user. Anyone can sign in with Google
 * and lands as a `player` with access to nothing; a boss finds them here and
 * promotes them. That means the person has to have signed in at least once —
 * you cannot grant access to an email that has never been used.
 *
 * A tournament_host also needs to be told WHICH tournaments. Those grants are
 * additive: a host keeps anything they created and gains what is ticked here.
 */

interface AccessUser {
  _id: string;
  name?: string;
  email: string;
  role: string;
  isActive?: boolean;
  tournamentAccess?: { tournamentId: string; tournamentName: string | null }[];
}

interface Tournament {
  _id: string;
  name?: string;
}

const ROLES = [
  { value: "player", label: "Player", hint: "No admin access. The default for everyone." },
  { value: "tournament_host", label: "Tournament host", hint: "Runs the tournaments you pick below." },
  { value: "super_user", label: "Super user", hint: "Sees and manages every tournament." },
  { value: "boss", label: "Boss", hint: "Full access, including granting boss." },
];

const roleBadge = (role: string) => {
  switch (role) {
    case "boss": return <Badge className="bg-primary text-primary-foreground">Boss</Badge>;
    case "super_user": return <Badge className="bg-secondary text-secondary-foreground">Super user</Badge>;
    case "tournament_host": return <Badge variant="outline" className="border-primary/50 text-primary">Host</Badge>;
    default: return <Badge variant="outline" className="text-muted-foreground">Player</Badge>;
  }
};

export const AccessManager = ({ currentUser }: { currentUser: { _id: string; role: string } | null }) => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccessUser[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<string>("");
  const [draftTournaments, setDraftTournaments] = useState<string[]>([]);
  /** Deactivated accounts are history, not people you are about to grant access to. */
  const [showInactive, setShowInactive] = useState(false);

  const headers = useMemo(() => jsonAuthHeaders(), []);

  useEffect(() => {
    if (!currentUser?._id) return;
    fetch(`${apiConfig.baseUrl}/api/tournament/all`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId: currentUser._id }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(b => { if (b?.data) setTournaments(b.data); })
      .catch(() => { /* the picker just stays empty */ });
  }, [currentUser?._id, headers]);

  // Search as they type, once they have typed enough to be meaningful.
  useEffect(() => {
    if (!currentUser?._id) return;
    const q = query.trim();
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`${apiConfig.baseUrl}/api/user/search?q=${encodeURIComponent(q)}`, { headers })
        .then(r => (r.ok ? r.json() : null))
        .then(b => setResults(b?.data || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, currentUser?._id, headers]);

  const openEditor = (u: AccessUser) => {
    setExpanded(u._id);
    setDraftRole(u.role);
    setDraftTournaments((u.tournamentAccess || []).map(a => a.tournamentId));
  };

  const save = async (u: AccessUser) => {
    setSavingId(u._id);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/user/set-access`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: currentUser?._id,
          targetUserId: u._id,
          role: draftRole,
          tournamentIds: draftRole === "tournament_host" ? draftTournaments : [],
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not update access");

      setResults(prev => prev.map(r => (r._id === u._id ? body.data : r)));
      setExpanded(null);
      toast({
        title: "Access updated",
        description: `${body.data.name || body.data.email} is now ${ROLES.find(r => r.value === body.data.role)?.label || body.data.role}.`,
      });
    } catch (err) {
      toast({
        title: "Not updated",
        description: err instanceof Error ? err.message : "Could not update access",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const isBoss = currentUser?.role === "boss";
  const inactiveCount = results.filter(u => u.isActive === false).length;
  const visible = showInactive ? results : results.filter(u => u.isActive !== false);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Grant access
        </CardTitle>
        <CardDescription>
          Search anyone who has signed in, then choose what they can do. Everyone starts as a player
          with no admin access — if you cannot find someone, ask them to sign in with Google once first.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>

        {inactiveCount > 0 && (
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={showInactive} onCheckedChange={(c) => setShowInactive(c === true)} />
            Show inactive users
            <span className="text-xs text-muted-foreground/70">({inactiveCount} hidden)</span>
          </label>
        )}

        {visible.length === 0 && !searching && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {query.trim() ? "Nobody matches that. They may not have signed in yet." : "Start typing to find someone."}
          </p>
        )}

        <div className="space-y-2">
          {visible.map(u => {
            const open = expanded === u._id;
            const self = u._id === currentUser?._id;
            return (
              <div key={u._id} className={cn("rounded-lg border border-border", open && "border-primary/50 bg-muted/30")}>
                <div className="flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {(u.name || u.email || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {u.name || "—"} {self && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    {u.role === "tournament_host" && !!u.tournamentAccess?.length && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {u.tournamentAccess.length} tournament{u.tournamentAccess.length === 1 ? "" : "s"} granted
                      </div>
                    )}
                  </div>
                  {u.isActive === false && <Badge variant="outline" className="text-destructive">Inactive</Badge>}
                  {roleBadge(u.role)}
                  <Button
                    size="sm"
                    variant={open ? "secondary" : "outline"}
                    disabled={self}
                    title={self ? "You cannot change your own role" : undefined}
                    onClick={() => (open ? setExpanded(null) : openEditor(u))}
                  >
                    <UserCog className="mr-1 h-4 w-4" />
                    {open ? "Cancel" : "Change"}
                  </Button>
                </div>

                {open && (
                  <div className="space-y-4 border-t border-border p-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</label>
                      <Select value={draftRole} onValueChange={setDraftRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.filter(r => r.value !== "boss" || isBoss).map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {ROLES.find(r => r.value === draftRole)?.hint}
                      </p>
                    </div>

                    {draftRole === "tournament_host" && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Tournaments they can manage
                        </label>
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                          {tournaments.length === 0 && (
                            <p className="p-2 text-xs text-muted-foreground">No tournaments to grant.</p>
                          )}
                          {tournaments.map(t => (
                            <label key={t._id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted">
                              <Checkbox
                                checked={draftTournaments.includes(t._id)}
                                onCheckedChange={(c) =>
                                  setDraftTournaments(prev =>
                                    c ? [...prev, t._id] : prev.filter(id => id !== t._id)
                                  )
                                }
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">{t.name || "Untitled"}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          They keep any tournament they created themselves — these are granted on top.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => save(u)} disabled={savingId === u._id}>
                        {savingId === u._id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save access
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
