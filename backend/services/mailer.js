const nodemailer = require("nodemailer");
const config = require("../config");

let transporter = null;

/**
 * Lazily builds the SMTP transporter from config so a missing config
 * doesn't crash the app at require-time.
 */
const getTransporter = () => {
    if (transporter) return transporter;

    const { smtpHost, smtpUser, smtpPass } = config.mail;
    if (!smtpHost || !smtpUser || !smtpPass) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.mail.smtpPort,
        secure: config.mail.smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
    });

    return transporter;
};

/**
 * Send an email. Returns null (and logs a warning) instead of throwing
 * when SMTP isn't configured, so callers like scheduled jobs don't crash.
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} options.html
 */
const sendMail = async ({ to, subject, html, text }) => {
    const t = getTransporter();
    if (!t) {
        console.warn("[mailer] SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing); skipping email send.");
        return null;
    }

    return t.sendMail({
        from: config.mail.mailFrom || config.mail.smtpUser,
        to: Array.isArray(to) ? to.join(",") : to,
        subject,
        html,
        text
    });
};

module.exports = { sendMail };
