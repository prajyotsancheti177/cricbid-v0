import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, RotateCcw, UsersRound, UserMinus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { useWorkspace } from "./TournamentWorkspace";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
};

type DangerAction = {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  run: (tournamentId: string) => Promise<Response>;
  redirectAfter?: boolean;
};

const TournamentSettingsSection = () => {
  const { tournament } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pending, setPending] = useState<DangerAction | null>(null);
  const [busy, setBusy] = useState(false);

  const user = getUser();
  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiConfig.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const actions: DangerAction[] = [
    {
      key: "reset", label: "Reset unsold players", icon: RotateCcw,
      description: "Mark all unsold players as pending again so they can re-enter the auction.",
      run: (id) => post("/api/player/reset-unsold", { touranmentId: id, userId: user?._id, userRole: user?.role }),
    },
    {
      key: "delTeams", label: "Delete all teams", icon: UsersRound,
      description: "Permanently delete every team in this tournament. Players become unassigned.",
      run: (id) => post("/api/team/delete-all", { touranmentId: id, userId: user?._id }),
    },
    {
      key: "delPlayers", label: "Delete all players", icon: UserMinus,
      description: "Permanently delete every player in this tournament.",
      run: (id) => post("/api/player/delete-all", { touranmentId: id, userId: user?._id }),
    },
    {
      key: "delTournament", label: "Delete tournament", icon: Trash2,
      description: "Permanently delete this tournament. This cannot be undone.",
      run: (id) => post("/api/tournament/delete", { tournamentId: id, userId: user?._id, userRole: user?.role }),
      redirectAfter: true,
    },
  ];

  const confirmRun = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await pending.run(tournament._id);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Action failed");
      toast({ title: "Done", description: data.message || `${pending.label} completed` });
      if (pending.redirectAfter) {
        navigate("/tournaments/manage");
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Action failed", variant: "destructive" });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Tournament configuration and danger zone</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Details</CardTitle>
            <CardDescription>Core tournament configuration.</CardDescription>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/tournaments/manage")}>
            <Pencil className="h-4 w-4" /> Edit details
          </Button>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Name" value={tournament.name || "—"} />
          <SummaryRow label="Total budget" value={`₹${(tournament.totalBudget || 0).toLocaleString()}`} />
          <SummaryRow label="Teams" value={String(tournament.noOfTeams ?? "—")} />
          <SummaryRow label="Players per team" value={`${tournament.minPlayersPerTeam ?? 0} – ${tournament.maxPlayersPerTeam ?? 0}`} />
          <SummaryRow label="Categories" value={(tournament.playerCategories || []).join(", ") || "—"} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger zone</CardTitle>
          <CardDescription>These actions are destructive and may be irreversible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.map((a) => (
            <div key={a.key} className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <a.icon className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm font-medium truncate">{a.label}</span>
              </div>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => setPending(a)}>
                Run
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.label}?</AlertDialogTitle>
            <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmRun(); }} disabled={busy} className="bg-destructive hover:bg-destructive/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TournamentSettingsSection;
