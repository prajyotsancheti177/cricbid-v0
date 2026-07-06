const cron = require("node-cron");
const activitySummaryService = require("../services/activitySummaryService");
const emailService = require("../services/emailService");
const config = require("../config");

/**
 * Build the previous day's activity summary and email it to the configured recipients.
 */
async function sendDailyActivitySummary() {
    if (!config.dailySummaryRecipients.length) {
        console.log("[dailyActivitySummary] No recipients configured, skipping.");
        return;
    }

    try {
        const { subject, html, text } = await activitySummaryService.buildDailySummaryEmail();
        await emailService.sendMail({ to: config.dailySummaryRecipients, subject, html, text });
        console.log(`[dailyActivitySummary] Sent daily summary to ${config.dailySummaryRecipients.join(", ")}`);
    } catch (err) {
        console.error("[dailyActivitySummary] Failed to send daily summary email:", err);
    }
}

/**
 * Schedule a daily cron job at 07:00 AM server time, covering the previous full day.
 * Call this once from the application entry point.
 */
function scheduleDailyActivitySummary() {
    // "0 7 * * *" = at 07:00 every day
    cron.schedule("0 7 * * *", async () => {
        console.log("[dailyActivitySummary] Running scheduled daily activity summary...");
        await sendDailyActivitySummary();
    });
    console.log("[dailyActivitySummary] Daily activity summary job scheduled (runs at 07:00 AM).");
}

module.exports = { sendDailyActivitySummary, scheduleDailyActivitySummary };
