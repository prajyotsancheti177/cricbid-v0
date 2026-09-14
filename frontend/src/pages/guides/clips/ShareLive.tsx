import { Check, Copy, Eye, Gavel, HelpCircle, Monitor, SplitSquareHorizontal, Tv, Volume2 } from "lucide-react";
import type { GuideDefinition, SceneProps } from "../kit/types";
import { Spotlight, FakeInput, FakeButton } from "../kit/primitives";
import { after, between, typed } from "../kit/timeline";
import { FEATURED_PLAYER, TEAMS } from "@/pages/demo/demoData";
import { cn } from "@/lib/utils";

/*
 * Real-product facts this clip follows:
 * - /auction (LiveAuctionLobby): "Live Auctions" cards with a "Live Now" badge, an Eye
 *   viewer count and an "Enter Room" footer button.
 * - The room URL /auction/room/:tournamentId is the share link; anyone opening it
 *   without hosting sees the "Viewer Mode" pill. There is no dedicated share button.
 * - OverlayControlBar (auctioneer only, when features.obsOverlays is on): Camera HUD /
 *   Fullscreen / Split Screen buttons copy /overlay/:id/<layout>; "OBS Guide" says
 *   Browser Source, 1920×1080, stream via Settings → Stream.
 * - Layouts are switched as separate OBS scenes: the backend relays
 *   overlay:layout_change, but no frontend screen emits it today.
 */

const ROOM = "cricbid.online/auction/room/jain-unity-cup";
const HUD_URL = "https://cricbid.online/overlay/jain-unity-cup/camera-hud";
const leader = TEAMS[0];

const Box = ({ x, y, w, h, show, r = "rounded-xl" }: { x: number; y: number; w: number; h: number; show: boolean; r?: string }) => (
    <div className="pointer-events-none absolute" style={{ left: x, top: y, width: w, height: h }}>
        <Spotlight show={show} className={r} />
    </div>
);

/* ---------- Phase A: lobby ---------- */
const Lobby = ({ t }: SceneProps) => {
    const viewers = Math.min(18, 3 + Math.floor(Math.max(0, t - 1000) / 900));
    const pressed = between(t, 6400, 6800);
    return (
        <div className="absolute inset-0 bg-background p-[60px_80px]">
            <h1 className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">Live Auctions</h1>
            <p className="mt-2 text-muted-foreground">Join active auctions as a viewer or start your own.</p>
            {[
                { name: "Jain Unity Cup", live: true, v: viewers },
                { name: "Chhatrapati Shivaji Maharaj Khel Mahotsav", live: false, v: 2 },
            ].map((a, i) => (
                <div key={a.name} className={cn("absolute overflow-hidden rounded-lg border-2 border-border bg-card", i === 0 && pressed && "scale-[0.98]")}
                    style={{ left: 80 + i * 390, top: 190, width: 360, height: 250 }}>
                    <div className="bg-muted/30 p-5 pb-4">
                        <div className="flex items-start justify-between">
                            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", a.live ? "bg-green-500 text-white" : "bg-secondary text-secondary-foreground")}>
                                {a.live ? "Live Now" : "Waiting for Host"}
                            </span>
                            <span className="flex items-center text-sm text-muted-foreground"><Eye className="mr-1 h-3.5 w-3.5" />{a.v}</span>
                        </div>
                        <p className="mt-2 truncate text-xl font-semibold">{a.name}</p>
                    </div>
                    <div className="flex items-center gap-2 p-5 pt-6 text-sm text-foreground/80">
                        <Gavel className="h-4 w-4 text-primary" /> Click to join room
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 border-t bg-muted/10 p-3">
                        <div className={cn("flex h-10 items-center justify-center rounded-md text-sm font-medium", i === 0 && after(t, 5000) ? "bg-primary/10 text-primary" : "")}>Enter Room</div>
                    </div>
                </div>
            ))}
            <Box x={92} y={380} w={336} h={44} show={between(t, 4800, 6600)} r="rounded-md" />
        </div>
    );
};

/* ---------- Phase B/C: room + phone ---------- */
const layouts = [
    { id: "camera-hud", label: "Camera HUD", icon: Monitor, x: 40, w: 132 },
    { id: "fullscreen", label: "Fullscreen", icon: Tv, x: 180, w: 116 },
    { id: "split-screen", label: "Split Screen", icon: SplitSquareHorizontal, x: 304, w: 128 },
];

const Room = ({ t }: SceneProps) => {
    const barSelected = between(t, 11000, 14500);
    const hudCopied = between(t, 22500, 24500);
    const showPhone = after(t, 13000);
    const viewers = Math.min(24, 18 + Math.floor(Math.max(0, t - 14000) / 900));
    return (
        <div className="absolute inset-0 bg-background">
            {/* in-scene address bar — this is the link to share */}
            <div className="absolute left-0 right-0 top-0 flex h-14 items-center gap-3 border-b border-border bg-card px-6">
                <span className="h-3 w-3 rounded-full bg-red-500/70" /><span className="h-3 w-3 rounded-full bg-yellow-500/70" /><span className="h-3 w-3 rounded-full bg-green-500/70" />
                <div className={cn("ml-24 flex h-9 w-[600px] items-center rounded-full border px-4 text-sm", barSelected ? "border-primary bg-primary/10" : "border-border bg-background")}>
                    <span className={cn(barSelected && "bg-blue-500/40")}>{ROOM}</span>
                </div>
                {between(t, 11400, 14500) && <span className="rounded-md bg-green-500/15 px-2 py-1 text-xs font-medium text-green-400">Link copied</span>}
            </div>
            <Box x={192} y={10} w={600} h={36} show={between(t, 9500, 11100)} r="rounded-full" />

            {/* OverlayControlBar */}
            <div className="absolute" style={{ top: 88, left: 0 }}>
                {layouts.map((l) => {
                    const Icon = l.icon;
                    const copied = l.id === "camera-hud" && hudCopied;
                    return (
                        <span key={l.id} className={cn("absolute flex h-9 items-center gap-2 rounded-lg border px-3 text-xs",
                            copied ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-border text-muted-foreground")}
                            style={{ left: l.x, width: l.w }}>
                            <Icon className="h-3.5 w-3.5" /><span className="font-medium">{l.label}</span>
                            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 opacity-50" />}
                        </span>
                    );
                })}
                <span className="absolute flex h-9 w-[110px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted-foreground" style={{ left: 440 }}>
                    <HelpCircle className="h-3.5 w-3.5" /><span className="font-medium">OBS Guide</span>
                </span>
            </div>
            <Box x={40} y={88} w={132} h={36} show={between(t, 20800, 22600)} r="rounded-lg" />

            {/* host header pill + player */}
            <div className="absolute left-[160px] top-[150px] flex items-center gap-3 rounded-full border-2 border-primary bg-card px-6 py-2">
                <span className="text-xl font-bold">Player #{FEATURED_PLAYER.lotNumber}</span>
                <span className="rounded-full border border-secondary/30 bg-secondary/20 px-2 py-0.5 text-sm">{FEATURED_PLAYER.category}</span>
            </div>
            <div className="absolute left-[800px] top-[152px] flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Volume2 className="h-5 w-5" /></div>
            <div className="absolute left-[40px] top-[220px] flex w-[800px] gap-6 rounded-2xl border border-border bg-card p-6">
                <img src={FEATURED_PLAYER.photo} alt="" className="h-[300px] w-[240px] rounded-xl object-cover" />
                <div className="flex flex-col justify-center">
                    <p className="text-4xl font-black">{FEATURED_PLAYER.name}</p>
                    <p className="mt-1 text-muted-foreground">Base price {FEATURED_PLAYER.basePrice} Pts</p>
                    <p className="mt-8 text-sm tracking-widest text-muted-foreground">CURRENT BID</p>
                    <p className="text-6xl font-black text-primary">3900 Pts</p>
                    <div className="mt-3 flex items-center gap-3">
                        <img src={leader.logo} alt="" className="h-10 w-10 rounded-full object-cover" />
                        <span className="text-xl font-bold">{leader.name}</span>
                    </div>
                </div>
            </div>

            {/* viewer phone */}
            {showPhone && (
                <div className="absolute left-[900px] top-[90px] h-[600px] w-[300px] rounded-[40px] border-[10px] border-zinc-800 bg-background p-3 shadow-2xl"
                    style={{ opacity: Math.min(1, (t - 13000) / 500) }}>
                    <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-zinc-800" />
                    <div className="flex items-center justify-between">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">Viewer Mode</span>
                        <span className="flex items-center text-xs text-muted-foreground"><Eye className="mr-1 h-3 w-3" />{viewers}</span>
                    </div>
                    <div className="mt-3 rounded-full border-2 border-primary bg-card py-1 text-center text-sm font-bold">Player #{FEATURED_PLAYER.lotNumber}</div>
                    <img src={FEATURED_PLAYER.photo} alt="" className="mt-3 h-[220px] w-full rounded-xl object-cover" />
                    <p className="mt-2 text-lg font-black">{FEATURED_PLAYER.name}</p>
                    <p className="text-xs tracking-widest text-muted-foreground">CURRENT BID</p>
                    <p className="text-3xl font-black text-primary">3900 Pts</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold"><img src={leader.logo} alt="" className="h-6 w-6 rounded-full object-cover" />{leader.name}</div>
                </div>
            )}

            {/* OBS: Browser Source properties */}
            {between(t, 25000, 32300) && (
                <div className="absolute inset-0 z-30 bg-black/60">
                    <div className="absolute rounded-lg border border-zinc-700 bg-[#2b2b33] p-6 text-zinc-100 shadow-2xl" style={{ left: 340, top: 170, width: 600, height: 420 }}>
                        <p className="text-sm text-zinc-400">OBS Studio · Scene "Auction HUD"</p>
                        <p className="mt-1 text-xl font-bold">Properties for 'Browser'</p>
                        <FakeInput className="mt-5" label="URL" value={typed(HUD_URL, t, 26200, 45)} focused={between(t, 26000, 29000)} />
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <FakeInput label="Width" value={after(t, 28300) ? "1920" : ""} />
                            <FakeInput label="Height" value={after(t, 28800) ? "1080" : ""} />
                        </div>
                        <div className="absolute" style={{ right: 24, bottom: 24, width: 84, height: 40 }}>
                            <FakeButton pressed={between(t, 31400, 31800)} className="h-10 w-full">OK</FakeButton>
                            <Spotlight show={between(t, 30000, 31600)} className="rounded-md" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ---------- Phase D: OBS preview ---------- */
const HudPreview = () => (
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-zinc-800 to-zinc-900">
        <p className="absolute left-6 top-5 text-xs uppercase tracking-widest text-white/40">Camera feed</p>
        <div className="absolute bottom-5 left-[150px] right-5 flex items-center gap-6 rounded-2xl px-6 py-3 text-white"
            style={{ background: "rgba(15,10,30,0.95)", borderBottom: "4px solid #f59e0b" }}>
            <div className="flex-1">
                <p className="text-2xl font-black"><span className="mr-2 text-white/40">#{FEATURED_PLAYER.lotNumber}</span>{FEATURED_PLAYER.name}</p>
                <span className="mt-1 inline-block rounded-full bg-amber-400/20 px-3 py-0.5 text-xs text-amber-300">{FEATURED_PLAYER.category}</span>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-bold tracking-[3px] text-white/50">CURRENT BID</p>
                <p className="text-4xl font-black text-amber-300">4200 <span className="text-2xl">Pts</span></p>
                <p className="flex items-center justify-end gap-2 text-sm font-extrabold text-amber-400">{leader.name}<img src={leader.logo} alt="" className="h-6 w-6 rounded-full object-cover" /><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /></p>
            </div>
        </div>
        <img src={FEATURED_PLAYER.photo} alt="" className="absolute bottom-5 left-5 h-[150px] w-[115px] rounded-xl border-2 border-amber-400 object-cover" />
    </div>
);

const FullscreenPreview = () => (
    <div className="absolute inset-0 flex gap-4 bg-[#0f0a1e] p-5 text-white">
        <div className="w-[260px] rounded-xl bg-white/5 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Teams Overview</p>
            {TEAMS.map((tm, i) => (
                <div key={tm.name} className="flex items-center gap-2 border-b border-white/5 py-1 text-xs">
                    <img src={tm.logo} alt="" className="h-5 w-5 rounded-full object-cover" />
                    <span className="flex-1 truncate font-semibold">{tm.name}</span>
                    <span className="text-white/70">{[5400, 8200, 6100, 9000, 7300, 6800, 8800, 7700][i]} Pts</span>
                </div>
            ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center">
            <img src={FEATURED_PLAYER.photo} alt="" className="h-[220px] w-[170px] rounded-2xl border-2 border-amber-400 object-cover" />
            <p className="mt-3 text-3xl font-black">{FEATURED_PLAYER.name}</p>
            <p className="text-5xl font-black text-amber-300">4200 Pts</p>
            <p className="mt-1 font-bold text-amber-400">{leader.name}</p>
        </div>
    </div>
);

const Obs = ({ t }: SceneProps) => {
    const live = after(t, 35700);
    const full = after(t, 40700);
    return (
        <div className="absolute inset-0 bg-[#1e1e24] text-zinc-200">
            <div className="absolute overflow-hidden border border-zinc-700 bg-black" style={{ left: 190, top: 24, width: 900, height: 506 }}>
                {full ? <FullscreenPreview /> : <HudPreview />}
            </div>
            {live && <span className="absolute left-[1110px] top-[30px] rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">● LIVE · YouTube</span>}
            <div className="absolute rounded border border-zinc-700 bg-[#27272f]" style={{ left: 40, top: 560, width: 300, height: 150 }}>
                <p className="h-8 border-b border-zinc-700 px-3 text-sm leading-8 text-zinc-400">Scenes</p>
                {["Auction HUD", "Auction Fullscreen", "Auction Split Screen"].map((s, i) => (
                    <p key={s} className={cn("h-9 px-3 text-sm leading-9", (full ? i === 1 : i === 0) && "bg-blue-600/40 text-white")}>{s}</p>
                ))}
            </div>
            <Box x={40} y={628} w={300} h={36} show={between(t, 39000, 40800)} r="rounded" />
            <div className="absolute rounded border border-zinc-700 bg-[#27272f]" style={{ left: 360, top: 560, width: 300, height: 150 }}>
                <p className="h-8 border-b border-zinc-700 px-3 text-sm leading-8 text-zinc-400">Sources</p>
                <p className="h-9 px-3 text-sm leading-9">🌐 CricBid overlay (Browser)</p>
                <p className="h-9 px-3 text-sm leading-9">📷 Camera</p>
            </div>
            <div className="absolute" style={{ left: 1060, top: 580, width: 180, height: 40 }}>
                <span className={cn("flex h-10 items-center justify-center rounded text-sm font-medium", live ? "bg-red-700 text-white" : "bg-zinc-700")}>
                    {live ? "Stop Streaming" : "Start Streaming"}
                </span>
                <Spotlight show={between(t, 34000, 35800)} className="rounded" />
            </div>
        </div>
    );
};

const Scene = ({ t }: SceneProps) => {
    if (t < 9000) return <Lobby t={t} />;
    if (t < 33000) return <Room t={t} />;
    return <Obs t={t} />;
};

const guide: GuideDefinition = {
    slug: "share-live",
    title: "Share the live auction and OBS overlays",
    summary: "Send the room link so people watch on their phones, then add CricBid's Camera HUD or Fullscreen overlay to OBS and stream the auction to YouTube.",
    group: "Auction night",
    audience: "Organiser",
    url: "cricbid.online/auction",
    duration: 46000,
    steps: [
        { at: 0, title: "Open Live Auctions", detail: "Every running auction is listed with its live viewer count." },
        { at: 4500, title: "Enter the auction room", detail: "Click Enter Room on your tournament's card." },
        { at: 9000, title: "Share the room link", detail: "Copy the room address and send it on WhatsApp." },
        { at: 13500, title: "Viewers watch on their phones", detail: "The link opens in Viewer Mode and the viewer count climbs." },
        { at: 20000, title: "Copy an overlay URL", detail: "In the host bar, click Camera HUD to copy its link." },
        { at: 25000, title: "Add it as a Browser Source in OBS", detail: "Paste the URL and set the size to 1920 × 1080." },
        { at: 33000, title: "Start streaming", detail: "The overlay follows every bid automatically." },
        { at: 38500, title: "Switch layouts with OBS scenes", detail: "Put each layout in its own scene and click to switch." },
    ],
    cursor: [
        { at: 0, x: 700, y: 520 },
        { at: 5200, x: 260, y: 402 },
        { at: 6500, x: 260, y: 402, click: true },
        { at: 9400, x: 640, y: 300 },
        { at: 11000, x: 492, y: 28, click: true },
        { at: 16000, x: 700, y: 420 },
        { at: 21800, x: 106, y: 106 },
        { at: 22500, x: 106, y: 106, click: true },
        { at: 26000, x: 640, y: 290 },
        { at: 30600, x: 874, y: 546 },
        { at: 31500, x: 874, y: 546, click: true },
        { at: 34600, x: 1150, y: 600 },
        { at: 35600, x: 1150, y: 600, click: true },
        { at: 39800, x: 150, y: 646 },
        { at: 40600, x: 150, y: 646, click: true },
        { at: 43000, x: 1180, y: 700 },
    ],
    Scene,
};

export default guide;
