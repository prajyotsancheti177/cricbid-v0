import { AnimatePresence, motion } from "framer-motion";
import { Gavel, Search } from "lucide-react";
import { AuctionPlayerCard } from "@/components/auction/AuctionPlayerCard";
import { TeamBudgetPanel } from "@/components/auction/TeamBudgetPanel";
import { TeamBidGrid } from "@/components/auction/TeamBidGrid";
import { UnsoldAnimation } from "@/components/auction/UnsoldAnimation";
import type { Player, Team } from "@/types/auction";
import { FEATURED_PLAYER, SQUAD_SIZE, TEAMS } from "@/pages/demo/demoData";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { FakeButton, Spotlight } from "../kit/primitives";
import { after, between } from "../kit/timeline";

/**
 * Host view of auction night, drawn with the real room components
 * (AuctionPlayerCard, TeamBudgetPanel, TeamBidGrid, UnsoldAnimation) from a
 * scripted bid ladder. SoldCelebration is NOT used: it fires canvas-confetti,
 * which paints over the whole browser page, so a contained look-alike stands in.
 */

// ---- timeline marks (ms) ----
const T_HOST = 2600;        // click "Start Auction as Host"
const T_RANDOM = 6000;      // click "Start with Next Player (Random Order)"
const T_CATEGORY = 9200;    // click "Regular" in Select Category
const T_ROOM = 9600;
const T_UNDO = 23600;
const T_SOLD = 37000;
const T_SOLD_END = 41300;
const T_NEXT = 42400;
const T_UNSOLD = 45200;
const DURATION = 50000;

/** Slabs for this clip: +50 below 2,000 Pts, +100 from 2,000. */
const increment = (amount: number) => (amount >= 2000 ? 100 : 50);

/** Scripted team state; drop-outs chosen so tiles go red one by one. */
const STATE: Record<string, { purse: number; slotsUsed: number; maxBiddable: number }> = {
    "Sledgers United": { purse: 12400, slotsUsed: 9, maxBiddable: 9000 },
    Lumen: { purse: 11800, slotsUsed: 9, maxBiddable: 9000 },
    "Patel Strikers": { purse: 6200, slotsUsed: 10, maxBiddable: 1950 },
    Terra: { purse: 5400, slotsUsed: 10, maxBiddable: 1600 },
    Redfit: { purse: 5900, slotsUsed: 11, maxBiddable: 2000 },
    Ather: { purse: 3600, slotsUsed: 11, maxBiddable: 1700 },
    "Sk.Infra": { purse: 4800, slotsUsed: 14, maxBiddable: 4800 },
    "MOP Dominators": { purse: 2700, slotsUsed: 12, maxBiddable: 1800 },
};

const BASE_PRICE = 1500;

/** [time, team, amount]. The 1,750 tap by Patel Strikers is the mistake undone at T_UNDO. */
const LADDER: { at: number; team: string; amount: number; undone?: boolean }[] = [
    { at: 12600, team: "Terra", amount: 1500 },
    { at: 14000, team: "Patel Strikers", amount: 1550 },
    { at: 15400, team: "Lumen", amount: 1600 },
    { at: 16800, team: "Redfit", amount: 1650 },
    { at: 18200, team: "Sledgers United", amount: 1700 },
    { at: 21000, team: "Patel Strikers", amount: 1750, undone: true },
    { at: 26200, team: "Lumen", amount: 1750 },
    { at: 27400, team: "Sledgers United", amount: 1800 },
    { at: 28600, team: "Lumen", amount: 1850 },
    { at: 29800, team: "Sledgers United", amount: 1900 },
    { at: 31000, team: "Lumen", amount: 1950 },
    { at: 32200, team: "Sledgers United", amount: 2000 },
    { at: 33400, team: "Lumen", amount: 2100 },
    { at: 34600, team: "Sledgers United", amount: 2200 },
];
const FINAL = LADDER[LADDER.length - 1];

// ---- stage geometry (all fixed, so cursor keys line up) ----
const GRID_LEFT = 36;
const COL_W = 296;
const GAP = 8;
const ROW_TOP = 446;
const ROW_H = 104;
const tileCenter = (team: string) => {
    const i = TEAMS.findIndex((x) => x.name === team);
    const col = i % 4;
    const row = Math.floor(i / 4);
    return { x: GRID_LEFT + col * (COL_W + GAP) + COL_W / 2, y: ROW_TOP + row * (ROW_H + GAP) + ROW_H / 2 };
};
const BTN_W = 96;
const BTN_Y = 686;
const BTN_LABELS = ["← Change Mode", "Next", "Search", "Undo", "Unsold", "Sold!"] as const;
const btnX = (label: (typeof BTN_LABELS)[number]) => {
    const i = BTN_LABELS.indexOf(label);
    const total = BTN_LABELS.length * BTN_W + (BTN_LABELS.length - 1) * 12;
    return 640 - total / 2 + i * (BTN_W + 12) + BTN_W / 2;
};

const soldPlayer: Player = {
    _id: "clip-player",
    name: FEATURED_PLAYER.name,
    photo: FEATURED_PLAYER.photo,
    playerCategory: "Regular",
    auctionSerialNumber: FEATURED_PLAYER.lotNumber,
    basePrice: BASE_PRICE,
    amtSold: 0,
    sold: false,
    auctionStatus: false,
};

const unsoldPlayer: Player = {
    _id: "clip-player-2",
    name: "Deepak Harne",
    photo: "https://api.dicebear.com/7.x/initials/svg?seed=Deepak%20Harne&backgroundColor=6366f1,8b5cf6&backgroundType=gradientLinear",
    playerCategory: "Regular",
    auctionSerialNumber: 40,
    basePrice: BASE_PRICE,
    amtSold: 0,
    sold: false,
    auctionStatus: false,
};

const LobbyButton = ({ y, label, variant, pressed, spot }: {
    y: number; label: string; variant: "primary" | "secondary" | "outline"; pressed?: boolean; spot?: boolean;
}) => (
    <div className="absolute left-1/2 w-[384px] -translate-x-1/2" style={{ top: y - 22 }}>
        <span className={
            "relative flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition-transform " +
            (variant === "primary" ? "bg-primary text-primary-foreground " : variant === "secondary" ? "bg-secondary text-secondary-foreground " : "border border-input bg-background ") +
            (pressed ? "scale-95 brightness-90" : "")
        }>
            {label}
            <Spotlight show={!!spot} />
        </span>
    </div>
);

const Lobby = ({ t }: { t: number }) => {
    const hosting = after(t, T_HOST + 300);
    const dialog = between(t, T_RANDOM + 300, T_CATEGORY + 300);
    return (
        <div className="relative h-full w-full bg-background">
            <div className="absolute left-1/2 top-[150px] h-[470px] w-[448px] -translate-x-1/2 rounded-xl border bg-card shadow-lg" />
            <Gavel className="absolute left-1/2 top-[196px] h-16 w-16 -translate-x-1/2 text-primary" />
            <h1 className="absolute left-0 right-0 top-[282px] text-center text-3xl font-bold">Live Auction</h1>
            <p className="absolute left-0 right-0 top-[330px] text-center text-muted-foreground">
                {hosting ? "You are connected as the auctioneer." : "Waiting for the auctioneer to start the session."}
            </p>
            {!hosting ? (
                <LobbyButton y={422} label="Start Auction as Host" variant="primary"
                    spot={between(t, 1200, T_HOST)} pressed={between(t, T_HOST, T_HOST + 250)} />
            ) : (
                <>
                    <LobbyButton y={422} label="Start with Next Player (Random Order)" variant="primary"
                        spot={between(t, 4400, T_RANDOM)} pressed={between(t, T_RANDOM, T_RANDOM + 250)} />
                    <LobbyButton y={482} label="Start with Next Player (Serial Number Order)" variant="secondary" />
                    <LobbyButton y={542} label="Select Player Manually" variant="outline" />
                </>
            )}
            <AnimatePresence>
                {dialog && (
                    <motion.div className="absolute inset-0 z-30 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute left-1/2 top-[250px] h-[290px] w-[384px] -translate-x-1/2 rounded-lg border bg-background p-6 shadow-2xl">
                            <h3 className="text-lg font-semibold">Select Category</h3>
                            <p className="text-sm text-muted-foreground">Choose which category to auction next</p>
                        </div>
                        {["All Categories", "Icon", "Regular"].map((c, i) => (
                            <div key={c} className="absolute left-1/2 w-[336px] -translate-x-1/2" style={{ top: 350 + i * 56 }}>
                                <span className={"relative flex h-12 w-full items-center rounded-md border border-input bg-background px-4 text-sm font-medium " +
                                    (c === "Regular" && between(t, T_CATEGORY, T_CATEGORY + 250) ? "scale-95" : "")}>
                                    {c}
                                    <Spotlight show={c === "Regular" && between(t, 8000, T_CATEGORY)} />
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SoldLookalike = ({ show, team, amount }: { show: boolean; team: string; amount: number }) => (
    <AnimatePresence>
        {show && (
            <motion.div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md"
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="space-y-5 rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-12 text-center shadow-[0_0_100px_rgba(168,85,247,0.6)]">
                    <motion.div animate={{ rotate: [0, -8, 8, -8, 0] }} transition={{ duration: 0.6, repeat: 3 }}
                        className="text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">🎉 SOLD! 🎉</motion.div>
                    <h2 className="text-5xl font-bold text-white">{FEATURED_PLAYER.name}</h2>
                    <p className="text-3xl text-white/90">to {team}</p>
                    <p className="text-6xl font-black text-yellow-300">💰 {amount} Pts 💰</p>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

const Room = ({ t }: { t: number }) => {
    const secondLot = after(t, T_NEXT + 200);
    const player = secondLot ? unsoldPlayer : soldPlayer;

    const active = secondLot ? [] : LADDER.filter((b) => after(t, b.at) && !(b.undone && after(t, T_UNDO)));
    const last = active[active.length - 1];
    const currentBid = last ? last.amount : BASE_PRICE;
    const leadingTeam = last ? last.team : null;
    const bidPrice = increment(currentBid);
    const sold = after(t, T_SOLD + 250);

    const teams: Team[] = TEAMS.map((team) => {
        const s = STATE[team.name];
        const bought = sold && team.name === FINAL.team;
        const purse = bought ? s.purse - FINAL.amount : s.purse;
        return {
            _id: team.name,
            name: team.name,
            logo: team.logo,
            remainingBudget: purse,
            maxPlayersPerTeam: SQUAD_SIZE,
            playersCount: s.slotsUsed + (bought ? 1 : 0),
            maxBiddableAmount: bought ? s.maxBiddable - FINAL.amount : s.maxBiddable,
        };
    });
    const teamBids: Record<string, number> = {};
    active.forEach((b) => { teamBids[b.team] = b.amount; });

    const pressed = (at: number) => between(t, at, at + 250);
    const btnSpot: Partial<Record<(typeof BTN_LABELS)[number], boolean>> = {
        Undo: between(t, 22200, T_UNDO),
        "Sold!": between(t, 35700, T_SOLD),
        Next: between(t, 41500, T_NEXT),
        Unsold: between(t, 43800, T_UNSOLD),
    };
    const btnPressed: Partial<Record<(typeof BTN_LABELS)[number], boolean>> = {
        Undo: pressed(T_UNDO), "Sold!": pressed(T_SOLD), Next: pressed(T_NEXT), Unsold: pressed(T_UNSOLD),
    };

    return (
        <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
            {/* header pill */}
            <div className="absolute left-0 right-0 top-4 flex justify-center">
                <div className="inline-flex items-center gap-3 rounded-full border-2 border-primary bg-card px-6 py-2 shadow-glow">
                    <span className="text-lg font-bold">Player #{player.auctionSerialNumber}</span>
                    <span className="rounded-full border border-secondary/30 bg-secondary/20 px-2 py-0.5 text-sm text-secondary">Regular</span>
                </div>
            </div>

            {/* player card + purse panel */}
            <div className="absolute left-5 right-5 top-[72px] flex h-[300px] gap-4 [&>div:nth-child(2)]:!flex [&>div:nth-child(2)]:!w-[440px] [&>div:nth-child(3)]:!hidden">
                <div className="h-full min-w-0 flex-1">
                    <AuctionPlayerCard
                        key={player._id}
                        player={player}
                        className="h-full w-full"
                        currentBid={currentBid}
                        leadingTeamName={leadingTeam ?? undefined}
                        leadingTeamLogo={TEAMS.find((x) => x.name === leadingTeam)?.logo}
                        bidPrice={bidPrice}
                    />
                </div>
                <TeamBudgetPanel teams={teams} currentBid={currentBid} bidPrice={bidPrice} leadingTeam={leadingTeam} />
            </div>

            {/* bidding card */}
            <div className="absolute left-5 right-5 top-[388px] h-[330px] rounded-lg border-2 border-border bg-card/80 shadow-elevated" />
            <h2 className="absolute left-0 right-0 top-[404px] text-center text-xl font-bold">Click on Team to Bid</h2>
            <div
                className="absolute overflow-hidden [&>div]:!mb-0 [&>div]:!grid-cols-4 [&>div]:!gap-2 [&_button]:!h-[104px] [&_button]:!min-h-0 [&_button]:!p-2 [&_img]:!h-12 [&_img]:!w-12"
                style={{ left: GRID_LEFT, top: ROW_TOP, width: COL_W * 4 + GAP * 3, height: ROW_H * 2 + GAP }}
            >
                <TeamBidGrid teams={teams} currentBid={currentBid} bidPrice={bidPrice} leadingTeam={leadingTeam} teamBids={teamBids} onBid={() => {}} />
            </div>
            {/* spotlight on the tile being tapped */}
            {!secondLot && LADDER.map((b) => {
                const c = tileCenter(b.team);
                return (
                    <div key={b.at} className="pointer-events-none absolute rounded-xl"
                        style={{ left: c.x - COL_W / 2, top: c.y - ROW_H / 2, width: COL_W, height: ROW_H }}>
                        <Spotlight show={between(t, b.at - 500, b.at)} />
                    </div>
                );
            })}

            {BTN_LABELS.map((label) => (
                <div key={label} className="absolute" style={{ left: btnX(label) - BTN_W / 2, top: BTN_Y - 16, width: BTN_W }}>
                    <span className="relative block">
                        <FakeButton
                            variant={label === "Next" ? "primary" : label === "Unsold" ? "outline" : label === "← Change Mode" ? "ghost" : "outline"}
                            pressed={btnPressed[label]}
                            className={
                                "h-8 w-full px-2 text-xs " +
                                (label === "Sold!" ? "bg-gradient-accent text-white " : "") +
                                (label === "Search" || label === "Undo" ? "border-0 bg-secondary text-secondary-foreground " : "")
                            }
                        >
                            {label === "Search" && <Search className="h-3 w-3" />}
                            {label}
                        </FakeButton>
                        <Spotlight show={!!btnSpot[label]} />
                    </span>
                </div>
            ))}

            <SoldLookalike show={between(t, T_SOLD + 250, T_SOLD_END)} team={FINAL.team} amount={FINAL.amount} />
            {/* real component; contained by the stage's transform (it is only position:fixed, no confetti) */}
            <UnsoldAnimation show={after(t, T_UNSOLD + 250)} playerName={unsoldPlayer.name} soundEnabled={false} animationEnabled />
        </div>
    );
};

const Scene = ({ t }: SceneProps) => (t < T_ROOM ? <Lobby t={t} /> : <Room t={t} />);

const tileKeys = LADDER.flatMap((b) => {
    const c = tileCenter(b.team);
    return [{ at: b.at - 450, x: c.x, y: c.y }, { at: b.at, x: c.x, y: c.y, click: true }];
});

const guide: GuideDefinition = {
    slug: "run-bidding",
    title: "Run the bidding",
    summary: "Host the live auction: bring up the next player, tap team tiles to bid, undo a slip, and close each lot as Sold! or Unsold.",
    group: "Auction night",
    audience: "Organiser",
    url: "cricbid.online/auction/room/jain-unity-cup",
    duration: DURATION,
    steps: [
        { at: 0, title: "Start the auction as host", detail: "Open the live auction room from the Auction section and tap Start Auction as Host." },
        { at: 3800, title: "Choose how players come up", detail: "Random or serial-number order by category — or Select Player Manually to pick anyone." },
        { at: 7200, title: "Pick a category", detail: "The first player appears at their base price, ready for bids." },
        { at: 11000, title: "Tap a team's tile to bid for them", detail: "Each tap raises the price by your slab increment — +50 here, +100 from 2,000 Pts." },
        { at: 19800, title: "Undo a mistaken bid", detail: "Undo takes back the last bid and returns the lead to the previous team." },
        { at: 25400, title: "Watch teams turn red", detail: "Red means the next price is over that team's max biddable amount, purse or squad limit." },
        { at: 35400, title: "Tap Sold! to close the lot", detail: "The player joins the leading team and the price comes out of its purse." },
        { at: 41300, title: "No bids? Tap Unsold", detail: "Unsold players can go back in later with Settings → Reset unsold players." },
    ],
    cursor: [
        { at: 0, x: 900, y: 650 },
        { at: 2000, x: 640, y: 422 },
        { at: T_HOST, x: 640, y: 422, click: true },
        { at: 5300, x: 640, y: 422 },
        { at: T_RANDOM, x: 640, y: 422, click: true },
        { at: 8500, x: 640, y: 486 },
        { at: T_CATEGORY, x: 640, y: 486, click: true },
        ...tileKeys.filter((k) => k.at < T_UNDO),
        { at: 22800, x: btnX("Undo"), y: BTN_Y },
        { at: T_UNDO, x: btnX("Undo"), y: BTN_Y, click: true },
        ...tileKeys.filter((k) => k.at > T_UNDO),
        { at: 36300, x: btnX("Sold!"), y: BTN_Y },
        { at: T_SOLD, x: btnX("Sold!"), y: BTN_Y, click: true },
        { at: 41800, x: btnX("Next"), y: BTN_Y },
        { at: T_NEXT, x: btnX("Next"), y: BTN_Y, click: true },
        { at: 44500, x: btnX("Unsold"), y: BTN_Y },
        { at: T_UNSOLD, x: btnX("Unsold"), y: BTN_Y, click: true },
        { at: 47000, x: 1100, y: 620 },
    ],
    Scene,
};

export default guide;
