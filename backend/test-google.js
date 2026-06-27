const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function test() {
    try {
        const keyPath = path.join(__dirname, 'google-credentials.json');
        const auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });
        const res = await drive.files.create({
            requestBody: {
                name: 'Test Sheet via Drive API',
                mimeType: 'application/vnd.google-apps.spreadsheet'
            }
        });
        console.log("Drive API create works! File ID:", res.data.id);
    } catch(err) {
        console.error("Drive error:", err.message);
        console.error(err);
    }
}
test();
