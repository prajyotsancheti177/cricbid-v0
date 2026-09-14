import { AnimatePresence, motion } from "framer-motion";
import { Edit3, History, Save, Trash2, Undo2, X } from "lucide-react";
import { FEATURED_PLAYER, TEAMS } from "@/pages/demo/demoData";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { FakeButton, FakeSelect, Spotlight, WorkspaceFrame } from "../kit/primitives";
import { after, between } from "../kit/timeline";

/**
 * How a mistaken sale is reversed in the product:
 *  1. Manage → Players → click the player → Edit → Auction Status
 *     "Not Auctioned" (back in the pool) or "Mark as Unsold" → Save.
 *     POST /api/player/update clears team + sold price; the team's purse is
 *     computed from its sold players, so the money comes back automatically.
 *  2. Player sheet → History → "Undo this" on the sale (POST /api/player/undo).
 * The live room's Undo only takes back bids before Sold! — not a sale.
 */

const T_SOLD_FILTER = 3600;
const T_CARD = 7800;
const T_EDIT = 12000;
const T_SELECT_OPEN = 15600;
const T_PICK = 18200;
const T_SAVE = 22600;
const T_RESULT = 23200;
const T_SHEET = 31500;
const DURATION = 40000;

const LUMEN = TEAMS[1];
const PRICE = 4600;
const LUMEN_PURSE_AFTER = 7200;

const OTHERS = [
    { name: "Shivraj Singh", team: "Lumen", price: 4200 },
    { name: "Nadeem", team: "Patel Strikers", price: 3900 },
    { name: "Sohil Pathan", team: "Ather", price: 3600 },
    { name: "Mohammad Usman", team: "MOP Dominators", price: 2900 },
    { name: "Deepak Harne", team: "Sk.Infra", price: 2400 },
    { name: "Rohit Kale", team: "Terra", price: 2100 },
    { name: "Aman Shaikh", team: "Redfit", price: 1900 },
];
const avatar = (n: string) =>
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(n)}&backgroundColor=6366f1,8b5cf6&backgroundType=gradientLinear`;

// Card grid: 4 columns inside the workspace main area (x from 262 to 1248)
const CARD_W = 232;
const CARD_H = 180;
const GRID_X = 262;
const GRID_Y = 370;
const cardPos = (i: number) => ({ x: GRID_X + (i % 4) * (CARD_W + 16), y: GRID_Y + Math.floor(i / 4) * (CARD_H + 16) });

const FILTERS = ["All (105)", "Sold (66)", "Unsold (21)", "Pending (18)"];
const filterX = (i: number) => 262 + i * 130 + 60;
const FILTER_Y = 250;

const Card = ({ name, photo, status, team, price, spot, pressed, pos }: {
    name: string; photo: string; status: "SOLD" | "PENDING"; team?: string; price?: number;
    spot?: boolean; pressed?: boolean; pos: { x: number; y: number };
}) => (
    <motion.div layout className="absolute" style={{ left: pos.x - 230, top: pos.y - 70, width: CARD_W, height: CARD_H }}>
        <div className={"relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-transform " + (pressed ? "scale-95" : "")}>
            <div className="relative h-[110px] bg-muted/40">
                <img src={photo} alt="" className="h-full w-full object-cover object-top" />
                <span className={"absolute left-2 top-2 rounded px-2 py-0.5 text-[11px] font-bold " + (status === "SOLD" ? "bg-green-500 text-white" : "bg-amber-500 text-black")}>
                    {status}
                </span>
            </div>
            <div className="p-3">
                <p className="truncate text-sm font-bold">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {status === "SOLD" ? `${team} · ${price} Pts` : "Regular · back in the pool"}
                </p>
            </div>
            <Spotlight show={!!spot} />
        </div>
    </motion.div>
);

const PlayersPage = ({ t }: { t: number }) => {
    const soldFilter = after(t, T_SOLD_FILTER);
    const reverted = after(t, T_SAVE + 300);
    const pendingView = after(t, T_RESULT + 2600);
    const cards = pendingView
        ? [{ name: FEATURED_PLAYER.name, photo: FEATURED_PLAYER.photo, status: "PENDING" as const }]
        : [
            ...(!reverted ? [{ name: FEATURED_PLAYER.name, photo: FEATURED_PLAYER.photo, status: "SOLD" as const, team: "Lumen", price: PRICE }] : []),
            ...OTHERS.slice(0, soldFilter ? 7 : 3).map((o) => ({ name: o.name, photo: avatar(o.name), status: "SOLD" as const, team: o.team, price: o.price })),
        ];
    const activeFilter = pendingView ? 3 : soldFilter ? 1 : 0;
    const counts = reverted ? ["All (105)", "Sold (65)", "Unsold (21)", "Pending (19)"] : FILTERS;

    return (
        <WorkspaceFrame active="Players">
            <p className="text-sm font-bold text-foreground">Player Registry</p>
            <h1 className="mt-1 bg-gradient-primary bg-clip-text text-4xl font-black text-transparent">All Players</h1>
            <p className="mt-1 text-muted-foreground">105 registered players</p>
            {counts.map((f, i) => (
                <div key={f} className="absolute" style={{ left: filterX(i) - 60 - 230, top: FILTER_Y - 18 }}>
                    <span className="relative block">
                        <FakeButton variant={i === activeFilter ? "primary" : "outline"} className="h-9 w-[120px]"
                            pressed={(i === 1 && between(t, T_SOLD_FILTER, T_SOLD_FILTER + 250))}>
                            {f}
                        </FakeButton>
                        <Spotlight show={i === 1 && between(t, 2200, T_SOLD_FILTER)} />
                    </span>
                </div>
            ))}
            {cards.map((c, i) => (
                <Card key={c.name + c.status} {...c} pos={cardPos(i)}
                    spot={i === 0 && c.status === "SOLD" && between(t, 6400, T_CARD)}
                    pressed={i === 0 && between(t, T_CARD, T_CARD + 250)} />
            ))}
        </WorkspaceFrame>
    );
};

const Modal = ({ t }: { t: number }) => {
    const editing = after(t, T_EDIT + 250);
    const status = after(t, T_PICK) ? "Not Auctioned" : "Mark as Sold";
    const selectOpen = between(t, T_SELECT_OPEN, T_PICK + 200);
    return (
        <motion.div className="absolute inset-0 z-40 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute left-[400px] top-[40px] h-[660px] w-[480px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <div className="relative h-[170px] bg-muted/40">
                    <img src={FEATURED_PLAYER.photo} alt="" className="h-full w-full object-contain" />
                    <span className="absolute left-3 top-3 rounded bg-green-500 px-2 py-0.5 text-xs font-bold text-white">SOLD</span>
                    <span className="absolute bottom-3 left-3 rounded border bg-background/80 px-2 py-0.5 text-xs">#{FEATURED_PLAYER.lotNumber}</span>
                    <span className="absolute right-3 top-3 rounded-full bg-background/80 p-2"><X className="h-4 w-4" /></span>
                </div>
                <div className="space-y-3 p-5">
                    {!editing ? (
                        <>
                            <div>
                                <h2 className="text-2xl font-bold">{FEATURED_PLAYER.name}</h2>
                                <span className="mt-1 inline-block rounded bg-secondary px-2 py-0.5 text-xs">Regular</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-muted/50 p-3 text-center"><p className="text-xs text-muted-foreground">Base Price</p><p className="text-lg font-bold">1500 Pts</p></div>
                                <div className="rounded-lg bg-muted/50 p-3 text-center"><p className="text-xs text-muted-foreground">Sold For</p><p className="text-lg font-bold text-green-500">{PRICE} Pts</p></div>
                            </div>
                            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-center">
                                <p className="text-xs text-muted-foreground">Team</p>
                                <p className="text-lg font-semibold text-primary">Lumen</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-muted-foreground">Name, category and photo fields…</p>
                            <FakeSelect label="Auction Status" value={status} open={selectOpen}
                                options={["Not Auctioned", "Mark as Sold", "Mark as Unsold"]}
                                highlighted={after(t, T_PICK - 900) ? "Not Auctioned" : "Mark as Sold"} />
                            {status === "Mark as Sold" && !selectOpen && (
                                <>
                                    <div className="h-2" />
                                    <div className="text-sm font-medium">Sold Amount</div>
                                    <div className="flex h-10 items-center rounded-md border border-input px-3 text-sm">{PRICE}</div>
                                    <div className="text-sm font-medium">Team</div>
                                    <div className="flex h-10 items-center rounded-md border border-input px-3 text-sm">Lumen</div>
                                </>
                            )}
                        </>
                    )}
                </div>
                {/* action buttons, pinned to the bottom of the card */}
                <div className="absolute bottom-5 left-5 right-5 flex gap-2">
                    {editing ? (
                        <>
                            <FakeButton variant="outline" className="flex-1"><X className="h-4 w-4" /> Cancel</FakeButton>
                            <span className="relative flex-1">
                                <FakeButton className="w-full" pressed={between(t, T_SAVE, T_SAVE + 250)}><Save className="h-4 w-4" /> Save</FakeButton>
                                <Spotlight show={between(t, 21000, T_SAVE)} />
                            </span>
                        </>
                    ) : (
                        <>
                            <FakeButton variant="outline" className="w-10 px-0 text-destructive"><Trash2 className="h-4 w-4" /></FakeButton>
                            <span className="relative flex-1">
                                <FakeButton className="w-full" pressed={between(t, T_EDIT, T_EDIT + 250)}><Edit3 className="h-4 w-4" /> Edit</FakeButton>
                                <Spotlight show={between(t, 10600, T_EDIT)} />
                            </span>
                        </>
                    )}
                </div>
                {editing && <Spotlight show={between(t, 14200, T_SELECT_OPEN)} className="!inset-auto left-4 right-4 top-[214px] h-[80px]" />}
            </div>
        </motion.div>
    );
};

const PurseCard = ({ t }: { t: number }) => {
    const refunded = after(t, T_RESULT + 800);
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="absolute right-8 top-[96px] z-30 flex w-[360px] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl">
            <img src={LUMEN.logo} alt="" className="h-12 w-12 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
                <p className="font-bold">Lumen</p>
                <p className="text-xs text-muted-foreground">Remaining budget</p>
            </div>
            <div className="text-right">
                <p className={"text-xl font-black tabular-nums " + (refunded ? "text-green-500" : "")}>
                    {refunded ? LUMEN_PURSE_AFTER + PRICE : LUMEN_PURSE_AFTER} Pts
                </p>
                {refunded && <p className="text-xs font-semibold text-green-500">+{PRICE} refunded</p>}
            </div>
        </motion.div>
    );
};

const SheetHistory = ({ t }: { t: number }) => (
    <WorkspaceFrame active="Player sheet">
        <h1 className="text-2xl font-bold">Player sheet</h1>
        <div className="absolute right-8 top-8">
            <span className="relative block">
                <FakeButton variant="outline" className="h-9" pressed={between(t, T_SHEET + 1200, T_SHEET + 1450)}>
                    <History className="h-3.5 w-3.5" /> History
                </FakeButton>
                <Spotlight show={between(t, T_SHEET + 200, T_SHEET + 1200)} />
            </span>
        </div>
        <AnimatePresence>
            {after(t, T_SHEET + 1500) && (
                <motion.div className="absolute inset-0 z-40 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="absolute left-[140px] top-[110px] w-[672px] rounded-xl border border-border bg-card p-6 shadow-2xl">
                        <h3 className="text-lg font-semibold">Change history</h3>
                        <p className="text-sm text-muted-foreground">Every edit, verification and renumber, newest first. Undo one on its own, or roll everything back to just before it.</p>
                        <div className="mt-4 rounded-lg border border-border p-3">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium">Edited player</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">11/7/2026, 9:42:10 pm · 1 player</p>
                                    <p className="mt-1.5 text-xs text-muted-foreground/80"><span className="text-foreground/70">{FEATURED_PLAYER.name}</span> sold: <span className="line-through">false</span> → true</p>
                                    <p className="text-xs text-muted-foreground/80"><span className="text-foreground/70">{FEATURED_PLAYER.name}</span> amtSold: <span className="line-through">empty</span> → {PRICE}</p>
                                    <p className="text-xs text-muted-foreground/60">+ 1 more</p>
                                </div>
                                <div className="flex shrink-0 flex-col gap-1.5">
                                    <span className="relative">
                                        <FakeButton variant="outline" className="h-7 px-3 text-xs"><Undo2 className="h-3 w-3" /> Undo this</FakeButton>
                                        <Spotlight show={after(t, T_SHEET + 2600)} />
                                    </span>
                                    <FakeButton variant="ghost" className="h-7 px-3 text-xs">Back to here</FakeButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </WorkspaceFrame>
);

const Scene = ({ t }: SceneProps) => {
    if (t >= T_SHEET) return <SheetHistory t={t} />;
    return (
        <div className="relative h-full w-full">
            <PlayersPage t={t} />
            <AnimatePresence>{between(t, T_CARD + 300, T_SAVE + 400) && <Modal t={t} />}</AnimatePresence>
            {after(t, T_RESULT) && <PurseCard t={t} />}
        </div>
    );
};

const first = cardPos(0);
const cardCenter = { x: first.x + CARD_W / 2, y: first.y - 70 + CARD_H / 2 };

const guide: GuideDefinition = {
    slug: "unsell-player",
    title: "Unsell a sold player",
    summary: "Sold someone by mistake? Change their Auction Status from the Players page — the team gets its points back and the player returns to the pool.",
    group: "Auction night",
    audience: "Organiser",
    url: "cricbid.online/tournament/jain-unity-cup/manage/players",
    duration: DURATION,
    steps: [
        { at: 0, title: "Open Players in the workspace", detail: "Every player is listed with their auction status." },
        { at: 2600, title: "Filter to Sold", detail: "Narrow the list down to players who have been sold." },
        { at: 6200, title: "Open the player sold by mistake", detail: "The card opens their details: sold price and team." },
        { at: 10400, title: "Tap Edit", detail: "Status, sold amount and team become editable." },
        { at: 14000, title: "Set Auction Status to Not Auctioned", detail: "Not Auctioned puts them back in the pool; Mark as Unsold keeps them out until Reset unsold players." },
        { at: 20800, title: "Save", detail: "The team and sold price are cleared together." },
        { at: 23600, title: "The team's purse is refunded", detail: "Budgets are worked out from sold players, so the points return straight away." },
        { at: 31000, title: "Or undo the sale from the Player sheet", detail: "History → Undo this reverts the sale; the player stays marked unsold." },
    ],
    cursor: [
        { at: 0, x: 900, y: 600 },
        { at: 3000, x: filterX(1), y: FILTER_Y },
        { at: T_SOLD_FILTER, x: filterX(1), y: FILTER_Y, click: true },
        { at: 7100, x: cardCenter.x, y: cardCenter.y },
        { at: T_CARD, x: cardCenter.x, y: cardCenter.y, click: true },
        { at: 11300, x: 664, y: 660 },
        { at: T_EDIT, x: 664, y: 660, click: true },
        { at: 15000, x: 640, y: 306 },
        { at: T_SELECT_OPEN, x: 640, y: 306, click: true },
        { at: 17400, x: 640, y: 355 },
        { at: T_PICK, x: 640, y: 355, click: true },
        { at: 21900, x: 752, y: 660 },
        { at: T_SAVE, x: 752, y: 660, click: true },
        { at: 25500, x: 1060, y: 150 },
        { at: 31800, x: 1198, y: 50 },
        { at: T_SHEET + 1200, x: 1198, y: 50, click: true },
        { at: 35000, x: 973, y: 244 },
    ],
    Scene,
};

export default guide;
