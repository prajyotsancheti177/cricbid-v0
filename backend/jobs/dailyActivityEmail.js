const cron = require("node-cron");
const config = require("../config");
const emailService = require("../services/emailService");
const dailySummaryService = require("../services/dailySummaryService");

const formatDateLabel = (isoLabel) => {
    const [year, month, day] = isoLabel.split('-');
    return `${day}-${month}-${year}`;
};

const tableRow = (cols) =>
    `<tr>${cols.map((c, i) => `<td style="padding:6px 12px;border:1px solid #ddd;${i > 0 ? 'text-align:right;' : ''}">${c}</td>`).join('')}</tr>`;

const buildHtmlReport = (label, summary) => {
    const eventRows = summary.eventTypeBreakdown.length
        ? summary.eventTypeBreakdown.map(e => tableRow([e.eventType, e.count])).join('')
        : tableRow(['No events recorded', '']);

    const pageRows = summary.topPages.length
        ? summary.topPages.map(p => tableRow([p.page, p.count])).join('')
        : tableRow(['No page views recorded', '']);

    const tournamentRows = summary.topTournaments.length
        ? summary.topTournaments.map(t => tableRow([t.name, t.events])).join('')
        : tableRow(['No tournament activity', '']);

    return `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:640px;">
      <h2 style="margin-bottom:4px;">CricBid — Daily Activity Summary</h2>
      <p style="margin-top:0;color:#555;">${formatDateLabel(label)} (IST)</p>

      <table style="border-collapse:collapse;margin-bottom:20px;">
        ${tableRow(['<b>Total Events</b>', summary.totalEvents])}
        ${tableRow(['<b>Page Views</b>', summary.pageViews])}
        ${tableRow(['<b>Unique Visitors</b>', summary.uniqueVisitors])}
        ${tableRow(['<b>Logged-in Users Active</b>', summary.uniqueLoggedInUsers])}
        ${tableRow(['<b>Unique IP Addresses</b>', summary.uniqueIPs])}
      </table>

      <h3>Events by Type</h3>
      <table style="border-collapse:collapse;margin-bottom:20px;width:100%;">
        <tr><th style="padding:6px 12px;border:1px solid #ddd;text-align:left;background:#f5f5f5;">Event Type</th><th style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;">Count</th></tr>
        ${eventRows}
      </table>

      <h3>Top Pages</h3>
      <table style="border-collapse:collapse;margin-bottom:20px;width:100%;">
        <tr><th style="padding:6px 12px;border:1px solid #ddd;text-align:left;background:#f5f5f5;">Page</th><th style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;">Views</th></tr>
        ${pageRows}
      </table>

      <h3>Most Active Tournaments</h3>
      <table style="border-collapse:collapse;width:100%;">
        <tr><th style="padding:6px 12px;border:1px solid #ddd;text-align:left;background:#f5f5f5;">Tournament</th><th style="padding:6px 12px;border:1px solid #ddd;background:#f5f5f5;">Events</th></tr>
        ${tournamentRows}
      </table>
    </div>`;
};

const buildTextReport = (label, summary) => {
    const lines = [
        `CricBid - Daily Activity Summary for ${formatDateLabel(label)} (IST)`,
        '',
        `Total Events: ${summary.totalEvents}`,
        `Page Views: ${summary.pageViews}`,
        `Unique Visitors: ${summary.uniqueVisitors}`,
        `Logged-in Users Active: ${summary.uniqueLoggedInUsers}`,
        `Unique IP Addresses: ${summary.uniqueIPs}`,
        '',
        'Events by Type:',
        ...(summary.eventTypeBreakdown.length
            ? summary.eventTypeBreakdown.map(e => `  ${e.eventType}: ${e.count}`)
            : ['  No events recorded']),
        '',
        'Top Pages:',
        ...(summary.topPages.length
            ? summary.topPages.map(p => `  ${p.page}: ${p.count}`)
            : ['  No page views recorded']),
        '',
        'Most Active Tournaments:',
        ...(summary.topTournaments.length
            ? summary.topTournaments.map(t => `  ${t.name}: ${t.events}`)
            : ['  No tournament activity'])
    ];
    return lines.join('\n');
};

/**
 * Compute and send the daily activity summary email.
 * @param {{start: Date, end: Date, label: string}} [range] - defaults to yesterday (IST)
 */
const sendDailyActivitySummaryEmail = async (range) => {
    if (!config.dailySummaryRecipients.length) {
        console.warn("[dailyActivityEmail] No recipients configured (DAILY_SUMMARY_RECIPIENTS), skipping send.");
        return;
    }

    const { start, end, label } = range || dailySummaryService.getYesterdayIstRange();
    const summary = await dailySummaryService.getDailyActivitySummary(start, end);

    await emailService.sendMail({
        to: config.dailySummaryRecipients,
        subject: `CricBid Daily Activity Summary — ${formatDateLabel(label)}`,
        html: buildHtmlReport(label, summary),
        text: buildTextReport(label, summary)
    });

    console.log(
        `[dailyActivityEmail] Sent daily activity summary for ${label} to ${config.dailySummaryRecipients.join(', ')}`
    );
};

/**
 * Schedule the daily activity summary email at 07:00 AM IST.
 * Call this once from the application entry point.
 */
const scheduleDailyActivitySummaryEmail = () => {
    cron.schedule("0 7 * * *", async () => {
        try {
            console.log("[dailyActivityEmail] Running scheduled daily activity summary email...");
            await sendDailyActivitySummaryEmail();
        } catch (err) {
            console.error("[dailyActivityEmail] Error sending daily activity summary email:", err);
        }
    }, { timezone: "Asia/Kolkata" });
    console.log("[dailyActivityEmail] Daily activity summary email job scheduled (runs at 07:00 AM IST).");
};

module.exports = { sendDailyActivitySummaryEmail, scheduleDailyActivitySummaryEmail, buildHtmlReport, buildTextReport };
