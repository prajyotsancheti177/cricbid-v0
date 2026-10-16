const nodemailer = require("nodemailer");

let transporter;

/**
 * Lazily create a shared SMTP transporter from env vars:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 */
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined
        });
    }
    return transporter;
};

/**
 * Send an email
 * @param {Object} options - { to, subject, html, text }
 */
const sendMail = async ({ to, subject, html, text }) => {
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    return getTransporter().sendMail({ from, to, subject, html, text });
};

module.exports = { sendMail };
