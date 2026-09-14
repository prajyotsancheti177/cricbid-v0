import { useEffect, useRef, useState } from "react";

/**
 * The clock every guide clip is drawn from.
 *
 * A clip is a pure function of elapsed time: given `t` (ms), it renders the
 * frame. Nothing is driven by setTimeout chains, so scrubbing, pausing and
 * replaying are all free, and every frame is reproducible — which is what makes
 * a clip screen-recordable into a video file.
 */
export const useTimeline = (duration: number, playing: boolean, loop = true) => {
    const [t, setT] = useState(0);
    const last = useRef<number | null>(null);

    useEffect(() => {
        if (!playing) { last.current = null; return; }
        let raf = 0;
        const tick = (now: number) => {
            if (last.current != null) {
                const dt = now - last.current;
                setT((prev) => {
                    const next = prev + dt;
                    if (next < duration) return next;
                    return loop ? 0 : duration;
                });
            }
            last.current = now;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing, duration, loop]);

    return [t, setT] as const;
};

/** 0→1 progress of `t` through the window [start, end], clamped. */
export const progress = (t: number, start: number, end: number) =>
    end <= start ? (t >= end ? 1 : 0) : Math.min(1, Math.max(0, (t - start) / (end - start)));

/** Smooth ease-in-out. */
export const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** True once `t` has reached `at`. */
export const after = (t: number, at: number) => t >= at;

/** True while `t` is inside [start, end). */
export const between = (t: number, start: number, end: number) => t >= start && t < end;

/** Characters of `text` revealed by time `t`, typing from `start` at `cps` chars/second. */
export const typed = (text: string, t: number, start: number, cps = 18) =>
    text.slice(0, Math.max(0, Math.floor(((t - start) / 1000) * cps)));

/** Linear interpolation between numbers. */
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
