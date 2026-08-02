import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuctionPlayerCard } from "@/components/auction/AuctionPlayerCard";
import { TeamBudgetPanel } from "@/components/auction/TeamBudgetPanel";
import { TeamBidGrid } from "@/components/auction/TeamBidGrid";
import { SoldCelebration } from "@/components/auction/SoldCelebration";
import type { Player, Team } from "@/types/auction";
import {
    BID_LADDER,
    DEMO_TEAM_STATE,
    FEATURED_PLAYER,
    SLAB_BOUNDARY,
    SQUAD_SIZE,
    TEAMS,
    formatPts,
} from "../demoData";
import { useIsInView } from "../useInViewOnce";

/**
 * The host screen, rendered with the *actual* auction-room components.
 *
 * AuctionPlayerCard, TeamBudgetPanel, TeamBidGrid and SoldCelebration are the
 * same components the live room mounts — imported, not reimplemented — so the
 * layout, the counting bid animation, the leading-team glow, the red
 * can't-bid tiles and the SOLD celebration are exactly what a host sees on the
 * night. Only the data source differs: instead of socket events, state comes
 * from a short scripted ladder.
 *
 * Runs as a ~13 second loop: ten bids, the hammer, then back to the start.
 */

/** Milliseconds per bid. Ten bids ≈ 8 seconds. */
const BID_INTERVAL_MS = 800;
/** Beat between the last bid and the celebration, as a host would pause. */
const HAMMER_DELAY_MS = 700;
/** How long the SOLD celebration stays up before the loop restarts. */
const CELEBRATION_MS = 4200;
/** Time for the celebration's exit animation to finish before the board resets. */
const EXIT_MS = 450;

const AuctionReplay = () => {
    const [index, setIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSold, setIsSold] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const current = BID_LADDER[index];
    const isLastBid = index >= BID_LADDER.length - 1;

    const clearTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    /**
     * Only run while the host screen is actually on screen. The celebration is a
     * full-screen fixed overlay, so a loop that kept going after the reader
     * scrolled on would hijack whatever they moved to next.
     */
    const stageInView = useIsInView(stageRef);

    useEffect(() => {
        if (stageInView) {
            setIsPlaying(true);
            return;
        }

        // Out of view: stop the loop and clear any celebration on screen.
        setIsPlaying(false);
        setIsSold(false);
        clearTimers();
    }, [stageInView]);

    useEffect(() => {
        if (!isPlaying) return;

        // Mid-ladder: step to the next bid.
        if (!isLastBid) {
            const t = setTimeout(() => setIndex((i) => i + 1), BID_INTERVAL_MS);
            timers.current.push(t);
            return clearTimers;
        }

        // End of the ladder: hammer, celebrate, then loop back round.
        const toSold = setTimeout(() => setIsSold(true), HAMMER_DELAY_MS);
        const toHide = setTimeout(() => setIsSold(false), HAMMER_DELAY_MS + CELEBRATION_MS);
        // Reset after the overlay has finished fading, so the board isn't seen
        // snapping back to the first bid through a half-transparent celebration.
        const toReset = setTimeout(() => setIndex(0), HAMMER_DELAY_MS + CELEBRATION_MS + EXIT_MS);

        timers.current.push(toSold, toHide, toReset);
        return clearTimers;
    }, [isPlaying, index, isLastBid]);

    useEffect(() => clearTimers, []);

    /** The live room takes its increment from the tournament's configured slabs. */
    const bidPrice = current.amount >= SLAB_BOUNDARY ? 100 : 50;

    /** The player, shaped exactly as the auction room's Player type. */
    const player: Player = useMemo(
        () => ({
            _id: "demo-player",
            name: FEATURED_PLAYER.name,
            photo: FEATURED_PLAYER.photo,
            playerCategory: FEATURED_PLAYER.category,
            auctionSerialNumber: FEATURED_PLAYER.lotNumber,
            basePrice: FEATURED_PLAYER.basePrice,
            amtSold: 0,
            sold: false,
            auctionStatus: false,
            // Deliberately no touranmentId: it would trigger the privacy-masking
            // hook's tournament lookup, and there is nothing to mask here.
        }),
        []
    );

    /**
     * Teams in the auction room's shape. The components compute the red
     * can't-bid state themselves from these numbers — purse, slots left and the
     * max biddable ceiling — so what's shown is the real rule, not a mock-up.
     */
    const teams: Team[] = useMemo(
        () =>
            TEAMS.map((team) => {
                const state = DEMO_TEAM_STATE[team.name];
                return {
                    _id: team.name,
                    name: team.name,
                    logo: team.logo,
                    remainingBudget: state.purse,
                    maxPlayersPerTeam: SQUAD_SIZE,
                    playersCount: state.slotsUsed,
                    maxBiddableAmount: state.maxBiddable,
                };
            }),
        []
    );

    /** Latest bid per team, which the grid renders under each crest. */
    const teamBids = useMemo(() => {
        const bids: Record<string, number> = {};
        for (let i = 0; i <= index; i++) {
            bids[BID_LADDER[i].team] = BID_LADDER[i].amount;
        }
        return bids;
    }, [index]);

    const leadingTeam = current.team;
    const leadingTeamLogo = TEAMS.find((t) => t.name === leadingTeam)?.logo;

    /** How many teams can no longer bid at this price — the point of the demo. */
    const blockedCount = useMemo(() => {
        const nextBid = current.amount + bidPrice;
        return TEAMS.filter((team) => {
            const state = DEMO_TEAM_STATE[team.name];
            return (
                SQUAD_SIZE - state.slotsUsed <= 0 ||
                state.purse < nextBid ||
                state.maxBiddable < nextBid
            );
        }).length;
    }, [current.amount, bidPrice]);

    return (
        <section className="relative py-20 md:py-28">
            <div className="container mx-auto px-4">
                <div className="mb-8 max-w-3xl">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        The host screen
                    </p>
                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                        One tap per bid. That's the whole job.
                    </h2>
                    <p className="text-base text-muted-foreground md:text-lg">
                        The closing seconds of a lot, on the real auction-room screen. Watch the bid
                        count up, the increment step up on its own as it crosses{" "}
                        {formatPts(SLAB_BOUNDARY)}, and teams turn red the moment the price passes what
                        they can afford — then the hammer falls.
                    </p>
                </div>

                {/* Playback control — the only part of this section that isn't the live UI */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Button
                        onClick={() => {
                            if (isSold) {
                                setIsSold(false);
                                setIndex(0);
                            }
                            setIsPlaying((p) => !p);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                    >
                        {isPlaying ? (
                            <>
                                <Pause className="h-4 w-4" /> Pause
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" /> Play
                            </>
                        )}
                    </Button>

                    <span className="text-sm tabular-nums text-muted-foreground">
                        Bid {current.order} of {BID_LADDER.length}
                    </span>

                    <span className="ml-auto text-sm text-muted-foreground">
                        <span className="font-semibold text-red-500">{blockedCount}</span> of{" "}
                        {TEAMS.length} teams can no longer bid
                    </span>
                </div>

                {/* ---- Below here is the live auction room, component for component ---- */}
                <div ref={stageRef} className="rounded-2xl border border-border/60 bg-background/40 p-3 md:p-4">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3 md:h-[55vh] md:min-h-[440px] md:flex-row md:gap-4">
                        <div className="h-[50vh] min-h-[360px] flex-1 md:h-full md:min-h-0">
                            <AuctionPlayerCard
                                player={player}
                                className="h-full w-full"
                                currentBid={current.amount}
                                leadingTeamName={leadingTeam}
                                leadingTeamLogo={leadingTeamLogo}
                                bidPrice={bidPrice}
                            />
                        </div>

                        <TeamBudgetPanel
                            teams={teams}
                            currentBid={current.amount}
                            bidPrice={bidPrice}
                            leadingTeam={leadingTeam}
                        />
                    </div>

                    <Card className="mx-auto mt-3 max-w-7xl border-2 border-border bg-card/80 p-3 shadow-elevated backdrop-blur-sm md:mt-4 md:p-5">
                        <h2 className="mb-3 text-center text-base font-bold text-foreground md:mb-4 md:text-xl">
                            Click on Team to Bid
                        </h2>

                        <TeamBidGrid
                            teams={teams}
                            currentBid={current.amount}
                            bidPrice={bidPrice}
                            leadingTeam={leadingTeam}
                            teamBids={teamBids}
                            onBid={() => setIsPlaying(false)}
                        />

                        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                            <Button variant="ghost" size="sm" className="px-3 text-xs text-muted-foreground md:px-4 md:text-sm">
                                ← Change Mode
                            </Button>
                            <Button size="sm" className="bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 md:px-6 md:text-sm">
                                Next
                            </Button>
                            <Button variant="secondary" size="sm" className="px-3 text-xs md:px-6 md:text-sm">
                                <Search className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" /> Search
                            </Button>
                            <Button
                                onClick={() => {
                                    setIsPlaying(false);
                                    setIndex((i) => Math.max(0, i - 1));
                                }}
                                disabled={index === 0}
                                variant="secondary"
                                size="sm"
                                className="px-3 text-xs md:px-6 md:text-sm"
                            >
                                Undo
                            </Button>
                            <Button variant="outline" size="sm" className="px-4 text-xs md:px-8 md:text-sm">
                                Unsold
                            </Button>
                            <Button
                                onClick={() => {
                                    setIndex(BID_LADDER.length - 1);
                                    setIsSold(true);
                                }}
                                size="sm"
                                className="bg-gradient-accent px-4 text-xs hover:opacity-90 md:px-8 md:text-sm"
                            >
                                Sold!
                            </Button>
                        </div>
                    </Card>
                </div>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                    Player card, purse panel, bidding grid and the SOLD celebration above are the live
                    auction-room components themselves — not screenshots. Player, photo and teams are
                    real; the bid amounts are illustrative.
                </p>

                {/* The slab moment — appears as the ladder crosses the boundary */}
                <AnimatePresence>
                    {current.amount >= SLAB_BOUNDARY && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mx-auto mt-6 flex max-w-7xl items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                        >
                            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                            <div className="text-sm">
                                <p className="font-semibold text-amber-500">
                                    The increment just changed itself.
                                </p>
                                <p className="text-muted-foreground">
                                    Two slabs were set before the auction: +50 below{" "}
                                    {formatPts(SLAB_BOUNDARY)} and +100 above it. The ladder crossed that
                                    line and stepped up on its own — the auctioneer never announced a
                                    number, and nobody argued about it.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/*
              The real celebration component. Sound is off: a marketing page must
              not autoplay audio, and browsers would block it anyway.
            */}
            <SoldCelebration
                show={isSold}
                playerName={FEATURED_PLAYER.name}
                teamName={FEATURED_PLAYER.soldTo}
                amount={FEATURED_PLAYER.finalPrice}
                soundEnabled={false}
                animationEnabled
            />
        </section>
    );
};

export default AuctionReplay;
