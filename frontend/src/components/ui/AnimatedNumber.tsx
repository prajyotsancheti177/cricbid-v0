import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Duration of the count-up in ms (default 150 — fast enough to keep up with rapid bids) */
  duration?: number;
  /** Extra className forwarded to the wrapping span */
  className?: string;
  /** Suffix appended after the number, e.g. " Pts" */
  suffix?: string;
}

/**
 * Smoothly counts up to `value` whenever it changes.
 * Triggers the `.animate-bid-pulse` Tailwind keyframe so the number
 * also scales + changes colour on each new bid.
 */
export function AnimatedNumber({
  value,
  duration = 150,
  className = "",
  suffix = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const [pulseKey, setPulseKey] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  // Mirrors `display` every frame so a bid that arrives mid-animation
  // continues from the value actually on screen, instead of restarting
  // from wherever the *previous* animation began.
  const displayRef = useRef(value);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;

    // Cancel any running animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    if (from === to) return;

    // Bumping the key remounts the span below, which restarts the CSS
    // pulse animation cleanly every time — no setTimeout bookkeeping, so
    // back-to-back bids within one pulse cycle can't leave it stuck.
    setPulseKey((k) => k + 1);
    startRef.current = null;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (to - from) * eased);
      displayRef.current = next;
      setDisplay(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span
      key={pulseKey}
      className={`inline-block tabular-nums ${pulseKey > 0 ? "animate-bid-pulse" : ""} ${className}`}
    >
      {display}
      {suffix}
    </span>
  );
}
