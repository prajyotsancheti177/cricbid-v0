const cron = require("node-cron");
const { sendDailyActivityReport } = require("../services/dailyReportMailService");

/**
 * Send yesterday's activity report immediately. Errors are caught so a bad
 * send (e.g. SMTP misconfigured) never crashes the server.
 */
async function runDailyActivityReport() {
    try {
        const { to, summary } = await sendDailyActivityReport();
        console.log(
            `[dailyActivityReport] Sent report to ${to} (${summary.totalEvents} events).`
        );
    } catch (err) {
        console.error("[dailyActivityReport] Failed to send daily activity report:", err.message);
    }
}

/**
 * Schedule the report to be sent daily at 07:00 AM server time, covering
 * the previous UTC day. Call this once from the application entry point.
 */
function scheduleDailyActivityReport() {
    // "0 7 * * *" = at 07:00 every day
    cron.schedule("0 7 * * *", runDailyActivityReport);
    console.log("[dailyActivityReport] Daily activity report job scheduled (runs at 07:00 AM).");
}

module.exports = { runDailyActivityReport, scheduleDailyActivityReport };
