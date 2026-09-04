const prisma = require("../db/prisma");

const playersService = require("../services/playerService");
const tournamentService = require('../services/tournamentService');
const googleService = require('../utils/googleService');
const playerProfileService = require('../services/playerProfileService');
const { sendSuccess, sendError } = require("../utils");
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
        const idColumns = headers.reduce(
            (acc, h, i) => (String(h ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === 'player id' ? acc.concat(i) : acc),
            []);
        if (idColumns.length === 0) throw new Error("Missing 'Player ID' header in Google Sheet");

        // Headers get hand-edited in the sheet, so compare them loosely: trimmed,
        // case-insensitive, whitespace collapsed. Without this a header of
        // "Category" never matched the configured label "Player Category" and
        // that column was silently dropped from the sync.
        const norm = (h) => String(h ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

        // Accepted alternatives for the standard fields, for sheets whose headers
        // were renamed by hand. Only consulted after exact label/key matches, so
        // a custom field named e.g. "Category" still wins its own column.
        const FIELD_ALIASES = {
            playerCategory: ['category', 'player category', 'playercategory'],
            mobile: ['mobile', 'mobile number', 'phone', 'phone number'],
            email: ['email', 'email address'],
            name: ['name', 'player name'],
            age: ['age'],
            gender: ['gender'],
            photo: ['photo', 'photo url'],
            skill: ['skill', 'skills'],
            address: ['address'],
            auctionSerialNumber: ['s.no.', 's.no', 'sno', 'serial', 'serial no', 'serial number'],
        };

        const standardKeys = Object.keys(config.fields || {});
        const headerMap = {};
        headers.forEach((h, colIdx) => {
            const n = norm(h);
            if (!n) return;

            if (n === norm('S.No.')) { headerMap[colIdx] = { key: 'auctionSerialNumber', type: 'standard' }; return; }
            if (n === norm('Name')) { headerMap[colIdx] = { key: 'name', type: 'standard' }; return; }
            if (n === norm('Player ID')) { headerMap[colIdx] = { key: '_id', type: 'system' }; return; }

            // 1. exact label or key on a configured standard field
            let found = standardKeys.find(k => norm(config.fields[k].label) === n || norm(k) === n);
            if (found) { headerMap[colIdx] = { key: found, type: 'standard' }; return; }

            // 2. exact label on a custom field
            const cfMatch = (config.customFields || []).find(cf => norm(cf.label) === n);
            if (cfMatch) { headerMap[colIdx] = { key: cfMatch.id, type: 'custom' }; return; }

            // 3. a known alias for a standard field
            found = Object.keys(FIELD_ALIASES).find(k => FIELD_ALIASES[k].includes(n));
            if (found) headerMap[colIdx] = { key: found, type: 'standard' };
        });

        const dbPlayers = await prisma.player.findMany({ where: { touranmentId } });
        const dbPlayerMap = {};
        dbPlayers.forEach(p => dbPlayerMap[p.id] = p);

        // A sheet can carry more than one column headed 'Player ID' — a custom
        // field whose label happens to match sits to the left of the real one,
        // and indexOf() then read that column, matched no player, and silently
        // reported "no changes" for every row. Pick the column that actually
        // holds player ids; the exporter always appends the real one last, so
        // that is the fallback when nothing matches (e.g. an empty sheet).
        const playerIdIdx = idColumns.length === 1 ? idColumns[0] : (() => {
            const scored = idColumns.map(idx => ({
                idx,
                hits: sheetData.slice(1).filter(r => r && dbPlayerMap[String(r[idx] || '').trim()]).length,
            }));
            const best = scored.reduce((a, b) => (b.hits > a.hits ? b : a));
            return best.hits > 0 ? best.idx : idColumns[idColumns.length - 1];
        })();

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

        eventService.trackEvent({
            userId: req.body.userId || null,
            tournamentId: req.body.touranmentId || null,
            eventType: "sheets_sync_applied",
            page: "/players",
            eventData: { tournamentId: req.body.touranmentId || null, changesApplied: diffs.length },
        }).catch(() => {});

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

        // Export rows in auction serial-number order (players without one go last)
        const dbPlayers = await prisma.player.findMany({
            where: { touranmentId },
            orderBy: [
                { auctionSerialNumber: { sort: 'asc', nulls: 'last' } },
                { name: 'asc' },
            ],
        });
        await googleService.updateEntireSheetWithPlayers(config.googleSheetId, config, dbPlayers);

        eventService.trackEvent({
            userId: req.body.userId || null,
            tournamentId: touranmentId || null,
            eventType: "sheets_sync_exported",
            page: "/players",
            eventData: { tournamentId: touranmentId },
        }).catch(() => {});

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