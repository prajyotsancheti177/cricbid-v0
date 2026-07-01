import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_BASE = import.meta.env.DEV
  ? "http://localhost:3001"
  : (import.meta.env.VITE_API_URL || "https://cricbid.online");

/**
 * Joins the scoring socket room for a match and invokes onUpdate whenever a
 * ball is recorded or undone. Returns the live connection flag.
 */
export function useLiveMatch(matchId: string | undefined, onUpdate: () => void) {
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!matchId) return;
    const socket: Socket = io(SOCKET_BASE, { transports: ["websocket"], reconnectionAttempts: 5 });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.emit("scoring:join", matchId);
    socket.on("scoring:ball", () => onUpdateRef.current());
    socket.on("scoring:undo", () => onUpdateRef.current());
    return () => { socket.disconnect(); };
  }, [matchId]);

  return connected;
}
