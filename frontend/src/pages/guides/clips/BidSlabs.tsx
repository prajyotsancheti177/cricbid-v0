import { Gavel, Pencil, Settings, Sparkles, Volume2, Zap } from "lucide-react";
import { BidSlabEditor, type BidSlab } from "@/components/auction/BidSlabEditor";
import { cn } from "@/lib/utils";
import { FEATURED_PLAYER, TEAMS, formatPts } from "@/pages/demo/demoData";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { after, between, progress, typed } from "../kit/timeline";
import { FakeButton, FakeInput, FakeToast, Spotlight, WorkspaceFrame } from "../kit/primitives";

/**
 * Bid increment slabs, in the two places the product edits them:
 *  A. Settings → Edit details → "Bid Increment Settings" in the Edit Tournament dialog.
 *  B. Mid-auction: the auctioneer's gear → "Bid Increment Settings" dialog → Save & Apply
 *     (emits auction:updateSlabs; the server recomputes bidPrice and rebroadcasts state).
 *
 * Both use the real BidSlabEditor, fed slabs computed from `t` with the same
 * rules as its own updateSlab/addSlab (typing a max bid moves the next range's start).
 */

const NAME = "Vidarbha Premier League 2026";

const T = {
    clickEdit: 2200,
    clickRow0Max: 4800, typeRow0Max: 5100,
    clickUpdate: 8500,
    closedA: 8800,
    partB: 12500,
    clickGear: 14000,
    clickAdd: 16300,
    clickRow1Max: 18100, typeRow1Max: 18400,
    clickRow2Inc: 19900, typeRow2Inc: 20200,
    clickSave: 23000,
    closedB: 23300,
    bidLumen: 25000,
    bidTerra: 28000,
    end: 32000,
};

const spotAt = (t: number, click: number, hold = 150) => between(t, click - 700, click + hold);

/** Value of an input whose old value is selected at `click`, then replaced by typing. */
const typedNum = (text: string, t: number, start: number, old: number) => {
    const s = typed(text, t, start, 8);
    return s ? parseInt(s, 10) : old;
};

const slabsA = (t: number): BidSlab[] => {
    const max = typedNum("3999", t, T.typeRow0Max, 499);
    return [{ minBid: 0, maxBid: max, increment: 50 }, { minBid: max + 1, maxBid: null, increment: 100 }];
};

const SAVED_A: BidSlab[] = [{ minBid: 0, maxBid: 3999, increment: 50 }, { minBid: 4000, maxBid: null, increment: 100 }];

const slabsB = (t: number): BidSlab[] => {
    if (!after(t, T.clickAdd)) return SAVED_A;
    const max = typedNum("7999", t, T.typeRow1Max, 4499);
    return [
        { minBid: 0, maxBid: 3999, increment: 50 },
        { minBid: 4000, maxBid: max, increment: 100 },
        { minBid: max + 1, maxBid: null, increment: typedNum("200", t, T.typeRow2Inc, 100) },
    ];
};

const incrementFor = (slabs: BidSlab[], bid: number) =>
    slabs.find((s) => bid >= s.minBid && (s.maxBid === null || bid <= s.maxBid))?.increment ?? 100;

/** Stage-positioned spotlight over something inside a real component. */
const SpotBox = ({ show, x, y, w, h }: { show: boolean; x: number; y: number; w: number; h: number }) => (
    <div className="pointer-events-none absolute z-50" style={{ left: x - w / 2, top: y - h / 2, width: w, height: h }}>
        <Spotlight show={show} />
    </div>
);

/* ───────────── Part A: Settings → Edit Tournament ───────────── */

const SettingsPage = ({ t }: { t: number }) => (
    <WorkspaceFrame active="Settings" tournament={NAME}>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tournament configuration and danger zone</p>
        <div className="absolute rounded-xl border border-border bg-card" style={{ left: 32, top: 110, width: 986, height: 340 }}>
            <p className="absolute left-6 top-6 text-lg font-semibold">Details</p>
            <p className="absolute left-6 text-sm text-muted-foreground" style={{ top: 52 }}>Core tournament configuration.</p>
            <div className="absolute" style={{ right: 24, top: 24, width: 136 }}>
                <FakeButton variant="outline" pressed={between(t, T.clickEdit, T.clickEdit + 200)} className="w-full">
                    <Pencil className="h-4 w-4" />Edit details
                </FakeButton>
                <Spotlight show={spotAt(t, T.clickEdit)} />
            </div>
            <div className="absolute left-6 right-6" style={{ top: 96 }}>
                {[["Name", NAME], ["Total budget", "100,000 Pts"], ["Teams", "8"], ["Players per team", "11 – 15"], ["Categories", "Icon, Regular"], ["Auction Date", "11 Oct 2026"]].map(([k, v]) => (
                    <div key={k} className="flex h-9 items-center justify-between border-b border-border text-sm">
                        <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                    </div>
                ))}
            </div>
        </div>
    </WorkspaceFrame>
);

// Dialog content origin (324, 64); editor origin (341, 281); rows centred at y 334 / 400.
const EditDialog = ({ t }: { t: number }) => (
    <div className="absolute inset-0 z-30 bg-black/70" style={{ opacity: progress(t, T.clickEdit, T.clickEdit + 300) }}>
        <div className="absolute rounded-xl border border-border bg-card shadow-2xl" style={{ left: 300, top: 40, width: 680, height: 570 }}>
            <div className="absolute" style={{ left: 24, top: 24, width: 632 }}>
                <h3 className="absolute top-0 text-lg font-semibold">Edit Tournament</h3>
                <p className="absolute text-sm text-muted-foreground" style={{ top: 30 }}>Update the tournament details below.</p>
                <div className="absolute w-full opacity-60" style={{ top: 76 }}>
                    <span className="block h-5 text-sm font-medium leading-5">Player Categories (comma-separated) *</span>
                    <FakeInput className="mt-1" value="Icon, Regular" />
                </div>
                <div className="absolute w-full rounded-lg border border-border bg-muted/40" style={{ top: 168, height: 292 }}>
                    <span className="absolute left-4 top-4 text-sm font-semibold">Bid Increment Settings *</span>
                    <div className="pointer-events-none absolute" style={{ left: 16, top: 48, width: 598 }}>
                        <BidSlabEditor slabs={slabsA(t)} onChange={() => {}} />
                    </div>
                    <p className="absolute left-4 text-xs text-muted-foreground" style={{ top: 258 }}>Configure bid increments for different price ranges</p>
                </div>
                <div className="absolute" style={{ left: 364, top: 476, width: 100 }}>
                    <FakeButton variant="outline" className="w-full">Cancel</FakeButton>
                </div>
                <div className="absolute" style={{ left: 472, top: 476, width: 160 }}>
                    <FakeButton pressed={between(t, T.clickUpdate, T.clickUpdate + 250)} className="w-full">Update Tournament</FakeButton>
                    <Spotlight show={spotAt(t, T.clickUpdate)} />
                </div>
            </div>
        </div>
        <SpotBox show={spotAt(t, T.clickRow0Max, 900)} x={502} y={334} w={100} h={36} />
        <SpotBox show={between(t, 6000, 7600)} x={765} y={367} w={250} h={102} />
    </div>
);

/* ───────────── Part B: live auction room ───────────── */

const bidAt = (t: number) =>
    after(t, T.bidTerra) ? { bid: 8200, leader: "Terra" } : after(t, T.bidLumen) ? { bid: 8000, leader: "Lumen" } : { bid: 7900, leader: "Terra" };

const ROOM_TEAMS = [
    { team: TEAMS[0], budget: 61500, slots: 6 },
    { team: TEAMS[1], budget: 48200, slots: 7 },
    { team: TEAMS[2], budget: 55000, slots: 5 },
    { team: TEAMS[3], budget: 39800, slots: 6 },
];

const AuctionRoom = ({ t }: { t: number }) => {
    const live = after(t, T.clickSave) ? slabsB(t) : SAVED_A;
    const { bid, leader } = bidAt(t);
    const inc = incrementFor(live, bid);
    const justSaved = between(t, T.closedB, T.closedB + 1800);
    const leaderTeam = TEAMS.find((x) => x.name === leader)!;

    return (
        <div className="relative h-[800px] w-[1280px] overflow-hidden bg-background text-foreground">
            {/* Header */}
            <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-primary bg-card px-6 py-2 shadow-glow">
                <Gavel className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">Player #24</span>
            </div>
            <div className="absolute flex gap-2" style={{ right: 24, top: 24 }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Volume2 className="h-5 w-5" /></span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
                <span className={cn("relative flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background transition-transform", between(t, T.clickGear, T.clickGear + 200) && "scale-90")}>
                    <Settings className="h-5 w-5" />
                    <Spotlight show={spotAt(t, T.clickGear)} className="rounded-full" />
                </span>
            </div>

            {/* Player card */}
            <div className="absolute overflow-hidden rounded-2xl border-2 border-border bg-card" style={{ left: 40, top: 90, width: 560, height: 480 }}>
                <img src={FEATURED_PLAYER.photo} alt="" className="h-[360px] w-full object-cover object-center" />
                <div className="p-5">
                    <p className="text-3xl font-black">{FEATURED_PLAYER.name}</p>
                    <p className="mt-1 text-muted-foreground">Regular · Base price 1,500 Pts</p>
                </div>
            </div>

            {/* Bid panel */}
            <div className="absolute rounded-2xl border-2 border-border bg-card p-6" style={{ left: 630, top: 90, width: 610, height: 480 }}>
                <p className="text-sm uppercase tracking-wider text-muted-foreground">Current bid</p>
                <p className="mt-1 text-6xl font-black tabular-nums text-primary">{formatPts(bid)}</p>
                <div className="mt-3 flex items-center gap-2 text-lg">
                    <img src={leaderTeam.logo} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <span className="font-semibold">{leader}</span><span className="text-muted-foreground">leading</span>
                </div>
                <div className={cn("mt-5 flex items-center justify-between rounded-xl border-2 px-5 py-4 transition-colors", justSaved || after(t, T.bidLumen) ? "border-primary bg-primary/10" : "border-border")}>
                    <div>
                        <p className="text-sm text-muted-foreground">Next bid</p>
                        <p className="text-3xl font-bold tabular-nums">{formatPts(bid + inc)}</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-lg font-bold text-amber-500"><Zap className="h-4 w-4" />+{inc}</span>
                </div>
                <p className="mt-5 text-sm uppercase tracking-wider text-muted-foreground">Bid increments</p>
                <div className="mt-2 flex flex-col gap-1.5">
                    {live.map((s) => {
                        const active = bid >= s.minBid && (s.maxBid === null || bid <= s.maxBid);
                        return (
                            <div key={s.minBid} className={cn("flex items-center justify-between rounded-lg px-3 py-1.5 text-sm", active ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground")}>
                                <span>{s.minBid.toLocaleString("en-IN")} {s.maxBid === null ? "& above" : `– ${s.maxBid.toLocaleString("en-IN")}`}</span>
                                <span>+{s.increment}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Team tiles — the auctioneer clicks a team to bid */}
            {ROOM_TEAMS.map(({ team, budget, slots }, i) => {
                const leading = team.name === leader;
                const pressed = (team.name === "Lumen" && between(t, T.bidLumen, T.bidLumen + 200)) || (team.name === "Terra" && between(t, T.bidTerra, T.bidTerra + 200));
                const spot = (team.name === "Lumen" && spotAt(t, T.bidLumen)) || (team.name === "Terra" && spotAt(t, T.bidTerra));
                return (
                    <div key={team.name} className="absolute" style={{ left: 40 + i * 306, top: 590, width: 290, height: 116 }}>
                        <div className={cn("flex h-full items-center gap-4 rounded-xl border-2 px-4 transition-transform", leading ? "border-primary bg-primary/20" : "border-border bg-card", pressed && "scale-95")}>
                            <img src={team.logo} alt="" className="h-14 w-14 rounded-full object-cover shadow-md" />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold">{team.name}</p>
                                <p className="text-xs text-muted-foreground">{budget} Pts • {slots} slots</p>
                                {leading && <p className="mt-1 text-xs font-bold text-primary">{bid} Pts</p>}
                            </div>
                        </div>
                        <Spotlight show={!!spot} />
                    </div>
                );
            })}

            {/* Settings dialog. Content origin (408, 134); editor origin (408, 202); rows at y 255 / 321 / 387. */}
            {between(t, T.clickGear, T.closedB) && (() => {
                const slabs = slabsB(t);
                const editorH = 64 + 66 * slabs.length;
                const buttonsTop = 68 + editorH + 24;
                return (
                    <div className="absolute inset-0 z-30 bg-black/70" style={{ opacity: progress(t, T.clickGear, T.clickGear + 300) }}>
                        <div className="absolute rounded-xl border border-border bg-card shadow-2xl" style={{ left: 384, top: 110, width: 512, height: buttonsTop + 40 + 48 }}>
                            <div className="absolute" style={{ left: 24, top: 24, width: 464 }}>
                                <h3 className="absolute top-0 text-lg font-semibold">Bid Increment Settings</h3>
                                <p className="absolute text-sm text-muted-foreground" style={{ top: 30 }}>Changes apply immediately — no restart needed.</p>
                                <div className="pointer-events-none absolute w-full" style={{ top: 68 }}>
                                    <BidSlabEditor slabs={slabs} onChange={() => {}} compact />
                                </div>
                                <div className="absolute flex w-full gap-2" style={{ top: buttonsTop }}>
                                    <FakeButton variant="outline" className="flex-1">Cancel</FakeButton>
                                    <span className="relative flex flex-1">
                                        <FakeButton pressed={between(t, T.clickSave, T.clickSave + 250)} className="flex-1">Save &amp; Apply</FakeButton>
                                        <Spotlight show={spotAt(t, T.clickSave)} />
                                    </span>
                                </div>
                            </div>
                        </div>
                        <SpotBox show={spotAt(t, T.clickAdd)} x={640} y={380} w={464} h={36} />
                        <SpotBox show={spotAt(t, T.clickRow1Max, 900)} x={517} y={321} w={100} h={36} />
                        <SpotBox show={spotAt(t, T.clickRow2Inc, 900)} x={732} y={387} w={180} h={36} />
                    </div>
                );
            })()}
        </div>
    );
};

const Scene = ({ t }: SceneProps) => {
    if (after(t, T.partB)) return <AuctionRoom t={t} />;
    return (
        <div className="relative h-[800px] w-[1280px] overflow-hidden bg-background text-foreground">
            <SettingsPage t={t} />
            {between(t, T.clickEdit, T.closedA) && <EditDialog t={t} />}
            <FakeToast show={between(t, T.closedA + 100, T.partB)} title="Success" description="Tournament updated" />
        </div>
    );
};

const guide: GuideDefinition = {
    slug: "bid-slabs",
    title: "Set and change bid increment slabs",
    summary: "Decide how much each bid raises the price at every price range — before the auction in Settings, or live mid-auction without stopping.",
    group: "Setup",
    audience: "Organiser",
    url: "cricbid.online/tournament/vidarbha-premier-league/manage/settings",
    duration: T.end,
    steps: [
        { at: 0, title: "Open Settings and click Edit details", detail: "Bid slabs live in the tournament's details, alongside budget and categories." },
        { at: 3200, title: "Set where the first price range ends", detail: "Type 3999 — bids up to it rise by 50, and 4000 & above by 100." },
        { at: 7000, title: "Click Update Tournament", detail: "Every lot in the auction now follows these slabs." },
        { at: 12500, title: "Mid-auction, click the settings gear", detail: "Only the auctioneer sees it; bidding carries on in the background." },
        { at: 15000, title: "Add a price range and set its limits", detail: "Here 4,000–7,999 stays at +100 and 8,000 & above becomes +200." },
        { at: 21500, title: "Click Save & Apply", detail: "Changes apply immediately for everyone in the room — no restart." },
        { at: 24500, title: "Bids now step up by the new amount", detail: "At 8,000 the next bid is 8,200 instead of 8,100." },
    ],
    cursor: [
        { at: 0, x: 700, y: 420 },
        { at: 1700, x: 1156, y: 154 },
        { at: T.clickEdit, x: 1156, y: 154, click: true },
        { at: 4300, x: 502, y: 334 },
        { at: T.clickRow0Max, x: 502, y: 334, click: true },
        { at: 6200, x: 765, y: 400 },
        { at: 8000, x: 876, y: 560 },
        { at: T.clickUpdate, x: 876, y: 560, click: true },
        { at: 13400, x: 1236, y: 44 },
        { at: T.clickGear, x: 1236, y: 44, click: true },
        { at: 15800, x: 640, y: 380 },
        { at: T.clickAdd, x: 640, y: 380, click: true },
        { at: 17600, x: 517, y: 321 },
        { at: T.clickRow1Max, x: 517, y: 321, click: true },
        { at: 19400, x: 732, y: 387 },
        { at: T.clickRow2Inc, x: 732, y: 387, click: true },
        { at: 22500, x: 758, y: 508 },
        { at: T.clickSave, x: 758, y: 508, click: true },
        { at: 24500, x: 491, y: 648 },
        { at: T.bidLumen, x: 491, y: 648, click: true },
        { at: 27500, x: 1103, y: 648 },
        { at: T.bidTerra, x: 1103, y: 648, click: true },
        { at: 30000, x: 900, y: 480 },
    ],
    Scene,
};

export default guide;
