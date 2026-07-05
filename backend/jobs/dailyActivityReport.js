const cron = require('node-cron');
const config = require('../config');
const reportService = require('../services/reportService');
const emailService = require('../services/emailService');

const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const buildTableRows = (items, renderCells, emptyMessage) => {
    if (!items.length) {
        return `<tr><td colspan="2" style="padding:6px 12px;color:#888;">${emptyMessage}</td></tr>`;
    }
    return items.map((item) => `<tr>${renderCells(item)}</tr>`).join('');
};

const formatSummaryHtml = (summary) => {
    const statRow = (label, value) =>
        `<tr><td style="padding:4px 12px;color:#555;">${label}</td><td style="padding:4px 12px;font-weight:600;">${value}</td></tr>`;

    const eventTypeRows = buildTableRows(
        summary.eventTypeBreakdown,
        (e) => `<td style="padding:4px 12px;">${escapeHtml(e.eventType)}</td><td style="padding:4px 12px;text-align:right;">${e.count}</td>`,
        'No events recorded'
    );

    const topPageRows = buildTableRows(
        summary.topPages,
        (p) => `<td style="padding:4px 12px;">${escapeHtml(p.page)}</td><td style="padding:4px 12px;text-align:right;">${p.count}</td>`,
        'No page views recorded'
    );

    const topTournamentRows = buildTableRows(
        summary.topTournaments,
        (t) => `<td style="padding:4px 12px;">${escapeHtml(t.name)}</td><td style="padding:4px 12px;text-align:right;">${t.count}</td>`,
        'No tournament activity recorded'
    );

    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <h2 style="margin-bottom:4px;">cricBid — Daily Activity Summary</h2>
        <p style="color:#555;margin-top:0;">Activity for <strong>${summary.date}</strong></p>

        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
            ${statRow('Total events', summary.totalEvents)}
            ${statRow('Unique visitors (sessions)', summary.uniqueVisitors)}
            ${statRow('Unique logged-in users', summary.uniqueLoggedInUsers)}
            ${statRow('Unique IP addresses', summary.uniqueIPs)}
            ${statRow('Page views', summary.pageViews)}
        </table>

        <h3>Events by type</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
            <tr style="background:#f5f5f5;"><th style="text-align:left;padding:4px 12px;">Event type</th><th style="text-align:right;padding:4px 12px;">Count</th></tr>
            ${eventTypeRows}
        </table>

        <h3>Top pages</h3>
        <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
            <tr style="background:#f5f5f5;"><th style="text-align:left;padding:4px 12px;">Page</th><th style="text-align:right;padding:4px 12px;">Views</th></tr>
            ${topPageRows}
        </table>

        <h3>Most active tournaments</h3>
        <table style="border-collapse:collapse;width:100%;">
            <tr style="background:#f5f5f5;"><th style="text-align:left;padding:4px 12px;">Tournament</th><th style="text-align:right;padding:4px 12px;">Events</th></tr>
            ${topTournamentRows}
        </table>
    </div>`;
};

/**
 * Build and send the daily activity report email for the given day.
 * Defaults to the previous full day (yesterday), since the report typically
 * runs early in the morning for a complete day's data.
 * @param {Date} [forDate]
 */
const sendDailyActivityReport = async (forDate) => {
    try {
        const date = forDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const summary = await reportService.getDailyActivitySummary(date);
        const recipients = config.dailyReportRecipients;

        if (!recipients.length) {
            console.warn('[dailyActivityReport] No recipients configured; skipping send.');
            return;
        }

        await emailService.sendMail({
            to: recipients.join(','),
            subject: `cricBid Daily Activity Summary — ${summary.date}`,
            html: formatSummaryHtml(summary)
        });

        console.log(`[dailyActivityReport] Sent daily activity report for ${summary.date} to ${recipients.join(', ')}`);
    } catch (err) {
        console.error('[dailyActivityReport] Failed to send daily activity report:', err);
    }
};

/**
 * Schedule the daily activity report at 07:00 AM server time.
 * Call this once from the application entry point.
 */
const scheduleDailyActivityReport = () => {
    // "0 7 * * *" = at 07:00 every day
    cron.schedule('0 7 * * *', async () => {
        console.log('[dailyActivityReport] Running scheduled daily activity report...');
        await sendDailyActivityReport();
    });
    console.log('[dailyActivityReport] Daily activity report job scheduled (runs at 07:00 AM).');
};

module.exports = { sendDailyActivityReport, scheduleDailyActivityReport };
