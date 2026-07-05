const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
    port: process.env.PORT,
    mongoDBUri: process.env.MONGO_DB_URI,
    metaApiKey: process.env.META_API_KEY,
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER
    },
    dailyReportRecipients: (process.env.DAILY_REPORT_EMAIL_TO || 'prajyotsancheti177@gmail.com')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
}