import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Loader2, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "./TournamentWorkspace";
import apiConfig from "@/config/apiConfig";

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
};

interface Team {
  _id: string;
  name: string;
  remainingBudget: number;
  totalToppedUp?: number;
}

interface Topup {
  _id: string;
  teamId: string;
  teamName: string | null;
  amount: number;
  note: string | null;
  createdBy: { _id: string; name?: string; email?: string } | null;
  createdAt: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const TournamentTopUpSection = () => {
  const { tournament } = useWorkspace();
  const { toast } = useToast();
  const user = getUser();

  const [teams, setTeams] = useState<Team[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiConfig.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userId: user?._id, userRole: user?.role }),
    });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, topupsRes] = await Promise.all([
        post("/api/team/all", { touranmentId: tournament._id }),
        post("/api/team/topup-history", { touranmentId: tournament._id }),
      ]);
      const teamsData = await teamsRes.json();
      const topupsData = await topupsRes.json();
      setTeams(teamsData?.data?.[0]?.teams || []);
      setTopups(Array.isArray(topupsData?.data) ? topupsData.data : []);
    } catch {
      toast({ title: "Error", description: "Failed to load team balances", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tournament._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedTeam = teams.find((t) => t._id === selectedTeamId) || null;
  const parsedAmount = Number(amount);
  const canSubmit = selectedTeamId && Number.isInteger(parsedAmount) && parsedAmount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await post("/api/team/topup-budget", {
        teamId: selectedTeamId,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Failed to top up balance");
      toast({
        title: "Balance topped up",
        description: `${selectedTeam?.name || "Team"} credited ${parsedAmount.toLocaleString("en-IN")} pts`,
      });
      setAmount("");
      setNote("");
      fetchData();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to top up balance", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Top Up Team Balance
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Credit a team extra auction points after their owner pays you cash outside the app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New top-up</CardTitle>
          <CardDescription>Pick a team and enter how many extra points to add to their balance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topup-team">Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={loading}>
                <SelectTrigger id="topup-team">
                  <SelectValue placeholder={loading ? "Loading teams…" : "Select a team"} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name} — {t.remainingBudget.toLocaleString("en-IN")} pts remaining
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topup-amount">Extra points to add</Label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="topup-note"
              placeholder="e.g. Paid ₹500 cash on 11 Jul"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
            Top up balance
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top-up history</CardTitle>
          <CardDescription>Every manual balance credit for this tournament, most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : topups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No top-ups yet.
            </div>
          ) : (
            <div className="space-y-2">
              {topups.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.teamName || "Unknown team"}{" "}
                      <span className="text-primary font-semibold">+{t.amount.toLocaleString("en-IN")} pts</span>
                    </p>
                    {t.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.note}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(t.createdAt)}{t.createdBy?.name ? ` · by ${t.createdBy.name}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentTopUpSection;
