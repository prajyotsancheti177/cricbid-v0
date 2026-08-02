import { RefObject, useEffect, useState } from "react";

/**
 * Viewport visibility, as a scroll/resize + getBoundingClientRect check.
 *
 * Deliberately not an IntersectionObserver: IO callbacks do not fire while a
 * document reports `visibilityState: "hidden"` (background tabs, embedded and
 * preview browsers), which would leave the demo's auto-playing sections frozen.
 * A rect check is cheap for a single element and behaves the same everywhere.
 */
const useVisibility = (ref: RefObject<HTMLElement>, margin: number, once: boolean): boolean => {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (once && inView) return;

        const check = () => {
            const node = ref.current;
            if (!node) return;

            const rect = node.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const visible = rect.top < viewportHeight - margin && rect.bottom > margin;

            setInView((current) => (current === visible ? current : visible));
        };

        check();
        window.addEventListener("scroll", check, { passive: true });
        window.addEventListener("resize", check);

        return () => {
            window.removeEventListener("scroll", check);
            window.removeEventListener("resize", check);
        };
    }, [ref, margin, once, inView]);

    return inView;
};

/** Fires once, the first time the element enters the viewport, then stays true. */
export const useInViewOnce = (ref: RefObject<HTMLElement>, margin = 80): boolean =>
    useVisibility(ref, margin, true);

/**
 * Tracks visibility continuously. Use this to stop animation that would
 * otherwise keep running — or keep taking over the screen — after the reader
 * has scrolled past it.
 */
export const useIsInView = (ref: RefObject<HTMLElement>, margin = 80): boolean =>
    useVisibility(ref, margin, false);
