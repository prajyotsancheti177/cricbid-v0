import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSocket } from "@/lib/socket";
import apiConfig from "@/config/apiConfig";
import { Badge } from "@/components/ui/badge";
import { Eye, Plus, Gavel, Radio, Trash2 } from "lucide-react";

interface ActiveAuction {
    tournamentId: string;
    tournamentName: string;
    viewerCount: number;
    hasAuctioneer: boolean;
    creationTime: number;
    hostId?: string;
}

interface Tournament {
    _id: string;
    name: string;
}

export default function LiveAuctionLobby() {
    const [activeAuctions, setActiveAuctions] = useState<ActiveAuction[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
    const [selectedTournamentId, setSelectedTournamentId] = useState("");
    const [loadingTournaments, setLoadingTournaments] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const isHost = !!user; // Simplified check, refine if needed

    useEffect(() => {
        const socket = getSocket();

        const onConnect = () => {
            setIsConnected(true);
            socket.emit("auction:list"); // Request list on connect
        };

        const onDisconnect = () => setIsConnected(false);

        const onListUpdate = (list: ActiveAuction[]) => {
            setActiveAuctions(list);
        };

        const onError = (msg: string) => {
            console.error(msg);
            toast({ variant: "destructive", title: "Auction Error", description: msg });
        };

        if (socket.connected) {
            onConnect();
        } else {
            socket.connect();
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("auction:list", onListUpdate); // Listen for updates
        socket.on("auction:error", onError);

        // Initial fetch
        socket.emit("auction:list");

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("auction:list", onListUpdate);
            socket.off("auction:error", onError);
        };
    }, []);

    const handleCreateRoomClick = async () => {
        if (!user) return;
        setShowCreateDialog(true);
        setLoadingTournaments(true);
        try {
            // Assuming an endpoint exists or we filter client side specific to user?
            // Since we don't know the exact endpoint for "my tournaments", let's try the general list 
            // but arguably we should only show tournaments where user is host.
            // For now, fetching all and filtering if possible, or just all.
            // The previous TournamentManagement used apiConfig.baseUrl + "/api/tournament/get-all-tournaments"

            const response = await fetch(`${apiConfig.baseUrl}/api/tournament/all`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    userId: user._id,
                    userRole: user.role
                })
            });

            if (response.ok) {
                const resData = await response.json();
                console.log("Fetched tournaments response:", resData);

                const all = resData.data || [];
                console.log("All active tournaments:", all);
                console.log("Current user:", user);

                const my = all.filter((t: any) => {
                    const hostId = t.tournamentHostId?._id || t.tournamentHostId;
                    const isHost = hostId === user._id;
                    const isAdmin = ['boss', 'super_user'].includes(user.role);
                    return isHost || isAdmin;
                });

                console.log("Filtered tournaments for dropdown:", my);
                setMyTournaments(my);
            }
        } catch (error) {
            console.error("Error fetching tournaments", error);
            toast({ variant: "destructive", title: "Failed to load tournaments" });
        } finally {
            setLoadingTournaments(false);
        }
    };

    const handleStartAuction = () => {
        if (!selectedTournamentId) return;
        // Navigate to auction room
        // Set storage just in case legacy code needs it
        localStorage.setItem("selectedTournamentId", selectedTournamentId);
        navigate(`/auction/room/${selectedTournamentId}`);
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-2 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                            Live Auctions
                        </h1>
                        <p className="text-muted-foreground">
                            Join active auctions as a viewer or start your own.
                        </p>
                    </div>

                    {isHost && (
                        <Button onClick={handleCreateRoomClick} size="lg" className="rounded-full shadow-lg">
                            <Plus className="mr-2 h-5 w-5" /> Create Auction Room
                        </Button>
                    )}
                </div>

                {/* Active Auctions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeAuctions.length === 0 ? (
                        <div className="col-span-full text-center py-20 bg-card/50 rounded-xl border-2 border-dashed border-border">
                            <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-xl font-semibold text-muted-foreground">No active live auctions</h3>
                            <p className="text-sm text-muted-foreground mt-2">Check back later or start a new one!</p>
                        </div>
                    ) : (
                        activeAuctions.map(auction => {
                            const isOwner = user && (user._id === auction.hostId || ['boss', 'super_user'].includes(user?.role));

                            return (
                                <Card key={auction.tournamentId} className="group hover:shadow-glow transition-all duration-300 border-2 overflow-hidden cursor-pointer relative" onClick={() => navigate(`/auction/room/${auction.tournamentId}`)}>
                                    <CardHeader className="bg-muted/30 pb-4">
                                        <div className="flex justify-between items-start">
                                            <Badge variant={auction.hasAuctioneer ? "default" : "secondary"} className={auction.hasAuctioneer ? "bg-green-500 hover:bg-green-600" : ""}>
                                                {auction.hasAuctioneer ? "Live Now" : "Waiting for Host"}
                                            </Badge>
                                            <div className="flex items-center text-xs text-muted-foreground gap-2">
                                                <span className="flex items-center">
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    {auction.viewerCount}
                                                </span>
                                                {isOwner && (
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-6 w-6 rounded-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm("Are you sure you want to close/delete this auction room?")) {
                                                                const socket = getSocket();
                                                                socket.emit("auction:delete", {
                                                                    tournamentId: auction.tournamentId,
                                                                    userId: user._id
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <CardTitle className="mt-2 text-xl truncate" title={auction.tournamentName}>
                                            {auction.tournamentName}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-2 text-sm text-foreground/80">
                                            <Gavel className="w-4 h-4 text-primary" />
                                            <span>Click to join room</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/10 border-t">
                                        <Button variant="ghost" className="w-full group-hover:bg-primary/10 group-hover:text-primary">
                                            Enter Room
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Create Room Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Start Auction Room</DialogTitle>
                        <DialogDescription>
                            Select a tournament to host the auction for.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Select Tournament</Label>
                            <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose tournament..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {loadingTournaments ? (
                                        <div className="p-2 text-center text-sm">Loading...</div>
                                    ) : myTournaments.length === 0 ? (
                                        <div className="p-2 text-center text-sm">No tournaments found</div>
                                    ) : (
                                        myTournaments.map(t => (
                                            <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                        <Button onClick={handleStartAuction} disabled={!selectedTournamentId}>Start Auction</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
