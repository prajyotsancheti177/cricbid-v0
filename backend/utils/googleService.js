const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const {
    buildColumnPlan,
    readPlayerValue,
    columnLetter,
} = require('./sheetColumns');

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

        // Same column plan the exporter writes, so headers and data always agree.
        const headers = buildColumnPlan(config).map(col => col.header);

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

/**
 * Rewrites a sheet's player data from the database.
 *
 * The header row and the data rows are built from one column plan and written
 * together, so they can never disagree — a disabled field used to shorten the
 * data rows but not the headers, shifting every later value one column left and
 * writing it under someone else's heading.
 *
 * The export owns columns A..<last planned column> and rewrites them in full,
 * including any rows left behind by deleted players. Anything to the RIGHT of
 * that is the host's own space and is never read, written or cleared — which is
 * where their manual columns must live.
 */
const updateEntireSheetWithPlayers = async (spreadsheetId, config, players) => {
    try {
        if (!hasRealCredentials()) return null;
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        const plan = buildColumnPlan(config);
        const lastCol = columnLetter(plan.length - 1);

        const existing = await getSheetData(spreadsheetId);
        const previousRowCount = Math.max(0, existing.length - 1);

        const values = [
            plan.map((col) => col.header),
            ...players.map((player) => plan.map((col) => readPlayerValue(player, col))),
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Sheet1!A1:${lastCol}${values.length}`,
            valueInputOption: 'RAW',
            resource: { values },
        });

        // Rows left behind by players deleted since the last export. Cleared only
        // across the owned columns — never the old A2:Z, which wiped whatever the
        // host kept to the right of the export.
        if (previousRowCount > players.length) {
            await sheets.spreadsheets.values.batchClear({
                spreadsheetId,
                resource: {
                    ranges: [`Sheet1!A${players.length + 2}:${lastCol}${previousRowCount + 1}`],
                },
            });
        }

        return {
            rowsWritten: players.length,
            columnsWritten: plan.length,
            lastColumn: lastCol,
            staleRowsCleared: Math.max(0, previousRowCount - players.length),
        };
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
