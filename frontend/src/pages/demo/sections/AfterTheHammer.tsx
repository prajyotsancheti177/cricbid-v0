import { useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Monitor, Radio } from "lucide-react";
import { FEATURED_PLAYER, TOURNAMENT, formatPts } from "../demoData";

/**
 * What happens in the seconds after a player is sold: the WhatsApp that reaches
 * the player, and the three OBS overlays that carry it to the stream.
 *
 * The message copy mirrors the live Meta-approved templates, filled with the
 * real result for this lot.
 */

const MESSAGES = [
    {
        id: "sold",
        time: "6:22 pm",
        body: (
            <>
                Hi <strong>{FEATURED_PLAYER.name}</strong> 🎉 Congratulations! You have been sold to{" "}
                <strong className="text-emerald-400">{FEATURED_PLAYER.soldTo}</strong> for{" "}
                <strong className="text-amber-400">{formatPts(FEATURED_PLAYER.finalPrice)}</strong> in the{" "}
                {TOURNAMENT.name}.
            </>
        ),
    },
    {
        id: "category",
        time: "5:58 pm",
        body: (
            <>
                🔔 Heads up — the <strong className="text-amber-400">Regular</strong> category auction is
                starting right now. Keep an eye on the stream.
            </>
        ),
    },
    {
        id: "summary",
        time: "8:04 pm",
        body: (
            <>
                Hi <strong>Mr. Tarang Totla</strong> 🏆 The auction for{" "}
                <strong>{FEATURED_PLAYER.soldTo}</strong> is complete.
                <br />
                Your final squad is ready to view, with every price and the purse you have left.
                <br />
                <span className="text-emerald-400">View squad →</span>
            </>
        ),
    },
];

const OVERLAYS = [
    {
        id: "camera",
        name: "Camera HUD",
        blurb: "Transparent lower-third over your live camera — player, bid and leading team, nothing else.",
    },
    {
        id: "fullscreen",
        name: "Fullscreen",
        blurb: "Opaque 1920×1080 scene, no camera needed. Background tints to the leading team's colour.",
    },
    {
        id: "split",
        name: "Split screen",
        blurb: "Camera on one side, auction data on the other — the format for a hosted, commentated stream.",
    },
];

const AfterTheHammer = () => {
    const [activeOverlay, setActiveOverlay] = useState("camera");

    return (
        <>
            {/* WhatsApp */}
            <section className="py-20 md:py-28">
                <div className="container mx-auto px-4">
                    <div className="mb-10 max-w-3xl">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                            WhatsApp automation
                        </p>
                        <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                            Every player knows before they leave the ground.
                        </h2>
                        <p className="text-base text-muted-foreground md:text-lg">
                            The moment the hammer falls, the player gets a message with their team and
                            amount. Owners get a squad summary at the end. Nobody types a thing.
                        </p>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-2">
                        <ul className="space-y-3">
                            {[
                                "Sold and unsold results, sent per player",
                                "“Your category is starting now” call-ups",
                                "Budget warnings to team owners at 80% spend",
                                "End-of-auction squad summary with a results link",
                                "Official Meta-approved templates, every send logged",
                            ].map((item) => (
                                <li
                                    key={item}
                                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                                >
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                    <span className="text-sm">{item}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Chat mock */}
                        <div className="overflow-hidden rounded-2xl border border-border bg-[#0b141a]">
                            <div className="flex items-center gap-3 border-b border-white/5 bg-[#202c33] px-4 py-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                                    CB
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">
                                        CricBid · {TOURNAMENT.organiser}
                                    </p>
                                    <p className="text-xs text-white/50">Business account</p>
                                </div>
                            </div>

                            <div className="space-y-3 p-4">
                                {MESSAGES.map((message, i) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.12 }}
                                        className="rounded-lg rounded-tl-none bg-[#005c4b] p-3"
                                    >
                                        <p className="text-sm leading-relaxed text-white/90">{message.body}</p>
                                        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-white/50">
                                            {message.time}
                                            <CheckCheck className="h-3 w-3 text-sky-400" />
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* OBS overlays */}
            <section className="py-20 md:py-28">
                <div className="container mx-auto px-4">
                    <div className="mb-10 max-w-3xl">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                            Live streaming
                        </p>
                        <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                            Broadcast it like the real thing.
                        </h2>
                        <p className="text-base text-muted-foreground md:text-lg">
                            Three OBS browser sources, one URL each. Paste into OBS, stream to YouTube or
                            Facebook — no extra setup, no operator driving the graphics.
                        </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
                        {/* Overlay preview */}
                        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-950 to-black">
                            {/* A stand-in for the camera feed behind the HUD */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.18),transparent_60%)]" />

                            <div className="relative flex aspect-video flex-col justify-between p-5 md:p-7">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                        Live
                                    </span>
                                    <span className="text-xs text-white/60">
                                        {FEATURED_PLAYER.category} · Lot #{FEATURED_PLAYER.lotNumber}
                                    </span>
                                </div>

                                <div
                                    className={`flex items-end gap-4 ${
                                        activeOverlay === "split" ? "justify-end text-right" : ""
                                    }`}
                                >
                                    {activeOverlay !== "camera" && (
                                        <img
                                            src={FEATURED_PLAYER.photo}
                                            alt={FEATURED_PLAYER.name}
                                            loading="lazy"
                                            className="h-28 w-24 rounded-lg object-cover shadow-xl md:h-36 md:w-28"
                                        />
                                    )}

                                    <div className="flex-1">
                                        <p className="text-2xl font-black leading-tight text-white md:text-4xl">
                                            {FEATURED_PLAYER.name}
                                        </p>
                                        <p className="mb-3 text-sm text-purple-300">
                                            {FEATURED_PLAYER.category} · {TOURNAMENT.organiser}
                                        </p>

                                        <div className="flex items-end justify-between border-t border-white/15 pt-3">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-white/50">
                                                    Current bid
                                                </p>
                                                <p className="text-2xl font-black text-amber-400 md:text-3xl">
                                                    {formatPts(FEATURED_PLAYER.finalPrice)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase tracking-wider text-white/50">
                                                    Leading bid
                                                </p>
                                                <p className="font-bold text-white">
                                                    {FEATURED_PLAYER.soldTo}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Overlay picker */}
                        <div className="space-y-3">
                            {OVERLAYS.map((overlay) => (
                                <button
                                    key={overlay.id}
                                    onClick={() => setActiveOverlay(overlay.id)}
                                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                                        activeOverlay === overlay.id
                                            ? "border-primary bg-primary/10"
                                            : "border-border bg-card hover:border-primary/50"
                                    }`}
                                >
                                    <p className="mb-1 flex items-center gap-2 font-semibold">
                                        {overlay.id === "camera" ? (
                                            <Radio className="h-4 w-4 text-primary" />
                                        ) : (
                                            <Monitor className="h-4 w-4 text-primary" />
                                        )}
                                        {overlay.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{overlay.blurb}</p>
                                </button>
                            ))}

                            <p className="px-1 text-xs text-muted-foreground">
                                SOLD and UNSOLD stamps, confetti and bid pulses fire on the overlay
                                automatically — the stream reacts without anyone touching it.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

export default AfterTheHammer;
