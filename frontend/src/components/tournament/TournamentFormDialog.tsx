import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, selectRecentlyInteracted } from "@/components/form/select";
import { BidSlabEditor, BidSlab } from "@/components/auction/BidSlabEditor";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { authHeaders, jsonAuthHeaders } from "@/lib/auth";
import { Plus } from "lucide-react";

/** Offered as one-tap choices when creating a tournament. */
const SUGGESTED_CATEGORIES = ["Icon", "Regular", "Marquee", "Batsman", "Bowler", "All-rounder", "Wicket keeper", "U17", "Female", "Owner"];

/** The form keeps categories as "a, b, c"; this is the list behind it. */
const categoryList = (value: string) => value.split(",").map((c) => c.trim()).filter(Boolean);

export interface TournamentFormData {
  name: string;
  tournamentHostId: string;
  noOfTeams: number | string;
  maxPlayersPerTeam: number | string;
  minPlayersPerTeam: number | string;
  totalBudget: number | string;
  auctionDate: string;
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
  auctionDate?: string | null;
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
  minPlayersPerTeam: "", totalBudget: "", auctionDate: "", playerCategories: "",
  categoryBasePrices: {}, bidIncrementSlabs: DEFAULT_SLABS,
};

// Tournament.auctionDate is stored as a full DateTime; the <input type="date">
// only wants the "yyyy-MM-dd" portion.
const toDateInputValue = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
    auctionDate: toDateInputValue(t.auctionDate),
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
    fetch(`${apiConfig.baseUrl}/api/tournament/hosts`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setHosts(d.data || []))
      .catch(() => {});
  }, [open, canSelectHost]);

  const [newCategory, setNewCategory] = useState("");
  // Categories unticked during this edit stay on screen so they can be ticked back.
  const [extraChoices, setExtraChoices] = useState<string[]>([]);
  useEffect(() => { if (open) { setNewCategory(""); setExtraChoices([]); } }, [open]);

  const selectedCategories = categoryList(formData.playerCategories);
  const categoryChoices = Array.from(new Set([
    ...selectedCategories,
    ...extraChoices,
    ...(tournament ? [] : SUGGESTED_CATEGORIES),
  ]));

  const writeCategories = (list: string[]) =>
    setFormData((p) => {
      const prices: { [k: string]: string } = {};
      list.forEach((c) => { prices[c] = p.categoryBasePrices[c] || ""; });
      return { ...p, playerCategories: list.join(", "), categoryBasePrices: prices };
    });

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setExtraChoices((x) => (x.includes(cat) ? x : [...x, cat]));
      writeCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      writeCategories([...selectedCategories, cat]);
    }
  };

  const addCategory = () => {
    // Commas would split one category into several in the stored list.
    const name = newCategory.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    if (!name) return;
    const existing = categoryChoices.find((c) => c.toLowerCase() === name.toLowerCase());
    const cat = existing || name;
    if (!selectedCategories.includes(cat)) writeCategories([...selectedCategories, cat]);
    setNewCategory("");
  };

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

    const categories = categoryList(formData.playerCategories);
    if (categories.length === 0) {
      toast({ title: "Validation Error", description: "Tick at least one player category", variant: "destructive" });
      return;
    }
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
      auctionDate: formData.auctionDate ? new Date(formData.auctionDate).toISOString() : null,
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
        headers: jsonAuthHeaders(),
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

  // A dropdown renders in a portal outside this dialog, so the click that
  // dismisses it — or a rapid second click just after it closes — can look like
  // a click outside the dialog and close the whole thing. Ignore outside
  // interactions that belong to a dropdown.
  const ignoreOutside = (e: any): boolean => {
    const t = (e?.detail?.originalEvent?.target ?? e?.target) as HTMLElement | undefined;
    return !!t?.closest?.('[data-radix-popper-content-wrapper]') || selectRecentlyInteracted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => { if (ignoreOutside(e)) e.preventDefault(); }}
        onInteractOutside={(e) => { if (ignoreOutside(e)) e.preventDefault(); }}
      >
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

          <div className="grid gap-2">
            <Label htmlFor="t-auction-date">Auction Date</Label>
            <Input
              id="t-auction-date"
              type="date"
              value={formData.auctionDate}
              onChange={(e) => set("auctionDate", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When the auction itself will be held. Separate from the tournament's created date.
            </p>
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

          <div className="grid gap-3 p-4 border rounded-lg bg-muted/40">
            <div>
              <Label className="font-semibold">Player Categories *</Label>
              <p className="text-xs text-muted-foreground">Tick the categories this tournament uses, and set a base price for each.</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categoryChoices.map((cat) => {
                const on = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                      {on && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-2.5 w-2.5"><path strokeWidth="4" d="M20 6L9 17l-5-5" /></svg>}
                    </span>
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add another category…"
                value={newCategory}
                className="h-9"
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
              />
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={addCategory} disabled={!newCategory.trim()}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {selectedCategories.length > 0 ? (
              <div className="grid gap-2 border-t pt-3">
                <Label className="text-sm font-semibold">Base price per category *</Label>
                {selectedCategories.map((cat, i) => (
                  <div key={cat} className="grid grid-cols-[1fr_140px] items-center gap-3">
                    <Label htmlFor={`bp-${i}`} className="truncate text-sm">{cat}</Label>
                    <Input
                      id={`bp-${i}`}
                      type="number"
                      placeholder="e.g., 500"
                      className="h-9"
                      value={formData.categoryBasePrices[cat] || ""}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, categoryBasePrices: { ...p.categoryBasePrices, [cat]: e.target.value } }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-destructive">Tick at least one category.</p>
            )}
          </div>

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
