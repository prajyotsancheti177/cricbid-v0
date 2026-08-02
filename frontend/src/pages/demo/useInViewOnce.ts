import { RefObject, useEffect, useState } from "react";

/**
 * Fires once, the first time the element is within the viewport.
 *
 * Deliberately a scroll/resize + getBoundingClientRect check rather than an
 * IntersectionObserver: IO callbacks do not fire while a document reports
 * `visibilityState: "hidden"` (background tabs, embedded/preview browsers), which
 * would leave the demo's auto-playing sections sitting frozen. A rect check is
 * cheap for a single element and behaves the same everywhere.
 *
 * @param ref - element to watch
 * @param margin - px of slack, so it triggers slightly before the edge
 */
export const useInViewOnce = (ref: RefObject<HTMLElement>, margin = 80): boolean => {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (inView) return;

        const check = () => {
            const node = ref.current;
            if (!node) return;

            const rect = node.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

            if (rect.top < viewportHeight - margin && rect.bottom > margin) {
                setInView(true);
            }
        };

        check();
        window.addEventListener("scroll", check, { passive: true });
        window.addEventListener("resize", check);

        return () => {
            window.removeEventListener("scroll", check);
            window.removeEventListener("resize", check);
        };
    }, [ref, margin, inView]);

    return inView;
};
