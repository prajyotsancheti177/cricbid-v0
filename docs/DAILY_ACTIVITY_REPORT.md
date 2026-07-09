# Daily Activity Report Email

Sends a daily summary email of site activity, built from the `user_event`
table (`UserEvent` model in `backend/prisma/schema.prisma`).

## What it reports

For the previous UTC day:
- Total events, unique active (logged-in) users, unique sessions
- Logins, new signups, new tournaments created
- Breakdown of events by `eventType`
- Top 10 pages by `page_view` count

## How it's scheduled

`backend/jobs/dailyActivityReport.js` registers a `node-cron` job (`0 7 * * *`,
07:00 AM server time) from `backend/server/index.js`, following the same
pattern as the existing `geoCleanup` job. It only runs while the backend
process is up, so it requires the server to be running continuously (e.g.
under PM2, as configured in `backend/ecosystem.config.js`).

## Configuration

Set these in `backend/.env` (see `backend/.env.example`):

| Var | Required | Notes |
|---|---|---|
| `SMTP_HOST` | yes | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | yes | `587` (STARTTLS) or `465` (implicit TLS) |
| `SMTP_USER` | yes | SMTP username / mailbox address |
| `SMTP_PASS` | yes | SMTP password / app password |
| `SMTP_FROM` | no | Defaults to `SMTP_USER` |
| `REPORT_RECIPIENT_EMAIL` | no | Defaults to `prajyotsancheti177@gmail.com` |

For Gmail as the sender, use an [app password](https://myaccount.google.com/apppasswords)
(requires 2-Step Verification) rather than the account password.

## Manual trigger / testing

```bash
cd backend
node scripts/sendDailyActivityReport.js
```

This sends a real email for yesterday's data immediately, useful for
verifying SMTP credentials without waiting for the 07:00 AM cron.
