# Daily Activity Summary Email

Sends a daily HTML email summarizing website activity, sourced from the
`user_event` table (Prisma model `UserEvent`).

## What it does

Every day at **07:00 AM server time**, `backend/jobs/dailyActivitySummary.js`
builds a summary of the previous full day's activity and emails it to the
configured recipient(s):

- Total events recorded
- Unique visitors (distinct `sessionId`)
- Logged-in users (distinct non-null `userId`)
- Event breakdown by `eventType` (e.g. `page_view`, `bid_placed`, `login`)
- Top 10 pages by view count

## Configuration

Set these environment variables in `backend/.env`:

| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | yes | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | no (default `587`) | SMTP server port |
| `SMTP_SECURE` | no (default `false`) | Set to `true` for port 465 |
| `SMTP_USER` | yes | SMTP username / sender account |
| `SMTP_PASS` | yes | SMTP password (for Gmail, use an [App Password](https://myaccount.google.com/apppasswords)) |
| `SMTP_FROM` | no (defaults to `SMTP_USER`) | "From" address on the email |
| `DAILY_SUMMARY_EMAIL` | no (default `prajyotsancheti177@gmail.com`) | Comma-separated recipient list |

If `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are not set, the job logs a message and
skips sending instead of failing, so the app still runs fine in local/dev
environments without mail configured.

## Manual trigger

To send the report on demand (e.g. to test the email formatting) without
waiting for the cron job, call:

```
POST /api/event/daily-summary/send
```

This route requires authentication and the `boss` or `super_user` role.
