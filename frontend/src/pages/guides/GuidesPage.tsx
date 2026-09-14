import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { GROUP_ORDER, GUIDES } from "./registry";
import { ClipPlayer } from "./kit/ClipPlayer";

/**
 * The how-to library: one short, looping clip per task an organiser, player or
 * team owner actually needs to do. Each clip also lives at /guides/:slug so it
 * can be shared on its own or recorded to video.
 */
const GuidesPage = () => {
    useEffect(() => { document.title = "How-to guides — CricBid"; }, []);

    return (
        <div className="min-h-screen bg-background">
            <section className="container mx-auto px-4 pb-8 pt-24 md:pt-28">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm">
                    <PlayCircle className="h-4 w-4 text-primary" /> Short clips, under a minute each
                </span>
                <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">How to run your auction on CricBid</h1>
                <p className="mt-4 max-w-2xl text-muted-foreground md:text-lg">
                    Every step from creating the tournament to exporting the results — shown on the real screens.
                    Click any dot on a clip's progress bar to jump to that step.
                </p>
                <nav className="mt-6 flex flex-wrap gap-2">
                    {GUIDES.map((g) => (
                        <a key={g.slug} href={`#${g.slug}`}
                            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground">
                            {g.title}
                        </a>
                    ))}
                </nav>
            </section>

            {GROUP_ORDER.map((group) => {
                const items = GUIDES.filter((g) => g.group === group);
                if (!items.length) return null;
                return (
                    <section key={group} className="container mx-auto px-4 pb-12">
                        <h2 className="mb-6 border-b border-border pb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                            {group}
                        </h2>
                        <div className="grid gap-10 lg:grid-cols-2">
                            {items.map((g) => (
                                <article key={g.slug} id={g.slug} className="scroll-mt-24">
                                    <div className="mb-3 flex items-baseline justify-between gap-3">
                                        <h3 className="text-xl font-bold">{g.title}</h3>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {g.audience} · {Math.round(g.duration / 1000)}s
                                        </span>
                                    </div>
                                    <ClipPlayer guide={g} />
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {g.summary}{" "}
                                        <Link to={`/guides/${g.slug}`} className="text-primary hover:underline">Open on its own</Link>
                                    </p>
                                </article>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};

export default GuidesPage;
