import { io, Socket } from "socket.io-client";
import apiConfig from "@/config/apiConfig";
import { getSessionToken } from "@/lib/auth";

// Create singleton socket instance
let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(`${apiConfig.baseUrl}/auction`, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            timeout: 20000,
            // Identifies the viewer, so a private tournament's room can tell an
            // invited person from a stranger with the link.
            auth: { token: getSessionToken() },
        });

        socket.on("connect", () => {
            console.log("Socket connected:", socket?.id);
        });

        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
        });

        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });
    }
    // The token can arrive after the socket was created (signing in without a
    // reload), so refresh it on every hand-out.
    socket.auth = { token: getSessionToken() };
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
