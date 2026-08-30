/**
 * Builds `upi://pay?...` deep links from a tournament's configured payee
 * details. Opening one on a phone hands the payer off to whichever UPI app they
 * have installed (GPay / PhonePe / Paytm / BHIM), pre-filled with payee and
 * amount. On desktop the link is inert — always show the UPI ID as copyable
 * text alongside the button.
 *
 * backend/utils/paymentConfig.js is the authority on what may be saved; this
 * copy exists for inline form feedback and for rendering. Keep them in sync.
 */

/** `name@bank` — the canonical UPI virtual payment address. */
const VPA_REGEX = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

/** A bare 10-digit Indian mobile number. */
const PHONE_REGEX = /^[6-9]\d{9}$/;

export const MAX_UPI_AMOUNT = 100000;

export type PaymentMode = "qr" | "upi" | "both";

export interface PaymentPanelConfig {
  enabled?: boolean;
  qrImage?: string;
  text?: string;
  mode?: PaymentMode;
  upiId?: string;
  payeeName?: string;
  amount?: number | string;
}

/**
 * Accepts a VPA or a 10-digit mobile number and returns the canonical VPA,
 * or null when it is neither.
 */
export function normalizeUpiId(raw?: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (VPA_REGEX.test(value)) return value;

  const digits = value.replace(/[\s-]/g, "").replace(/^\+?91/, "");
  if (PHONE_REGEX.test(digits)) return `${digits}@upi`;

  return null;
}

export function isValidUpiId(raw?: string | null): boolean {
  return normalizeUpiId(raw) !== null;
}

/** True when the value was given as a bare phone number rather than a VPA. */
export function isPhoneUpiId(raw?: string | null): boolean {
  const value = (raw ?? "").trim();
  if (!value || VPA_REGEX.test(value)) return false;
  return PHONE_REGEX.test(value.replace(/[\s-]/g, "").replace(/^\+?91/, ""));
}

export function parseUpiAmount(raw?: number | string | null): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_UPI_AMOUNT) return null;
  return Math.round(amount * 100) / 100;
}

/**
 * The mode to render. Panels saved before the UPI option existed have no
 * `mode` — those keep the original QR-only layout.
 */
export function resolvePaymentMode(panel?: PaymentPanelConfig | null): PaymentMode {
  return panel?.mode ?? "qr";
}

/**
 * Returns the UPI deep link for a panel, or null when the payee is unusable.
 *
 * Every value is URI-encoded. This is security-critical: without it a payee
 * name containing `&pa=attacker@ybl` would inject a second payee parameter and
 * redirect the payment.
 */
export function buildUpiUri(panel: PaymentPanelConfig): string | null {
  const payeeAddress = normalizeUpiId(panel.upiId);
  if (!payeeAddress) return null;

  const params: string[] = [`pa=${encodeURIComponent(payeeAddress)}`];

  const payeeName = (panel.payeeName ?? "").trim();
  if (payeeName) params.push(`pn=${encodeURIComponent(payeeName)}`);

  const amount = parseUpiAmount(panel.amount);
  if (amount !== null) params.push(`am=${encodeURIComponent(amount.toFixed(2))}`);

  const note = (panel.text ?? "").trim();
  if (note) params.push(`tn=${encodeURIComponent(note.slice(0, 80))}`);

  params.push("cu=INR");

  return `upi://pay?${params.join("&")}`;
}
