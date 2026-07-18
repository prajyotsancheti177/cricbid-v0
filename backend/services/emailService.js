const nodemailer = require("nodemailer");

let transporter = null;

/**
 * Lazily create the SMTP transporter from env vars.
 * Returns null if SMTP is not configured, so callers can no-op safely.
 */
const getTransporter = () => {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    return transporter;
};

/**
 * Send an email.
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML body
 * @param {string} [options.text] - Plain-text fallback body
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const client = getTransporter();
    if (!client) {
        console.warn("[emailService] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing) — skipping send");
        return null;
    }

    return await client.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text
    });
};

module.exports = { sendEmail };
