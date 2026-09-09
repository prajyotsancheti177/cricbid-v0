import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/form/select";
import { useToast } from "@/hooks/use-toast";
import {
  Check, Columns3, Loader2, LockKeyhole, Search, X, Pencil, ImageIcon, RotateCcw, Download, ListOrdered, History, Undo2,
} from "lucide-react";
import apiConfig from "@/config/apiConfig";
import { useWorkspace, isFeatureOn } from "./TournamentWorkspace";
import { getDriveThumbnail } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ types */

interface SheetPlayer {
  _id: string;
  name?: string;
  age?: number | string | null;
  gender?: string | null;
  photo?: string | null;
  skill?: string | null;
  mobile?: string | number | null;
  email?: string | null;
  address?: string | null;
  playerCategory?: string | null;
  auctionSerialNumber?: number | null;
  paymentVerified?: boolean;
  sold?: boolean;
  amtSold?: number | null;
  teamName?: string | null;
  customFields?: Record<string, string> | null;
}

type ColumnKind = "text" | "number" | "select" | "readonly" | "file";

interface ColumnDef {
  key: string;
  label: string;
  group: "Player" | "Registration" | "Auction" | "Your columns";
  kind: ColumnKind;
  width: number;
  /** custom field / note columns live inside customFields */
  custom?: boolean;
  options?: string[];
  align?: "right";
}

interface HistoryBatch {
  batchId: string;
  label: string;
  at: string;
  actor: string | null;
  isUndo: boolean;
  changeCount: number;
  playerCount: number;
  sample: { playerName: string | null; field: string; oldValue: string | null; newValue: string | null }[];
}

const NOTE_IDS = ["cf_note_1", "cf_note_2", "cf_note_3"];
const MAX_NOTES = NOTE_IDS.length;

/* Always visible — the two anchors a host scans by. Both are editable: the
   serial number is what gets printed and handed to team owners, so it has to
   be correctable from here. */
const LOCKED = ["auctionSerialNumber", "name"];

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
};

const initials = (name?: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/* ------------------------------------------------------------- the section */

const TournamentPlayerSheetSection = () => {
  const { tournament } = useWorkspace();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = getUser();

  const [players, setPlayers] = useState<SheetPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [customCols, setCustomCols] = useState<ColumnDef[]>([]);

  const [tab, setTab] = useState<"all" | "pending" | "verified">("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("all");

  const [visible, setVisible] = useState<string[] | null>(null);
  const [noteLabels, setNoteLabels] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [draft, setDraft] = useState("");
  /** The focused cell when not editing — what arrow keys move around. */
  const [cursor, setCursor] = useState<{ id: string; key: string } | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string; subtitle: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resequence, setResequence] = useState<{ changes: { id: string; name: string; from: number | null; to: number }[]; total: number } | null>(null);
  const [resequencing, setResequencing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<HistoryBatch[] | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------- data loading */

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [playersRes, configRes, catRes] = await Promise.all([
          fetch(`${apiConfig.baseUrl}/api/player/all`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ touranmentId: tournament._id }),
          }),
          fetch(`${apiConfig.baseUrl}/api/tournament/${tournament._id}/registration-config`),
          fetch(`${apiConfig.baseUrl}/api/player/categories`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ touranmentId: tournament._id }),
          }),
        ]);

        const playersData = await playersRes.json();
        if (!cancelled && playersRes.ok) setPlayers(playersData.data || []);

        const configData = await configRes.json();
        const cfg = configData?.data?.registrationFormConfig;
        if (!cancelled && cfg?.customFields) {
          setCustomCols(
            cfg.customFields
              .filter((cf: { id: string }) => !NOTE_IDS.includes(cf.id))
              .map((cf: { id: string; label: string; type: string; options?: string[] }) => ({
                key: cf.id,
                label: cf.label,
                group: "Registration" as const,
                kind: cf.type === "file" ? ("file" as const)
                  : cf.type === "dropdown" ? ("select" as const)
                  : cf.type === "number" ? ("number" as const) : ("text" as const),
                width: 150,
                custom: true,
                options: cf.options,
              }))
          );
        }

        const catData = await catRes.json();
        if (!cancelled && catData?.success) setCategories(catData.data || []);
      } catch {
        if (!cancelled) toast({ title: "Error", description: "Could not load the player sheet", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tournament._id, toast]);

  /* Sheet settings live on the tournament, so they persist for everyone. */
  useEffect(() => {
    const cfg = tournament.playerSheetConfig;
    setVisible(cfg?.visibleColumns ?? null);
    setNoteLabels(cfg?.noteLabels ?? {});
  }, [tournament]);

  const persistSheetConfig = async (next: { visibleColumns?: string[]; noteLabels?: Record<string, string> }) => {
    try {
      await fetch(`${apiConfig.baseUrl}/api/tournament/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({
          tournamentId: tournament._id,
          userId: user._id,
          playerSheetConfig: {
            visibleColumns: next.visibleColumns ?? visible ?? undefined,
            noteLabels: next.noteLabels ?? noteLabels,
          },
        }),
      });
    } catch { /* a lost column preference is not worth interrupting the host */ }
  };

  /* ------------------------------------------------------------- columns */

  const columns: ColumnDef[] = useMemo(() => {
    const skills = [...new Set(players.map(p => p.skill).filter(Boolean))] as string[];
    return [
      { key: "auctionSerialNumber", label: "S.No", group: "Player", kind: "number", width: 62, align: "right" },
      { key: "name", label: "Player", group: "Player", kind: "text", width: 200 },
      { key: "mobile", label: "Mobile", group: "Registration", kind: "text", width: 124 },
      { key: "playerCategory", label: "Category", group: "Registration", kind: "select", width: 128, options: categories },
      { key: "skill", label: "Skill", group: "Registration", kind: "select", width: 122, options: skills.length ? skills : ["Batsman", "Bowler", "All-rounder", "Wicket keeper"] },
      { key: "age", label: "Age", group: "Registration", kind: "number", width: 62, align: "right" },
      { key: "gender", label: "Gender", group: "Registration", kind: "select", width: 100, options: ["Male", "Female", "Other"] },
      { key: "email", label: "Email", group: "Registration", kind: "text", width: 190 },
      { key: "address", label: "Address", group: "Registration", kind: "text", width: 190 },
      ...customCols,
      { key: "paymentVerified", label: "Payment", group: "Auction", kind: "readonly", width: 132 },
      { key: "teamName", label: "Team", group: "Auction", kind: "readonly", width: 150 },
      { key: "amtSold", label: "Sold for", group: "Auction", kind: "readonly", width: 96, align: "right" },
      ...NOTE_IDS.map((id, i) => ({
        key: id,
        label: noteLabels[id] || (i === 0 ? "Note" : `Note ${i + 1}`),
        group: "Your columns" as const,
        kind: "text" as const,
        width: 168,
        custom: true,
      })),
    ];
  }, [categories, customCols, noteLabels, players]);

  const DEFAULT_VISIBLE = useMemo(
    () => ["auctionSerialNumber", "name", "mobile", "playerCategory", "skill", "age", "paymentVerified", NOTE_IDS[0]],
    []
  );
  const visibleKeys = visible ?? DEFAULT_VISIBLE;
  const shown = columns.filter(c => LOCKED.includes(c.key) || visibleKeys.includes(c.key));

  const toggleColumn = (key: string) => {
    if (LOCKED.includes(key)) return;
    const base = visible ?? DEFAULT_VISIBLE;
    const next = base.includes(key) ? base.filter(k => k !== key) : [...base, key];
    setVisible(next);
    persistSheetConfig({ visibleColumns: next });
  };

  /* --------------------------------------------------------------- rows */

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter(p => {
      if (tab === "pending" && p.paymentVerified !== false) return false;
      if (tab === "verified" && p.paymentVerified === false) return false;
      if (categoryFilter !== "all" && (p.playerCategory || "") !== categoryFilter) return false;
      if (skillFilter !== "all" && (p.skill || "") !== skillFilter) return false;
      if (q) {
        const hay = `${p.name || ""} ${p.mobile || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [players, tab, search, categoryFilter, skillFilter]);

  const pendingCount = players.filter(p => p.paymentVerified === false).length;
  const skillOptions = [...new Set(players.map(p => p.skill).filter(Boolean))] as string[];

  /* -------------------------------------------------------------- saving */

  const valueOf = (p: SheetPlayer, col: ColumnDef): string => {
    if (col.custom) return String(p.customFields?.[col.key] ?? "");
    const v = (p as unknown as Record<string, unknown>)[col.key];
    return v === null || v === undefined ? "" : String(v);
  };

  const saveCell = async (player: SheetPlayer, col: ColumnDef, raw: string) => {
    const previous = valueOf(player, col);
    if (raw === previous) { setEditing(null); return; }

    // optimistic: the grid should feel like a spreadsheet, not a form
    setPlayers(prev => prev.map(p => {
      if (p._id !== player._id) return p;
      return col.custom
        ? { ...p, customFields: { ...(p.customFields || {}), [col.key]: raw } }
        : { ...p, [col.key]: raw };
    }));
    setEditing(null);
    setSaving(player._id);

    try {
      const body: Record<string, unknown> = { playerId: player._id, userId: user._id };
      if (col.custom) body.customFieldPatch = { [col.key]: raw };
      else body[col.key] = col.kind === "number" ? (raw === "" ? null : Number(raw)) : raw;

      const res = await fetch(`${apiConfig.baseUrl}/api/player/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Save failed");

      // Serial numbers are printed and handed out, so a duplicate is worth
      // saying out loud — but it is the host's call, so the save still stands.
      if (col.key === "auctionSerialNumber" && raw !== "") {
        const clash = players.find(o => o._id !== player._id && String(o.auctionSerialNumber ?? "") === raw);
        if (clash) {
          toast({
            title: `Serial ${raw} is now used twice`,
            description: `${player.name} and ${clash.name} both have #${raw}.`,
          });
        }
      }
    } catch (e) {
      // put the old value back rather than leaving a lie on screen
      setPlayers(prev => prev.map(p => {
        if (p._id !== player._id) return p;
        return col.custom
          ? { ...p, customFields: { ...(p.customFields || {}), [col.key]: previous } }
          : { ...p, [col.key]: previous };
      }));
      toast({
        title: "Not saved",
        description: e instanceof Error ? e.message : "That change did not save",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const setVerified = async (ids: string[], verified: boolean, all = false) => {
    if (!all && ids.length === 0) return;
    setVerifying(true);
    const affected = all ? players.filter(p => p.paymentVerified === false).map(p => p._id) : ids;
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/verify-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({ touranmentId: tournament._id, playerIds: ids, verified, all }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not update");
      setPlayers(prev => prev.map(p => affected.includes(p._id) ? { ...p, paymentVerified: verified } : p));
      setSelected(new Set());
      toast({ title: verified ? "Payment verified" : "Moved back to pending", description: data.message });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not update", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const askResequence = async () => {
    setResequencing(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/resequence-serials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({ touranmentId: tournament._id, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not work out the new numbering");
      setResequence(data.data);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not check the numbering", variant: "destructive" });
    } finally {
      setResequencing(false);
    }
  };

  const applyResequence = async () => {
    setResequencing(true);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/resequence-serials`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({ touranmentId: tournament._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not renumber");
      const byId = new Map((data.data?.changes || []).map((c: { id: string; to: number }) => [c.id, c.to]));
      setPlayers(prev => prev.map(p => byId.has(p._id) ? { ...p, auctionSerialNumber: byId.get(p._id) as number } : p));
      setResequence(null);
      toast({ title: "Serial numbers updated", description: data.message });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not renumber", variant: "destructive" });
    } finally {
      setResequencing(false);
    }
  };

  const loadHistory = async () => {
    setHistoryOpen(true);
    setHistoryBatches(null);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({ touranmentId: tournament._id, userId: user._id, limit: 40 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not load history");
      setHistoryBatches(data.data || []);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not load history", variant: "destructive" });
      setHistoryBatches([]);
    }
  };

  /** Undo one action, or everything after it. */
  const undo = async (batch: HistoryBatch, mode: "one" | "since") => {
    setUndoing(batch.batchId);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/api/player/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user._id },
        body: JSON.stringify({
          touranmentId: tournament._id,
          userId: user._id,
          ...(mode === "one" ? { batchId: batch.batchId } : { until: batch.at }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not undo");

      // the grid is now stale — reload rather than guess at the reverted values
      const fresh = await fetch(`${apiConfig.baseUrl}/api/player/all`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touranmentId: tournament._id }),
      });
      const freshData = await fresh.json();
      if (fresh.ok) setPlayers(freshData.data || []);

      toast({ title: "Undone", description: data.message });
      loadHistory();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not undo", variant: "destructive" });
    } finally {
      setUndoing(null);
    }
  };

  const renameNote = (id: string, label: string) => {
    const next = { ...noteLabels, [id]: label };
    setNoteLabels(next);
    persistSheetConfig({ noteLabels: next });
  };

  /* ---------------------------------------------------------- navigation */

  const editableKeys = shown.filter(c => c.kind !== "readonly" && c.kind !== "file").map(c => c.key);

  /** Move the cursor by rows/columns, skipping columns that cannot be edited. */
  const moveCursor = (from: { id: string; key: string }, dRow: number, dCol: number) => {
    const rowIndex = rows.findIndex(r => r._id === from.id);
    const colIndex = editableKeys.indexOf(from.key);
    if (rowIndex < 0) return;

    const nextRow = Math.min(Math.max(rowIndex + dRow, 0), rows.length - 1);
    let nextCol = colIndex;
    if (dCol) {
      nextCol = colIndex + dCol;
      // Tab past the last column wraps to the start of the next row, as in Sheets
      if (nextCol >= editableKeys.length) { nextCol = 0; }
      else if (nextCol < 0) { nextCol = editableKeys.length - 1; }
    }
    const target = { id: rows[nextRow]._id, key: editableKeys[Math.max(0, nextCol)] };
    setCursor(target);
    setEditing(null);
  };

  /**
   * Keys on the grid. Typing straight into a focused cell starts an edit with
   * that character, which is the behaviour anyone coming from Sheets expects.
   */
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (!cursor || editing) return;
    const player = rows.find(r => r._id === cursor.id);
    const col = shown.find(c => c.key === cursor.key);
    if (!player || !col) return;

    const startEditing = (initial?: string) => {
      setDraft(initial ?? valueOf(player, col));
      setEditing({ id: player._id, key: col.key });
    };

    switch (e.key) {
      case "ArrowDown":  e.preventDefault(); moveCursor(cursor, 1, 0); return;
      case "ArrowUp":    e.preventDefault(); moveCursor(cursor, -1, 0); return;
      case "ArrowRight": e.preventDefault(); moveCursor(cursor, 0, 1); return;
      case "ArrowLeft":  e.preventDefault(); moveCursor(cursor, 0, -1); return;
      case "Tab":        e.preventDefault(); moveCursor(cursor, 0, e.shiftKey ? -1 : 1); return;
      case "Enter":      e.preventDefault(); startEditing(); return;
      case "F2":         e.preventDefault(); startEditing(); return;
      case "Backspace":
      case "Delete":     e.preventDefault(); saveCell(player, col, ""); return;
      default:
        // a printable character replaces the cell, like typing over a selection
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          startEditing(e.key);
        }
    }
  };

  /** After an edit, Enter goes down and Tab goes right — never just stops. */
  const commitAndMove = (player: SheetPlayer, col: ColumnDef, value: string, dRow: number, dCol: number) => {
    saveCell(player, col, value);
    moveCursor({ id: player._id, key: col.key }, dRow, dCol);
  };

  /* --------------------------------------------------------------- cells */

  const isCellEditing = (id: string, key: string) => editing?.id === id && editing?.key === key;

  const renderCell = (p: SheetPlayer, col: ColumnDef) => {
    const isEditing = editing?.id === p._id && editing?.key === col.key;

    if (col.key === "name") {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreview({
                url: p.photo ? getDriveThumbnail(p.photo) : "",
                title: p.name || "Player",
                subtitle: `#${p.auctionSerialNumber ?? "—"} · ${p.playerCategory || "No category"} · ${p.mobile || "No mobile"}`,
              });
            }}
            title="View photo"
            className="h-6 w-6 rounded-full overflow-hidden shrink-0 border border-border bg-muted grid place-items-center text-[9px] font-bold hover:ring-2 hover:ring-primary transition-shadow"
          >
            {p.photo
              ? <img src={getDriveThumbnail(p.photo)} alt="" className="h-full w-full object-cover"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              : initials(p.name)}
          </button>
          {isEditing
            ? <input ref={inputRef} autoFocus className="h-[26px] w-full bg-background border-2 border-primary rounded-sm px-1.5 text-[13px] outline-none"
                     value={draft} onChange={e => setDraft(e.target.value)}
                     onBlur={() => saveCell(p, col, draft)}
                     onKeyDown={e => {
                       if (e.key === "Enter") { e.preventDefault(); commitAndMove(p, col, draft, 1, 0); }
                       if (e.key === "Tab") { e.preventDefault(); commitAndMove(p, col, draft, 0, e.shiftKey ? -1 : 1); }
                       if (e.key === "Escape") { setEditing(null); setCursor({ id: p._id, key: col.key }); }
                     }} />
            : <span className="truncate font-medium">{p.name}</span>}
        </div>
      );
    }

    if (col.key === "paymentVerified") {
      const verified = p.paymentVerified !== false;
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setVerified([p._id], !verified); }}
          disabled={verifying}
          className="flex items-center gap-2 group"
          title={verified ? "Click to move back to pending" : "Click to verify payment"}
        >
          <span className={cn("h-[15px] w-[15px] rounded-[4px] grid place-items-center shrink-0 border",
            verified ? "bg-emerald-600 border-emerald-600" : "border-orange-500")}>
            {verified && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
          </span>
          <span className={cn("text-xs font-medium", verified ? "text-emerald-500" : "text-orange-500 font-semibold")}>
            {verified ? "Verified" : "Pending"}
          </span>
        </button>
      );
    }

    if (col.kind === "file") {
      const url = p.customFields?.[col.key];
      if (!url) return <span className="text-muted-foreground/60 text-xs italic">Not uploaded</span>;
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPreview({
              url,
              title: `${col.label} — ${p.name}`,
              subtitle: `#${p.auctionSerialNumber ?? "—"} · ${p.mobile || "No mobile"}`,
            });
          }}
          className="text-primary text-xs hover:underline flex items-center gap-1.5"
        >
          <ImageIcon className="h-3.5 w-3.5" /> View
        </button>
      );
    }

    if (col.kind === "readonly") {
      const v = valueOf(p, col);
      return (
        <span className={cn("truncate", col.align === "right" && "w-full text-right", "text-muted-foreground")}>
          {col.key === "amtSold" && v ? `${v} Pts` : v || "—"}
        </span>
      );
    }

    if (isEditing) {
      if (col.kind === "select") {
        return (
          <Select
            defaultOpen
            value={draft}
            onValueChange={(v) => { setDraft(v); saveCell(p, col, v); }}
          >
            <SelectTrigger className="h-[26px] border-2 border-primary rounded-sm px-1.5 text-[13px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(col.options || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      }
      return (
        <input ref={inputRef} autoFocus
          type={col.kind === "number" ? "number" : "text"}
          className="h-[26px] w-full bg-background border-2 border-primary rounded-sm px-1.5 text-[13px] outline-none"
          value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={() => saveCell(p, col, draft)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commitAndMove(p, col, draft, 1, 0); }
            if (e.key === "Tab") { e.preventDefault(); commitAndMove(p, col, draft, 0, e.shiftKey ? -1 : 1); }
            if (e.key === "Escape") { setEditing(null); setCursor({ id: p._id, key: col.key }); }
          }} />
      );
    }

    const v = valueOf(p, col);
    return (
      <span className={cn("truncate w-full", col.align === "right" && "text-right",
        !v && "text-muted-foreground/40", col.group === "Your columns" && "text-muted-foreground")}>
        {v || "—"}
      </span>
    );
  };

  /* ---------------------------------------------------------------- view */

  if (!isFeatureOn(tournament, "dataExport")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Player sheet</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockKeyhole className="h-4 w-4 shrink-0" />
          <span>Data export is disabled for this tournament.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => navigate("../settings")}>Enable in Settings</Button>
        </div>
      </div>
    );
  }

  const gridTemplate = `36px ${shown.map(c => `${c.width}px`).join(" ")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Player sheet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Click a cell to edit, or use the arrow keys · Enter edits and moves down · Tab moves right ·
            Esc cancels. Changes save on their own; auction results stay read-only.
          </p>
        </div>
        {saving && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> saving…</span>}
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          ["all", `All players`, players.length],
          ["pending", "Awaiting payment", pendingCount],
          ["verified", "Verified", players.length - pendingCount],
        ] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("px-3.5 py-2 text-[13px] -mb-px border-b-2 transition-colors",
              tab === key ? "border-primary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}{" "}
            <span className={cn("text-xs", key === "pending" && count > 0 && "text-orange-500 font-bold")}>{count}</span>
          </button>
        ))}
      </div>

      {/* toolbar / bulk bar */}
      {selected.size > 0 ? (
        <div className="h-12 rounded-lg border border-primary bg-primary/10 flex items-center px-3 gap-3">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  disabled={verifying} onClick={() => setVerified([...selected], true)}>
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            Verify payment for {selected.size}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={verifying}
                  onClick={() => setVerified([...selected], false)}>
            <RotateCcw className="h-3.5 w-3.5" /> Mark pending
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-[240px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-[11px] text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
                   placeholder="Search name or mobile…" className="h-9 pl-8 text-[13px]" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-[168px] text-[13px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="h-9 w-[150px] text-[13px]"><SelectValue placeholder="Skill" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All skills</SelectItem>
              {skillOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || categoryFilter !== "all" || skillFilter !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground"
                    onClick={() => { setSearch(""); setCategoryFilter("all"); setSkillFilter("all"); }}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}

          <div className="flex-1" />

          {pendingCount > 0 && (
            <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    disabled={verifying} onClick={() => setVerified([], true, true)}>
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              Verify all {pendingCount} pending
            </Button>
          )}

          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={loadHistory} title="See and undo recent changes">
            <History className="h-3.5 w-3.5" />
            History
          </Button>

          <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={resequencing}
                  onClick={askResequence} title="Close gaps left by deleted players">
            {resequencing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListOrdered className="h-3.5 w-3.5" />}
            Fix serial numbers
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Columns3 className="h-3.5 w-3.5" />
                Columns <span className="text-muted-foreground">{shown.length} of {columns.length}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[290px] p-2 max-h-[420px] overflow-y-auto">
              {(["Player", "Registration", "Auction", "Your columns"] as const).map(group => {
                const inGroup = columns.filter(c => c.group === group);
                if (!inGroup.length) return null;
                return (
                  <div key={group}>
                    <p className="px-2 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</p>
                    {inGroup.map(col => {
                      const locked = LOCKED.includes(col.key);
                      const isNote = NOTE_IDS.includes(col.key);
                      return (
                        <div key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60">
                          <Checkbox checked={locked || visibleKeys.includes(col.key)} disabled={locked}
                                    onCheckedChange={() => toggleColumn(col.key)} />
                          {isNote ? (
                            <input
                              className="flex-1 bg-transparent text-[13px] outline-none focus:bg-muted rounded px-1 -mx-1"
                              defaultValue={col.label}
                              onBlur={(e) => renameNote(col.key, e.target.value.trim() || col.label)}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            />
                          ) : (
                            <span className="flex-1 text-[13px]">{col.label}</span>
                          )}
                          {locked && <span className="text-[10px] text-muted-foreground">locked</span>}
                          {isNote && <Pencil className="h-3 w-3 text-muted-foreground/60" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <p className="px-2 pt-2 pb-1 text-[11px] text-muted-foreground border-t border-border mt-2">
                {MAX_NOTES} note columns are yours — tick one and rename it.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* grid */}
      {loading ? (
        <div className="h-[420px] grid place-items-center border border-border rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="h-[300px] grid place-items-center border border-border rounded-xl text-sm text-muted-foreground">
          {players.length === 0 ? "No players registered yet." : "No players match these filters."}
        </div>
      ) : (
        <div
          className="border border-border rounded-xl overflow-auto bg-card max-h-[calc(100vh-330px)] focus:outline-none"
          tabIndex={0}
          onKeyDown={onGridKeyDown}
        >
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, minWidth: "fit-content" }}>
            {/* header */}
            <div className="sticky top-0 z-20 bg-muted/70 backdrop-blur border-b border-r border-border h-9 grid place-items-center">
              <Checkbox
                checked={rows.length > 0 && rows.every(r => selected.has(r._id))}
                onCheckedChange={(c) => setSelected(c ? new Set(rows.map(r => r._id)) : new Set())}
              />
            </div>
            {shown.map(col => (
              <div key={col.key}
                   className={cn("sticky top-0 z-20 bg-muted/70 backdrop-blur border-b border-r border-border h-9 flex items-center px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                     col.align === "right" && "justify-end", col.group === "Your columns" && "text-primary")}>
                {col.label}
              </div>
            ))}

            {/* rows */}
            {rows.map(p => {
              const pending = p.paymentVerified === false;
              return (
                <div key={p._id} className="contents group">
                  <div className={cn("border-b border-r border-border/60 h-9 grid place-items-center",
                    pending && "bg-orange-500/[0.06] border-l-2 border-l-orange-500",
                    selected.has(p._id) && "bg-primary/10")}>
                    <Checkbox checked={selected.has(p._id)} onCheckedChange={(c) => {
                      setSelected(prev => { const n = new Set(prev); c ? n.add(p._id) : n.delete(p._id); return n; });
                    }} />
                  </div>
                  {shown.map(col => {
                    const editable = col.kind !== "readonly" && col.kind !== "file";
                    return (
                      <div key={col.key}
                        onClick={() => {
                          if (!editable) return;
                          setCursor({ id: p._id, key: col.key });
                          setDraft(valueOf(p, col));
                          setEditing({ id: p._id, key: col.key });
                        }}
                        className={cn("border-b border-r border-border/60 h-9 flex items-center px-2.5 text-[13px] min-w-0 relative",
                          editable && "cursor-text hover:bg-muted/40",
                          pending && "bg-orange-500/[0.06]",
                          selected.has(p._id) && "bg-primary/10",
                          cursor?.id === p._id && cursor?.key === col.key && !isCellEditing(p._id, col.key) &&
                            "ring-2 ring-inset ring-primary z-10")}>
                        {renderCell(p, col)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {players.length} players{pendingCount > 0 && ` · ${pendingCount} awaiting payment`}
      </p>

      {/* history — every action, newest first, each undoable */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogTitle>Change history</DialogTitle>
          <p className="text-sm text-muted-foreground -mt-2">
            Every edit, verification and renumber, newest first. Undo one on its own, or roll everything
            back to just before it.
          </p>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {historyBatches === null ? (
              <div className="h-40 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : historyBatches.length === 0 ? (
              <div className="h-40 grid place-items-center text-sm text-muted-foreground text-center px-8">
                Nothing recorded yet. Changes made from here on will appear, ready to undo.
              </div>
            ) : (
              <div className="space-y-2">
                {historyBatches.map(b => (
                  <div key={b.batchId} className="border border-border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium flex items-center gap-2">
                          {b.isUndo && <Undo2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="truncate">{b.label}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(b.at).toLocaleString("en-IN")}
                          {b.actor && ` · ${b.actor}`}
                          {` · ${b.playerCount} player${b.playerCount === 1 ? "" : "s"}`}
                        </p>
                        <div className="mt-1.5 space-y-0.5">
                          {b.sample.map((c, i) => (
                            <p key={i} className="text-xs text-muted-foreground/80 truncate">
                              <span className="text-foreground/70">{c.playerName}</span>{" "}
                              {c.field}: <span className="line-through">{c.oldValue ?? "empty"}</span> → {c.newValue ?? "empty"}
                            </p>
                          ))}
                          {b.changeCount > b.sample.length && (
                            <p className="text-xs text-muted-foreground/60">+ {b.changeCount - b.sample.length} more</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                disabled={!!undoing} onClick={() => undo(b, "one")}>
                          {undoing === b.batchId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                          Undo this
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                                disabled={!!undoing} onClick={() => undo(b, "since")}>
                          Back to here
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* renumbering asks first, and shows exactly what moves */}
      <Dialog open={!!resequence} onOpenChange={() => setResequence(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Fix serial numbers</DialogTitle>
          {resequence && resequence.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to do — the {resequence.total} players are already numbered 1 to {resequence.total} with no gaps.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Renumbers everyone 1 to {resequence?.total} in their current order, closing gaps left by deleted
                players. <span className="text-foreground font-medium">{resequence?.changes.length} players move.</span>
              </p>
              <div className="max-h-[280px] overflow-y-auto border border-border rounded-lg divide-y divide-border/60">
                {resequence?.changes.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-1.5 text-[13px]">
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground tabular-nums">#{c.from ?? "—"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold tabular-nums w-8 text-right">#{c.to}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Serial numbers are printed and handed out — if you have already shared a list, share the updated one.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResequence(null)}>Cancel</Button>
                <Button onClick={applyResequence} disabled={resequencing} className="gap-1.5">
                  {resequencing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Renumber {resequence?.changes.length} players
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* image preview — screenshots open here rather than downloading */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">{preview?.title}</DialogTitle>
          {preview?.url ? (
            <img src={preview.url} alt={preview.title}
                 className="w-full max-h-[70vh] object-contain bg-black" />
          ) : (
            <div className="h-56 grid place-items-center text-muted-foreground text-sm">Nothing uploaded</div>
          )}
          <div className="p-4 border-t border-border flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{preview?.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{preview?.subtitle}</p>
            </div>
            {preview?.url && (
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                {/* uploads are served as octet-stream, so this saves the file */}
                <a href={preview.url} target="_blank" rel="noreferrer">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default TournamentPlayerSheetSection;
