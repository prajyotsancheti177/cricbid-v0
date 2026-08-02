import { motion } from "framer-motion";
import { Bell, ListChecks, Volume2, Wallet } from "lucide-react";

/**
 * What the single "Sold" tap actually sets off.
 *
 * The celebration itself is not repeated here — the replay above fires the real
 * SoldCelebration component at the end of its loop. This section explains what
 * happens behind that animation.
 */
const CONSEQUENCES = [
    {
        icon: Wallet,
        title: "The maths is already done",
        body: "Purse debited, squad slot counted, and every other team's ceiling recalculated before the next player is even on screen.",
    },
    {
        icon: Bell,
        title: "The player is told immediately",
        body: "A WhatsApp with their team and price goes out on the same event — they know before they've left the ground.",
    },
    {
        icon: ListChecks,
        title: "The roster writes itself",
        body: "Squad lists, exports and the Google Sheet all update. Nobody retypes a whiteboard at the end of the night.",
    },
    {
        icon: Volume2,
        title: "Or keep it quiet",
        body: "Running behind schedule? Sound and animation are toggles — turn them off and keep the hammer moving.",
    },
];

const SoldMoment = () => (
    <section className="relative py-20 md:py-28">
        <div className="container mx-auto px-4">
            <div className="mb-10 max-w-3xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    The hammer falls
                </p>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
                    One tap, and the whole room knows.
                </h2>
                <p className="text-base text-muted-foreground md:text-lg">
                    That celebration fires on the host's laptop, every team owner's phone and the OBS
                    overlay feeding the stream — all in the same second, with nobody cueing it. Underneath
                    it, four things have already happened.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {CONSEQUENCES.map((item, i) => (
                    <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ delay: i * 0.08 }}
                        className="rounded-2xl border border-border bg-card p-6"
                    >
                        <item.icon className="mb-3 h-6 w-6 text-primary" />
                        <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    </section>
);

export default SoldMoment;
