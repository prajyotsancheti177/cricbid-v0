import { ArrowRight, Check, ChevronDown, Coins, Trash2, Wallet } from "lucide-react";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, ease, lerp, progress, typed } from "../kit/timeline";
import { FakeButton, FakeInput, FakeToast, Spotlight, WorkspaceFrame } from "../kit/primitives";
import { TEAMS } from "@/pages/demo/demoData";
import { cn } from "@/lib/utils";

/*
 * Real product facts this clip follows (TournamentTopUpSection + teamService):
 * - Fields: Team (select, shows "<name> — N pts remaining"), "Extra points to add"
 *   (positive whole number), optional Note. Button "Top up balance".
 * - Each top-up is a logged row (amount, note, who, when) in "Top-up history";
 *   the bin icon deletes it and takes the points back off.
 * - remainingBudget = tournament budget + total topped up − spent, and
 *   max bid = remaining − minBasePrice × (minPlayers − bought − 1),
 *   so the reserve is unchanged and max bid rises by the full top-up.
 */

const AMOUNT = 5000;
const NOTE = "Paid ₹500 cash on 11 Jul";
const MIN_BASE = 1500;
const MIN_PLAYERS = 11;
const NEXT_BID = 4000;

// Teams: remaining purse and players bought
const ROSTER = [
    { ...TEAMS[0], remaining: 14600, bought: 6 },
    { ...TEAMS[1], remaining: 8200, bought: 7 },
    { ...TEAMS[2], remaining: 11900, bought: 6 },
    { ...TEAMS[5], remaining: 9800, bought: 7 },
];
const TARGET = 1; // Lumen
const maxBid = (remaining: number, bought: number) =>
    Math.max(0, remaining - MIN_BASE * Math.max(0, MIN_PLAYERS - bought - 1));

// Timeline (ms)
const T_OPEN = 3500;
const T_PICK = 6300;
const T_AMOUNT = 8500;
const T_NOTE = 12500;
const T_SUBMIT = 17500;
const T_AUCTION = 23000;
const T_RISE = 25000;
const DURATION = 32000;

// Stage coordinates (workspace main starts at x=230)
const SELECT = { x: 519, y: 246 };
const OPTION = (i: number) => ({ x: 519, y: 276 + 40 * i + 20 });
const AMOUNT_IN = { x: 990, y: 246 };
const NOTE_IN = { x: 755, y: 336 };
const SUBMIT_BTN = { x: 379, y: 400 };

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

const TopUpScreen = ({ t }: SceneProps) => {
    const done = after(t, T_SUBMIT + 400);
    const open = between(t, T_OPEN, T_PICK);
    const picked = after(t, T_PICK);
    const lumen = ROSTER[TARGET];
    const amount = done ? "" : typed(String(AMOUNT), t, T_AMOUNT + 400, 8);
    const note = done ? "" : typed(NOTE, t, T_NOTE + 400, 20);

    return (
        <WorkspaceFrame active="Top up balance">
            <div className="absolute inset-0">
                <div className="absolute" style={{ left: 40, top: 32 }}>
                    <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet className="h-6 w-6 text-primary" /> Top Up Team Balance</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Credit a team extra auction points after their owner pays you cash outside the app.</p>
                </div>

                <div className="absolute rounded-xl border border-border bg-card" style={{ left: 40, width: 970, top: 110, height: 330 }} />
                <p className="absolute text-lg font-semibold" style={{ left: 64, top: 128 }}>New top-up</p>
                <p className="absolute text-sm text-muted-foreground" style={{ left: 64, top: 158 }}>Pick a team and enter how many extra points to add to their balance.</p>

                <div className="absolute z-30" style={{ left: 64, width: 450, top: 200 }}>
                    <span className="mb-1.5 block text-sm font-medium">Team</span>
                    <div className={cn("relative flex h-11 items-center justify-between rounded-md border bg-background px-3 text-[15px]",
                        open ? "border-primary ring-2 ring-primary/30" : "border-input")}>
                        <span className={picked ? "" : "text-muted-foreground"}>
                            {picked ? `${lumen.name} — ${fmt(lumen.remaining + (done ? AMOUNT : 0))} pts remaining` : "Select a team"}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-60" />
                        <Spotlight show={between(t, 2500, T_OPEN + 100)} />
                    </div>
                    {open && (
                        <div className="absolute left-0 right-0 rounded-md border border-border bg-popover p-1 shadow-xl" style={{ top: 72 }}>
                            {ROSTER.map((team, i) => (
                                <div key={team.name} className={cn("flex h-10 items-center justify-between rounded px-3 text-[15px]",
                                    i === TARGET && t > 5200 ? "bg-primary/15 text-foreground" : "text-muted-foreground")}>
                                    {team.name} — {fmt(team.remaining)} pts remaining
                                    {i === TARGET && t > 5200 && <Check className="h-4 w-4 text-primary" />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="absolute" style={{ left: 534, width: 452, top: 200 }}>
                    <FakeInput label="Extra points to add" value={amount} placeholder="e.g. 5000" focused={between(t, T_AMOUNT, T_NOTE)} />
                    <Spotlight show={between(t, 7400, T_AMOUNT + 100)} />
                </div>
                <div className="absolute" style={{ left: 64, width: 922, top: 290 }}>
                    <FakeInput label="Note (optional)" value={note} placeholder="e.g. Paid ₹500 cash on 11 Jul" focused={between(t, T_NOTE, T_SUBMIT)} />
                </div>
                <div className="absolute" style={{ left: 64, top: 380 }}>
                    <div className="relative">
                        <FakeButton pressed={between(t, T_SUBMIT, T_SUBMIT + 350)} className="w-[170px]">
                            <Coins className="h-4 w-4" /> Top up balance
                        </FakeButton>
                        <Spotlight show={between(t, 16200, T_SUBMIT + 100)} />
                    </div>
                </div>

                <div className="absolute rounded-xl border border-border bg-card" style={{ left: 40, width: 970, top: 470, height: 200 }} />
                <p className="absolute text-lg font-semibold" style={{ left: 64, top: 488 }}>Top-up history</p>
                <p className="absolute text-sm text-muted-foreground" style={{ left: 64, top: 518 }}>Every manual balance credit for this tournament, most recent first.</p>
                {done ? (
                    <div className="absolute flex items-center justify-between gap-3 rounded-lg border border-border px-4" style={{ left: 64, width: 922, top: 556, height: 76 }}>
                        <div>
                            <p className="text-sm font-medium">{lumen.name} <span className="font-semibold text-primary">+{fmt(AMOUNT)} pts</span></p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{NOTE}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">11 Jul 2026, 07:42 pm · by Youthika Sports</p>
                        </div>
                        <span className="flex h-9 w-9 items-center justify-center text-destructive"><Trash2 className="h-4 w-4" /></span>
                    </div>
                ) : (
                    <p className="absolute text-center text-sm text-muted-foreground" style={{ left: 64, width: 922, top: 580 }}>No top-ups yet.</p>
                )}
            </div>
            <FakeToast show={between(t, T_SUBMIT + 400, T_AUCTION - 300)} title="Balance topped up" description={`${lumen.name} credited ${fmt(AMOUNT)} pts`} />
        </WorkspaceFrame>
    );
};

const AuctionScreen = ({ t }: SceneProps) => {
    const p = ease(progress(t, T_RISE, T_RISE + 1500));
    return (
        <div className="relative flex h-full w-full gap-8 bg-background p-10 text-foreground">
            {/* Before / after purse for the topped-up team */}
            <div className="flex w-[640px] flex-col gap-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Auction room · live</p>
                <div className="flex items-center gap-4">
                    <img src={ROSTER[TARGET].logo} alt="" className="h-16 w-16 rounded-full object-cover" />
                    <div>
                        <p className="text-3xl font-black">{ROSTER[TARGET].name}</p>
                        <p className="text-muted-foreground">{ROSTER[TARGET].bought} players bought · min squad {MIN_PLAYERS}</p>
                    </div>
                </div>
                {[
                    { label: "Remaining purse", before: ROSTER[TARGET].remaining, after: ROSTER[TARGET].remaining + AMOUNT },
                    { label: "Max bid amount", before: maxBid(ROSTER[TARGET].remaining, ROSTER[TARGET].bought), after: maxBid(ROSTER[TARGET].remaining + AMOUNT, ROSTER[TARGET].bought) },
                ].map((row) => (
                    <div key={row.label} className="rounded-xl border border-border bg-card p-5">
                        <p className="text-sm text-muted-foreground">{row.label}</p>
                        <div className="mt-2 flex items-center gap-4 text-3xl font-black tabular-nums">
                            <span className="text-muted-foreground line-through decoration-2">{fmt(row.before)}</span>
                            <ArrowRight className="h-6 w-6 text-primary" />
                            <span className="text-primary">{fmt(lerp(row.before, row.after, p))} Pts</span>
                        </div>
                    </div>
                ))}
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Reserved for empty slots stays {fmt(MIN_BASE)} × {MIN_PLAYERS - ROSTER[TARGET].bought - 1} = {fmt(MIN_BASE * (MIN_PLAYERS - ROSTER[TARGET].bought - 1))} Pts,
                    so the whole +{fmt(AMOUNT)} is biddable. Next bid: <span className="font-semibold text-foreground">{fmt(NEXT_BID)} Pts</span>.
                </div>
            </div>

            {/* Look-alike of components/auction/TeamBudgetPanel (desktop) */}
            <div className="flex w-[460px] shrink-0 flex-col self-start overflow-hidden rounded-2xl border-2 border-border bg-card/80">
                <div className="border-b border-border bg-muted/30 px-3 py-2">
                    <h3 className="text-center text-sm font-bold uppercase tracking-wide">Max Bid Amount</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2">
                    {ROSTER.map((team, i) => {
                        const remaining = team.remaining + (i === TARGET ? AMOUNT * p : 0);
                        const max = maxBid(remaining, team.bought);
                        const warn = max < NEXT_BID;
                        const slots = 15 - team.bought;
                        return (
                            <div key={team.name} className={cn("relative flex items-center gap-2 rounded-xl border px-2.5 py-2.5",
                                warn ? "border-red-500/60 bg-red-500/10" : "border-border/50 bg-background/40")}>
                                <img src={team.logo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                                <div className="min-w-0 flex-1">
                                    <p className="mb-0.5 text-xs font-bold leading-tight">{team.name}</p>
                                    <p className={cn("text-sm font-black tabular-nums", warn ? "text-red-400" : "text-secondary")}>{fmt(max)} Pts</p>
                                </div>
                                <div className="shrink-0 rounded-lg bg-muted/40 px-2 py-1 text-center text-muted-foreground">
                                    <p className="text-base font-black leading-none tabular-nums">{slots}</p>
                                    <p className="mt-0.5 text-[9px] font-medium leading-tight">slots</p>
                                </div>
                                {i === TARGET && <Spotlight show={after(t, T_RISE + 1600)} />}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const Scene = ({ t }: SceneProps) => (t < T_AUCTION ? <TopUpScreen t={t} /> : <AuctionScreen t={t} />);

const guide: GuideDefinition = {
    slug: "top-up-budget",
    title: "Top up a team's budget",
    summary: "Credit a team extra points from Top up balance — the credit is logged with a note, and their remaining purse and max bid rise by the same amount in the live auction.",
    group: "Auction night",
    audience: "Organiser",
    url: "cricbid.online/tournament/6650c1f2a9e4b7d3c8f01a2b/manage/top-up",
    duration: DURATION,
    steps: [
        { at: 0, title: "Open Top up balance", detail: "Use it when an owner pays you for extra points outside the app." },
        { at: 2500, title: "Pick the team", detail: "Each option shows how many points that team has left." },
        { at: 7200, title: "Enter the extra points", detail: "A positive whole number, added on top of their balance." },
        { at: 11800, title: "Add a note for the record", detail: "Optional — it shows in the top-up history." },
        { at: 16000, title: "Click Top up balance", detail: "It's logged with your name; the bin icon reverses it." },
        { at: T_AUCTION, title: "Watch their max bid rise", detail: "The slot reserve doesn't change, so the full top-up is biddable." },
    ],
    cursor: [
        { at: 0, x: 760, y: 560 },
        { at: 2900, x: SELECT.x, y: SELECT.y },
        { at: T_OPEN, x: SELECT.x, y: SELECT.y, click: true },
        { at: 5200, x: OPTION(TARGET).x, y: OPTION(TARGET).y },
        { at: T_PICK, x: OPTION(TARGET).x, y: OPTION(TARGET).y, click: true },
        { at: 7800, x: AMOUNT_IN.x, y: AMOUNT_IN.y },
        { at: T_AMOUNT, x: AMOUNT_IN.x, y: AMOUNT_IN.y, click: true },
        { at: 12000, x: NOTE_IN.x, y: NOTE_IN.y },
        { at: T_NOTE, x: NOTE_IN.x, y: NOTE_IN.y, click: true },
        { at: 16600, x: SUBMIT_BTN.x, y: SUBMIT_BTN.y },
        { at: T_SUBMIT, x: SUBMIT_BTN.x, y: SUBMIT_BTN.y, click: true },
        { at: 21000, x: 640, y: 590 },
        { at: 26500, x: 1000, y: 180 },
    ],
    Scene,
};

export default guide;
