const cron = require("node-cron");
const { getDailySummary } = require("../services/eventService");
const { sendMail } = require("../services/mailer");
const config = require("../config");

const formatDate = (date) => date.toISOString().slice(0, 10);

const buildSummaryHtml = (summary) => {
    const dateLabel = formatDate(summary.date);

    const eventRows = summary.eventBreakdown
        .map(e => `<tr><td>${e.eventType}</td><td style="text-align:right">${e.count}</td></tr>`)
        .join("") || `<tr><td colspan="2">No events recorded</td></tr>`;

    const pageRows = summary.topPages
        .map(p => `<tr><td>${p.page}</td><td style="text-align:right">${p.count}</td></tr>`)
        .join("") || `<tr><td colspan="2">No page views recorded</td></tr>`;

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2>CricBid Daily Activity Summary — ${dateLabel}</h2>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
        <tr><td style="padding:6px 0;">Total events</td><td style="text-align:right; font-weight:bold;">${summary.totalEvents}</td></tr>
        <tr><td style="padding:6px 0;">Unique visitors (sessions)</td><td style="text-align:right; font-weight:bold;">${summary.uniqueVisitors}</td></tr>
        <tr><td style="padding:6px 0;">Unique logged-in users</td><td style="text-align:right; font-weight:bold;">${summary.uniqueUsers}</td></tr>
        <tr><td style="padding:6px 0;">Unique IP addresses</td><td style="text-align:right; font-weight:bold;">${summary.uniqueIPs}</td></tr>
      </table>

      <h3>Events by type</h3>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;" border="1" cellpadding="6">
        <thead><tr><th style="text-align:left;">Event Type</th><th style="text-align:right;">Count</th></tr></thead>
        <tbody>${eventRows}</tbody>
      </table>

      <h3>Top pages viewed</h3>
      <table style="border-collapse: collapse; width: 100%;" border="1" cellpadding="6">
        <thead><tr><th style="text-align:left;">Page</th><th style="text-align:right;">Views</th></tr></thead>
        <tbody>${pageRows}</tbody>
      </table>
    </div>
  `;
};

/**
 * Build and send the activity digest for a given day (defaults to yesterday,
 * since the job runs each morning covering the prior day's full activity).
 * @param {Date} forDate
 */
const sendDailySummaryEmail = async (forDate = new Date(Date.now() - 24 * 60 * 60 * 1000)) => {
    try {
        const summary = await getDailySummary(forDate);
        const recipients = config.mail.dailySummaryRecipients;

        if (!recipients.length) {
            console.warn("[dailyEmailSummary] No recipients configured; skipping send.");
            return;
        }

        await sendMail({
            to: recipients,
            subject: `CricBid Daily Activity Summary — ${formatDate(summary.date)}`,
            html: buildSummaryHtml(summary)
        });

        console.log(`[dailyEmailSummary] Sent daily summary for ${formatDate(summary.date)} to ${recipients.join(", ")}`);
    } catch (err) {
        console.error("[dailyEmailSummary] Failed to send daily summary email:", err);
    }
};

/**
 * Schedule the daily activity digest at 07:00 AM server time.
 * Call this once from the application entry point.
 */
const scheduleDailySummaryEmail = () => {
    // "0 7 * * *" = at 07:00 every day
    cron.schedule("0 7 * * *", async () => {
        console.log("[dailyEmailSummary] Running scheduled daily summary email job...");
        await sendDailySummaryEmail();
    });
    console.log("[dailyEmailSummary] Daily summary email job scheduled (runs at 07:00 AM).");
};

module.exports = { sendDailySummaryEmail, scheduleDailySummaryEmail };
