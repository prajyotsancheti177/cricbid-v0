const eventService = require("./eventService");

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const formatDateLabel = (date) => date.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
});

/**
 * Returns the [start, end] bounds of the calendar day before referenceDate,
 * i.e. the most recently completed full day.
 */
const getPreviousDayRange = (referenceDate = new Date()) => {
    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 1);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const buildStatTile = (value, label) => `
    <td style="padding:12px;background:#f3f4f6;border-radius:8px;text-align:center;">
      <div style="font-size:22px;font-weight:bold;color:#111827;">${value}</div>
      <div style="color:#6b7280;font-size:12px;">${label}</div>
    </td>`;

const buildTable = (rows, columns) => `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #111827;">${columns[0]}</th>
          <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #111827;">${columns[1]}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(([label, count]) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(label)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${count}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

const buildDailySummaryEmail = async (referenceDate = new Date()) => {
    const { start, end } = getPreviousDayRange(referenceDate);
    const summary = await eventService.getDailyActivitySummary(start, end);
    const dateLabel = formatDateLabel(start);

    const subject = `cricBid Daily Activity Summary - ${dateLabel}`;

    const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color:#111827;">
      <h2 style="margin-bottom:4px;">cricBid Daily Activity Summary</h2>
      <p style="margin-top:0;color:#6b7280;">${dateLabel}</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          ${buildStatTile(summary.totalEvents, "Total Events")}
          <td style="width:12px;"></td>
          ${buildStatTile(summary.uniqueVisitors, "Unique Visitors")}
          <td style="width:12px;"></td>
          ${buildStatTile(summary.uniqueUsers, "Logged-in Users")}
        </tr>
      </table>

      <h3>Events by Type</h3>
      ${summary.eventTypeBreakdown.length
        ? buildTable(summary.eventTypeBreakdown.map(r => [r.eventType, r.count]), ["Event Type", "Count"])
        : `<p style="color:#6b7280;">No events recorded.</p>`}

      <h3>Top Pages</h3>
      ${summary.topPages.length
        ? buildTable(summary.topPages.map(r => [r.page, r.count]), ["Page", "Views"])
        : `<p style="color:#6b7280;">No page views recorded.</p>`}

      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Generated automatically from the cricBid user_event table.</p>
    </div>`;

    const text = [
        `cricBid Daily Activity Summary - ${dateLabel}`,
        "",
        `Total Events: ${summary.totalEvents}`,
        `Unique Visitors: ${summary.uniqueVisitors}`,
        `Logged-in Users: ${summary.uniqueUsers}`,
        "",
        "Events by Type:",
        ...(summary.eventTypeBreakdown.length
            ? summary.eventTypeBreakdown.map(r => `  ${r.eventType}: ${r.count}`)
            : ["  No events recorded."]),
        "",
        "Top Pages:",
        ...(summary.topPages.length
            ? summary.topPages.map(r => `  ${r.page}: ${r.count}`)
            : ["  No page views recorded."])
    ].join("\n");

    return { subject, html, text, summary, dateLabel };
};

module.exports = { getPreviousDayRange, buildDailySummaryEmail };
