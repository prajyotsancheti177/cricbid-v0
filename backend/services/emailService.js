const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

/**
 * Lazily build the SMTP transporter from env config.
 * Returns null when email isn't configured so callers can no-op instead of throwing.
 */
const getTransporter = () => {
    if (transporter) return transporter;
    if (!config.email.host || !config.email.user || !config.email.pass) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
            user: config.email.user,
            pass: config.email.pass
        }
    });

    return transporter;
};

/**
 * Send an email
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient address(es)
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 * @returns {Object} { messageId } or { skipped: true } if email isn't configured
 */
const sendMail = async ({ to, subject, html, text }) => {
    const t = getTransporter();
    if (!t) {
        console.warn('[emailService] Email not configured (missing EMAIL_HOST/EMAIL_USER/EMAIL_PASS); skipping send.');
        return { skipped: true };
    }

    const info = await t.sendMail({
        from: config.email.from,
        to,
        subject,
        html,
        text
    });

    return { messageId: info.messageId };
};

module.exports = { sendMail };
