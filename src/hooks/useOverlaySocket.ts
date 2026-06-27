import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import apiConfig from "@/config/apiConfig";
import { Player, Team } from "@/types/auction";

export interface OverlayAuctionState {
  tournamentId: string;
  isActive: boolean;
  auctionMode: "category" | "manual" | null;
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

export interface SoldEventData {
  player: Player;
  team: Team;
  amount: number;
}

export interface UnsoldEventData {
  player: Player;
}

export interface BidPlacedData {
  teamId: string;
  amount: number;
  teamName: string;
  nextBidIncrement: number;
}

interface UseOverlaySocketReturn {
  isConnected: boolean;
  auctionState: OverlayAuctionState | null;
  soldEvent: SoldEventData | null;
  unsoldEvent: UnsoldEventData | null;
  lastBid: BidPlacedData | null;
  clearSoldEvent: () => void;
  clearUnsoldEvent: () => void;
}

/**
 * Read-only socket hook for overlay pages.
 * Connects to the /auction namespace, joins the tournament room as a viewer,
 * and exposes reactive auction state for rendering overlays.
 */
export const useOverlaySocket = (tournamentId: string | undefined): UseOverlaySocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [auctionState, setAuctionState] = useState<OverlayAuctionState | null>(null);
  const [soldEvent, setSoldEvent] = useState<SoldEventData | null>(null);
  const [unsoldEvent, setUnsoldEvent] = useState<UnsoldEventData | null>(null);
  const [lastBid, setLastBid] = useState<BidPlacedData | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const clearSoldEvent = useCallback(() => setSoldEvent(null), []);
  const clearUnsoldEvent = useCallback(() => setUnsoldEvent(null), []);

  useEffect(() => {
    if (!tournamentId) return;

    // Create a dedicated socket for the overlay (don't share with main app)
    const socket = io(`${apiConfig.baseUrl}/auction`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Overlay] Socket connected:", socket.id);
      setIsConnected(true);
      // Join room as viewer (no userId)
      socket.emit("auction:join", { tournamentId });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Overlay] Socket disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("reconnect", () => {
      console.log("[Overlay] Reconnected, re-joining room");
      socket.emit("auction:join", { tournamentId });
    });

    socket.on("auction:state", (state: OverlayAuctionState) => {
      setAuctionState(state);
    });

    socket.on("auction:viewerCount", (count: number) => {
      setAuctionState((prev) =>
        prev ? { ...prev, viewerCount: count } : null
      );
    });

    socket.on("auction:sold", (data: SoldEventData) => {
      setSoldEvent(data);
    });

    socket.on("auction:unsold", (data: UnsoldEventData) => {
      setUnsoldEvent(data);
    });

    socket.on("auction:bidPlaced", (data: BidPlacedData) => {
      setLastBid(data);
    });

    socket.on("auction:playerSelected", () => {
      // Clear previous events when a new player is selected
      setSoldEvent(null);
      setUnsoldEvent(null);
      setLastBid(null);
    });

    socket.on("auction:ended", () => {
      setAuctionState(null);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tournamentId]);

  return {
    isConnected,
    auctionState,
    soldEvent,
    unsoldEvent,
    lastBid,
    clearSoldEvent,
    clearUnsoldEvent,
  };
};
