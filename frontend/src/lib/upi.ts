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
/** Payee name length accepted across UPI apps. */
export const MAX_UPI_NAME = 50;
/** Transaction notes longer than this are rejected by some apps. */
export const MAX_UPI_NOTE = 50;

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
 * Returns the UPI deep link for a panel, or null when it cannot be built —
 * an unusable payee, or no amount configured.
 *
 * Every value is URI-encoded. This is security-critical: without it a payee
 * name containing `&pa=attacker@ybl` would inject a second payee parameter and
 * redirect the payment.
 */
export interface UpiUriOptions {
  /**
   * Include the configured fee. Set false for the "open without the amount"
   * fallback: some apps refuse an amount-carrying intent to a personal UPI ID
   * while accepting the same payee with the amount typed by hand.
   */
  includeAmount?: boolean;
}

export function buildUpiUri(panel: PaymentPanelConfig, options: UpiUriOptions = {}): string | null {
  const payeeAddress = normalizeUpiId(panel.upiId);
  if (!payeeAddress) return null;

  // `pa` and `pn` are mandatory in the UPI Linking Specification. A link
  // missing one is not reported as malformed by the UPI apps — GPay and
  // PhonePe answer with a generic "you have exceeded the bank limit for this
  // payment", which sends people hunting for a bank problem that does not
  // exist. Typing the same UPI ID by hand works, which is the tell.
  const params: string[] = [
    // `@` is left as-is: it is legal in a query string and every real-world UPI
    // link carries it literally, while some apps mishandle the escaped `%40`.
    `pa=${encodeURIComponent(payeeAddress).replace(/%40/g, "@")}`,
    `pn=${encodeURIComponent((panel.payeeName ?? "").trim() || payeeNameFromVpa(payeeAddress))}`,
  ];

  // `am` is mandatory too. A link without it is what produced "you have
  // exceeded the bank limit for this payment" while the same UPI ID typed by
  // hand went through. Rather than hand the player a button that cannot work,
  // no link is offered until a fee is configured — the QR and the copyable UPI
  // ID still cover a tournament whose fee varies by category.
  const includeAmount = options.includeAmount !== false;
  const amount = parseUpiAmount(panel.amount);
  if (includeAmount) {
    if (amount === null) return null;
    params.push(`am=${encodeURIComponent(amount.toFixed(2))}`);
  }

  params.push("cu=INR");

  // The note is the host's own payment instructions, which run to several
  // lines and carry "/", "-" and brackets. Apps parse the note strictly and
  // reject what they dislike, again as a "limit" error, so it is reduced to
  // one short plain line and dropped entirely if nothing usable survives.
  const note = safeUpiNote(panel.text);
  if (note) params.push(`tn=${encodeURIComponent(note)}`);

  return `upi://pay?${params.join("&")}`;
}

/** A usable payee name when the host left the field blank: "gaurav.surana-1" → "gaurav surana". */
function payeeNameFromVpa(vpa: string): string {
  const local = vpa.split("@")[0].replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return (local || "Payee").slice(0, MAX_UPI_NAME);
}

/** One plain line, letters/digits/space/dot/dash only, short enough for every app. */
export function safeUpiNote(raw?: string | null): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, MAX_UPI_NOTE);
}

/** Package names of the UPI apps worth offering by name. */
export const UPI_APPS = [
  { key: "gpay", label: "Google Pay", pkg: "com.google.android.apps.nbu.paisa.user" },
  { key: "phonepe", label: "PhonePe", pkg: "com.phonepe.app" },
  { key: "paytm", label: "Paytm", pkg: "net.one97.paytm" },
] as const;

/**
 * The same payment as an Android `intent://` URL.
 *
 * A plain `upi://` link is handled by the browser, and in-app browsers — the
 * one inside WhatsApp, Instagram or Facebook, where a shared registration link
 * is usually opened — refuse to hand custom schemes to the OS. An intent URL
 * goes through the Android intent system instead, so the UPI apps are found.
 *
 * Without `pkg` Android shows the chooser ("any UPI app"); with it the payment
 * opens in that one app, which is the most reliable route out of a WebView.
 *
 * Deliberately no `mc` or `tr`: `mc` is a merchant category code, which a
 * personal UPI ID is not entitled to claim, and a `tr` that is the same for
 * every player is read as a repeated transaction and refused.
 */
export function buildUpiIntentUri(
  panel: PaymentPanelConfig,
  options: UpiUriOptions = {},
  pkg?: string
): string | null {
  const upi = buildUpiUri(panel, options);
  if (!upi) return null;

  const payload = upi.slice("upi://".length);
  const extras = [
    "Intent",
    "scheme=upi",
    "action=android.intent.action.VIEW",
    "category=android.intent.category.BROWSABLE",
    ...(pkg ? [`package=${pkg}`] : []),
    "end",
  ];
  return `intent://${payload}#${extras.join(";")}`;
}

/** True on Android, where intent URLs are understood. */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}
