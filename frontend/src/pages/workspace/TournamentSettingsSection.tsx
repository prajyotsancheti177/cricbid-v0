import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, RotateCcw, UsersRound, UserMinus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import TournamentFormDialog from "@/components/tournament/TournamentFormDialog";
import { useWorkspace, TournamentFeatures, isFeatureOn } from "./TournamentWorkspace";

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

const FEATURE_DEFS: { key: keyof TournamentFeatures; label: string; description: string }[] = [
  { key: "whatsappNotifications", label: "WhatsApp notifications", description: "Send players a WhatsApp message when they are sold or unsold." },
  { key: "obsOverlays", label: "OBS live streaming overlays", description: "Show overlay links for Camera HUD, fullscreen scoreboard, and split-screen layouts." },
  { key: "publicPlayerRegistration", label: "Public player registration", description: "Allow players to self-register via a shareable public link." },
  { key: "publicTeamRegistration", label: "Public team registration", description: "Allow team owners to register via a shareable public link." },
  { key: "googleSheetsSync", label: "Google Sheets sync", description: "Enable bi-directional sync between the database and a connected Google Sheet." },
  { key: "dataExport", label: "Data export (CSV & PDF)", description: "Allow downloading player and team data as CSV or PDF files." },
];

const TournamentSettingsSection = () => {
  const { tournament, reload } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pending, setPending] = useState<DangerAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);

  // Countdown timer settings (derived from tournament.features)
  const currentFeatures = (tournament.features as TournamentFeatures) ?? {};
  const [countdownEnabled, setCountdownEnabled] = useState<boolean>(currentFeatures.countdownEnabled ?? false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(currentFeatures.countdownSeconds ?? 60);
  const [savingCountdown, setSavingCountdown] = useState(false);

  const user = getUser();
  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiConfig.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const saveCountdownSettings = async (enabled: boolean, seconds: number) => {
    setSavingCountdown(true);
    const newFeatures: TournamentFeatures = { ...currentFeatures, countdownEnabled: enabled, countdownSeconds: seconds };
    try {
      const res = await post("/api/tournament/update", {
        tournamentId: tournament._id,
        userId: user?._id,
        userRole: user?.role,
        features: newFeatures,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Save failed");
      reload();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSavingCountdown(false);
    }
  };

  const toggleFeature = async (key: keyof TournamentFeatures, value: boolean) => {
    setSavingFeature(key);
    const newFeatures: TournamentFeatures = { ...(tournament.features as TournamentFeatures ?? {}), [key]: value };
    try {
      const res = await post("/api/tournament/update", {
        tournamentId: tournament._id,
        userId: user?._id,
        userRole: user?.role,
        features: newFeatures,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Save failed");
      reload();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSavingFeature(null);
    }
  };

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
          <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit details
          </Button>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Name" value={tournament.name || "—"} />
          <SummaryRow label="Total budget" value={`${(tournament.totalBudget || 0).toLocaleString()} Pts`} />
          <SummaryRow label="Teams" value={String(tournament.noOfTeams ?? "—")} />
          <SummaryRow label="Players per team" value={`${tournament.minPlayersPerTeam ?? 0} – ${tournament.maxPlayersPerTeam ?? 0}`} />
          <SummaryRow label="Categories" value={(tournament.playerCategories || []).join(", ") || "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Features</CardTitle>
          <CardDescription>Enable or disable features for this tournament. Changing a setting takes effect immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_DEFS.map(({ key, label, description }) => {
            const enabled = isFeatureOn(tournament, key);
            const saving = savingFeature === key;
            return (
              <div key={key} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor={`feature-${key}`} className="text-sm font-medium cursor-pointer">{label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Switch
                    id={`feature-${key}`}
                    checked={enabled}
                    disabled={saving}
                    onCheckedChange={(v) => toggleFeature(key, v)}
                  />
                </div>
              </div>
            );
          })}

          {/* Countdown timer — special feature with number input */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="feature-countdownEnabled" className="text-sm font-medium cursor-pointer">
                  Enable player countdown timer
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Show a countdown timer in the auction room for each player. Purely visual — the auctioneer still controls selling.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                {savingCountdown && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Switch
                  id="feature-countdownEnabled"
                  checked={countdownEnabled}
                  disabled={savingCountdown}
                  onCheckedChange={(v) => {
                    setCountdownEnabled(v);
                    saveCountdownSettings(v, countdownSeconds);
                  }}
                />
              </div>
            </div>
            {countdownEnabled && (
              <div className="mt-3 flex items-center gap-3">
                <Label htmlFor="countdownSeconds" className="text-sm text-muted-foreground whitespace-nowrap">
                  Duration (seconds)
                </Label>
                <Input
                  id="countdownSeconds"
                  type="number"
                  min={10}
                  max={300}
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                  className="w-24"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingCountdown}
                  onClick={() => saveCountdownSettings(countdownEnabled, countdownSeconds)}
                >
                  {savingCountdown ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
              </div>
            )}
          </div>
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

      <TournamentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tournament={tournament as Parameters<typeof TournamentFormDialog>[0]["tournament"]}
        onSuccess={reload}
      />
    </div>
  );
};

export default TournamentSettingsSection;
