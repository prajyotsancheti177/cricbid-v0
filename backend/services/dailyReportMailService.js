const { sendMail } = require("../utils/mailer");
const { getYesterdayRange, getDailyActivitySummary } = require("./activityReportService");

const formatDate = (date) => date.toISOString().slice(0, 10);

const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

const renderCountTable = (title, rows, labelHeader) => {
    if (!rows.length) {
        return `<h3 style="margin:24px 0 8px;font-family:sans-serif;">${title}</h3><p style="font-family:sans-serif;color:#666;">No data.</p>`;
    }
    const body = rows.map(r =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${escapeHtml(r.label)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${r.count}</td></tr>`
    ).join("");
    return `
        <h3 style="margin:24px 0 8px;font-family:sans-serif;">${title}</h3>
        <table style="border-collapse:collapse;width:100%;max-width:480px;font-family:sans-serif;font-size:14px;">
            <thead>
                <tr>
                    <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #333;">${labelHeader}</th>
                    <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #333;">Count</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>`;
};

const renderStatCard = (label, value) => `
    <td style="padding:12px 20px;text-align:center;border:1px solid #eee;">
        <div style="font-family:sans-serif;font-size:24px;font-weight:bold;">${value}</div>
        <div style="font-family:sans-serif;font-size:12px;color:#666;">${escapeHtml(label)}</div>
    </td>`;

const buildEmail = (summary) => {
    const dateLabel = formatDate(summary.start);

    const html = `
    <div style="font-family:sans-serif;max-width:640px;">
        <h2 style="margin-bottom:4px;">CricBid Daily Activity Report</h2>
        <p style="color:#666;margin-top:0;">${dateLabel} (UTC)</p>

        <table style="border-collapse:collapse;margin:16px 0;">
            <tr>
                ${renderStatCard("Total Events", summary.totalEvents)}
                ${renderStatCard("Active Users", summary.uniqueActiveUsers)}
                ${renderStatCard("Sessions", summary.uniqueSessions)}
                ${renderStatCard("Logins", summary.logins)}
                ${renderStatCard("New Signups", summary.newSignups)}
                ${renderStatCard("New Tournaments", summary.newTournaments)}
            </tr>
        </table>

        ${renderCountTable(
            "Events by Type",
            summary.eventTypeBreakdown.map(e => ({ label: e.eventType, count: e.count })),
            "Event Type"
        )}

        ${renderCountTable(
            "Top Pages",
            summary.topPages.map(p => ({ label: p.page, count: p.count })),
            "Page"
        )}
    </div>`;

    const text = [
        `CricBid Daily Activity Report - ${dateLabel} (UTC)`,
        "",
        `Total Events: ${summary.totalEvents}`,
        `Active Users: ${summary.uniqueActiveUsers}`,
        `Sessions: ${summary.uniqueSessions}`,
        `Logins: ${summary.logins}`,
        `New Signups: ${summary.newSignups}`,
        `New Tournaments: ${summary.newTournaments}`,
        "",
        "Events by Type:",
        ...summary.eventTypeBreakdown.map(e => `  ${e.eventType}: ${e.count}`),
        "",
        "Top Pages:",
        ...summary.topPages.map(p => `  ${p.page}: ${p.count}`)
    ].join("\n");

    return {
        subject: `CricBid Daily Activity Report — ${dateLabel}`,
        html,
        text
    };
};

/**
 * Build and send the previous day's activity report to the configured recipient.
 * @param {Date} [referenceDate] - defaults to now; the report covers the UTC day before this date.
 */
const sendDailyActivityReport = async (referenceDate = new Date()) => {
    const to = process.env.REPORT_RECIPIENT_EMAIL || "prajyotsancheti177@gmail.com";
    const { start, end } = getYesterdayRange(referenceDate);
    const summary = await getDailyActivitySummary(start, end);
    const { subject, html, text } = buildEmail(summary);

    await sendMail({ to, subject, html, text });

    return { to, subject, summary };
};

module.exports = { sendDailyActivityReport };
