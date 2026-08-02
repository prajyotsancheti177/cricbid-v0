import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { percentChange } from "../shared";

interface DeltaBadgeProps {
    current: number;
    previous: number;
    /** Set when a fall is the good outcome (e.g. failed messages). */
    invert?: boolean;
}

/**
 * Change against the preceding equal-length window. Renders nothing meaningful
 * when there is no baseline rather than claiming infinite growth.
 */
export const DeltaBadge = ({ current, previous, invert = false }: DeltaBadgeProps) => {
    const change = percentChange(current, previous);

    if (change === null) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" />
                no prior data
            </span>
        );
    }

    const isFlat = Math.abs(change) < 0.05;
    const isGood = invert ? change < 0 : change > 0;

    const tone = isFlat
        ? "text-muted-foreground"
        : isGood
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400";

    const Icon = isFlat ? Minus : change > 0 ? ArrowUp : ArrowDown;

    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
            <Icon className="h-3 w-3" />
            {isFlat ? "no change" : `${Math.abs(change)}%`}
        </span>
    );
};

interface StatCardProps {
    title: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    /** Tailwind classes for the accent gradient and border. */
    accent?: string;
    valueClass?: string;
}

export const StatCard = ({ title, value, hint, icon, accent = "", valueClass = "" }: StatCardProps) => (
    <Card className={accent}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-3xl font-bold ${valueClass}`}>{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </CardContent>
    </Card>
);

export const EmptyState = ({ message, height = "h-[300px]" }: { message: string; height?: string }) => (
    <div className={`flex items-center justify-center ${height} text-muted-foreground`}>{message}</div>
);
