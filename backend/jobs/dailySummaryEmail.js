const cron = require("node-cron");
const { generateAndSendDailySummary } = require("../services/dailySummaryEmailService");

/**
 * Schedule a daily job at 07:00 AM server time that emails a summary of
 * the previous day's user_event activity.
 * Call this once from the application entry point.
 */
function scheduleDailySummaryEmail() {
  // "0 7 * * *" = at 07:00 every day
  cron.schedule("0 7 * * *", async () => {
    console.log("[dailySummaryEmail] Generating and sending daily activity summary email...");
    try {
      const result = await generateAndSendDailySummary();
      if (result?.skipped) {
        console.warn("[dailySummaryEmail] Skipped — SMTP is not configured.");
      } else {
        console.log("[dailySummaryEmail] Daily summary email sent.");
      }
    } catch (err) {
      console.error("[dailySummaryEmail] Error sending daily summary email:", err);
    }
  });
  console.log("[dailySummaryEmail] Daily summary email job scheduled (runs at 07:00 AM).");
}

module.exports = { scheduleDailySummaryEmail };
