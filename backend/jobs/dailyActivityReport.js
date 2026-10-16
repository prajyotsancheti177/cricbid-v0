const cron = require("node-cron");
const eventService = require("../services/eventService");
const { sendMail } = require("../utils/mailer");
const config = require("../config");

const EVENT_LABELS = {
    page_view: "Page views",
    login: "Logins",
    logout: "Logouts",
    auction_start: "Auctions started",
    auction_completed: "Auctions completed",
    player_sold: "Players sold",
    player_unsold: "Players marked unsold",
    player_search: "Player searches",
    category_selected: "Categories selected",
    team_created: "Teams created",
    player_registered: "Players registered",
    tournament_created: "Tournaments created",
    settings_changed: "Settings changed",
    tournament_view: "Tournament views",
    teams_view: "Teams list views",
    players_view: "Players list views",
    auction_room_created: "Auction rooms created",
    auction_room_joined: "Auction room joins",
    auction_room_left: "Auction room exits",
    auction_room_closed: "Auction rooms closed"
};

const formatEventType = (eventType) =>
    EVENT_LABELS[eventType] || eventType.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());

/**
 * Returns the [start, end) window for the previous full calendar day
 * (server local time).
 */
const getPreviousDayRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end };
};

const buildReportData = async (start, end) => {
    const [summary, pageTraffic] = await Promise.all([
        eventService.getSiteActivitySummary(start, end),
        eventService.getPageTrafficBreakdown(start, end)
    ]);

    return { ...summary, pageTraffic };
};

const renderHtml = (dateLabel, data) => {
    const eventRows = data.eventCounts
        .map(e => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${formatEventType(e.eventType)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${e.count}</td></tr>`)
        .join("");

    const pageRows = data.pageTraffic
        .map(p => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${p.page}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${p.pageViews}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${p.uniqueVisitors}</td></tr>`)
        .join("");

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;margin:0 auto;">
      <h2 style="margin-bottom:0;">CricBid Daily Activity Summary</h2>
      <p style="color:#666;margin-top:4px;">${dateLabel}</p>

      <div style="display:flex;gap:12px;margin:16px 0;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#f5f7fa;border-radius:8px;padding:12px;">
          <div style="font-size:22px;font-weight:bold;">${data.totalEvents}</div>
          <div style="font-size:12px;color:#666;">Total events</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f5f7fa;border-radius:8px;padding:12px;">
          <div style="font-size:22px;font-weight:bold;">${data.uniqueUsers}</div>
          <div style="font-size:12px;color:#666;">Active logged-in users</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f5f7fa;border-radius:8px;padding:12px;">
          <div style="font-size:22px;font-weight:bold;">${data.uniqueSessions}</div>
          <div style="font-size:12px;color:#666;">Unique visitor sessions</div>
        </div>
      </div>

      <h3>Activity breakdown</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #ccc;">Event</th>
            <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #ccc;">Count</th>
          </tr>
        </thead>
        <tbody>
          ${eventRows || `<tr><td colspan="2" style="padding:12px;color:#999;">No events recorded</td></tr>`}
        </tbody>
      </table>

      <h3>Top pages</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #ccc;">Page</th>
            <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #ccc;">Views</th>
            <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #ccc;">Unique visitors</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows || `<tr><td colspan="3" style="padding:12px;color:#999;">No page views recorded</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};

const renderText = (dateLabel, data) => {
    const lines = [
        `CricBid Daily Activity Summary - ${dateLabel}`,
        "",
        `Total events: ${data.totalEvents}`,
        `Active logged-in users: ${data.uniqueUsers}`,
        `Unique visitor sessions: ${data.uniqueSessions}`,
        "",
        "Activity breakdown:",
        ...data.eventCounts.map(e => `  ${formatEventType(e.eventType)}: ${e.count}`),
        "",
        "Top pages:",
        ...data.pageTraffic.map(p => `  ${p.page}: ${p.pageViews} views, ${p.uniqueVisitors} unique visitors`)
    ];
    return lines.join("\n");
};

/**
 * Build and send the daily activity summary email for the previous
 * calendar day.
 */
const sendDailyActivityReport = async () => {
    const { start, end } = getPreviousDayRange();
    const dateLabel = start.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

    try {
        const data = await buildReportData(start, end);

        await sendMail({
            to: config.mail.dailyReportRecipient,
            subject: `CricBid Daily Activity Summary - ${dateLabel}`,
            html: renderHtml(dateLabel, data),
            text: renderText(dateLabel, data)
        });

        console.log(`[dailyActivityReport] Sent daily activity summary for ${dateLabel}`);
    } catch (err) {
        console.error("[dailyActivityReport] Failed to send daily activity summary:", err);
    }
};

/**
 * Schedule the daily activity report at 07:00 AM server time, covering
 * the previous calendar day's activity.
 */
const scheduleDailyActivityReport = () => {
    // "0 7 * * *" = at 07:00 every day
    cron.schedule("0 7 * * *", sendDailyActivityReport);
    console.log("[dailyActivityReport] Daily activity summary job scheduled (runs at 07:00 AM).");
};

module.exports = { sendDailyActivityReport, scheduleDailyActivityReport };
