import { useEffect } from "react";
import { GROUP_ORDER, GUIDES } from "./registry";

/**
 * Unlisted preview of the exported guide videos (public/guide-clips/<slug>.mp4).
 * Not linked from anywhere and marked noindex while the clips are reviewed.
 */
const GuideVideosPage = () => {
    useEffect(() => {
        document.title = "Guide videos — preview";
        const meta = document.createElement("meta");
        meta.name = "robots";
        meta.content = "noindex, nofollow";
        document.head.appendChild(meta);
        return () => { meta.remove(); };
    }, []);

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 pb-16 pt-10">
                <h1 className="text-3xl font-black md:text-4xl">CricBid guide videos</h1>
                <p className="mt-2 text-muted-foreground">Preview — {GUIDES.length} clips. Not public yet.</p>

                {GROUP_ORDER.map((group) => {
                    const items = GUIDES.filter((g) => g.group === group);
                    if (!items.length) return null;
                    return (
                        <section key={group} className="mt-10">
                            <h2 className="mb-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                                {group}
                            </h2>
                            <div className="grid gap-8 md:grid-cols-2">
                                {items.map((g) => (
                                    <article key={g.slug}>
                                        <video
                                            className="w-full rounded-lg border border-border bg-black"
                                            src={`/guide-clips/${g.slug}.mp4`}
                                            poster={`/guide-clips/${g.slug}.jpg`}
                                            controls
                                            playsInline
                                            preload="none"
                                        />
                                        <h3 className="mt-3 font-bold">{g.title}</h3>
                                        <p className="text-sm text-muted-foreground">{g.summary}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

export default GuideVideosPage;
