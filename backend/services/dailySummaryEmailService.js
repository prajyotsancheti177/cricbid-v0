const eventService = require('./eventService');
const { sendMail } = require('./mailService');
const config = require('../config');

/**
 * Full previous calendar day [00:00:00, 24:00:00) relative to referenceDate.
 */
function getPreviousDayRange(referenceDate = new Date()) {
    const end = new Date(referenceDate);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
}

function formatDateLabel(date) {
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderEventTypeRows(breakdown) {
    if (!breakdown.length) {
        return '<tr><td colspan="2" style="padding:8px;text-align:center;color:#888;">No events recorded</td></tr>';
    }
    return breakdown.map(({ eventType, count }) => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(eventType)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${count}</td>
        </tr>`).join('');
}

function renderPageRows(pages) {
    if (!pages.length) {
        return '<tr><td colspan="3" style="padding:8px;text-align:center;color:#888;">No page views recorded</td></tr>';
    }
    return pages.slice(0, 10).map(({ page, pageViews, uniqueVisitors }) => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(page)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${pageViews}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${uniqueVisitors}</td>
        </tr>`).join('');
}

function statTile(value, label) {
    return `
        <td style="padding:12px;background:#f5f5f5;border-radius:6px;text-align:center;width:25%;">
            <div style="font-size:22px;font-weight:bold;">${value}</div>
            <div style="font-size:12px;color:#666;">${label}</div>
        </td>`;
}

function buildEmailHtml({ dateLabel, overview, breakdown, pages }) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222;">
        <h2 style="margin-bottom:4px;">cricBid — Daily Activity Summary</h2>
        <p style="margin-top:0;color:#555;">${escapeHtml(dateLabel)}</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr>
                ${statTile(overview.totalEvents, 'Total Events')}
                <td style="width:4%;"></td>
                ${statTile(overview.uniqueUsers, 'Unique Users')}
                <td style="width:4%;"></td>
                ${statTile(overview.uniqueSessions, 'Sessions')}
            </tr>
        </table>

        <h3>Activity Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Event Type</th>
                    <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Count</th>
                </tr>
            </thead>
            <tbody>${renderEventTypeRows(breakdown)}</tbody>
        </table>

        <h3>Top Pages</h3>
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Page</th>
                    <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Views</th>
                    <th style="text-align:right;padding:8px;border-bottom:2px solid #ddd;">Unique Visitors</th>
                </tr>
            </thead>
            <tbody>${renderPageRows(pages)}</tbody>
        </table>

        <p style="margin-top:24px;font-size:12px;color:#999;">Unique IPs seen: ${overview.uniqueIPs}</p>
    </div>`;
}

/**
 * Aggregate the previous day's user_event activity and email it as an HTML summary.
 * @param {Date} referenceDate - Defaults to now; the "previous day" is computed relative to this.
 */
const generateAndSendDailySummary = async (referenceDate = new Date()) => {
    const { start, end } = getPreviousDayRange(referenceDate);

    const [overview, breakdown, pages] = await Promise.all([
        eventService.getDailyOverview(start, end),
        eventService.getEventTypeBreakdown(start, end),
        eventService.getPageTrafficBreakdown(start, end)
    ]);

    const dateLabel = formatDateLabel(start);
    const html = buildEmailHtml({ dateLabel, overview, breakdown, pages });

    return await sendMail({
        to: config.mail.dailySummaryTo,
        subject: `cricBid Daily Activity Summary — ${dateLabel}`,
        html
    });
};

module.exports = { generateAndSendDailySummary, getPreviousDayRange };
