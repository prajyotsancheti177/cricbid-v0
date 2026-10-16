const cron = require("node-cron");
const { buildDailyActivityReport, formatDailyActivityReportEmail } = require("../services/dailyReportService");
const { sendMail } = require("../services/mailerService");

const DEFAULT_RECIPIENTS = "prajyotsancheti177@gmail.com";

const getRecipients = () => (process.env.DAILY_REPORT_RECIPIENTS || DEFAULT_RECIPIENTS)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

/**
 * Build and send the previous day's activity summary email
 */
async function sendDailyActivityReport() {
    try {
        const report = await buildDailyActivityReport();
        const { subject, html, text } = formatDailyActivityReportEmail(report);
        const recipients = getRecipients();

        await sendMail({ to: recipients, subject, html, text });

        console.log(
            `[dailyActivityReport] Sent daily activity summary for ${report.startDate.toISOString().slice(0, 10)} to ${recipients.join(", ")}`
        );
    } catch (err) {
        console.error("[dailyActivityReport] Error building/sending daily activity report:", err);
    }
}

/**
 * Schedule the daily activity report at 06:00 AM server time.
 * Reports on the previous full day's user_event activity.
 */
function scheduleDailyActivityReport() {
    // "0 6 * * *" = at 06:00 every day
    cron.schedule("0 6 * * *", async () => {
        console.log("[dailyActivityReport] Running scheduled daily activity report...");
        await sendDailyActivityReport();
    });
    console.log("[dailyActivityReport] Daily activity report job scheduled (runs at 06:00 AM).");
}

module.exports = { sendDailyActivityReport, scheduleDailyActivityReport };
