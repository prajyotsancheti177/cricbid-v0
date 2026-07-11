const cron = require("node-cron");
const eventService = require("../services/eventService");
const emailService = require("../services/emailService");

const DEFAULT_RECIPIENT = "prajyotsancheti177@gmail.com";

const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

const formatDate = (date) =>
    date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

const renderBreakdownRows = (rows, labelKey, countKey) =>
    rows.length
        ? rows.map(r => `<tr><td style="padding:4px 12px;border-bottom:1px solid #eee;">${r[labelKey]}</td><td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right;">${r[countKey]}</td></tr>`).join("")
        : `<tr><td colspan="2" style="padding:4px 12px;color:#888;">No data</td></tr>`;

const buildEmailHtml = (summary, dateLabel) => {
    const statRow = (label, value) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${value}</td></tr>`;

    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
        <h2 style="margin-bottom:4px;">CricBid Daily Activity Summary</h2>
        <p style="color:#666;margin-top:0;">${dateLabel}</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${statRow("Total events", summary.totalEvents)}
            ${statRow("Unique users", summary.uniqueUsers)}
            ${statRow("Unique sessions", summary.uniqueSessions)}
            ${statRow("Page views", summary.pageViews)}
            ${statRow("Logins", summary.logins)}
            ${statRow("New player registrations", summary.newRegistrations)}
            ${statRow("Auctions started", summary.auctionsStarted)}
            ${statRow("Auctions completed", summary.auctionsCompleted)}
            ${statRow("Players sold", summary.playersSold)}
            ${statRow("Players unsold", summary.playersUnsold)}
            ${statRow("Tournaments created", summary.tournamentsCreated)}
            ${statRow("Teams created", summary.teamsCreated)}
        </table>

        <h3>Event breakdown</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${renderBreakdownRows(summary.eventTypeBreakdown, "eventType", "count")}
        </table>

        <h3>Top pages</h3>
        <table style="width:100%;border-collapse:collapse;">
            ${renderBreakdownRows(summary.topPages, "page", "pageViews")}
        </table>
    </div>`;
};

/**
 * Compute and email the previous day's activity summary.
 */
async function sendDailyActivitySummary() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    const dateLabel = formatDate(yesterday);
    const recipient = process.env.DAILY_SUMMARY_EMAIL || DEFAULT_RECIPIENT;

    try {
        const summary = await eventService.getDailySummary(start, end);

        await emailService.sendEmail({
            to: recipient,
            subject: `CricBid Daily Activity Summary — ${dateLabel}`,
            html: buildEmailHtml(summary, dateLabel)
        });

        console.log(`[dailyActivityEmail] Sent daily activity summary for ${dateLabel} to ${recipient}`);
    } catch (err) {
        console.error("[dailyActivityEmail] Failed to send daily activity summary:", err);
    }
}

/**
 * Schedule the daily summary email at 07:00 AM server time,
 * covering the previous full day's activity.
 */
function scheduleDailyActivityEmail() {
    // "0 7 * * *" = at 07:00 every day
    cron.schedule("0 7 * * *", sendDailyActivitySummary);
    console.log("[dailyActivityEmail] Daily activity summary email job scheduled (runs at 07:00 AM).");
}

module.exports = { sendDailyActivitySummary, scheduleDailyActivityEmail };
