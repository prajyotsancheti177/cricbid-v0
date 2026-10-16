const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.mail.smtpHost,
            port: config.mail.smtpPort,
            secure: config.mail.smtpPort === 465,
            auth: config.mail.smtpUser
                ? { user: config.mail.smtpUser, pass: config.mail.smtpPass }
                : undefined
        });
    }
    return transporter;
}

/**
 * Send an email via the configured SMTP transport.
 * No-ops (with a warning) if SMTP credentials are not configured, so the
 * calling job doesn't crash in environments where mail hasn't been set up yet.
 * @param {Object} options - { to, subject, html, text }
 */
const sendMail = async ({ to, subject, html, text }) => {
    if (!config.mail.smtpHost || !config.mail.smtpUser) {
        console.warn('[mailService] SMTP not configured (MAIL_SMTP_HOST/MAIL_SMTP_USER missing) — skipping send.');
        return { skipped: true };
    }

    return await getTransporter().sendMail({
        from: config.mail.mailFrom || config.mail.smtpUser,
        to,
        subject,
        html,
        text
    });
};

module.exports = { sendMail };
