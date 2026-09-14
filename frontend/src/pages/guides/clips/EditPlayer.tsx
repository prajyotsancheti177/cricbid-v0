import { ArrowUp, Check, Columns3, History, ListOrdered, Loader2, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, typed } from "../kit/timeline";
import { FakeDialog, Spotlight, WorkspaceFrame } from "../kit/primitives";

/*
 * Look-alike of pages/workspace/TournamentPlayerSheetSection.tsx.
 * All positions are absolute inside <main> (which starts at stage x=230, y=0),
 * so cursor keys can target exact cells.
 *
 * Grid: left 24 (stage 254), header top 204 (h 36), rows from 240, 36px each.
 */
const GRID_LEFT = 24;
const GRID_TOP = 204;
const ROW_H = 36;
const COLS = [
    { key: "check", label: "", width: 36 },
    { key: "sno", label: "S.No", width: 62, right: true },
    { key: "name", label: "Player", width: 200 },
    { key: "mobile", label: "Mobile", width: 124 },
    { key: "cat", label: "Category", width: 128 },
    { key: "skill", label: "Skill", width: 122 },
    { key: "age", label: "Age", width: 62, right: true },
    { key: "pay", label: "Payment", width: 132 },
] as const;

interface Row { id: string; sno: number; name: string; mobile: string; cat: string; skill: string; age: number; pending?: boolean }

const BASE: Row[] = [
    { id: "a", sno: 1, name: "Rohan Deshmukh", mobile: "9000000101", cat: "Gold", skill: "All-rounder", age: 24 },
    { id: "b", sno: 2, name: "Siddharth Patil", mobile: "9000000102", cat: "Silver", skill: "Batsman", age: 27 },
    { id: "c", sno: 3, name: "Aarav Jain", mobile: "9000000103", cat: "Platinum", skill: "Bowler", age: 22 },
    { id: "d", sno: 4, name: "Karan Shah", mobile: "9000000104", cat: "Bronze", skill: "Wicket keeper", age: 30 },
    { id: "e", sno: 5, name: "Harsh Mehta", mobile: "9000000105", cat: "Gold", skill: "Batsman", age: 26 },
    { id: "f", sno: 6, name: "Vivek Kulkarni", mobile: "9000000106", cat: "Silver", skill: "Bowler", age: 29 },
    { id: "g", sno: 7, name: "Nikhil Joshi", mobile: "9000000107", cat: "Gold", skill: "All-rounder", age: 25, pending: true },
    { id: "h", sno: 8, name: "Pranav Agarwal", mobile: "9000000108", cat: "Bronze", skill: "Batsman", age: 21 },
];
const CATEGORIES = ["Platinum", "Gold", "Silver", "Bronze"];

// ---- timeline (ms)
const T = {
    sortName: 4500,
    sortSerial: 7500,
    catOpen: 11000,
    catPick: 13200,
    clashOpen: 17000,
    clashType: 17700,
    clashEnter: 19200,
    freeOpen: 24500,
    freeType: 25200,
    freeEnter: 26500,
    photoOpen: 30000,
    photoClose: 33500,
    end: 38000,
};

const colX = (key: string) => {
    let x = GRID_LEFT;
    for (const c of COLS) { if (c.key === key) return x; x += c.width; }
    return x;
};
const colW = (key: string) => COLS.find((c) => c.key === key)!.width;
/** Stage coords of a cell centre. */
const cellCenter = (key: string, row: number) => ({ x: 230 + colX(key) + colW(key) / 2, y: GRID_TOP + ROW_H + ROW_H * row + ROW_H / 2 });

const initials = (n: string) => n.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

const Scene = ({ t }: SceneProps) => {
    // data at time t
    const rows = BASE.map((r) => {
        const next = { ...r };
        if (r.id === "b" && after(t, T.catPick)) next.cat = "Platinum";
        if (r.id === "e" && after(t, T.freeEnter)) next.sno = 9;
        return next;
    });
    const sortKey = between(t, T.sortName, T.sortSerial) ? "name" : "sno";
    const ordered = [...rows].sort((a, b) => (sortKey === "name" ? a.name.localeCompare(b.name) : a.sno - b.sno));
    const orderOf = (id: string) => ordered.findIndex((r) => r.id === id);

    const editingCat = between(t, T.catOpen, T.catPick);
    const editingSerial = between(t, T.clashOpen, T.clashEnter) ? "clash" : between(t, T.freeOpen, T.freeEnter) ? "free" : null;
    const serialDraft = editingSerial === "clash"
        ? (after(t, T.clashType) ? typed("3", t, T.clashType, 6) || "5" : "5")
        : editingSerial === "free" ? (after(t, T.freeType) ? typed("9", t, T.freeType, 6) || "5" : "5") : "";
    const serialSelected = editingSerial && serialDraft === "5";
    const saving = between(t, T.catPick, T.catPick + 900) || between(t, T.freeEnter, T.freeEnter + 900);
    const clashToast = between(t, T.clashEnter, T.clashEnter + 4300);
    const photo = between(t, T.photoOpen, T.photoClose);
    const harsh = rows.find((r) => r.id === "e")!;
    const width = COLS.reduce((s, c) => s + c.width, 0);

    return (
        <WorkspaceFrame active="Player sheet">
            <div className="absolute inset-0">
                {/* header */}
                <div className="absolute left-6 right-6 top-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Player sheet</h1>
                        <p className="mt-1 max-w-[860px] text-sm text-muted-foreground">
                            Click a cell to edit, or use the arrow keys · Enter edits and moves down · Tab moves right ·
                            Esc cancels. Changes save on their own; auction results stay read-only.
                        </p>
                    </div>
                    {saving && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> saving…</span>}
                </div>

                {/* tabs */}
                <div className="absolute left-6 right-6 top-[108px] flex gap-1 border-b border-border">
                    {[["All players", 8], ["Awaiting payment", 1], ["Verified", 7]].map(([label, count], i) => (
                        <span key={label} className={cn("-mb-px border-b-2 px-3.5 py-2 text-[13px]",
                            i === 0 ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground")}>
                            {label} <span className={cn("text-xs", i === 1 && "font-bold text-orange-500")}>{count}</span>
                        </span>
                    ))}
                </div>

                {/* toolbar */}
                <div className="absolute left-6 right-6 top-[156px] flex items-center gap-2">
                    <div className="relative flex h-9 w-[240px] items-center rounded-md border border-input pl-8 text-[13px] text-muted-foreground">
                        <Search className="absolute left-2.5 h-3.5 w-3.5" /> Search name or mobile…
                    </div>
                    <div className="flex h-9 w-[168px] items-center justify-between rounded-md border border-input px-3 text-[13px] text-muted-foreground">All categories <ChevronDown className="h-4 w-4 opacity-50" /></div>
                    <div className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input px-3 text-[13px] text-muted-foreground">All skills <ChevronDown className="h-4 w-4 opacity-50" /></div>
                    <div className="flex-1" />
                    <span className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[13px] font-medium text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /> Verify all 1 pending</span>
                    <span className="flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-[13px]"><History className="h-3.5 w-3.5" /> History</span>
                    <span className="flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-[13px]"><ListOrdered className="h-3.5 w-3.5" /> Fix serial numbers</span>
                    <span className="flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-[13px]"><Columns3 className="h-3.5 w-3.5" /> Columns <span className="text-muted-foreground">8 of 13</span></span>
                </div>

                {/* grid */}
                <div className="absolute overflow-hidden rounded-xl border border-border bg-card"
                    style={{ left: GRID_LEFT - 1, top: GRID_TOP - 1, width: width + 2, height: ROW_H * 9 + 2 }}>
                    {/* header */}
                    <div className="absolute left-0 top-0 flex h-9 bg-muted/70">
                        {COLS.map((c) => {
                            const sorted = (c.key === "sno" && sortKey === "sno") || (c.key === "name" && sortKey === "name");
                            return (
                                <div key={c.key} style={{ width: c.width }}
                                    className={cn("relative flex h-9 items-center gap-1 border-b border-r border-border px-2.5 text-[11px] font-semibold uppercase tracking-wider",
                                        c.key === "check" && "justify-center", "right" in c && c.right && "justify-end",
                                        sorted ? "text-foreground" : "text-muted-foreground")}>
                                    {c.key === "check" ? <span className="h-4 w-4 rounded-sm border border-primary" /> : <span className="truncate">{c.label}</span>}
                                    {sorted && <ArrowUp className="h-3 w-3 shrink-0" />}
                                    {c.key === "name" && <Spotlight show={between(t, T.sortName - 1000, T.sortName)} className="rounded-md" />}
                                    {c.key === "sno" && <Spotlight show={between(t, T.sortSerial - 1000, T.sortSerial)} className="rounded-md" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* rows */}
                    {rows.map((r) => {
                        const idx = orderOf(r.id);
                        return (
                            <div key={r.id} className="absolute left-0 flex transition-[top] duration-500 ease-in-out"
                                style={{ top: ROW_H + idx * ROW_H }}>
                                {COLS.map((c) => {
                                    const isCatEdit = r.id === "b" && c.key === "cat" && editingCat;
                                    const isSerialEdit = r.id === "e" && c.key === "sno" && !!editingSerial;
                                    return (
                                        <div key={c.key} style={{ width: c.width }}
                                            className={cn("relative flex h-9 min-w-0 items-center border-b border-r border-border/60 px-2.5 text-[13px]",
                                                c.key === "check" && "justify-center px-0",
                                                r.pending && "bg-orange-500/[0.06]",
                                                r.pending && c.key === "check" && "border-l-2 border-l-orange-500")}>
                                            {c.key === "check" && <span className="h-4 w-4 rounded-sm border border-primary" />}
                                            {c.key === "sno" && (isSerialEdit
                                                ? <span className="flex h-[26px] w-full items-center justify-end rounded-sm border-2 border-primary bg-background px-1.5">
                                                    <span className={cn(serialSelected && "bg-primary/40")}>{serialDraft}</span>
                                                    <span className="ml-px h-4 w-[2px] animate-pulse bg-primary" />
                                                </span>
                                                : <span className="w-full truncate text-right">{r.sno}</span>)}
                                            {c.key === "name" && (
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-muted text-[9px] font-bold">
                                                        {initials(r.name)}
                                                        {r.id === "e" && <Spotlight show={between(t, T.photoOpen - 1000, T.photoOpen)} className="rounded-full" />}
                                                    </span>
                                                    <span className="truncate font-medium">{r.name}</span>
                                                </div>
                                            )}
                                            {c.key === "mobile" && <span className="truncate">{r.mobile}</span>}
                                            {c.key === "cat" && (isCatEdit
                                                ? <span className="flex h-[26px] w-full items-center justify-between rounded-sm border-2 border-primary px-1.5">{r.cat}<ChevronDown className="h-3.5 w-3.5 opacity-50" /></span>
                                                : <span className={cn("truncate", r.id === "b" && between(t, T.catPick, T.catPick + 1500) && "font-semibold text-primary")}>{r.cat}</span>)}
                                            {c.key === "skill" && <span className="truncate">{r.skill}</span>}
                                            {c.key === "age" && <span className="w-full text-right">{r.age}</span>}
                                            {c.key === "pay" && (
                                                <span className="flex items-center gap-2">
                                                    <span className={cn("grid h-[15px] w-[15px] place-items-center rounded-[4px] border", r.pending ? "border-orange-500" : "border-emerald-600 bg-emerald-600")}>
                                                        {!r.pending && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                                                    </span>
                                                    <span className={cn("text-xs font-medium", r.pending ? "font-semibold text-orange-500" : "text-emerald-500")}>{r.pending ? "Pending" : "Verified"}</span>
                                                </span>
                                            )}
                                            {r.id === "b" && c.key === "cat" && <Spotlight show={between(t, T.catOpen - 1000, T.catOpen)} className="rounded-md" />}
                                            {r.id === "e" && c.key === "sno" && <Spotlight show={between(t, T.clashOpen - 1000, T.clashOpen) || between(t, T.freeOpen - 1000, T.freeOpen)} className="rounded-md" />}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* category dropdown (outside grid so it isn't clipped) */}
                {editingCat && (
                    <div className="absolute z-30 w-[160px] rounded-md border border-border bg-popover p-1 shadow-xl"
                        style={{ left: colX("cat"), top: GRID_TOP + ROW_H * 3 + 4 }}>
                        {CATEGORIES.map((o) => (
                            <div key={o} className={cn("flex h-8 items-center justify-between rounded px-2 text-[13px]",
                                o === "Platinum" && after(t, T.catPick - 700) ? "bg-accent text-foreground" : "text-muted-foreground")}>
                                {o}{o === "Silver" && <Check className="h-3.5 w-3.5" />}
                            </div>
                        ))}
                    </div>
                )}

                <p className="absolute text-xs text-muted-foreground" style={{ left: GRID_LEFT, top: GRID_TOP + ROW_H * 9 + 14 }}>
                    Showing 8 of 8 players · 1 awaiting payment
                </p>
            </div>

            {/* destructive toast, as the app shows it */}
            {clashToast && (
                <div className="absolute right-6 top-6 z-50 w-[380px] rounded-lg border border-destructive bg-destructive p-4 text-destructive-foreground shadow-2xl">
                    <p className="text-sm font-semibold">Serial #3 is taken</p>
                    <p className="mt-1 text-sm opacity-90">Aarav Jain already has it. Pick a different number, or clear theirs first.</p>
                </div>
            )}

            <FakeDialog show={photo} title={harsh.name} description={`#${harsh.sno} · ${harsh.cat} · ${harsh.mobile}`} width={420}>
                <div className="grid h-[300px] place-items-center rounded-lg bg-muted text-6xl font-bold text-muted-foreground">
                    {initials(harsh.name)}
                </div>
            </FakeDialog>
        </WorkspaceFrame>
    );
};

const hdrName = { x: 230 + colX("name") + 40, y: GRID_TOP + 18 };
const hdrSno = { x: 230 + colX("sno") + 24, y: GRID_TOP + 18 };
const catCell = cellCenter("cat", 1);
const serialCell = cellCenter("sno", 4);
const avatarLast = { x: 230 + colX("name") + 10 + 12, y: cellCenter("name", 7).y };
const platinumOpt = { x: 230 + colX("cat") + 80, y: GRID_TOP + ROW_H * 3 + 4 + 4 + 16 };

const guide: GuideDefinition = {
    slug: "edit-player",
    title: "Edit players in the player sheet",
    summary: "Sort the player sheet by any column and fix details right in the grid — serial numbers stay unique and every change saves on its own.",
    group: "Setup",
    audience: "Organiser",
    url: "cricbid.online/tournament/jain-unity-cup/manage/sheet",
    duration: T.end,
    steps: [
        { at: 0, title: "Open Player sheet", detail: "Every player in one grid, sorted by serial number to start." },
        { at: 3000, title: "Click a column header to sort", detail: "Click Player to sort by name, S.No to go back to auction order." },
        { at: 9500, title: "Click a cell to edit it", detail: "Pick a new category — the change saves the moment you choose." },
        { at: 15500, title: "Change a serial number", detail: "Type the new number and press Enter." },
        { at: 19200, title: "Duplicate serials are blocked", detail: "If another player already has that number, nothing is saved." },
        { at: 23500, title: "Pick a free number instead", detail: "The row saves and moves to its new place in the order." },
        { at: 29000, title: "Click the avatar to see the photo", detail: "Check the player's picture without leaving the sheet." },
        { at: 34000, title: "That's it — no Save button", detail: "Edits save as you go; use History to undo one." },
    ],
    cursor: [
        { at: 0, x: 700, y: 620 },
        { at: 3200, x: hdrName.x, y: hdrName.y },
        { at: T.sortName, x: hdrName.x, y: hdrName.y, click: true },
        { at: 6500, x: hdrSno.x, y: hdrSno.y },
        { at: T.sortSerial, x: hdrSno.x, y: hdrSno.y, click: true },
        { at: 10000, x: catCell.x, y: catCell.y },
        { at: T.catOpen, x: catCell.x, y: catCell.y, click: true },
        { at: 12500, x: platinumOpt.x, y: platinumOpt.y },
        { at: T.catPick, x: platinumOpt.x, y: platinumOpt.y, click: true },
        { at: 16000, x: serialCell.x, y: serialCell.y },
        { at: T.clashOpen, x: serialCell.x, y: serialCell.y, click: true },
        { at: T.clashEnter, x: serialCell.x + 30, y: serialCell.y + 20 },
        { at: 23800, x: serialCell.x, y: serialCell.y },
        { at: T.freeOpen, x: serialCell.x, y: serialCell.y, click: true },
        { at: T.freeEnter, x: serialCell.x + 30, y: serialCell.y + 20 },
        { at: 29200, x: avatarLast.x, y: avatarLast.y },
        { at: T.photoOpen, x: avatarLast.x, y: avatarLast.y, click: true },
        { at: T.photoClose, x: 700, y: 640 },
        { at: T.end, x: 700, y: 640 },
    ],
    Scene,
};

export default guide;
