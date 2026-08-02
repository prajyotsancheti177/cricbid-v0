import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import { FEATURED_PLAYER, formatINR } from "../demoData";
import { useInViewOnce } from "../useInViewOnce";

/**
 * The SOLD celebration, using the same treatment the live auction fires.
 *
 * On auction day this goes off simultaneously on the host's laptop, every team
 * owner's phone and the OBS overlay feeding the stream — this section lets a
 * visitor trigger it themselves.
 */
const SoldMoment = () => {
    const [isCelebrating, setIsCelebrating] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);
    const hasAutoFired = useRef(false);

    const fireConfetti = () => {
        // Respect a reduced-motion preference — the card still shows, quietly.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const colors = ["#a855f7", "#ec4899", "#f97316", "#fbbf24", "#22c55e", "#3b82f6"];

        confetti({ particleCount: 130, spread: 95, origin: { x: 0.5, y: 0.45 }, colors });

        // Two angled follow-up bursts, the way the live celebration layers them.
        [
            { angle: 60, origin: { x: 0, y: 0.65 } },
            { angle: 120, origin: { x: 1, y: 0.65 } },
        ].forEach((burst, i) => {
            setTimeout(() => {
                confetti({ particleCount: 60, spread: 70, colors, ...burst });
            }, 180 + i * 120);
        });
    };

    const celebrate = () => {
        setIsCelebrating(true);
        fireConfetti();
        setTimeout(() => setIsCelebrating(false), 4200);
    };

    // Fire once when the section first comes into view.
    const inView = useInViewOnce(sectionRef, 160);

    useEffect(() => {
        if (inView && !hasAutoFired.current) {
            hasAutoFired.current = true;
            celebrate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inView]);

    return (
        <section ref={sectionRef} className="relative overflow-hidden py-20 md:py-28">
            <div className="container mx-auto px-4">
                <div className="mb-10 max-w-3xl">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        The hammer falls
                    </p>
                    <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                        One tap, and the whole room knows.
                    </h2>
                    <p className="text-base text-muted-foreground md:text-lg">
                        The host taps <span className="font-semibold text-foreground">Sold</span>. The purse
                        is debited, the squad slot is counted, the roster updates, the WhatsApp goes out and
                        the stream overlay celebrates — in the same second, on every connected screen.
                    </p>
                </div>

                <motion.div
                    animate={isCelebrating ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 p-10 text-center shadow-[0_0_80px_rgba(168,85,247,0.35)] md:p-16"
                >
                    <AnimatePresence>
                        {isCelebrating && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.35, 0] }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.2, repeat: 2 }}
                                className="pointer-events-none absolute inset-0 bg-white"
                            />
                        )}
                    </AnimatePresence>

                    <div className="relative">
                        <motion.p
                            animate={isCelebrating ? { scale: [1, 1.15, 1] } : {}}
                            transition={{ duration: 0.6, repeat: isCelebrating ? 3 : 0 }}
                            className="mb-4 text-2xl font-black tracking-[0.3em] text-amber-300 md:text-3xl"
                        >
                            SOLD!
                        </motion.p>

                        <h3 className="mb-3 text-4xl font-black text-white md:text-6xl">
                            {FEATURED_PLAYER.name}
                        </h3>

                        <p className="mb-6 text-lg text-white/80 md:text-xl">
                            to {FEATURED_PLAYER.soldTo}
                        </p>

                        <p className="text-4xl font-black text-amber-300 md:text-5xl">
                            {formatINR(FEATURED_PLAYER.finalPrice)}
                        </p>

                        <p className="mt-6 text-sm text-white/70">
                            Real result · {FEATURED_PLAYER.totalBids} bids · {FEATURED_PLAYER.teamsBidding}{" "}
                            teams competing
                        </p>
                    </div>
                </motion.div>

                <div className="mt-6 flex justify-center">
                    <Button onClick={celebrate} variant="outline" size="lg" className="gap-2">
                        <PartyPopper className="h-4 w-4" />
                        Play the celebration again
                    </Button>
                </div>

                <div className="mt-10 grid gap-4 md:grid-cols-3">
                    {[
                        {
                            title: "Fires everywhere at once",
                            body: "Host laptop, owners' phones and the OBS overlay all celebrate on the same event — nobody cues anything.",
                        },
                        {
                            title: "Books itself",
                            body: "Purse debited, slot counted, roster updated, WhatsApp queued. No one touches a keyboard.",
                        },
                        {
                            title: "Or turn it off",
                            body: "Running behind schedule? Sound and animation are toggles — keep the hammer moving.",
                        },
                    ].map((item) => (
                        <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                            <p className="mb-2 font-semibold">{item.title}</p>
                            <p className="text-sm text-muted-foreground">{item.body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default SoldMoment;
