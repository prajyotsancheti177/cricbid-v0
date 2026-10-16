# Daily Activity Summary Email

Sends a daily HTML email summarizing the previous day's `user_event` activity
(the same table the Analytics endpoints in `eventService.js` read from).

## How it works

- `backend/jobs/dailySummaryEmail.js` schedules a `node-cron` job at **07:00 AM
  server time** that generates and sends the summary for the previous
  calendar day.
- `backend/services/dailySummaryEmailService.js` aggregates the data (total
  events, unique users/sessions/IPs, event-type breakdown, top pages) via
  `eventService.js` and renders it as an HTML email.
- `backend/services/mailService.js` sends the email over SMTP using
  `nodemailer`. If SMTP isn't configured, it logs a warning and no-ops
  instead of crashing the job.

## Required environment variables

Add these to `backend/.env`:

| Variable | Description | Default |
|---|---|---|
| `MAIL_SMTP_HOST` | SMTP server host (e.g. `smtp.gmail.com`) | — |
| `MAIL_SMTP_PORT` | SMTP port (`465` for SSL, `587` for STARTTLS) | `587` |
| `MAIL_SMTP_USER` | SMTP username | — |
| `MAIL_SMTP_PASS` | SMTP password / app password | — |
| `MAIL_FROM` | "From" address on outgoing mail | `MAIL_SMTP_USER` |
| `DAILY_SUMMARY_EMAIL_TO` | Recipient address | `prajyotsancheti177@gmail.com` |

To use Gmail as the SMTP provider, create a
[Google App Password](https://myaccount.google.com/apppasswords) (regular
account passwords won't work) and set:

```
MAIL_SMTP_HOST=smtp.gmail.com
MAIL_SMTP_PORT=465
MAIL_SMTP_USER=your.address@gmail.com
MAIL_SMTP_PASS=<16-character app password>
MAIL_FROM=your.address@gmail.com
```

## Manual test

Run the job on demand instead of waiting for the 07:00 AM trigger:

```
node backend/scripts/sendDailySummaryTest.js
```
