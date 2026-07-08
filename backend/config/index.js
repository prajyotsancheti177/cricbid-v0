const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
    port: process.env.PORT,
    mongoDBUri: process.env.MONGO_DB_URI,
    metaApiKey: process.env.META_API_KEY,
    mail: {
        smtpHost: process.env.MAIL_SMTP_HOST,
        smtpPort: Number(process.env.MAIL_SMTP_PORT) || 587,
        smtpUser: process.env.MAIL_SMTP_USER,
        smtpPass: process.env.MAIL_SMTP_PASS,
        mailFrom: process.env.MAIL_FROM,
        dailySummaryTo: process.env.DAILY_SUMMARY_EMAIL_TO || "prajyotsancheti177@gmail.com"
    }
}