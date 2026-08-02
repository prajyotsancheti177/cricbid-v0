import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to a container element and adds the
 * `.is-visible` class to each child that has `.scroll-reveal` once it
 * enters the viewport.  Stagger delay is applied inline via JS.
 *
 * Works correctly with async-loaded lists: a MutationObserver watches the
 * container for new children and wires them up to the IO automatically.
 *
 * Includes a fallback: if the viewport is zero-sized (headless / embedded
 * iframe environments), all items are revealed immediately so content is
 * never stuck invisible.
 *
 * Usage:
 *   const gridRef = useScrollReveal<HTMLDivElement>();
 *   <div ref={gridRef}>
 *     {items.map(i => <Card className="scroll-reveal" key={i._id} />)}
 *   </div>
 */
export function useScrollReveal<T extends HTMLElement>(
  staggerMs = 60,
  threshold = 0.12
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    let globalCount = 0;

    /** Mark an element as visible with a staggered delay */
    const reveal = (el: HTMLElement) => {
      if (el.classList.contains("is-visible")) return;
      el.style.transitionDelay = `${globalCount++ * staggerMs}ms`;
      el.classList.add("is-visible");
    };

    // Fallback: if the viewport is zero-sized (headless preview / certain
    // iframes), IntersectionObserver never fires — reveal everything immediately
    if (window.innerHeight === 0 || window.innerWidth === 0) {
      const revealAll = () => {
        container
          .querySelectorAll<HTMLElement>(".scroll-reveal")
          .forEach(reveal);
      };
      revealAll();
      // Also watch for async-added items
      const mo = new MutationObserver(() => revealAll());
      mo.observe(container, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -5% 0px" }
    );

    /** Wire up any `.scroll-reveal` elements inside `container` */
    const observeItems = (root: Element) => {
      root.querySelectorAll<HTMLElement>(".scroll-reveal:not(.is-visible)").forEach(
        (el) => io.observe(el)
      );
    };

    // Observe existing items immediately
    observeItems(container);

    // Watch for new items added asynchronously (async data loads)
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList.contains("scroll-reveal")) {
              io.observe(node);
            } else {
              observeItems(node);
            }
          }
        });
      });
    });

    mo.observe(container, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [staggerMs, threshold]);

  return ref;
}
