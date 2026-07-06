const nodemailer = require("nodemailer");
const config = require("../config");

let transporter = null;

const isConfigured = () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: { user: config.smtp.user, pass: config.smtp.pass }
        });
    }
    return transporter;
};

/**
 * Send an email. No-ops (with a log line) when SMTP credentials are not configured,
 * so the app can run locally/in dev without a mail provider set up.
 * @param {Object} opts
 * @param {string|string[]} opts.to - Recipient address(es)
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 */
const sendMail = async ({ to, subject, html, text }) => {
    if (!isConfigured()) {
        console.log(`[emailService] SMTP not configured, skipping email: "${subject}"`);
        return null;
    }

    const recipients = Array.isArray(to) ? to.join(",") : to;
    return await getTransporter().sendMail({
        from: config.smtp.from || config.smtp.user,
        to: recipients,
        subject,
        html,
        text
    });
};

module.exports = { sendMail, isConfigured };
