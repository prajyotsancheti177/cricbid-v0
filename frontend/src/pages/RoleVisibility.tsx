import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Loader2, Lock, RotateCcw, ShieldCheck, Server, ChevronLeft, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/form/select";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { authHeaders, jsonAuthHeaders, useCurrentUser } from "@/lib/auth";
import { refreshVisibility, type ResourceKey, type Role } from "@/lib/visibility";
import { cn } from "@/lib/utils";

/**
 * Role visibility — which roles see which pages, workspace tabs and actions.
 *
 * A boss switches cells on and off; changes are staged and saved together.
 * Every cell is bounded by what the server allows (the manifest's ceiling):
 * cells outside it are shown as unavailable, never as switches, so this page
 * cannot hand a role more than the code was written to allow. Items marked
 * "Enforced" are refused by the API too; the rest only hide the screen, and
 * the page says so.
 *
 * Super users can open it read-only.
 */

interface Cell {
  visible: boolean;
  default: boolean;
  allowed: boolean;
  locked: boolean;
  override: boolean | null;
}

interface ResourceRow {
  key: ResourceKey;
  group: string;
  label: string;
  path?: string;
  description?: string;
  enforced?: boolean;
  cells: Record<Role, Cell>;
}

interface Matrix {
  version: string;
  roles: Role[];
  roleLabels: Record<Role, string>;
  groups: { id: string; label: string }[];
  resources: ResourceRow[];
  orphaned: { role: Role; key: string; visible: boolean }[];
}

interface HistoryEntry {
  at: string;
  by: string | null;
  changes: { role: Role; key: string; from: boolean; to: boolean; reset: boolean }[];
}

/** Staged edit for one cell: true/false, or null to go back to the default. */
type Staged = Record<string, boolean | null>;
const cellId = (role: Role, key: string) => `${role}|${key}`;

const RoleVisibilityPage = () => {
  const { user } = useCurrentUser();
  const isBoss = user?.role === "boss";
  const { toast } = useToast();

  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [staged, setStaged] = useState<Staged>({});
  const [saving, setSaving] = useState(false);
  const [previewRole, setPreviewRole] = useState<Role>("tournament_host");

  const load = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([
        fetch(`${apiConfig.baseUrl}/api/visibility/matrix`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${apiConfig.baseUrl}/api/visibility/history?limit=20`, { headers: authHeaders() }).then((r) => r.json()),
      ]);
      if (!m?.success) throw new Error(m?.message || "Could not load");
      setMatrix(m.data);
      setHistory(h?.success ? h.data : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** What a cell shows, counting unsaved edits. */
  const effective = (row: ResourceRow, role: Role): boolean => {
    const id = cellId(role, row.key);
    if (id in staged) {
      const v = staged[id];
      return v === null ? row.cells[role].default : v;
    }
    return row.cells[role].visible;
  };

  /** Whether a cell differs from the code default, counting unsaved edits. */
  const isChanged = (row: ResourceRow, role: Role) => {
    const c = row.cells[role];
    if (!c.allowed || c.locked) return false;
    return effective(row, role) !== c.default;
  };

  const toggle = (row: ResourceRow, role: Role, next: boolean) => {
    const c = row.cells[role];
    const id = cellId(role, row.key);
    setStaged((prev) => {
      const copy = { ...prev };
      // Back to what is saved: nothing to send.
      if (next === c.visible) delete copy[id];
      // Back to the default: send a reset, so the default keeps applying later.
      else copy[id] = next === c.default ? null : next;
      return copy;
    });
  };

  const resetCell = (row: ResourceRow, role: Role) => {
    const c = row.cells[role];
    const id = cellId(role, row.key);
    setStaged((prev) => {
      const copy = { ...prev };
      if (c.override === null) delete copy[id];
      else copy[id] = null;
      return copy;
    });
  };

  const resetAll = () => {
    if (!matrix) return;
    const next: Staged = {};
    for (const row of matrix.resources) {
      for (const role of matrix.roles) {
        if (row.cells[role].override !== null) next[cellId(role, row.key)] = null;
      }
    }
    setStaged(next);
  };

  const pendingCount = Object.keys(staged).length;

  const save = async () => {
    if (!pendingCount) return;
    setSaving(true);
    try {
      const changes = Object.entries(staged).map(([id, visible]) => {
        const [role, key] = id.split("|");
        return { role, key, visible };
      });
      const res = await fetch(`${apiConfig.baseUrl}/api/visibility`, {
        method: "PUT",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ changes }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error((typeof body.error === "string" && body.error) || body.message || "Save failed");
      setMatrix(body.data);
      setStaged({});
      toast({ title: "Saved", description: `${changes.length} change${changes.length === 1 ? "" : "s"} applied. Open browsers update within seconds.` });
      refreshVisibility(true);
      load();
    } catch (e) {
      toast({ title: "Not saved", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!pendingCount) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingCount]);

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    matrix?.resources.forEach((r) => m.set(r.key, r.label));
    return (k: string) => m.get(k) || k;
  }, [matrix]);

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="container mx-auto py-16 px-4 flex justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading role visibility…
      </div>
    );
  }

  const roles = matrix.roles;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl pb-28">
      <Link to="/site-settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="h-4 w-4" /> Site settings
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Role visibility
        </h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
          Choose which roles see each page, workspace tab and action. Changes apply to everyone with that role,
          within seconds. A role can only be given what the system allows it — cells marked “—” are never
          available to that role, and players can never manage anything.
        </p>
      </div>

      {!isBoss && (
        <Alert className="mb-4">
          <AlertDescription>View only. Only a boss can change role visibility.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground mb-4">
        <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Always on</span>
        <span className="inline-flex items-center gap-1.5"><span className="font-semibold">—</span> Never available to this role</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Changed from the default</span>
        <span className="inline-flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> Enforced on the server — not only hidden</span>
      </div>

      {matrix.groups.map((group) => {
        const rows = matrix.resources.filter((r) => r.group === group.id);
        if (!rows.length) return null;
        return (
          <Card key={group.id} className="mb-5 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2 min-w-[220px]">Item</th>
                      {roles.map((role) => (
                        <th key={role} className="font-medium px-2 py-2 text-center min-w-[92px]">{matrix.roleLabels[role]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{row.label}</span>
                            {row.enforced && (
                              <Badge variant="outline" className="gap-1 text-[10px] py-0" title="The server refuses this feature's API calls for a role it is switched off for.">
                                <Server className="h-3 w-3" /> Enforced
                              </Badge>
                            )}
                          </div>
                          {row.description && <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>}
                          {row.path && <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">{row.path}</p>}
                        </td>
                        {roles.map((role) => {
                          const c = row.cells[role];
                          const id = cellId(role, row.key);
                          const pending = id in staged;
                          if (!c.allowed) {
                            return (
                              <td key={role} className="px-2 py-3 text-center text-muted-foreground" title={`${matrix.roleLabels[role]} can never have this`}>—</td>
                            );
                          }
                          if (c.locked) {
                            return (
                              <td key={role} className="px-2 py-3 text-center" title={`Always on for ${matrix.roleLabels[role]}`}>
                                <Lock className="h-4 w-4 inline text-muted-foreground" />
                              </td>
                            );
                          }
                          const on = effective(row, role);
                          const changed = isChanged(row, role);
                          return (
                            <td key={role} className="px-2 py-3 text-center">
                              <div className={cn("inline-flex flex-col items-center gap-1 rounded-md px-1.5 py-1", pending && "ring-2 ring-primary/50")}>
                                <div className="flex items-center gap-1">
                                  <Switch
                                    checked={on}
                                    disabled={!isBoss || saving}
                                    onCheckedChange={(v) => toggle(row, role, v)}
                                    aria-label={`${row.label} for ${matrix.roleLabels[role]}`}
                                  />
                                  {changed && <span className="h-2 w-2 rounded-full bg-amber-500" title="Changed from the default" />}
                                </div>
                                {isBoss && changed && (
                                  <button
                                    type="button"
                                    onClick={() => resetCell(row, role)}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                                    title={`Back to the default (${c.default ? "on" : "off"})`}
                                  >
                                    <RotateCcw className="h-3 w-3" /> default
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {matrix.orphaned.length > 0 && (
        <Alert className="mb-5">
          <AlertDescription>
            {matrix.orphaned.length} saved setting{matrix.orphaned.length === 1 ? " refers" : "s refer"} to items that no longer exist and {matrix.orphaned.length === 1 ? "is" : "are"} ignored:{" "}
            {matrix.orphaned.map((o) => `${o.key} (${matrix.roleLabels[o.role] || o.role})`).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Preview as a role</CardTitle>
            <CardDescription>What this role sees, including unsaved changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={previewRole} onValueChange={(v) => setPreviewRole(v as Role)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((role) => <SelectItem key={role} value={role}>{matrix.roleLabels[role]}</SelectItem>)}
              </SelectContent>
            </Select>
            {matrix.groups.map((group) => {
              const seen = matrix.resources.filter((r) => r.group === group.id && effective(r, previewRole));
              return (
                <div key={group.id}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{group.label}</p>
                  {seen.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {seen.map((r) => <Badge key={r.key} variant="secondary" className="font-normal">{r.label}</Badge>)}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nothing</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Recent changes</CardTitle>
            <CardDescription>Who changed what, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes yet — everything is on its default.</p>
            ) : (
              <ul className="space-y-3 text-sm max-h-80 overflow-y-auto pr-1">
                {history.map((h, i) => (
                  <li key={i}>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.at).toLocaleString()} · {h.by || "Unknown"}
                    </p>
                    <ul className="mt-0.5">
                      {h.changes.map((c, j) => (
                        <li key={j}>
                          {labelOf(c.key)} for <span className="font-medium">{matrix.roleLabels[c.role] || c.role}</span>:{" "}
                          {c.reset ? `back to default (${c.to ? "on" : "off"})` : c.to ? "turned on" : "turned off"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {isBoss && (
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetAll} disabled={saving || matrix.resources.every((r) => roles.every((role) => r.cells[role].override === null))}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset everything to defaults
          </Button>
        </div>
      )}

      {isBoss && pendingCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm">{pendingCount} unsaved change{pendingCount === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStaged({})} disabled={saving}>Discard</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleVisibilityPage;
