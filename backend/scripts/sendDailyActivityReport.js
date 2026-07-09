/**
 * Manually trigger the daily user-activity email report (covers the
 * previous UTC day). Useful for testing SMTP config or re-sending a report.
 *
 * Usage: node scripts/sendDailyActivityReport.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { sendDailyActivityReport } = require("../services/dailyReportMailService");

sendDailyActivityReport()
    .then(({ to, subject, summary }) => {
        console.log(`Sent "${subject}" to ${to}`);
        console.log(summary);
        process.exit(0);
    })
    .catch((err) => {
        console.error("Failed to send daily activity report:", err);
        process.exit(1);
    });
