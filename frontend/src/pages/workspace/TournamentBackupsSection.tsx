import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Trash2, Loader2, Users, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "./TournamentWorkspace";
import apiConfig from "@/config/apiConfig";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
};

interface Backup {
  _id: string;
  label?: string;
  playerCount: number;
  soldCount: number;
  createdAt: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const TournamentBackupsSection = () => {
  const { tournament } = useWorkspace();
  const { toast } = useToast();
  const user = getUser();

  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiConfig.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userId: user?._id, userRole: user?.role }),
    });

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await post("/api/backup/list", { tournamentId: tournament._id });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message);
      setBackups(data.data ?? []);
    } catch {
      toast({ title: "Error", description: "Failed to load backups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tournament._id]);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await post("/api/backup/create", { tournamentId: tournament._id, label: label.trim() || undefined });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Failed to create backup");
      toast({ title: "Backup created", description: label.trim() || "Checkpoint saved" });
      setCreateOpen(false);
      setLabel("");
      fetchBackups();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await post("/api/backup/restore", { backupId: restoreTarget._id, tournamentId: tournament._id });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Restore failed");
      toast({ title: "Restored", description: `Tournament reverted to "${restoreTarget.label || formatDate(restoreTarget.createdAt)}"` });
      setRestoreTarget(null);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Restore failed", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await post("/api/backup/delete", { backupId: deleteTarget._id, tournamentId: tournament._id });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Delete failed");
      toast({ title: "Deleted", description: "Backup removed" });
      setDeleteTarget(null);
      fetchBackups();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Backups</h1>
          <p className="text-muted-foreground text-sm mt-1">Save checkpoints of the auction state and restore to any point</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Save className="h-4 w-4" /> Create backup
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Checkpoints</CardTitle>
          <CardDescription>Each backup captures every player's sold status, team, and sold amount at that moment.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading backups…
            </div>
          ) : backups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No backups yet. Create one before making changes you might want to undo.
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b._id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.label || "Unnamed checkpoint"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(b.createdAt)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {b.playerCount} players
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" /> {b.soldCount} sold
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRestoreTarget(b)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(b)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setLabel(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="backup-label">Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="backup-label"
              placeholder="e.g. Before Round 3, After Category A"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
            />
            <p className="text-xs text-muted-foreground">
              Captures the current sold/unsold state of all {""} players in this tournament.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save checkpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert every player's sold status, team, and sold amount to the state saved in{" "}
              <strong>{restoreTarget?.label || formatDate(restoreTarget?.createdAt ?? "")}</strong>.
              Players added after this backup will be reset to unsold. This cannot be undone unless you create a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleRestore(); }} disabled={restoring}>
              {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Yes, restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              "<strong>{deleteTarget?.label || formatDate(deleteTarget?.createdAt ?? "")}</strong>" will be permanently deleted and cannot be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TournamentBackupsSection;
