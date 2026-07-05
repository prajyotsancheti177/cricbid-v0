/**
 * Manually trigger the daily activity report email, for local testing.
 * Usage: node scripts/sendDailyActivityReport.js [YYYY-MM-DD]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { sendDailyActivityReport } = require('../jobs/dailyActivityReport');

const dateArg = process.argv[2];
const forDate = dateArg ? new Date(dateArg) : undefined;

sendDailyActivityReport(forDate)
    .then(() => {
        console.log('Done.');
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
