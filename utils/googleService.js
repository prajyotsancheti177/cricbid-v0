const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];

const getAuthClient = async () => {
    const keyPath = path.join(__dirname, '..', 'google-credentials.json');
    if (fs.existsSync(keyPath)) {
        return new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: SCOPES,
        });
    }
    
    return new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: SCOPES,
    });
};

const hasRealCredentials = () => {
    const keyPath = path.join(__dirname, '..', 'google-credentials.json');
    if (fs.existsSync(keyPath)) return true;
    if (process.env.GOOGLE_SERVICE_EMAIL && !process.env.GOOGLE_SERVICE_EMAIL.includes('dummy')) return true;
    return false;
};

const initializeSheetHeaders = async (spreadsheetId, config) => {
    try {
        if (!hasRealCredentials()) {
            console.log("Dummy Google Credentials detected, skipping sheet initialization.");
            return;
        }

        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // Initialize Headers
        const headers = ['S.No.', 'Name'];
        
        const possibleFields = ['age', 'gender', 'photo', 'mobile', 'email', 'skill', 'address', 'playerCategory'];
        possibleFields.forEach(f => {
            if (config.fields && config.fields[f] && config.fields[f].enabled) {
                headers.push(config.fields[f].label || f);
            }
        });

        if (config.customFields) {
            config.customFields.forEach(cf => headers.push(cf.label));
        }

        // Add Player Database ID for Reverse Syncing
        headers.push('Player ID');

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            resource: {
                values: [headers]
            }
        });
    } catch (e) {
        console.error("Failed to initialize registration sheet headers:", e);
        throw e;
    }
};

const appendPlayerRow = async (sheetId, rowData) => {
    try {
        if (!hasRealCredentials()) {
            console.log("Dummy Google Credentials detected, skipping row append.");
            return;
        }

        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:A',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowData],
            },
        });
    } catch (e) {
        console.error("Failed to append player row to sheet:", e);
    }
};

const getSheetData = async (sheetId) => {
    try {
        if (!hasRealCredentials()) {
            return [];
        }
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:Z',
        });
        return res.data.values || [];
    } catch (e) {
        console.error("Failed to get sheet data:", e);
        throw e;
    }
};

const updateEntireSheetWithPlayers = async (spreadsheetId, config, players) => {
    try {
        if (!hasRealCredentials()) return;
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // Calculate mapped rows
        const rows = players.map((player) => {
            const rowData = [player.auctionSerialNumber || '', player.name || ''];
            const possibleFields = ['age', 'gender', 'photo', 'mobile', 'email', 'skill', 'address', 'playerCategory'];
            possibleFields.forEach(f => {
                if (config.fields && config.fields[f] && config.fields[f].enabled) {
                    rowData.push(player[f] !== undefined ? player[f] : '');
                }
            });

            if (config.customFields) {
                config.customFields.forEach(cf => {
                    rowData.push((player.customFields && player.customFields.get(cf.id)) !== undefined ? player.customFields.get(cf.id) : '');
                });
            }
            
            rowData.push(player._id ? player._id.toString() : '');
            return rowData;
        });

        // Clear existing data rows (excluding row 1 header)
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: 'Sheet1!A2:Z',
        });

        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Sheet1!A2',
                valueInputOption: 'RAW',
                resource: {
                    values: rows
                }
            });
        }
    } catch (e) {
        console.error("Failed to sync entire sheet:", e);
        throw e;
    }
};

module.exports = {
    initializeSheetHeaders,
    appendPlayerRow,
    getSheetData,
    updateEntireSheetWithPlayers
};
