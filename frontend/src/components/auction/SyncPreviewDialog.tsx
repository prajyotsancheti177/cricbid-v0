import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import apiConfig from "@/config/apiConfig";
import { Loader2, ArrowRight } from "lucide-react";

interface DiffChange {
    field: string;
    old: string;
    new: string;
    dbKey: string;
    dbType: string;
}

interface PlayerDiff {
    playerId: string;
    playerName: string;
    changes: DiffChange[];
}

interface SyncPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tournamentId: string;
}

export function SyncPreviewDialog({ isOpen, onClose, tournamentId }: SyncPreviewDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [diffs, setDiffs] = useState<PlayerDiff[]>([]);
    
    useEffect(() => {
        if (isOpen && tournamentId) {
            fetchDiff();
        }
    }, [isOpen, tournamentId]);

    const fetchDiff = async () => {
        try {
            setLoading(true);
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const response = await fetch(`${apiConfig.baseUrl}/api/player/sync-diff`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": user._id,
                    "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
                },
                body: JSON.stringify({ touranmentId: tournamentId })
            });

            const data = await response.json();
            if (response.ok) {
                setDiffs(data.data || []);
            } else {
                toast({
                    title: "Sync Error",
                    description: data.message || "Failed to fetch spreadsheet delta",
                    variant: "destructive"
                });
                onClose();
            }
        } catch (err) {
            toast({
                title: "Error",
                description: "An error occurred while computing the sync diff",
                variant: "destructive"
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        try {
            setApplying(true);
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const response = await fetch(`${apiConfig.baseUrl}/api/player/sync-apply`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": user._id,
                    "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
                },
                body: JSON.stringify({ diffs, touranmentId: tournamentId })
            });

            const data = await response.json();
            if (response.ok) {
                toast({
                    title: "Sync Successful",
                    description: "All changes from Google Sheets have been applied to the database."
                });
                onClose();
            } else {
                toast({
                    title: "Apply Error",
                    description: data.message || "Failed to apply modifications",
                    variant: "destructive"
                });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: "An error occurred while pushing changes to database",
                variant: "destructive"
            });
        } finally {
            setApplying(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex flex-col gap-2">
                        <span className="text-xl">Preview Database Sync</span>
                    </DialogTitle>
                    <DialogDescription>
                        Review the modifications made in Google Sheets before committing them to the live Database.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-auto my-4 border rounded-md">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <p>Analyzing spreadsheet discrepancies...</p>
                        </div>
                    ) : diffs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-8 text-center bg-gray-50">
                            <p className="text-lg font-medium text-gray-700">Database is up to date!</p>
                            <p className="text-sm">No divergent records were found between Google Sheets and the Database.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-primary/5 sticky top-0">
                                <TableRow>
                                    <TableHead>Player</TableHead>
                                    <TableHead>Updated Field</TableHead>
                                    <TableHead>Old Database Value</TableHead>
                                    <TableHead>New External Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diffs.map((player) => 
                                    player.changes.map((change, idx) => (
                                        <TableRow key={`${player.playerId}-${idx}`}>
                                            {idx === 0 ? (
                                                <TableCell className="font-medium align-top bg-secondary/10" rowSpan={player.changes.length}>
                                                    {player.playerName}
                                                </TableCell>
                                            ) : null}
                                            <TableCell className="font-semibold text-primary">{change.field}</TableCell>
                                            <TableCell className="text-red-500/80 line-through decoration-red-500/30">{change.old || <em className="text-muted-foreground/50 no-underline">Empty</em>}</TableCell>
                                            <TableCell className="text-emerald-600 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                    {change.new || <em className="text-muted-foreground/50">Empty</em>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onClose} disabled={applying}>Cancel</Button>
                    <Button 
                        onClick={handleApply} 
                        disabled={loading || diffs.length === 0 || applying}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {applying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Confirm & Overwrite Database
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
