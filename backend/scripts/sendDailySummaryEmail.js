/**
 * Manually send the CricBid daily activity summary email.
 *
 * Usage:
 *   node scripts/sendDailySummaryEmail.js              # sends yesterday's (IST) summary
 *   node scripts/sendDailySummaryEmail.js 2026-07-03    # sends the summary for a specific IST date
 */
require('../config'); // loads .env

const dailySummaryService = require('../services/dailySummaryService');
const { sendDailyActivitySummaryEmail } = require('../jobs/dailyActivityEmail');

const main = async () => {
    const dateArg = process.argv[2];
    const range = dateArg
        ? dailySummaryService.getIstDayRange(new Date(`${dateArg}T12:00:00+05:30`))
        : undefined;

    await sendDailyActivitySummaryEmail(range);
};

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[sendDailySummaryEmail] Failed:', err);
        process.exit(1);
    });
