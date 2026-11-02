const playerCardService = require("../services/playerCardService");
const { sendSuccess, sendError } = require("../utils");

// Public by design: the card is meant to be opened from a WhatsApp message and
// posted to a story. The service decides what is safe to return.
const getCard = async (req, res) => {
    try {
        const { playerId, code } = { ...req.query, ...req.body };
        const card = await playerCardService.getCard({ playerId, code });
        return sendSuccess(res, 200, "Card fetched successfully", card);
    } catch (error) {
        return sendError(res, 404, error.message || "No card found for that link", error);
    }
};

// Same-origin image proxy, so html2canvas can read the pixels back. Without
// it every card exports with a blank photo: S3 sends no CORS headers.
const getCardImage = async (req, res) => {
    try {
        const { code, which } = req.query;
        const stored = await playerCardService.getCardImageUrl({ code, which });
        if (!stored) return sendError(res, 404, "No image for that card");

        let target;
        try {
            target = new URL(stored);
        } catch {
            return sendError(res, 400, "The stored image is not a URL");
        }
        if (target.protocol !== "https:") return sendError(res, 400, "The stored image is not served over https");

        const upstream = await fetch(target.toString());
        if (!upstream.ok) return sendError(res, 502, "Could not fetch that image");

        // The uploader sets no content type, so S3 serves application/octet-stream
        // and the file extension is the only reliable signal (same as the payment QR).
        const EXT_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
        const upstreamType = (upstream.headers.get("content-type") || "").split(";")[0].trim();
        if (upstreamType.startsWith("text/") || upstreamType === "application/json") {
            return sendError(res, 502, "That is not an image");
        }
        const ext = (target.pathname.split(".").pop() || "").toLowerCase();
        const type = upstreamType.startsWith("image/") ? upstreamType : (EXT_TYPES[ext] || "image/jpeg");

        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
        return sendError(res, 404, error.message || "Could not load that image", error);
    }
};

module.exports = { getCard, getCardImage };
