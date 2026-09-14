import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Building blocks for guide scenes.
 *
 * Scenes should import real app components wherever those render from props
 * alone (AuctionPlayerCard, TeamBidGrid, BidSlabEditor…). These primitives are
 * for the rest: screens whose real component fetches its own data, so a clip
 * needs a faithful look-alike driven by the timeline instead.
 *
 * All sizes assume the fixed 1280×800 stage, so use real pixel values.
 */

/** A pulsing ring drawing the eye to the thing about to be clicked. */
export const Spotlight = ({ show, className }: { show: boolean; className?: string }) => (
    <AnimatePresence>
        {show && (
            <motion.span
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                    "pointer-events-none absolute -inset-1.5 z-40 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background",
                    className
                )}
            >
                <span className="absolute inset-0 animate-pulse rounded-xl bg-primary/10" />
            </motion.span>
        )}
    </AnimatePresence>
);

/** A labelled text input showing `value` with a caret while `focused`. */
export const FakeInput = ({
    label, value, placeholder, focused, className, suffix,
}: {
    label?: string; value: string; placeholder?: string; focused?: boolean; className?: string; suffix?: ReactNode;
}) => (
    <label className={cn("block", className)}>
        {label && <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>}
        <div className={cn(
            "flex h-11 items-center rounded-md border bg-background px-3 text-[15px]",
            focused ? "border-primary ring-2 ring-primary/30" : "border-input"
        )}>
            <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
            {focused && <span className="ml-0.5 h-5 w-[2px] animate-pulse bg-primary" />}
            {suffix && <span className="ml-auto">{suffix}</span>}
        </div>
    </label>
);

/** A select: closed shows `value`; `open` shows `options` with `highlighted` hovered. */
export const FakeSelect = ({
    label, value, placeholder, open, options = [], highlighted, className,
}: {
    label?: string; value?: string; placeholder?: string; open?: boolean;
    options?: string[]; highlighted?: string; className?: string;
}) => (
    <div className={cn("relative", className)}>
        {label && <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>}
        <div className={cn(
            "flex h-11 items-center justify-between rounded-md border bg-background px-3 text-[15px]",
            open ? "border-primary ring-2 ring-primary/30" : "border-input"
        )}>
            <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
        </div>
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover p-1 shadow-xl"
                >
                    {options.map((o) => (
                        <div key={o} className={cn(
                            "flex items-center justify-between rounded px-3 py-2 text-[15px]",
                            o === highlighted ? "bg-primary/15 text-foreground" : "text-muted-foreground"
                        )}>
                            {o}
                            {o === value && <Check className="h-4 w-4 text-primary" />}
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

/** An on/off switch. */
export const FakeSwitch = ({ on, className }: { on: boolean; className?: string }) => (
    <span className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
        on ? "bg-primary" : "bg-muted", className
    )}>
        <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </span>
);

/** A button that visibly depresses while `pressed`. */
export const FakeButton = ({
    children, pressed, variant = "primary", className,
}: {
    children: ReactNode; pressed?: boolean; variant?: "primary" | "outline" | "destructive" | "ghost"; className?: string;
}) => (
    <span className={cn(
        "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-transform",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "outline" && "border border-input bg-background text-foreground",
        variant === "destructive" && "bg-destructive text-destructive-foreground",
        variant === "ghost" && "text-muted-foreground",
        pressed && "scale-95 brightness-90",
        className
    )}>
        {children}
    </span>
);

/** A toast in the bottom-right, like the app's own. */
export const FakeToast = ({ show, title, description }: { show: boolean; title: string; description?: string }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="absolute right-6 top-6 z-50 w-[360px] rounded-lg border border-border bg-card p-4 shadow-2xl"
            >
                <p className="text-sm font-semibold">{title}</p>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </motion.div>
        )}
    </AnimatePresence>
);

/** A centred modal over a dimmed page. */
export const FakeDialog = ({
    show, title, description, children, width = 620,
}: {
    show: boolean; title: string; description?: string; children: ReactNode; width?: number;
}) => (
    <AnimatePresence>
        {show && (
            <motion.div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div
                    initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
                    className="max-h-[720px] overflow-hidden rounded-xl border border-border bg-card p-6 shadow-2xl"
                    style={{ width }}
                >
                    <h3 className="text-xl font-bold">{title}</h3>
                    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                    <div className="mt-5">{children}</div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

/**
 * The tournament workspace frame — sidebar on the left, section on the right —
 * so organiser clips open on the screen organisers actually use.
 */
export const WorkspaceFrame = ({
    active, children, tournament = "Jain Unity Cup",
}: {
    active: string; children: ReactNode; tournament?: string;
}) => {
    const items = ["Overview", "Players", "Player sheet", "Teams", "Add player", "Bulk upload", "Registration", "Auction", "Top up balance", "Schedule & Scores", "WhatsApp", "Data & export", "Backups", "Settings"];
    return (
        <div className="flex h-full w-full bg-background text-foreground">
            <aside className="flex w-[230px] shrink-0 flex-col border-r border-border bg-card/60 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tournament</p>
                <p className="mb-5 mt-1 truncate text-base font-bold">{tournament}</p>
                <nav className="flex flex-col gap-1">
                    {items.map((item) => (
                        <span key={item} className={cn(
                            "rounded-md px-3 py-2 text-sm",
                            item === active ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground"
                        )}>
                            {item}
                        </span>
                    ))}
                </nav>
            </aside>
            <main className="relative min-w-0 flex-1 overflow-hidden p-8">{children}</main>
        </div>
    );
};
