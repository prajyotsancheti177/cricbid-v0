import { Plus, Trophy, Users, Wallet } from "lucide-react";
import { BidSlabEditor } from "@/components/auction/BidSlabEditor";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, ease, lerp, progress, typed } from "../kit/timeline";
import { FakeButton, FakeInput, FakeToast, Spotlight, WorkspaceFrame } from "../kit/primitives";

/**
 * Create a tournament: Manage Tournaments → "Create New Tournament" dialog
 * (the real TournamentFormDialog's fields, labels, order and placeholders) →
 * the new row in the list → Manage opens the workspace.
 *
 * Every element is absolutely positioned so cursor waypoints are exact.
 * Dialog content coordinates map to the stage as  x = 324 + cx,  y = 54 + cy - scroll.
 */

const NAME = "Vidarbha Premier League 2026";
const CATS = "Icon, Regular";

const T = {
    clickCreate: 3000,
    clickName: 4200, typeName: 4500,
    clickTeams: 7000, typeTeams: 7200,
    clickBudget: 8000, typeBudget: 8200,
    clickMin: 9200, typeMin: 9400,
    clickMax: 10200, typeMax: 10400,
    clickCats: 11800, typeCats: 12000,
    scroll1: 13800,
    clickIcon: 15000, typeIcon: 15200,
    clickRegular: 16200, typeRegular: 16400,
    scroll2: 17600,
    clickSubmit: 20000,
    closed: 20400,
    clickManage: 25500,
    workspace: 26000,
    end: 31000,
};

const DEFAULT_SLABS = [
    { minBid: 0, maxBid: 499, increment: 50 },
    { minBid: 500, maxBid: null, increment: 100 },
];

const EXISTING = [
    { name: "Nagpur Premier League", teams: 10, min: 12, max: 16, budget: 150000, cats: ["A", "B", "C"] },
    { name: "Wardha Warriors Cup", teams: 6, min: 11, max: 14, budget: 80000, cats: ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"] },
];

const spotAt = (t: number, click: number) => between(t, click - 700, click + 150);

const Field = ({
    x, y, w, label, value, placeholder, focused, spot, help, labelClass,
}: {
    x: number; y: number; w: number; label: string; value: string; placeholder?: string;
    focused?: boolean; spot?: boolean; help?: string; labelClass?: string;
}) => (
    <div className="absolute" style={{ left: x, top: y, width: w }}>
        <span className={cn("block h-5 text-sm font-medium leading-5", labelClass)}>{label}</span>
        <div className="relative mt-1">
            <FakeInput value={value} placeholder={placeholder} focused={focused} />
            <Spotlight show={!!spot} />
        </div>
        {help && <p className="mt-2 text-xs text-muted-foreground">{help}</p>}
    </div>
);

const TournamentList = ({ t }: { t: number }) => {
    const created = after(t, T.closed);
    const rows = created
        ? [{ name: NAME, teams: 8, min: 11, max: 15, budget: 100000, cats: ["Icon", "Regular"] }, ...EXISTING]
        : EXISTING;
    const glow = created ? 1 - progress(t, T.closed + 3000, T.closed + 5000) : 0;

    return (
        <div className="absolute rounded-xl border border-border bg-card" style={{ left: 60, top: 40, width: 1160, height: 640 }}>
            <div className="absolute left-6 top-6">
                <h2 className="flex items-center gap-2 text-3xl font-bold"><Trophy className="h-8 w-8" />Tournament Management</h2>
                <p className="mt-2 text-sm text-muted-foreground">Manage your tournaments</p>
            </div>
            <div className="absolute" style={{ left: 926, top: 36, width: 210, height: 48 }}>
                <FakeButton pressed={between(t, T.clickCreate, T.clickCreate + 200)} className="h-12 w-full text-base">
                    <Plus className="h-5 w-5" />Create Tournament
                </FakeButton>
                <Spotlight show={spotAt(t, T.clickCreate)} />
            </div>

            <div className="absolute left-6 right-6 flex h-11 items-center border-b border-border text-sm font-medium text-muted-foreground" style={{ top: 150 }}>
                <span style={{ width: 300 }}>Tournament Name</span>
                <span className="text-center" style={{ width: 120 }}>Teams</span>
                <span className="text-center" style={{ width: 150 }}>Players/Team</span>
                <span className="text-right" style={{ width: 160 }}>Budget</span>
                <span className="pl-6" style={{ width: 220 }}>Categories</span>
                <span className="text-center" style={{ width: 162 }}>Actions</span>
            </div>
            {rows.map((r, i) => (
                <div
                    key={r.name}
                    className="absolute left-6 right-6 flex h-14 items-center border-b border-border text-sm"
                    style={{ top: 194 + i * 56, backgroundColor: i === 0 && created ? `hsl(var(--primary) / ${0.14 * glow})` : undefined }}
                >
                    <span className="font-medium" style={{ width: 300 }}>{r.name}</span>
                    <span className="text-center" style={{ width: 120 }}>
                        <Badge variant="secondary"><Users className="mr-1 h-3 w-3" />{r.teams}</Badge>
                    </span>
                    <span className="text-center" style={{ width: 150 }}>{r.min} - {r.max}</span>
                    <span className="text-right font-semibold" style={{ width: 160 }}>
                        <Wallet className="inline h-4 w-4" />{r.budget.toLocaleString()} Pts
                    </span>
                    <span className="flex flex-wrap gap-1 pl-6" style={{ width: 220 }}>
                        {r.cats.slice(0, 3).map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                        {r.cats.length > 3 && <Badge variant="outline" className="text-xs">+{r.cats.length - 3}</Badge>}
                    </span>
                    <span className="flex justify-center" style={{ width: 162 }}>
                        <span className="relative">
                            <FakeButton pressed={i === 0 && created && between(t, T.clickManage, T.clickManage + 200)} className="h-9 px-3">Manage</FakeButton>
                            {i === 0 && created && <Spotlight show={spotAt(t, T.clickManage)} />}
                        </span>
                    </span>
                </div>
            ))}
        </div>
    );
};

const CreateDialog = ({ t }: { t: number }) => {
    const scroll = lerp(0, 260, ease(progress(t, T.scroll1, T.scroll1 + 800))) + lerp(0, 260, ease(progress(t, T.scroll2, T.scroll2 + 1000)));
    const appear = progress(t, T.clickCreate, T.clickCreate + 300);
    const cats = typed(CATS, t, T.typeCats);
    const catList = cats.split(",").map((c) => c.trim()).filter(Boolean);
    const prices = [typed("4000", t, T.typeIcon), typed("1500", t, T.typeRegular)];
    const focus = (from: number, to: number) => between(t, from, to);

    return (
        <div className="absolute inset-0 z-30 bg-black/70" style={{ opacity: appear }}>
            <div
                className="absolute overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
                style={{ left: 300, top: 30, width: 680, height: 690, transform: `scale(${0.97 + 0.03 * appear})` }}
            >
                <div className="absolute" style={{ left: 24, top: 24, width: 632, height: 1200, transform: `translateY(${-scroll}px)` }}>
                    <h3 className="absolute top-0 text-lg font-semibold">Create New Tournament</h3>
                    <p className="absolute text-sm text-muted-foreground" style={{ top: 30 }}>Fill in the details to create a new tournament.</p>

                    <Field x={0} y={80} w={632} label="Tournament Name *" placeholder="e.g., IPL 2025"
                        value={typed(NAME, t, T.typeName)} focused={focus(T.clickName, T.clickTeams)} spot={spotAt(t, T.clickName)} />

                    <Field x={0} y={168} w={308} label="Number of Teams *" placeholder="e.g., 8"
                        value={typed("8", t, T.typeTeams)} focused={focus(T.clickTeams, T.clickBudget)} spot={spotAt(t, T.clickTeams)} />
                    <Field x={324} y={168} w={308} label="Total Budget *" placeholder="e.g., 100000"
                        value={typed("100000", t, T.typeBudget)} focused={focus(T.clickBudget, T.clickMin)} spot={spotAt(t, T.clickBudget)} />

                    <Field x={0} y={256} w={632} label="Auction Date" value="" placeholder="dd-mm-yyyy"
                        help="When the auction itself will be held. Separate from the tournament's created date." />

                    <Field x={0} y={366} w={308} label="Min Players per Team *" placeholder="e.g., 11"
                        value={typed("11", t, T.typeMin)} focused={focus(T.clickMin, T.clickMax)} spot={spotAt(t, T.clickMin)} />
                    <Field x={324} y={366} w={308} label="Max Players per Team *" placeholder="e.g., 15"
                        value={typed("15", t, T.typeMax)} focused={focus(T.clickMax, T.clickCats)} spot={spotAt(t, T.clickMax)} />

                    <Field x={0} y={454} w={632} label="Player Categories (comma-separated) *"
                        placeholder="e.g., Batsman, Bowler, All-rounder, Wicket-keeper"
                        value={cats} focused={focus(T.clickCats, T.scroll1)} spot={spotAt(t, T.clickCats)}
                        help="Separate multiple categories with commas" />

                    {catList.length > 0 && (
                        <div className="absolute rounded-lg border border-border bg-muted/40" style={{ left: 0, top: 566, width: 632, height: 234 }}>
                            <span className="absolute left-4 top-4 text-sm font-semibold">Base Prices for Categories *</span>
                            {catList.slice(0, 2).map((c, i) => (
                                <Field key={i} x={16} y={46 + i * 82} w={600} label={c} labelClass="font-semibold"
                                    placeholder="e.g., 500" value={prices[i]}
                                    focused={i === 0 ? focus(T.clickIcon, T.clickRegular) : focus(T.clickRegular, T.scroll2)}
                                    spot={spotAt(t, i === 0 ? T.clickIcon : T.clickRegular)} />
                            ))}
                            <p className="absolute left-4 text-xs text-muted-foreground" style={{ top: 206 }}>Enter the base auction price for each category</p>
                        </div>
                    )}

                    <div className="absolute rounded-lg border border-border bg-muted/40" style={{ left: 0, top: 820, width: 632, height: 280 }}>
                        <span className="absolute left-4 top-4 text-sm font-semibold">Bid Increment Settings *</span>
                        <div className="pointer-events-none absolute" style={{ left: 16, top: 46, width: 600 }}>
                            <BidSlabEditor slabs={DEFAULT_SLABS} onChange={() => {}} />
                        </div>
                        <p className="absolute left-4 text-xs text-muted-foreground" style={{ top: 254 }}>Configure bid increments for different price ranges</p>
                    </div>

                    <div className="absolute" style={{ left: 384, top: 1120, width: 90 }}>
                        <FakeButton variant="outline" className="w-full">Cancel</FakeButton>
                    </div>
                    <div className="absolute" style={{ left: 482, top: 1120, width: 150 }}>
                        <FakeButton pressed={between(t, T.clickSubmit, T.clickSubmit + 250)} className="w-full">Create Tournament</FakeButton>
                        <Spotlight show={spotAt(t, T.clickSubmit)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const Workspace = () => (
    <WorkspaceFrame active="Overview" tournament={NAME}>
        <h1 className="text-2xl font-bold">{NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your tournament is ready — add players and teams next.</p>
        <div className="mt-8 grid grid-cols-4 gap-4">
            {[["Teams", "8"], ["Budget per team", "100,000 Pts"], ["Players per team", "11 – 15"], ["Categories", "Icon, Regular"]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-card p-5">
                    <p className="text-sm text-muted-foreground">{k}</p>
                    <p className="mt-2 text-2xl font-bold">{v}</p>
                </div>
            ))}
        </div>
    </WorkspaceFrame>
);

const Scene = ({ t }: SceneProps) => {
    if (after(t, T.workspace)) {
        return <div className="relative h-[800px] w-[1280px] overflow-hidden bg-background"><Workspace /></div>;
    }
    return (
        <div className="relative h-[800px] w-[1280px] overflow-hidden bg-background text-foreground">
            <TournamentList t={t} />
            {between(t, T.clickCreate, T.closed) && <CreateDialog t={t} />}
            <FakeToast show={between(t, T.closed + 100, T.closed + 4000)} title="Success" description="Tournament created" />
        </div>
    );
};

const guide: GuideDefinition = {
    slug: "create-tournament",
    title: "Create a tournament",
    summary: "Set up a new tournament in under a minute — name, teams, purse, squad size and category base prices — then open its workspace.",
    group: "Setup",
    audience: "Organiser",
    url: "cricbid.online/tournaments/manage",
    duration: T.end,
    steps: [
        { at: 0, title: "Click Create Tournament", detail: "Manage Tournaments lists every tournament you run." },
        { at: 3500, title: "Name your tournament", detail: "Players and teams see this name on registration links and the auction screen." },
        { at: 6600, title: "Set teams, budget and squad size", detail: "Total Budget is the purse each team starts the auction with, in points." },
        { at: 11200, title: "List your player categories", detail: "Separate them with commas — a base price box appears for each one." },
        { at: 13800, title: "Enter a base price for each category", detail: "Bidding on a player opens at their category's base price." },
        { at: 17600, title: "Click Create Tournament", detail: "Bid increments start with defaults you can change any time." },
        { at: 21000, title: "Click Manage to open the workspace", detail: "Your new tournament is in the list, ready for players and teams." },
    ],
    cursor: [
        { at: 0, x: 640, y: 420 },
        { at: 2400, x: 1091, y: 100 },
        { at: T.clickCreate, x: 1091, y: 100, click: true },
        { at: 3900, x: 640, y: 180 },
        { at: T.clickName, x: 640, y: 180, click: true },
        { at: 6700, x: 478, y: 268 },
        { at: T.clickTeams, x: 478, y: 268, click: true },
        { at: 7700, x: 802, y: 268 },
        { at: T.clickBudget, x: 802, y: 268, click: true },
        { at: 8900, x: 478, y: 466 },
        { at: T.clickMin, x: 478, y: 466, click: true },
        { at: 9900, x: 802, y: 466 },
        { at: T.clickMax, x: 802, y: 466, click: true },
        { at: 11400, x: 640, y: 554 },
        { at: T.clickCats, x: 640, y: 554, click: true },
        { at: 14600, x: 640, y: 452 },
        { at: T.clickIcon, x: 640, y: 452, click: true },
        { at: 15900, x: 640, y: 534 },
        { at: T.clickRegular, x: 640, y: 534, click: true },
        { at: 19200, x: 881, y: 674 },
        { at: T.clickSubmit, x: 881, y: 674, click: true },
        { at: 24800, x: 1115, y: 262 },
        { at: T.clickManage, x: 1115, y: 262, click: true },
        { at: 27500, x: 760, y: 420 },
    ],
    Scene,
};

export default guide;
