# Daily Activity Summary Email

Sends a daily email summarizing the previous day's activity from the `user_event`
table (page views, logins, auction events, etc.), plus new user signups.

## How it works

- `backend/services/eventService.js` — `getDailyActivityOverview()` aggregates
  `user_event` rows for a date range into total events, unique visitors
  (sessions), unique logged-in users, and a per-`eventType` breakdown.
- `backend/services/dailyReportService.js` — builds the previous UTC day's
  report (`buildDailyActivityReport`) and formats it into an email
  (`formatDailyActivityReportEmail`).
- `backend/services/mailerService.js` — sends the email via SMTP (nodemailer).
- `backend/jobs/dailyActivityReport.js` — cron job (`node-cron`), scheduled at
  06:00 AM server time in `backend/server/index.js`.

## Required environment variables

Add these to `backend/.env`:

| Var | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default `587`) |
| `SMTP_SECURE` | `"true"` for port 465, otherwise omit/`"false"` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password / app password |
| `MAIL_FROM` | From address (defaults to `SMTP_USER`) |
| `DAILY_REPORT_RECIPIENTS` | Comma-separated recipient list (defaults to `prajyotsancheti177@gmail.com`) |

If using Gmail as the SMTP provider, `SMTP_HOST=smtp.gmail.com`,
`SMTP_PORT=465`, `SMTP_SECURE=true`, and `SMTP_PASS` must be a Google
[App Password](https://myaccount.google.com/apppasswords) (not the account
password) — this requires 2-Step Verification to be enabled on the account.

## Manual test

Run once, without waiting for the cron schedule:

```
node backend/scripts/sendDailyActivityReport.js
```
