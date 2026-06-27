import { io, Socket } from "socket.io-client";
import apiConfig from "@/config/apiConfig";

// Create singleton socket instance
let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(`${apiConfig.baseUrl}/auction`, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            timeout: 20000,
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
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
