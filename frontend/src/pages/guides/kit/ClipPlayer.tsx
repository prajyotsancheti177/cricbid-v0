import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CursorKey, GuideDefinition } from "./types";
import { ease, progress, useTimeline } from "./timeline";
import { useIsInView } from "@/pages/demo/useInViewOnce";

/** Every clip is authored on a fixed 1280×800 stage and scaled to fit. */
export const STAGE_W = 1280;
export const STAGE_H = 800;

/** Where the cursor is at time `t`, eased between waypoints. */
const cursorAt = (keys: CursorKey[], t: number) => {
    if (!keys.length) return null;
    if (t <= keys[0].at) return { x: keys[0].x, y: keys[0].y, clicking: false };
    for (let i = 1; i < keys.length; i++) {
        const a = keys[i - 1];
        const b = keys[i];
        if (t < b.at) {
            // Hold still for the first part of the gap, then travel — reads
            // like a person looking, then moving.
            const travel = Math.min(650, b.at - a.at);
            const p = ease(progress(t, b.at - travel, b.at));
            const clicking = Boolean(a.click) && t - a.at < 260;
            return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, clicking };
        }
    }
    const lastKey = keys[keys.length - 1];
    return { x: lastKey.x, y: lastKey.y, clicking: Boolean(lastKey.click) && t - lastKey.at < 260 };
};

const Cursor = ({ keys, t }: { keys: CursorKey[]; t: number }) => {
    const pos = cursorAt(keys, t);
    if (!pos) return null;
    return (
        <div
            className="pointer-events-none absolute left-0 top-0 z-[60]"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
            {pos.clicking && (
                <span className="absolute -left-5 -top-5 h-10 w-10 animate-ping rounded-full bg-primary/50" />
            )}
            <svg width="26" height="26" viewBox="0 0 24 24" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                style={{ transform: pos.clicking ? "scale(0.88)" : "scale(1)" }}>
                <path d="M4 2l16 10.5-7 1.3 4.2 7.6-3 1.6-4.2-7.6L4 20z" fill="white" stroke="black" strokeWidth="1.2" />
            </svg>
        </div>
    );
};

interface ClipPlayerProps {
    guide: GuideDefinition;
    /** Autoplay whenever the clip is on screen. */
    autoplay?: boolean;
    /** Hide captions/controls — for recording a clean video. */
    bare?: boolean;
    /** Captions only, no browser chrome or controls, play once — for recording video. */
    record?: boolean;
    className?: string;
}

/**
 * A guide clip: browser chrome, the scaled stage, a moving cursor, step
 * captions and a scrubbable progress bar with a marker per step.
 */
export const ClipPlayer = ({ guide, autoplay = true, bare = false, record = false, className }: ClipPlayerProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    const [userPaused, setUserPaused] = useState(false);
    const inView = useIsInView(wrapRef, 40);
    const playing = autoplay && inView && !userPaused;
    const [t, setT] = useTimeline(guide.duration, playing, !record);
    const showChrome = !bare && !record;

    // Lets the recorder know when a one-shot playthrough has finished.
    useEffect(() => {
        if (record && t >= guide.duration) (window as unknown as { __clipDone?: boolean }).__clipDone = true;
    }, [record, t, guide.duration]);

    useLayoutEffect(() => {
        const node = wrapRef.current;
        if (!node) return;
        const measure = () => setScale(node.clientWidth / STAGE_W);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(node);
        return () => ro.disconnect();
    }, []);

    // Keyboard: space toggles when this clip is the only thing on the page.
    useEffect(() => {
        if (!bare) return;
        const onKey = (e: KeyboardEvent) => { if (e.code === "Space") setUserPaused((p) => !p); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [bare]);

    const stepIndex = guide.steps.reduce((idx, s, i) => (t >= s.at ? i : idx), 0);
    const step = guide.steps[stepIndex];
    const { Scene } = guide;

    const scrub = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setT(((e.clientX - rect.left) / rect.width) * guide.duration);
    };

    return (
        <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-2xl", className)}>
            {/* Browser chrome */}
            {showChrome && (
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                    <div className="ml-2 flex-1 truncate rounded-md bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                        {guide.url}
                    </div>
                </div>
            )}

            {/* Stage */}
            <div ref={wrapRef} className="relative w-full overflow-hidden bg-background"
                style={{ height: STAGE_H * scale }}>
                <div className="absolute left-0 top-0 origin-top-left"
                    style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
                    <div className="relative h-full w-full overflow-hidden">
                        <Scene t={t} />
                        <Cursor keys={guide.cursor} t={t} />
                    </div>
                </div>

                {/* Caption */}
                {!bare && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 sm:p-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={stepIndex}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.25 }}
                                className="max-w-[92%] rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 text-center backdrop-blur sm:px-4 sm:py-2"
                            >
                                <p className="text-xs font-semibold text-white sm:text-sm">
                                    <span className="mr-2 text-primary">{stepIndex + 1}/{guide.steps.length}</span>
                                    {step?.title}
                                </p>
                                {step?.detail && (
                                    <p className="hidden text-xs text-white/70 sm:block">{step.detail}</p>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Controls */}
            {showChrome && (
                <div className="flex items-center gap-3 border-t border-border px-3 py-2">
                    <button
                        type="button"
                        aria-label={playing ? "Pause" : "Play"}
                        onClick={() => setUserPaused((p) => !p)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                        type="button"
                        aria-label="Restart"
                        onClick={() => { setT(0); setUserPaused(false); }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </button>
                    <div className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-muted" onClick={scrub}>
                        <div className="absolute inset-y-0 left-0 rounded-full bg-primary"
                            style={{ width: `${(t / guide.duration) * 100}%` }} />
                        {guide.steps.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                title={s.title}
                                onClick={(e) => { e.stopPropagation(); setT(s.at); }}
                                className={cn(
                                    "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
                                    t >= s.at ? "bg-primary" : "bg-muted-foreground/50"
                                )}
                                style={{ left: `${(s.at / guide.duration) * 100}%` }}
                            />
                        ))}
                    </div>
                    <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                        {Math.floor(t / 1000)}s
                    </span>
                </div>
            )}
        </div>
    );
};
