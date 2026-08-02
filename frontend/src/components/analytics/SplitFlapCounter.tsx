import { useEffect, useRef, useState } from "react";
import "./SplitFlapCounter.css";

const FLIP_MS = 130;

interface SplitFlapDigitProps {
    /** The digit this cell should settle on. */
    target: string;
    /** Milliseconds per individual flap. */
    flipMs: number;
}

/**
 * One character cell. Rather than jumping straight to the target it steps
 * through every intervening digit, one flap at a time — that stepping is what
 * makes a Solari board read as mechanical rather than as a crossfade.
 */
const SplitFlapDigit = ({ target, flipMs }: SplitFlapDigitProps) => {
    const [displayed, setDisplayed] = useState(target);
    // The glyph being flipped away from, held so the falling leaf can show it.
    const [outgoing, setOutgoing] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (displayed === target) return;

        // Computed outside the state updater: updaters must stay pure, and React
        // invokes them twice in StrictMode.
        const from = Number(displayed);
        const to = Number(target);

        // Non-numeric cells (a separator, or a blank) have nothing to step
        // through, so they swap directly.
        const next =
            Number.isNaN(from) || Number.isNaN(to)
                ? target
                : // Step one digit at a time, wrapping 0-9, so the board counts up
                  // when the number rises and down when it falls.
                  String(from < to ? (from + 1) % 10 : (from + 9) % 10);

        timerRef.current = setTimeout(() => {
            setOutgoing(displayed);
            setDisplayed(next);
        }, flipMs);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [displayed, target, flipMs]);

    // `key` on the leaves restarts the CSS animation on every step.
    const leafKey = `${outgoing ?? ""}-${displayed}`;

    return (
        <span className="sf-cell" style={{ ["--sf-duration" as string]: `${flipMs}ms` }}>
            <span className="sf-half sf-top" aria-hidden="true">
                <span>{displayed}</span>
            </span>
            <span className="sf-half sf-bottom" aria-hidden="true">
                <span>{outgoing ?? displayed}</span>
            </span>

            {outgoing !== null && (
                <>
                    <span className="sf-leaf sf-leaf-front" key={`f-${leafKey}`} aria-hidden="true">
                        <span>{outgoing}</span>
                    </span>
                    <span className="sf-leaf sf-leaf-back" key={`b-${leafKey}`} aria-hidden="true">
                        <span>{displayed}</span>
                    </span>
                </>
            )}
        </span>
    );
};

interface SplitFlapCounterProps {
    value: number;
    /** Pad to at least this many cells so the board doesn't resize as it counts. */
    minDigits?: number;
    flipMs?: number;
    className?: string;
    /** Accessible description of what is being counted. */
    label?: string;
}

/**
 * Airport-board counter. Digits flap up or down to the new value.
 */
const SplitFlapCounter = ({
    value,
    minDigits = 2,
    flipMs = FLIP_MS,
    className = "",
    label,
}: SplitFlapCounterProps) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    const digits = String(safeValue).padStart(minDigits, "0").split("");

    return (
        <span
            className={`sf-board ${className}`}
            // The animated cells are aria-hidden; screen readers get the plain
            // number, announced when it changes.
            role="status"
            aria-live="polite"
            aria-label={label ? `${safeValue} ${label}` : String(safeValue)}
        >
            {digits.map((digit, index) => (
                <SplitFlapDigit
                    // Index-keyed on purpose: cell 0 stays cell 0 so a digit
                    // rolling over flaps in place instead of remounting.
                    key={index}
                    target={digit}
                    flipMs={flipMs}
                />
            ))}
        </span>
    );
};

export default SplitFlapCounter;
