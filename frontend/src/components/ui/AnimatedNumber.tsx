import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Duration of the count-up in ms (default 350) */
  duration?: number;
  /** Extra className forwarded to the wrapping span */
  className?: string;
  /** Suffix appended after the number, e.g. " Pts." */
  suffix?: string;
}

/**
 * Smoothly counts up to `value` whenever it changes.
 * Triggers the `.animate-bid-pulse` Tailwind keyframe so the number
 * also scales + changes colour on each new bid.
 */
export function AnimatedNumber({
  value,
  duration = 350,
  className = "",
  suffix = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const [pulsing, setPulsing] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    // Cancel any running animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    if (from === to) return;

    // Trigger the CSS pulse animation
    setPulsing(false);
    // Force a reflow so re-adding the class re-triggers the animation
    requestAnimationFrame(() => {
      setPulsing(true);
      // Remove after one cycle (400 ms matches the keyframe duration)
      setTimeout(() => setPulsing(false), 420);
    });

    startRef.current = null;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span
      className={`inline-block tabular-nums ${pulsing ? "animate-bid-pulse" : ""} ${className}`}
    >
      {display}
      {suffix}
    </span>
  );
}
