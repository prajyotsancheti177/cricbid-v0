const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
    port: process.env.PORT,
    mongoDBUri: process.env.MONGO_DB_URI,
    metaApiKey: process.env.META_API_KEY,
    mail: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS,
        mailFrom: process.env.MAIL_FROM,
        dailySummaryRecipients: (process.env.DAILY_SUMMARY_RECIPIENTS || 'prajyotsancheti177@gmail.com')
            .split(',')
            .map(email => email.trim())
            .filter(Boolean)
    }
}