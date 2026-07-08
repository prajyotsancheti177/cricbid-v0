/**
 * Manually generate and send the daily activity summary email on demand,
 * without waiting for the 07:00 AM cron trigger. Useful for verifying
 * SMTP configuration and the summary content.
 *
 * Usage: node scripts/sendDailySummaryTest.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { generateAndSendDailySummary } = require('../services/dailySummaryEmailService');

(async () => {
  try {
    const result = await generateAndSendDailySummary();
    if (result?.skipped) {
      console.warn('SMTP is not configured (set MAIL_SMTP_HOST / MAIL_SMTP_USER / MAIL_SMTP_PASS in .env). No email was sent.');
    } else {
      console.log('Daily summary email sent:', result.messageId || result);
    }
  } catch (err) {
    console.error('Failed to send daily summary email:', err);
    process.exitCode = 1;
  }
})();
