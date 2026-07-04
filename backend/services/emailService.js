const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
        throw new Error(
            'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS (see backend/.env.example).'
        );
    }

    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass }
    });

    return transporter;
};

/**
 * Send an email via the configured SMTP transport.
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} [options.html]
 * @param {string} [options.text]
 */
const sendMail = async ({ to, subject, html, text }) => {
    const mailer = getTransporter();
    return mailer.sendMail({
        from: config.smtp.from || config.smtp.user,
        to,
        subject,
        html,
        text
    });
};

module.exports = { sendMail };
