import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, FileSpreadsheet, Link2, Settings2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEAMS, TOP_SALES, TOURNAMENT, formatPts } from "../demoData";

/** Everything that happens before auction day, and the record it leaves behind. */

const SETUP_CARDS = [
    {
        icon: Link2,
        title: "One registration link",
        body: "Drop it in the tournament WhatsApp group. Players fill in their own name, photo, skill and number. Team owners register the same way.",
    },
    {
        icon: FileSpreadsheet,
        title: "Or bulk upload a sheet",
        body: "Already have a spreadsheet? Upload hundreds of players in one go — names, base prices, categories, numbers and photo links.",
    },
    {
        icon: Settings2,
        title: "Set the rules once",
        body: "Purse, squad size, categories and the increment ladder. Editable mid-auction, applied instantly, no restart.",
    },
    {
        icon: Trophy,
        title: "Nothing gets lost",
        body: "Two-way Google Sheets sync and an automatic backup of every auction — a dropped connection is never a lost auction.",
    },
];

const SetupAndResults = () => (
    <>
        {/* Before auction day */}
        <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
                <div className="mb-10 max-w-3xl">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                        Before auction day
                    </p>
                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                        Setup that fills itself in.
                    </h2>
                    <p className="text-base text-muted-foreground md:text-lg">
                        By the time the auction starts, the player list, the photos, the categories and the
                        purse are already in place — because everyone entered their own details.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {SETUP_CARDS.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-60px" }}
                            transition={{ delay: i * 0.08 }}
                            className="rounded-2xl border border-border bg-card p-6"
                        >
                            <card.icon className="mb-3 h-6 w-6 text-primary" />
                            <h3 className="mb-2 text-lg font-semibold">{card.title}</h3>
                            <p className="text-sm text-muted-foreground">{card.body}</p>
                        </motion.div>
                    ))}
                </div>

                {/* The real configuration this tournament used */}
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-6">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            This tournament's real categories
                        </p>
                        <ul className="space-y-2">
                            {TOURNAMENT.categories.map((category) => (
                                <li
                                    key={category.name}
                                    className="flex items-center justify-between rounded-lg bg-background/50 px-4 py-3"
                                >
                                    <span className="font-medium">{category.name}</span>
                                    <span className="tabular-nums text-primary">
                                        base {formatPts(category.basePrice)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-6">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Its real increment ladder
                        </p>
                        <ul className="space-y-2">
                            {TOURNAMENT.slabs.map((slab) => (
                                <li
                                    key={slab.from}
                                    className="flex items-center justify-between rounded-lg bg-background/50 px-4 py-3"
                                >
                                    <span className="font-medium tabular-nums">
                                        {formatPts(slab.from)}
                                        {slab.to ? ` – ${formatPts(slab.to)}` : " and above"}
                                    </span>
                                    <span className="tabular-nums text-amber-500">
                                        +{slab.increment.toLocaleString("en-IN")}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        {/* Results */}
        <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
                <div className="mb-10 max-w-3xl">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                        When it's over
                    </p>
                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                        The whole auction, on the record.
                    </h2>
                    <p className="text-base text-muted-foreground md:text-lg">
                        The totals from the {TOURNAMENT.date} auction, read from the same logs the
                        platform writes as the hammer falls. Player counts, bids and timings are exact;
                        amounts are scaled to match the replay above.
                    </p>
                </div>

                <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { value: TOURNAMENT.playersAuctioned, label: "Players auctioned" },
                        { value: formatPts(TOURNAMENT.totalSpend), label: "Total spend" },
                        { value: TOURNAMENT.totalBids.toLocaleString("en-IN"), label: "Bids placed" },
                        { value: `${Math.floor(TOURNAMENT.durationMinutes / 60)}h ${TOURNAMENT.durationMinutes % 60}m`, label: "Start to finish" },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
                            <p className="text-2xl font-black text-primary md:text-3xl">{stat.value}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Top sales */}
                    <div className="rounded-2xl border border-border bg-card p-6">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Biggest buys of the night
                        </p>
                        <ul className="space-y-2">
                            {TOP_SALES.map((sale, i) => (
                                <li
                                    key={sale.name}
                                    className="flex items-center gap-3 rounded-lg bg-background/50 px-4 py-3"
                                >
                                    <span className="w-5 text-sm tabular-nums text-muted-foreground">
                                        {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">{sale.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {sale.team} · {sale.bids} bids
                                        </span>
                                    </span>
                                    <span className="shrink-0 font-semibold tabular-nums text-emerald-500">
                                        {formatPts(sale.price)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Teams */}
                    <div className="rounded-2xl border border-border bg-card p-6">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            The eight squads that bid
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {TEAMS.map((team) => (
                                <div
                                    key={team.name}
                                    className="flex items-center gap-3 rounded-lg bg-background/50 p-3"
                                >
                                    <img
                                        src={team.logo}
                                        alt={team.name}
                                        loading="lazy"
                                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                            {team.name}
                                        </span>
                                        <span className="block truncate text-[11px] text-muted-foreground">
                                            {team.owner}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-sm text-muted-foreground">
                    Every roster exports to PDF and CSV, syncs back to Google Sheets, and stays available as
                    a shareable results link — so nobody chases a squad list across three WhatsApp groups.
                </p>
            </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-20 md:py-28">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
            <div className="container relative mx-auto px-4 text-center">
                <h2 className="mb-4 text-3xl font-black sm:text-4xl md:text-5xl">
                    Run yours the same way.
                </h2>
                <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground md:text-lg">
                    Box cricket, gully, colony or corporate — if it has an auction, CricBid runs it. Priced
                    per tournament, not per seat.
                </p>

                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <Button asChild size="lg" className="gap-2 text-base">
                        <Link to="/tournaments">
                            Get started
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="text-base">
                        <a href="tel:9423931031">Talk to us — 94239 31031</a>
                    </Button>
                </div>
            </div>
        </section>
    </>
);

export default SetupAndResults;
