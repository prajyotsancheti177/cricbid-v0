import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowRight, Zap } from "lucide-react";

export interface BidSlab {
    minBid: number;
    maxBid: number | null;
    increment: number;
}

interface BidSlabEditorProps {
    slabs: BidSlab[];
    onChange: (slabs: BidSlab[]) => void;
    compact?: boolean; // For use inside smaller dialogs
}

export const BidSlabEditor = ({ slabs, onChange, compact = false }: BidSlabEditorProps) => {
    const [validationError, setValidationError] = useState<string | null>(null);

    // Validate slabs whenever they change
    useEffect(() => {
        const errors: string[] = [];
        for (let i = 0; i < slabs.length; i++) {
            if (slabs[i].increment <= 0) {
                errors.push(`Slab ${i + 1}: increment must be greater than 0`);
            }
            if (i > 0 && slabs[i].minBid !== (slabs[i - 1].maxBid ?? 0) + 1) {
                errors.push(`Gap between slab ${i} and ${i + 1}`);
            }
        }
        setValidationError(errors.length > 0 ? errors[0] : null);
    }, [slabs]);

    const updateSlab = (index: number, field: keyof BidSlab, value: number | null) => {
        const updated = slabs.map((s, i) => {
            if (i !== index) return s;
            return { ...s, [field]: value };
        });

        // Auto-adjust next slab's minBid when maxBid changes
        if (field === "maxBid" && value !== null && index < updated.length - 1) {
            updated[index + 1] = { ...updated[index + 1], minBid: value + 1 };
        }

        onChange(updated);
    };

    const addSlab = () => {
        const last = slabs[slabs.length - 1];
        const newMin = last.maxBid ? last.maxBid + 1 : last.minBid + 500;

        const updated = slabs.map((s, i) => {
            if (i === slabs.length - 1) {
                return { ...s, maxBid: newMin - 1 };
            }
            return s;
        });

        onChange([...updated, { minBid: newMin, maxBid: null, increment: 100 }]);
    };

    const removeSlab = (index: number) => {
        if (slabs.length <= 1) return;
        const filtered = slabs.filter((_, i) => i !== index);

        // Ensure last slab has null maxBid
        if (filtered.length > 0) {
            filtered[filtered.length - 1] = { ...filtered[filtered.length - 1], maxBid: null };
        }

        // Re-chain minBid values
        for (let i = 1; i < filtered.length; i++) {
            const prevMax = filtered[i - 1].maxBid;
            if (prevMax !== null) {
                filtered[i] = { ...filtered[i], minBid: prevMax + 1 };
            }
        }

        onChange(filtered);
    };

    return (
        <div className="space-y-3">
            {/* Slab Table */}
            <div className="space-y-2">
                {/* Header */}
                <div className={`grid ${compact ? "grid-cols-[1fr_1fr_auto]" : "grid-cols-[1fr_1fr_auto]"} gap-2 px-1`}>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Price Range (Pts)
                    </Label>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Bid Increment
                    </Label>
                    <div className="w-9" /> {/* Spacer for delete button */}
                </div>

                {/* Slab Rows */}
                {slabs.map((slab, index) => {
                    const isLast = index === slabs.length - 1;

                    return (
                        <Card
                            key={index}
                            className={`p-3 border transition-all ${validationError && slab.increment <= 0
                                ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                                : "border-border hover:border-primary/30"
                                }`}
                        >
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                {/* Price Range */}
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 flex-1">
                                        {index === 0 ? (
                                            <Input
                                                type="number"
                                                value={slab.minBid}
                                                onChange={(e) =>
                                                    updateSlab(
                                                        index,
                                                        "minBid",
                                                        e.target.value ? parseInt(e.target.value) : 0
                                                    )
                                                }
                                                className="h-8 w-20 text-sm"
                                                min={0}
                                                placeholder="0"
                                            />
                                        ) : (
                                            <span className="text-xs text-muted-foreground font-medium min-w-[10px]">
                                                {slab.minBid}
                                            </span>
                                        )}
                                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        {isLast ? (
                                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                & above
                                            </span>
                                        ) : (
                                            <Input
                                                type="number"
                                                value={slab.maxBid ?? ""}
                                                onChange={(e) =>
                                                    updateSlab(
                                                        index,
                                                        "maxBid",
                                                        e.target.value ? parseInt(e.target.value) : null
                                                    )
                                                }
                                                className="h-8 w-24 text-sm"
                                                min={slab.minBid + 1}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Increment */}
                                <div className="flex items-center gap-1.5">
                                    <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                                    <Input
                                        type="number"
                                        value={slab.increment}
                                        onChange={(e) =>
                                            updateSlab(index, "increment", parseInt(e.target.value) || 0)
                                        }
                                        className="h-8 text-sm"
                                        min={1}
                                        placeholder="e.g. 50"
                                    />
                                </div>

                                {/* Delete */}
                                {slabs.length > 1 ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSlab(index)}
                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                ) : (
                                    <div className="w-8" />
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Add Slab Button */}
            <Button
                type="button"
                onClick={addSlab}
                variant="outline"
                size="sm"
                className="w-full border-dashed"
            >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Price Range
            </Button>

            {/* Validation Error */}
            {validationError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                    {validationError}
                </p>
            )}
        </div>
    );
};
