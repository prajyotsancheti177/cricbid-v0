const tournamentService = require("../services/tournamentService");
const { sendSuccess, sendError } = require("../utils");

const addTournamnet = async (req, res) => {
    try {
        // Extract user info from request (you may need to add auth middleware)
        const userId = req.userId;
        const userRole = req.userRole;
        
        const tournament = await tournamentService.createTournament(
            req.body, 
            userId, 
            userRole
        );
        return sendSuccess(res, 201, "Tournament added successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to create tournament", error);
    }
};

const getAllTournaments = async (req, res) => {
    try {
        const userRole = req.userRole; const userId = req.userId;
        
        let tournaments;
        if (userRole === 'tournament_host') {
            // Tournament hosts see only their tournaments
            tournaments = await tournamentService.getTournamentsByHost(userId);
        } else {
            // Boss and super_user see all tournaments
            tournaments = await tournamentService.getAllTournaments();
        }
        
        return sendSuccess(res, 200, "Tournaments fetched successfully", tournaments);
    } catch (error) {
        return sendError(res, 500, "Failed to fetch tournaments", error);
    }
};

const getManagedTournaments = async (req, res) => {
    try {
        const tournaments = req.userRole === 'tournament_host'
            ? await tournamentService.getTournamentsByHost(req.userId)
            : await tournamentService.getManagedTournamentsForAdmin(req.userId);
        return sendSuccess(res, 200, "Tournaments fetched successfully", tournaments);
    } catch (error) {
        return sendError(res, 500, "Failed to fetch tournaments", error);
    }
};

const getTournamentDetail = async (req, res) => {
    try {
        const { tournamentId } = req.body;
        const userId = req.userId;
        const userRole = req.userRole;
        
        const tournament = await tournamentService.getTournamentDetail(
            tournamentId, 
            userId, 
            userRole
        );
        return sendSuccess(res, 200, "Tournament details fetched successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch tournament details", error);
    }
};

const updateTournament = async (req, res) => {
    try {
        const { tournamentId, userId: _ignoredUserId, userRole: _ignoredRole, ...updateData } = req.body;
        const userId = req.userId;
        const userRole = req.userRole;
        
        const tournament = await tournamentService.updateTournament(
            tournamentId,
            updateData,
            userId,
            userRole
        );
        return sendSuccess(res, 200, "Tournament updated successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to update tournament", error);
    }
};

const deleteTournament = async (req, res) => {
    try {
        const { tournamentId } = req.body;
        const userId = req.userId;
        const userRole = req.userRole;
        
        const tournament = await tournamentService.deleteTournament(
            tournamentId,
            userId,
            userRole
        );
        return sendSuccess(res, 200, "Tournament deleted successfully", tournament);
    } catch (error) {
        return sendError(res, 400, "Failed to delete tournament", error);
    }
};

const getAllTournamentHosts = async (req, res) => {
    try {
        const hosts = await tournamentService.getAllTournamentHosts();
        return sendSuccess(res, 200, "Tournament hosts fetched successfully", hosts);
    } catch (error) {
        return sendError(res, 500, "Failed to fetch tournament hosts", error);
    }
};

const exportTournamentData = async (req, res) => {
    try {
        const { tournamentId } = req.body;
        const exportData = await tournamentService.getTournamentExportData(tournamentId);
        return sendSuccess(res, 200, "Tournament data exported successfully", exportData);
    } catch (error) {
        return sendError(res, 400, "Failed to export tournament data", error);
    }
};

const getRegistrationConfig = async (req, res) => {
    try {
        // the id is passed in URL params
        const tournamentId = req.params.id || req.body.tournamentId; 
        const config = await tournamentService.getRegistrationConfig(tournamentId);
        return sendSuccess(res, 200, "Registration config fetched successfully", config);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch registration config", error);
    }
};

const updateRegistrationConfig = async (req, res) => {
    try {
        // userId comes from authMiddleware; the caller's role is resolved from
        // the database in the service, never taken from the request body.
        const { tournamentId, configData } = req.body;
        const config = await tournamentService.updateRegistrationConfig(tournamentId, configData, req.userId);
        return sendSuccess(res, 200, "Registration config updated successfully", config);
    } catch (error) {
        return sendError(res, 400, "Failed to update registration config", error);
    }
};

const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 400, "No image file provided");
        }
        // multer-s3 puts the public URL in file.location; local disk uses file.path
        const imageUrl = req.file.location || req.file.path;
        return sendSuccess(res, 200, "Image uploaded successfully", { imageUrl });
    } catch (error) {
        return sendError(res, 500, "Failed to upload image", error);
    }
};


/**
 * Stream this tournament's payment QR back as a download.
 *
 * The image lives on S3, which sends no CORS headers, so the browser cannot
 * fetch it as a blob and the `download` attribute is ignored cross-origin —
 * the button could only open the image in a tab and leave the player to
 * long-press it. Serving the bytes from our own origin with an attachment
 * header makes it an actual download on every browser.
 *
 * Only ever streams the URL stored on that tournament, never one supplied by
 * the caller, and only from the host the uploader writes to — so this cannot
 * be pointed at an internal address.
 */
const downloadPaymentQr = async (req, res) => {
    try {
        const tournament = await tournamentService.getPaymentQrTarget(req.params.id);
        if (!tournament) return sendError(res, 404, "Tournament not found");
        if (!tournament.enabled || !tournament.qrImage) return sendError(res, 404, "No payment QR for this tournament");
        if (!tournament.downloadAllowed) return sendError(res, 403, "Downloading the QR is turned off for this tournament");

        let target;
        try {
            target = new URL(tournament.qrImage);
        } catch {
            return sendError(res, 400, "The stored QR image is not a URL");
        }
        if (target.protocol !== "https:") return sendError(res, 400, "The stored QR image is not served over https");

        const upstream = await fetch(target.toString());
        if (!upstream.ok) return sendError(res, 502, "Could not fetch the QR image");

        // S3 serves these as application/octet-stream — the uploader does not set
        // a content type — so the extension is the reliable signal and an
        // image/* check on the response would reject every real QR. Anything
        // actively wrong (an HTML error page) is still refused.
        const EXT_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
        const upstreamType = (upstream.headers.get("content-type") || "").split(";")[0].trim();
        if (upstreamType.startsWith("text/") || upstreamType === "application/json") {
            return sendError(res, 502, "That is not an image");
        }
        const ext = (target.pathname.split(".").pop() || "").toLowerCase();
        const type = upstreamType.startsWith("image/")
            ? upstreamType
            : (EXT_TYPES[ext] || "image/png");
        const base = String(tournament.name || "tournament").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);

        res.setHeader("Content-Type", type);
        const outExt = (type.split("/")[1] || "png").replace("jpeg", "jpg");
        res.setHeader("Content-Disposition", `attachment; filename="${base}-payment-qr.${outExt}"`);
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
        return sendError(res, 500, "Could not download the QR image", error);
    }
};

module.exports = {
    downloadPaymentQr,
    addTournamnet,
    getAllTournaments,
    getManagedTournaments,
    getTournamentDetail,
    updateTournament,
    deleteTournament,
    getAllTournamentHosts,
    exportTournamentData,
    getRegistrationConfig,
    updateRegistrationConfig,
    uploadImage
};