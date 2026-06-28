import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BidSlabEditor, BidSlab } from "@/components/auction/BidSlabEditor";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";

export interface TournamentFormData {
  name: string;
  tournamentHostId: string;
  noOfTeams: number | string;
  maxPlayersPerTeam: number | string;
  minPlayersPerTeam: number | string;
  totalBudget: number | string;
  playerCategories: string;
  categoryBasePrices: { [key: string]: string };
  bidIncrementSlabs: BidSlab[];
}

interface TournamentHost {
  _id: string;
  name: string;
  email: string;
}

export interface TournamentForForm {
  _id: string;
  name?: string;
  tournamentHostId?: { _id: string; name: string; email: string } | string;
  noOfTeams?: number;
  maxPlayersPerTeam?: number;
  minPlayersPerTeam?: number;
  totalBudget?: number;
  playerCategories?: string[];
  categoryBasePrices?: { [key: string]: number };
  bidIncrementSlabs?: BidSlab[];
}

const DEFAULT_SLABS: BidSlab[] = [
  { minBid: 0, maxBid: 499, increment: 50 },
  { minBid: 500, maxBid: null, increment: 100 },
];

const BLANK_FORM: TournamentFormData = {
  name: "", tournamentHostId: "", noOfTeams: "", maxPlayersPerTeam: "",
  minPlayersPerTeam: "", totalBudget: "", playerCategories: "",
  categoryBasePrices: {}, bidIncrementSlabs: DEFAULT_SLABS,
};

function toFormData(t: TournamentForForm): TournamentFormData {
  const basePrices: { [key: string]: string } = {};
  if (t.categoryBasePrices) {
    Object.entries(t.categoryBasePrices).forEach(([k, v]) => { basePrices[k] = String(v); });
  }
  return {
    name: t.name || "",
    tournamentHostId: typeof t.tournamentHostId === "object"
      ? (t.tournamentHostId?._id || "") : (t.tournamentHostId as string || ""),
    noOfTeams: t.noOfTeams ?? "",
    maxPlayersPerTeam: t.maxPlayersPerTeam ?? "",
    minPlayersPerTeam: t.minPlayersPerTeam ?? "",
    totalBudget: t.totalBudget ?? "",
    playerCategories: t.playerCategories?.join(", ") || "",
    categoryBasePrices: basePrices,
    bidIncrementSlabs: t.bidIncrementSlabs ?? DEFAULT_SLABS,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament?: TournamentForForm | null;
  onSuccess: () => void;
}

const TournamentFormDialog = ({ open, onOpenChange, tournament, onSuccess }: Props) => {
  const { toast } = useToast();
  const user = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const canSelectHost = user.role === "boss" || user.role === "super_user";
  const isTournamentHost = user.role === "tournament_host";

  const isEditing = !!tournament;
  const [formData, setFormData] = useState<TournamentFormData>(BLANK_FORM);
  const [hosts, setHosts] = useState<TournamentHost[]>([]);
  const [busy, setBusy] = useState(false);

  // Populate form when dialog opens
  useEffect(() => {
    if (!open) return;
    setFormData(tournament ? toFormData(tournament) : { ...BLANK_FORM, bidIncrementSlabs: [...DEFAULT_SLABS] });
  }, [open, tournament]);

  // Fetch hosts once if needed
  useEffect(() => {
    if (!open || !canSelectHost || hosts.length > 0) return;
    fetch(`${apiConfig.baseUrl}/api/tournament/hosts`, { headers: { "x-user-id": user._id } })
      .then((r) => r.json())
      .then((d) => setHosts(d.data || []))
      .catch(() => {});
  }, [open, canSelectHost]);

  const set = (field: keyof TournamentFormData, value: string) =>
    setFormData((p) => ({ ...p, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.name || !formData.noOfTeams || !formData.maxPlayersPerTeam ||
      !formData.minPlayersPerTeam || !formData.totalBudget) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (canSelectHost && !formData.tournamentHostId) {
      toast({ title: "Validation Error", description: "Please select a tournament host", variant: "destructive" });
      return;
    }

    const categories = formData.playerCategories.split(",").map((c) => c.trim()).filter(Boolean);
    const categoryBasePrices: { [k: string]: number } = {};
    for (const cat of categories) {
      const bp = formData.categoryBasePrices[cat];
      if (!bp || Number(bp) <= 0) {
        toast({ title: "Validation Error", description: `Please enter a valid base price for: ${cat}`, variant: "destructive" });
        return;
      }
      categoryBasePrices[cat] = Number(bp);
    }

    const payload: Record<string, unknown> = {
      name: formData.name,
      noOfTeams: Number(formData.noOfTeams),
      maxPlayersPerTeam: Number(formData.maxPlayersPerTeam),
      minPlayersPerTeam: Number(formData.minPlayersPerTeam),
      totalBudget: Number(formData.totalBudget),
      playerCategories: categories,
      categoryBasePrices,
      bidIncrementSlabs: formData.bidIncrementSlabs,
      userId: user._id,
      userRole: user.role,
      ...(canSelectHost && { tournamentHostId: formData.tournamentHostId }),
    };

    let url = `${apiConfig.baseUrl}/api/tournament/register`;
    if (isEditing && tournament) {
      url = `${apiConfig.baseUrl}/api/tournament/update`;
      payload.tournamentId = tournament._id;
    }

    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save tournament");
      toast({ title: "Success", description: isEditing ? "Tournament updated" : "Tournament created" });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save tournament", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Tournament" : "Create New Tournament"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the tournament details below." : "Fill in the details to create a new tournament."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="t-name">Tournament Name *</Label>
            <Input id="t-name" placeholder="e.g., IPL 2025" value={formData.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          {canSelectHost && (
            <div className="grid gap-2">
              <Label htmlFor="t-host">Tournament Host *</Label>
              <Select value={formData.tournamentHostId} onValueChange={(v) => set("tournamentHostId", v)} disabled={isEditing && isTournamentHost}>
                <SelectTrigger><SelectValue placeholder="Select tournament host" /></SelectTrigger>
                <SelectContent>
                  {hosts.map((h) => (
                    <SelectItem key={h._id} value={h._id}>{h.name} ({h.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="t-teams">Number of Teams *</Label>
              <Input id="t-teams" type="number" placeholder="e.g., 8" value={formData.noOfTeams} onChange={(e) => set("noOfTeams", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-budget">Total Budget *</Label>
              <Input id="t-budget" type="number" placeholder="e.g., 100000" value={formData.totalBudget} onChange={(e) => set("totalBudget", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="t-min">Min Players per Team *</Label>
              <Input id="t-min" type="number" placeholder="e.g., 11" value={formData.minPlayersPerTeam} onChange={(e) => set("minPlayersPerTeam", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-max">Max Players per Team *</Label>
              <Input id="t-max" type="number" placeholder="e.g., 15" value={formData.maxPlayersPerTeam} onChange={(e) => set("maxPlayersPerTeam", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="t-cats">Player Categories (comma-separated) *</Label>
            <Input
              id="t-cats"
              placeholder="e.g., Batsman, Bowler, All-rounder, Wicket-keeper"
              value={formData.playerCategories}
              onChange={(e) => {
                const cats = e.target.value;
                const list = cats.split(",").map((c) => c.trim()).filter(Boolean);
                const newPrices: { [k: string]: string } = {};
                list.forEach((c) => { newPrices[c] = formData.categoryBasePrices[c] || ""; });
                setFormData((p) => ({ ...p, playerCategories: cats, categoryBasePrices: newPrices }));
              }}
            />
            <p className="text-xs text-muted-foreground">Separate multiple categories with commas</p>
          </div>

          {formData.playerCategories.split(",").map((c) => c.trim()).filter(Boolean).length > 0 && (
            <div className="grid gap-3 p-4 border rounded-lg bg-muted/40">
              <Label className="font-semibold">Base Prices for Categories *</Label>
              <div className="grid gap-4">
                {formData.playerCategories.split(",").map((c) => c.trim()).filter(Boolean).map((cat, i) => (
                  <div key={i} className="grid gap-2">
                    <Label htmlFor={`bp-${i}`} className="text-sm font-semibold">{cat}</Label>
                    <Input
                      id={`bp-${i}`}
                      type="number"
                      placeholder="e.g., 500"
                      value={formData.categoryBasePrices[cat] || ""}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, categoryBasePrices: { ...p.categoryBasePrices, [cat]: e.target.value } }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Enter the base auction price for each category</p>
            </div>
          )}

          <div className="grid gap-3 p-4 border rounded-lg bg-muted/40">
            <Label className="font-semibold">Bid Increment Settings *</Label>
            <BidSlabEditor
              slabs={formData.bidIncrementSlabs}
              onChange={(slabs) => setFormData((p) => ({ ...p, bidIncrementSlabs: slabs }))}
            />
            <p className="text-xs text-muted-foreground">Configure bid increments for different price ranges</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : isEditing ? "Update Tournament" : "Create Tournament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TournamentFormDialog;
