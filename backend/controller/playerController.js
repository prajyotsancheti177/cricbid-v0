const prisma = require("../db/prisma");

const playersService = require("../services/playerService");
const tournamentService = require('../services/tournamentService');
const googleService = require('../utils/googleService');
const playerProfileService = require('../services/playerProfileService');
const { sendSuccess, sendError } = require("../utils");
const { buildColumnPlan, readPlayerValue } = require("../utils/sheetColumns");
const eventService = require("../services/eventService");


const registerPlayer = async (req, res) => {
    try {
        const player = await playersService.registerPlayer(req.body);
        return sendSuccess(res, 201, "Player registered successfully!", player)
    } catch (error) {
        return sendError(res, 400, "Failed to register player!", error)
    }
}

const registerPlayerPublic = async (req, res) => {
    try {
        let {
            name, age, gender, mobile, email, address, skill, playerCategory, customFields
        } = req.body;
        
        let touranmentId = req.body.touranmentId || req.body.tournamentId;

        if (!touranmentId) {
            throw new Error("Tournament ID is required");
        }

        // customFields comes as string in multipart/form-data
        if (typeof customFields === 'string') {
            try {
                customFields = JSON.parse(customFields);
            } catch (e) {
                customFields = {};
            }
        } else if (!customFields) {
            customFields = {};
        }

        let photoUrl = req.body.photo || "";

        // Process uploaded files mapped by multer-s3
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach(file => {
                if (file.fieldname === 'photo') {
                    photoUrl = file.location || file.path; 
                } else if (file.fieldname.startsWith('cf_')) {
                    // Custom fields prefixed with cf_
                    customFields[file.fieldname] = file.location || file.path;
                }
            });
        }

        // Fetch config to verify default values for hidden fields
        const tournamentData = await tournamentService.getRegistrationConfig(touranmentId);
        const config = tournamentData?.registrationFormConfig;

        // Apply Default Values for Hidden Fields
        if (config) {
            // Standard Fields
            const possibleFields = ['age', 'gender', 'photo', 'mobile', 'email', 'skill', 'address', 'playerCategory'];
            possibleFields.forEach(f => {
                if (config.fields?.[f]?.enabled && config.fields?.[f]?.showToPublic === false) {
                    // Force the default value
                    const defVal = config.fields[f].defaultValue;
                    req.body[f] = defVal; // overwrite any malicious intent
                    if (f === 'age') age = defVal;
                    if (f === 'gender') gender = defVal;
                    if (f === 'mobile') mobile = defVal;
                    if (f === 'email') email = defVal;
                    if (f === 'address') address = defVal;
                    if (f === 'skill') skill = defVal;
                    if (f === 'playerCategory') playerCategory = defVal;
                    if (f === 'photo') photoUrl = defVal || photoUrl;
                }
            });

            // Custom Fields
            if (config.customFields) {
                config.customFields.forEach(cf => {
                    if (cf.showToPublic === false) {
                        customFields[cf.id] = cf.defaultValue;
                    }
                });
            }
        }

        const safePayload = {
            name, age, gender, mobile, email, address, skill, playerCategory, photo: photoUrl, touranmentId, customFields,
            sold: false,
            auctionStatus: false,
            // Registering does not put a player in the auction — the host has to
            // verify their payment first.
            paymentVerified: false,
            isPublic: true,
        };

        const player = await playersService.registerPlayer(safePayload);

        // Upsert player profile so future tournament registrations can pre-fill
        if (mobile) {
            try {
                await playerProfileService.upsertProfile({ name, age, gender, mobile, email, address, skill, photo: photoUrl });
            } catch (profileErr) {
                console.error("Failed to upsert player profile (non-fatal)", profileErr);
            }
        }

        try {
            if (config && config.googleSheetId) {
                // Same column plan the full export uses, so an appended row
                // lands under the same headers as everything else.
                const rowData = buildColumnPlan(config).map(col => readPlayerValue({
                    ...safePayload,
                    auctionSerialNumber: player.auctionSerialNumber,
                    customFields,
                    _id: player._id,
                    id: player.id,
                }, col));

                await googleService.appendPlayerRow(config.googleSheetId, rowData);
            }
        } catch (syncErr) {
            console.error("Failed to sync to Google Sheets, but player is registered", syncErr);
        }

        return sendSuccess(res, 201, "Player registered successfully!", player)
    } catch (error) {
        return sendError(res, 400, "Failed to register player!", error)
    }
}

const allPlayerDetails = async (req, res) => {
    try {
        const playerDetails = await playersService.allPlayerDetails(req.body.touranmentId);
        return sendSuccess(res, 200, "All player details fetched successfully!", playerDetails)
    } catch (error) {
        return sendError(res, 400, "Failed to fetch player details!", error)
    }
};

const getPlayerDetail = async (req, res) => {
    try {
        const playerDetail = await playersService.getPlayerDetail(req.body.playerId);
        return sendSuccess(res, 200, "Player detail fetched successfully!", playerDetail)
    } catch (error) {
        return sendError(res, 400, "Failed to fetch player detail!", error)
    }
};

const updatePlayer = async (req, res) => {
    try {
        const updatedPlayer = await playersService.updatePlayer(req.body);
        return sendSuccess(res, 200, "Player updated successfully", updatedPlayer);
    } catch (error) {
        return sendError(res, 400, "Failed to update player!", error);
    }
};

const deletePlayer = async (req, res) => {
    try {
        const deletedPlayer = await playersService.deletePlayer(req.body.playerId);
        return sendSuccess(res, 200, "Player deleted successfully", deletedPlayer);
    } catch (error) {
        return sendError(res, 400, "Failed to delete player!", error);
    }
};

const getPlayerCategories = async (req, res) => {
    try {
        const categories = await playersService.getPlayerCategories(req.body.touranmentId);
        return sendSuccess(res, 200, "Player categories fetched successfully", categories);
    } catch (error) {
        return sendError(res, 400, "Failed to get player categories!", error);
    }
};

const bulkCreatePlayers = async (req, res) => {
    try {
        const result = await playersService.bulkCreatePlayers(req.body.players, req.body.touranmentId);
        return sendSuccess(res, 201, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to create players!", error);
    }
};

const resetUnsoldPlayers = async (req, res) => {
    try {
        const result = await playersService.resetUnsoldPlayers(req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to reset unsold players!", error);
    }
};

const deleteAllPlayers = async (req, res) => {
    try {
        const result = await playersService.deleteAllPlayersByTournament(req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete players!", error);
    }
};

const bulkUpdatePlayers = async (req, res) => {
    try {
        const result = await playersService.bulkUpdatePlayers(req.body.players, req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to update players!", error);
    }
};

const syncToSheet = async (req, res) => {
    try {
        const { touranmentId } = req.body;
        const tournamentData = await tournamentService.getRegistrationConfig(touranmentId);
        const config = tournamentData?.registrationFormConfig;
        
        if (!config || !config.googleSheetId) {
            throw new Error("Google Sheet Sync is not configured for this tournament");
        }

        // Export rows in auction serial-number order (players without one go last)
        const dbPlayers = await prisma.player.findMany({
            where: { touranmentId },
            orderBy: [
                { auctionSerialNumber: { sort: 'asc', nulls: 'last' } },
                { name: 'asc' },
            ],
        });
        const summary = await googleService.updateEntireSheetWithPlayers(config.googleSheetId, config, dbPlayers);

        eventService.trackEvent({
            userId: req.body.userId || null,
            tournamentId: touranmentId || null,
            eventType: "sheets_sync_exported",
            page: "/players",
            eventData: { tournamentId: touranmentId },
        }).catch(() => {});

        // Tell the host when a field had no column to go in, rather than
        // silently leaving it out of the sheet.
        const skipped = summary?.skippedFields || [];
        const message = skipped.length
            ? `Exported ${summary.rowsWritten} players. No column found for: ${skipped.join(', ')} — add a header with that name to include it.`
            : "Successfully exported database to Google Sheet";
        return sendSuccess(res, 200, message, summary || undefined);
    } catch(err) {
        return sendError(res, 400, "Failed to sync to sheet", err);
    }
};

/**
 * Verify (or un-verify) payment for a set of players, or for every pending
 * player in the tournament when `all` is set.
 */
const verifyPayments = async (req, res) => {
    try {
        const { touranmentId, playerIds, verified, all } = req.body;
        if (!touranmentId) throw new Error("Tournament ID is required");

        const shouldVerify = verified !== false;
        const result = all === true
            ? await playersService.verifyAllPending(touranmentId)
            : await playersService.setPaymentVerified(touranmentId, playerIds, shouldVerify);

        const verb = shouldVerify ? "verified" : "moved back to pending";
        return sendSuccess(res, 200, `${result.count} player(s) ${verb}`, { count: result.count });
    } catch (error) {
        return sendError(res, 400, "Failed to update payment verification", error);
    }
};

const getOverlayStats = async (req, res) => {
    try {
        const { touranmentId, tournamentId } = req.body;
        const tId = touranmentId || tournamentId;
        if (!tId) {
            return sendError(res, 400, "Tournament ID is required!");
        }
        const stats = await playerService.getOverlayStats(tId);
        return sendSuccess(res, 200, "Overlay stats fetched successfully!", stats);
    } catch (error) {
        return sendError(res, 400, "Failed to fetch overlay stats!", error);
    }
}

module.exports = {
    registerPlayer,
    registerPlayerPublic,
    allPlayerDetails,
    getPlayerDetail,
    updatePlayer,
    deletePlayer,
    getPlayerCategories,
    bulkCreatePlayers,
    resetUnsoldPlayers,
    deleteAllPlayers,
    bulkUpdatePlayers,
    syncToSheet,
    getOverlayStats,
    verifyPayments
};