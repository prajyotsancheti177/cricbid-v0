/**
 * Validation for registrationFormConfig.paymentPanel.
 *
 * The public registration form turns these values into a payment QR and a
 * `upi://pay?...` deep link, so they decide who actually receives registration
 * fees. Everything here is validated server-side and never trusted from the
 * client as-is.
 *
 * Keep the rules in sync with frontend/src/lib/upi.ts (that copy exists only to
 * give the host inline feedback while typing).
 */

/** `name@bank` — the canonical UPI virtual payment address. */
const VPA_REGEX = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

/** A bare 10-digit Indian mobile number. */
const PHONE_REGEX = /^[6-9]\d{9}$/;

const PAYMENT_MODES = ["qr", "upi", "both"];

const MAX_AMOUNT = 100000;
const MAX_PAYEE_NAME = 80;
const MAX_TEXT = 500;

/**
 * Accepts a VPA (`name@bank`) or a 10-digit mobile number and returns the
 * canonical VPA to put in the deep link, or null when it is neither.
 *
 * NOTE: mobile-number UPI IDs (`<number>@upi`) rely on the recipient's bank
 * having enabled NPCI's mobile-number mapping — a full VPA is more reliable.
 */
const normalizeUpiId = (raw) => {
    const value = String(raw ?? "").trim();
    if (!value) return null;
    if (VPA_REGEX.test(value)) return value;

    const digits = value.replace(/[\s-]/g, "").replace(/^\+?91/, "");
    if (PHONE_REGEX.test(digits)) return `${digits}@upi`;

    return null;
};

/**
 * Drops control characters and clamps length, for values that end up inside a
 * URI. Compared by code point rather than a regex so the intent stays obvious.
 */
const cleanText = (raw, maxLength) =>
    Array.from(String(raw ?? ""))
        .filter((ch) => {
            const code = ch.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join("")
        .trim()
        .slice(0, maxLength);

const parseAmount = (raw) => {
    if (raw === undefined || raw === null || String(raw).trim() === "") return undefined;

    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payment amount must be a positive number");
    }
    if (amount > MAX_AMOUNT) {
        throw new Error(`Payment amount must not exceed ${MAX_AMOUNT}`);
    }
    return Math.round(amount * 100) / 100;
};

/**
 * Returns the sanitized paymentPanel to persist, or throws with a host-readable
 * message when the configuration is unusable.
 *
 * Panels saved before the UPI option existed have no `mode`; those are treated
 * as "qr" so live tournaments keep rendering exactly as they do today.
 */
const sanitizePaymentPanel = (panel) => {
    if (!panel || typeof panel !== "object") return panel;

    const mode = panel.mode === undefined ? "qr" : String(panel.mode);
    if (!PAYMENT_MODES.includes(mode)) {
        throw new Error(`Payment mode must be one of: ${PAYMENT_MODES.join(", ")}`);
    }

    // qrImage is written by the existing upload flow (handleQrUpload), so it is
    // passed through untouched rather than re-validated as a URL here.
    const sanitized = {
        ...panel,
        mode,
        text: cleanText(panel.text, MAX_TEXT),
    };

    if (!panel.enabled) return sanitized;

    if (mode === "upi" || mode === "both") {
        const upiId = normalizeUpiId(panel.upiId);
        if (!upiId) {
            throw new Error("Enter a valid UPI ID (name@bank) or 10-digit mobile number");
        }
        sanitized.upiId = upiId;
        sanitized.payeeName = cleanText(panel.payeeName, MAX_PAYEE_NAME);
        sanitized.amount = parseAmount(panel.amount);
    } else {
        sanitized.upiId = "";
    }

    if ((mode === "qr" || mode === "both") && !panel.qrImage) {
        throw new Error("Upload a QR image to use QR payment mode");
    }

    return sanitized;
};

module.exports = {
    sanitizePaymentPanel,
    normalizeUpiId,
    PAYMENT_MODES,
    MAX_AMOUNT,
};
