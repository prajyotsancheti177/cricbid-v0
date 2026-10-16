const nodemailer = require("nodemailer");
const config = require("../config");

let transporter = null;

/**
 * Lazily builds the SMTP transporter from EMAIL_* env vars.
 * Returns null when credentials aren't configured, so callers can
 * skip sending (e.g. in local/dev environments) instead of throwing.
 */
const getTransporter = () => {
    if (transporter) return transporter;

    const { host, port, secure, user, pass } = config.mail;
    if (!host || !user || !pass) return null;

    transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    return transporter;
};

/**
 * Send an email.
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 */
const sendMail = async ({ to, subject, html, text }) => {
    const t = getTransporter();
    if (!t) {
        console.warn("[mailer] EMAIL_HOST/EMAIL_USER/EMAIL_PASS not configured, skipping email send.");
        return { skipped: true };
    }

    const info = await t.sendMail({
        from: config.mail.from,
        to,
        subject,
        html,
        text
    });

    return { skipped: false, messageId: info.messageId };
};

module.exports = { sendMail };
