const nodemailer = require("nodemailer");

let transporter = null;

/**
 * Lazily build a shared SMTP transporter from env vars.
 * Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */
const getTransporter = () => {
    if (transporter) return transporter;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error(
            "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in the environment."
        );
    }

    const port = Number(SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
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
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    return getTransporter().sendMail({ from, to, subject, html, text });
};

module.exports = { sendMail };
