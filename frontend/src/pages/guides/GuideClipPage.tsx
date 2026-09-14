import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { findGuide } from "./registry";
import { ClipPlayer } from "./kit/ClipPlayer";

/**
 * One clip on its own page. `?bare=1` drops captions and controls; `?record=1` keeps
 * captions, drops chrome and plays once — what the video exporter captures.
 */
const GuideClipPage = () => {
    const { slug } = useParams();
    const [params] = useSearchParams();
    const guide = findGuide(slug);
    const bare = params.get("bare") === "1";
    const record = params.get("record") === "1";

    useEffect(() => { if (guide) document.title = `${guide.title} — CricBid guide`; }, [guide]);

    if (!guide) {
        return (
            <div className="container mx-auto px-4 pt-32 text-center">
                <p className="text-lg">That guide doesn't exist.</p>
                <Link to="/guides" className="text-primary hover:underline">See all guides</Link>
            </div>
        );
    }

    if (record) return <div className="bg-background"><ClipPlayer guide={guide} record className="rounded-none border-0" /></div>;
    if (bare) return <div className="bg-background"><ClipPlayer guide={guide} bare className="rounded-none border-0" /></div>;

    return (
        <div className="container mx-auto max-w-5xl px-4 pb-16 pt-24">
            <Link to="/guides" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> All guides
            </Link>
            <h1 className="mb-2 text-3xl font-black md:text-4xl">{guide.title}</h1>
            <p className="mb-6 text-muted-foreground">{guide.summary}</p>
            <ClipPlayer guide={guide} />
            <ol className="mt-8 space-y-3">
                {guide.steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                        <div>
                            <p className="font-medium">{s.title}</p>
                            {s.detail && <p className="text-sm text-muted-foreground">{s.detail}</p>}
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default GuideClipPage;
