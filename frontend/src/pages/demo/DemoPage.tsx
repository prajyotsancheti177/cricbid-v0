import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuctionReplay from "./sections/AuctionReplay";
import SoldMoment from "./sections/SoldMoment";
import AfterTheHammer from "./sections/AfterTheHammer";
import SetupAndResults from "./sections/SetupAndResults";
import { TOURNAMENT } from "./demoData";

/**
 * A guided walkthrough of a real auction, built entirely from production data.
 *
 * Rather than a gallery of static screenshots, the page replays one genuine
 * auction lot bid by bid — so a visitor sees the product behaving, at the speed
 * it behaves on the night, with the real names and real amounts.
 */
const DemoPage = () => {
    useEffect(() => {
        document.title = "See a real auction — CricBid demo";
    }, []);

    const scrollToReplay = () => {
        document.getElementById("replay")?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <section className="relative flex min-h-[85vh] items-center overflow-hidden pt-24">
                <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
                <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-primary/20 blur-3xl md:h-96 md:w-96" />
                <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-secondary/20 blur-3xl md:h-96 md:w-96" />

                <div className="container relative z-10 mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-4xl"
                    >
                        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm">
                            <Gavel className="h-4 w-4 text-primary" />
                            A real auction, not a mock-up
                        </span>

                        <h1 className="mb-6 text-4xl font-black leading-tight sm:text-5xl md:text-7xl">
                            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                                See the auction room
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                actually running
                            </span>
                        </h1>

                        <p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl">
                            Not screenshots — the real auction-room screen, live on this page, with a
                            real player and the real teams from the {TOURNAMENT.name} auction. Watch the
                            bidding, the budget rules and the hammer, then scroll on for everything
                            around it.
                        </p>

                        <div className="mb-12 flex flex-col gap-3 sm:flex-row">
                            <Button size="lg" onClick={scrollToReplay} className="gap-2 text-base">
                                Watch the auction room
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Headline numbers from the real event */}
                        <div className="grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
                            {[
                                { value: TOURNAMENT.playersAuctioned, label: "Players" },
                                { value: TOURNAMENT.totalBids.toLocaleString("en-IN"), label: "Bids" },
                                { value: "8", label: "Teams" },
                                { value: `${Math.floor(TOURNAMENT.durationMinutes / 60)}h`, label: "One evening" },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-2xl font-black text-primary md:text-3xl">
                                        {stat.value}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            <div id="replay">
                <AuctionReplay />
            </div>

            <SoldMoment />
            <AfterTheHammer />
            <SetupAndResults />
        </div>
    );
};

export default DemoPage;
