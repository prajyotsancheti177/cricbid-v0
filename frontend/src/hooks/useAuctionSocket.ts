import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { Player, Team } from "@/types/auction";
import { useToast } from "@/hooks/use-toast";

export interface AuctionState {
    tournamentId: string;
    isActive: boolean;
    auctionMode: 'category' | 'manual' | null;
    selectedCategory: string | null;
    currentPlayer: Player | null;
    currentBid: number;
    leadingTeam: string | null;
    teamBids: Record<string, number>;
    teams: Team[];
    playerNumber: number;
    bidPrice: number;
    hasAuctioneer: boolean;
    viewerCount: number;
}

export const useAuctionSocket = (tournamentId: string | undefined, userId: string | undefined) => {
    const [isConnected, setIsConnected] = useState(false);
    const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
    const [isAuctioneer, setIsAuctioneer] = useState(false);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const socketRef = useRef(getSocket());
    const { toast } = useToast();

    useEffect(() => {
        if (!tournamentId) return;

        const socket = socketRef.current;

        // Connect if not connected
        if (!socket.connected) {
            socket.connect();
        }

        // Join room
        socket.emit("auction:join", { tournamentId, userId });

        // Event listeners
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        const onStateUpdate = (state: AuctionState) => {
            // console.log("Received auction state:", state);
            setAuctionState(state);
        };

        const onViewerCount = (count: number) => {
            setAuctionState(prev => prev ? { ...prev, viewerCount: count } : null);
        };

        const onError = (error: string) => {
            console.error("Auction socket error:", error);
            toast({
                title: "Auction Error",
                description: error,
                variant: "destructive"
            });
        };

        const onRole = (role: string) => {
            if (role === 'auctioneer') {
                setIsAuctioneer(true);
            } else {
                setIsAuctioneer(false);
            }
        };

        // Specific event notifications
        const onPlayerSelected = (player: Player) => {
            // Optional: Could trigger specific UI effects
        };

        const onBidPlaced = (data: { teamName: string, amount: number }) => {
            // Optional: Could trigger toast or sound
        };

        const onSold = (data: { player: Player, team: Team, amount: number }) => {
            // Handled by state update mostly, but can trigger animation independently if needed
            // Note: Don't clear infoMessage here as auction:info may come after this event
        };

        const onInfo = (message: string) => {
            setInfoMessage(message);
        };

        const onPlayerSelectedClear = (player: Player) => {
            setInfoMessage(null); // Clear info message when a new player is selected
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("auction:state", onStateUpdate);
        socket.on("auction:viewerCount", onViewerCount);
        socket.on("auction:error", onError);
        socket.on("auction:role", onRole);
        socket.on("auction:playerSelected", onPlayerSelectedClear);
        socket.on("auction:bidPlaced", onBidPlaced);
        socket.on("auction:sold", onSold);
        socket.on("auction:info", onInfo);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("auction:state", onStateUpdate);
            socket.off("auction:viewerCount", onViewerCount);
            socket.off("auction:error", onError);
            socket.off("auction:role", onRole);
            socket.off("auction:playerSelected", onPlayerSelectedClear);
            socket.off("auction:bidPlaced", onBidPlaced);
            socket.off("auction:sold", onSold);
            socket.off("auction:info", onInfo);

            // Don't disconnect here because moving between pages might need connection
            // But for now, let's keep it alive
        };
    }, [tournamentId, userId, toast]);

    // Actions
    const startAuction = useCallback(() => {
        if (!tournamentId || !userId) return;
        socketRef.current.emit("auction:start", { tournamentId, userId });
    }, [tournamentId, userId]);

    const selectPlayer = useCallback((playerId?: string, category?: string) => {
        if (!tournamentId) return;
        socketRef.current.emit("auction:selectPlayer", { tournamentId, playerId, category });
    }, [tournamentId]);

    const placeBid = useCallback((teamId: string) => {
        if (!tournamentId) return;
        socketRef.current.emit("auction:bid", { tournamentId, teamId });
    }, [tournamentId]);

    const undoBid = useCallback(() => {
        if (!tournamentId) return;
        socketRef.current.emit("auction:undoBid", { tournamentId });
    }, [tournamentId]);

    const markSold = useCallback(() => {
        if (!tournamentId || !userId) return;
        socketRef.current.emit("auction:sold", { tournamentId, userId });
    }, [tournamentId, userId]);

    const markUnsold = useCallback(() => {
        if (!tournamentId || !userId) return;
        socketRef.current.emit("auction:unsold", { tournamentId, userId });
    }, [tournamentId, userId]);

    const resetMode = useCallback(() => {
        if (!tournamentId) return;
        socketRef.current.emit("auction:resetMode", { tournamentId });
    }, [tournamentId]);

    const updateSlabs = useCallback((bidIncrementSlabs: Array<{ minBid: number; maxBid: number | null; increment: number }>) => {
        if (!tournamentId) return;
        socketRef.current.emit("auction:updateSlabs", { tournamentId, bidIncrementSlabs });
    }, [tournamentId]);

    return {
        socket: socketRef.current,
        isConnected,
        auctionState,
        isAuctioneer,
        infoMessage,
        actions: {
            startAuction,
            selectPlayer,
            placeBid,
            undoBid,
            markSold,
            markUnsold,
            resetMode,
            updateSlabs
        }
    };
};
