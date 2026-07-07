/**
 * Manually trigger the daily activity summary email (bypasses the cron schedule)
 *
 * Usage: node scripts/sendDailyActivityReport.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sendDailyActivityReport } = require('../jobs/dailyActivityReport');

sendDailyActivityReport()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
