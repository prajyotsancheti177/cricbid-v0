const prisma = require("../db/prisma");

const playersService = require("../services/playerService");
const tournamentService = require('../services/tournamentService');
const googleService = require('../utils/googleService');
const playerProfileService = require('../services/playerProfileService');
const { sendSuccess, sendError } = require("../utils");
const { buildHeaderMap, resolveIdColumn, buildColumnPlan, readPlayerValue } = require("../utils/sheetColumns");
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
            auctionStatus: false
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

const getSyncDiff = async (req, res) => {
    try {
        const { touranmentId } = req.body;
        const tournamentData = await tournamentService.getRegistrationConfig(touranmentId);
        const config = tournamentData?.registrationFormConfig;
        
        if (!config || !config.googleSheetId) {
            throw new Error("Google Sheet Sync is not configured for this tournament");
        }

        const sheetData = await googleService.getSheetData(config.googleSheetId);
        if (sheetData.length < 2) {
            return sendSuccess(res, 200, "No changes detected", { updates: [], deletions: [], matchedRows: 0, sheetRows: 0 });
        }
        
        const headers = sheetData[0];
        const headerMap = buildHeaderMap(headers, config);

        const dbPlayers = await prisma.player.findMany({ where: { touranmentId } });
        const dbPlayerMap = {};
        dbPlayers.forEach(p => dbPlayerMap[p.id] = p);

        const playerIdIdx = resolveIdColumn(headers, sheetData.slice(1), (id) => !!dbPlayerMap[id]);
        if (playerIdIdx === -1) throw new Error("Missing 'Player ID' header in Google Sheet");

        const diffs = [];
        for (let i = 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            const playerId = String(row[playerIdIdx] || '').trim();
            if (!playerId || !dbPlayerMap[playerId]) continue;
            
            const dbPlayer = dbPlayerMap[playerId];
            const changes = [];

            row.forEach((cellVal, colIdx) => {
                const map = headerMap[colIdx];
                if (!map || map.type === 'system') return;
                
                let dbVal = '';
                if (map.type === 'standard') {
                     dbVal = dbPlayer[map.key] || '';
                } else if (map.type === 'custom') {
                     dbVal = (dbPlayer.customFields && dbPlayer.customFields[map.key]) || '';
                }
                
                const cleanCell = String(cellVal || '').trim();
                const cleanDb = String(dbVal || '').trim();
                
                if (cleanDb !== cleanCell) {
                     changes.push({
                         field: headers[colIdx],
                         dbKey: map.key,
                         dbType: map.type,
                         old: cleanDb,
                         new: cleanCell
                     });
                }
            });

            if (changes.length > 0) {
                 diffs.push({
                     playerId,
                     playerName: dbPlayer.name,
                     changes
                 });
            }
        }

        // Players the host removed from the sheet are removed from the database
        // too. Guarded: if not one row matched a player the sheet is unrelated
        // to this tournament (wrong id column, wrong sheet, header-only export)
        // and proposing to delete the entire squad would be catastrophic.
        const sheetIds = new Set(
            sheetData.slice(1)
                .map(r => String((r || [])[playerIdIdx] || '').trim())
                .filter(Boolean)
        );
        const matchedCount = dbPlayers.filter(p => sheetIds.has(p.id)).length;
        const deletions = matchedCount === 0 ? [] : dbPlayers
            .filter(p => !sheetIds.has(p.id))
            .map(p => ({
                playerId: p.id,
                playerName: p.name,
                auctionSerialNumber: p.auctionSerialNumber,
                sold: !!p.sold,
            }));

        return sendSuccess(res, 200, "Diff computed successfully", {
            updates: diffs,
            deletions,
            matchedRows: matchedCount,
            sheetRows: sheetIds.size,
        });
    } catch(err) {
        return sendError(res, 400, "Failed to compute sync diff", err);
    }
};

const applySync = async (req, res) => {
    try {
        const { touranmentId } = req.body;
        const diffs = req.body.diffs || req.body.updates || [];
        const deletions = req.body.deletions || [];
        if (!touranmentId) throw new Error("Tournament ID is required");

        const intFields = new Set(['age', 'amtSold', 'auctionSerialNumber']);
        const boolFields = new Set(['sold', 'auctionStatus']);
        for (const diff of diffs) {
            const player = await prisma.player.findUnique({ where: { id: diff.playerId } });
            // The ids come from the client, so confirm each one really belongs
            // to the tournament being synced before writing to it.
            if (!player || player.touranmentId !== touranmentId) continue;

            const data = {};
            const customFields = (player.customFields && typeof player.customFields === 'object')
                ? { ...player.customFields } : {};
            let customTouched = false;

            diff.changes.forEach(c => {
                if (c.dbType === 'standard') {
                    if (intFields.has(c.dbKey)) {
                        const n = Number(c.new);
                        data[c.dbKey] = Number.isFinite(n) ? Math.trunc(n) : null;
                    } else if (boolFields.has(c.dbKey)) {
                        const v = String(c.new).trim().toLowerCase();
                        data[c.dbKey] = v === 'yes' || v === 'true';
                    } else if (c.dbKey === 'mobile') {
                        data[c.dbKey] = c.new === '' ? null : String(c.new);
                    } else {
                        data[c.dbKey] = c.new;
                    }
                } else if (c.dbType === 'custom') {
                    customFields[c.dbKey] = c.new;
                    customTouched = true;
                }
            });
            if (customTouched) data.customFields = customFields;

            await prisma.player.update({ where: { id: diff.playerId }, data });
        }

        // Deleting is scoped to this tournament, so a forged id cannot reach a
        // player in someone else's.
        let deleted = 0;
        if (deletions.length > 0) {
            const result = await prisma.player.deleteMany({
                where: {
                    touranmentId,
                    id: { in: deletions.map(d => d.playerId).filter(Boolean) },
                },
            });
            deleted = result.count;
        }

        eventService.trackEvent({
            userId: req.body.userId || null,
            tournamentId: req.body.touranmentId || null,
            eventType: "sheets_sync_applied",
            page: "/players",
            eventData: { tournamentId: touranmentId || null, changesApplied: diffs.length, playersDeleted: deleted },
        }).catch(() => {});

        const message = deleted > 0
            ? `Sync applied: ${diffs.length} player(s) updated, ${deleted} removed`
            : "Sync applied successfully";
        return sendSuccess(res, 200, message, { updated: diffs.length, deleted });
    } catch(err) {
        return sendError(res, 400, "Failed to apply sync", err);
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
    getSyncDiff,
    applySync,
    syncToSheet,
    getOverlayStats
};