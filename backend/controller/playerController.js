const prisma = require("../db/prisma");

const playersService = require("../services/playerService");
const tournamentService = require('../services/tournamentService');
const googleService = require('../utils/googleService');
const playerProfileService = require('../services/playerProfileService');
const { sendSuccess, sendError } = require("../utils");


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
                const rowData = [player.auctionSerialNumber || '', name];
                const possibleFields = ['age', 'gender', 'photo', 'mobile', 'email', 'skill', 'address', 'playerCategory'];
                
                possibleFields.forEach(f => {
                    if (config.fields?.[f]?.enabled) {
                        rowData.push(safePayload[f] !== undefined ? safePayload[f] : '');
                    }
                });

                if (config.customFields) {
                    config.customFields.forEach(cf => {
                        rowData.push(customFields[cf.id] !== undefined ? customFields[cf.id] : '');
                    });
                }
                
                rowData.push(player._id ? player._id.toString() : '');
                
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
        if (sheetData.length < 2) return sendSuccess(res, 200, "No changes detected", []);
        
        const headers = sheetData[0];
        const playerIdIdx = headers.indexOf('Player ID');
        if (playerIdIdx === -1) throw new Error("Missing 'Player ID' header in Google Sheet");

        const headerMap = {};
        headers.forEach((h, colIdx) => {
            if (h === 'S.No.') headerMap[colIdx] = { key: 'auctionSerialNumber', type: 'standard' };
            else if (h === 'Name') headerMap[colIdx] = { key: 'name', type: 'standard' };
            else if (h === 'Player ID') headerMap[colIdx] = { key: '_id', type: 'system' };
            else {
                let found = Object.keys(config.fields || {}).find(k => config.fields[k].label === h || k === h);
                if (found) {
                     headerMap[colIdx] = { key: found, type: 'standard' };
                } else if (config.customFields) {
                     let cfMatch = config.customFields.find(cf => cf.label === h);
                     if (cfMatch) headerMap[colIdx] = { key: cfMatch.id, type: 'custom' };
                }
            }
        });

        const dbPlayers = await prisma.player.findMany({ where: { touranmentId } });
        const dbPlayerMap = {};
        dbPlayers.forEach(p => dbPlayerMap[p.id] = p);

        const diffs = [];
        for (let i = 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            const playerId = row[playerIdIdx];
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
        
        return sendSuccess(res, 200, "Diff computed successfully", diffs);
    } catch(err) {
        return sendError(res, 400, "Failed to compute sync diff", err);
    }
};

const applySync = async (req, res) => {
    try {
        const { diffs } = req.body;
        const intFields = new Set(['age', 'amtSold', 'auctionSerialNumber']);
        const boolFields = new Set(['sold', 'auctionStatus']);
        for (const diff of diffs) {
            const player = await prisma.player.findUnique({ where: { id: diff.playerId } });
            if (!player) continue;

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
        return sendSuccess(res, 200, "Sync applied successfully");
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

        const dbPlayers = await prisma.player.findMany({ where: { touranmentId } });
        await googleService.updateEntireSheetWithPlayers(config.googleSheetId, config, dbPlayers);
        
        return sendSuccess(res, 200, "Successfully exported database to Google Sheet");
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