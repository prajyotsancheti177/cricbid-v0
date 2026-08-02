import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Gavel, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BID_LADDER, FEATURED_PLAYER, TEAMS, TOURNAMENT, formatINR } from "../demoData";
import { useInViewOnce } from "../useInViewOnce";

/**
 * The centrepiece: a bid-by-bid replay of a real auction lot.
 *
 * This is not a mock-up with invented numbers. Every bid, team and amount below
 * is replayed from the production AuctionLog for Pushkar Sancheti — 156 bids
 * across five teams, ending at ₹1,45,000. Because it is the real ladder, the
 * increment genuinely switches from +₹500 to +₹1,000 as it crosses ₹40,000,
 * which is the clearest possible demonstration of the slab engine.
 */

/** Playback speeds, in milliseconds between bids. */
const SPEEDS = [
    { label: "1×", ms: 420 },
    { label: "2×", ms: 210 },
    { label: "4×", ms: 95 },
];

/**
 * Per-team purse for the replay. The production auction ran on a purse the log
 * doesn't record per-bid, so this is a representative ceiling used only to show
 * how the max-bid tiles behave — the bid amounts themselves are all real.
 */
const DEMO_PURSE = 400000;

const AuctionReplay = () => {
    const [index, setIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [hasFinished, setHasFinished] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sectionRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const hasAutoStarted = useRef(false);

    const current = BID_LADDER[index];
    const isLastBid = index >= BID_LADDER.length - 1;

    // Start the replay once the host screen scrolls into view, so the section is
    // already alive by the time the reader reaches it.
    const stageInView = useInViewOnce(stageRef);

    useEffect(() => {
        if (stageInView && !hasAutoStarted.current) {
            hasAutoStarted.current = true;
            setIsPlaying(true);
        }
    }, [stageInView]);

    useEffect(() => {
        if (!isPlaying) return;

        if (isLastBid) {
            setIsPlaying(false);
            setHasFinished(true);
            return;
        }

        timerRef.current = setTimeout(() => setIndex((i) => i + 1), SPEEDS[speed].ms);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isPlaying, index, isLastBid, speed]);

    const restart = useCallback(() => {
        setIndex(0);
        setHasFinished(false);
        setIsPlaying(true);
    }, []);

    /** Which teams have bid so far, and their latest bid — drives the tiles. */
    const teamState = useMemo(() => {
        const latest = new Map<string, number>();
        for (let i = 0; i <= index; i++) {
            latest.set(BID_LADDER[i].team, BID_LADDER[i].amount);
        }
        return latest;
    }, [index]);

    const nextBidAmount = current.amount + (current.amount >= 40000 ? 1000 : 500);
    const activeIncrement = current.amount >= 40000 ? 1000 : 500;

    // The last few bids, newest first — the auctioneer's running ladder.
    const recentBids = useMemo(
        () => BID_LADDER.slice(Math.max(0, index - 6), index + 1).reverse(),
        [index]
    );

    const progressPct = (index / (BID_LADDER.length - 1)) * 100;

    return (
        <section ref={sectionRef} className="relative py-20 md:py-28">
            <div className="container mx-auto px-4">
                <div className="mb-10 max-w-3xl">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        The live auction — replayed from real data
                    </p>
                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                        156 bids. Five teams. One screen.
                    </h2>
                    <p className="text-base text-muted-foreground md:text-lg">
                        This is the actual bidding war for {FEATURED_PLAYER.name} at the{" "}
                        {TOURNAMENT.name}, replayed bid by bid from the auction log. Nothing here is
                        invented — press play and watch a real lot climb from{" "}
                        {formatINR(FEATURED_PLAYER.basePrice)} to {formatINR(FEATURED_PLAYER.finalPrice)}.
                    </p>
                </div>

                {/* Playback controls */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Button
                        onClick={() => (isLastBid ? restart() : setIsPlaying((p) => !p))}
                        className="gap-2"
                        size="lg"
                    >
                        {isLastBid ? (
                            <>
                                <RotateCcw className="h-4 w-4" /> Replay
                            </>
                        ) : isPlaying ? (
                            <>
                                <Pause className="h-4 w-4" /> Pause
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" /> Play the auction
                            </>
                        )}
                    </Button>

                    <div className="flex gap-1 rounded-lg border border-border p-1">
                        {SPEEDS.map((option, i) => (
                            <button
                                key={option.label}
                                onClick={() => setSpeed(i)}
                                className={`rounded px-3 py-1 text-sm transition-colors ${
                                    speed === i ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto text-sm tabular-nums text-muted-foreground">
                        Bid <span className="font-semibold text-foreground">{current.order}</span> of{" "}
                        {BID_LADDER.length}
                    </div>
                </div>

                {/* Scrubber */}
                <div className="mb-8">
                    <input
                        type="range"
                        min={0}
                        max={BID_LADDER.length - 1}
                        value={index}
                        onChange={(e) => {
                            setIsPlaying(false);
                            setIndex(Number(e.target.value));
                        }}
                        aria-label="Scrub through the auction"
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                        style={{
                            background: `linear-gradient(to right, hsl(var(--primary)) ${progressPct}%, hsl(var(--muted)) ${progressPct}%)`,
                        }}
                    />
                </div>

                {/* The host screen */}
                <div ref={stageRef} className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
                    {/* Player card */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Lot #{FEATURED_PLAYER.lotNumber}
                            </span>
                            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-500">
                                {FEATURED_PLAYER.category}
                            </span>
                        </div>

                        <div className="mb-4 overflow-hidden rounded-xl">
                            <img
                                src={FEATURED_PLAYER.photo}
                                alt={FEATURED_PLAYER.name}
                                // Eager: this is the replay's primary image and
                                // deferring it shows an empty card on arrival.
                                loading="eager"
                                className="aspect-[3/4] w-full object-cover"
                            />
                        </div>

                        <h3 className="mb-1 text-2xl font-bold">{FEATURED_PLAYER.name}</h3>

                        <p className="mb-5 text-xs uppercase tracking-wider text-muted-foreground">
                            Current bid
                        </p>

                        {/* The number that matters. Keyed so each bid animates in. */}
                        <div className="mb-1 h-14 overflow-hidden">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={current.amount}
                                    initial={{ y: 28, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -28, opacity: 0 }}
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                    className="text-4xl font-black tabular-nums text-primary"
                                >
                                    {formatINR(current.amount)}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <p className="mb-4 text-sm">
                            <span className="text-muted-foreground">Leading: </span>
                            <span className="font-semibold">{current.team}</span>
                        </p>

                        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                            <span>Base {formatINR(FEATURED_PLAYER.basePrice)}</span>
                            <motion.span
                                key={activeIncrement}
                                initial={{ scale: 1.25, color: "hsl(var(--primary))" }}
                                animate={{ scale: 1, color: "hsl(var(--muted-foreground))" }}
                                transition={{ duration: 0.5 }}
                                className="font-semibold"
                            >
                                Increment +{activeIncrement.toLocaleString("en-IN")}
                            </motion.span>
                        </div>
                    </div>

                    {/* Teams + ladder */}
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Click a team to bid
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Next bid {formatINR(nextBidAmount)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {TEAMS.map((team) => {
                                    const isLeading = team.name === current.team;
                                    const teamBid = teamState.get(team.name);
                                    // A team is blocked once the next bid would exceed its purse —
                                    // the same rule the live auction enforces.
                                    const isBlocked = nextBidAmount > DEMO_PURSE;

                                    return (
                                        <div
                                            key={team.name}
                                            className={`rounded-xl border-2 p-3 text-center transition-all duration-200 ${
                                                isLeading
                                                    ? "scale-[1.03] border-primary bg-primary/15 shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
                                                    : isBlocked
                                                      ? "border-red-500/50 bg-red-500/10"
                                                      : "border-border bg-background/40"
                                            }`}
                                        >
                                            <img
                                                src={team.logo}
                                                alt={team.name}
                                                loading="lazy"
                                                className="mx-auto mb-2 h-11 w-11 rounded-full object-cover"
                                            />
                                            <p className="truncate text-xs font-semibold">{team.name}</p>
                                            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                                                {isLeading
                                                    ? "Leading"
                                                    : teamBid
                                                      ? `Last ${formatINR(teamBid)}`
                                                      : "—"}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Running bid ladder */}
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Bid history
                            </p>

                            <ul className="space-y-1.5">
                                <AnimatePresence initial={false}>
                                    {recentBids.map((bid) => (
                                        <motion.li
                                            key={bid.order}
                                            layout
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: bid.order === current.order ? 1 : 0.55, x: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                                bid.order === current.order ? "bg-primary/10" : ""
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="w-8 text-xs tabular-nums text-muted-foreground">
                                                    #{bid.order}
                                                </span>
                                                <span className="font-medium">{bid.team}</span>
                                            </span>
                                            <span className="tabular-nums font-semibold">
                                                {formatINR(bid.amount)}
                                            </span>
                                        </motion.li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* The slab moment — called out when the replay crosses it */}
                <AnimatePresence>
                    {current.amount >= 40000 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                        >
                            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                            <div className="text-sm">
                                <p className="font-semibold text-amber-500">
                                    The increment just changed itself.
                                </p>
                                <p className="text-muted-foreground">
                                    This tournament was configured with two slabs: +₹500 below ₹40,000 and
                                    +₹1,000 above it. The ladder crossed ₹40,000 at bid 52 and switched
                                    automatically — the auctioneer never announced a number, and nobody
                                    argued about it. That switch is in the real data, not staged for this page.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Summary stats */}
                <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { icon: Gavel, label: "Bids on this player", value: FEATURED_PLAYER.totalBids },
                        { icon: Users, label: "Teams in the fight", value: FEATURED_PLAYER.teamsBidding },
                        {
                            label: "Climbed from base",
                            value: `${Math.round((FEATURED_PLAYER.finalPrice / FEATURED_PLAYER.basePrice) * 10) / 10}×`,
                        },
                        { label: "Final price", value: formatINR(FEATURED_PLAYER.finalPrice) },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
                            <p className="text-2xl font-bold text-primary">{stat.value}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AuctionReplay;
