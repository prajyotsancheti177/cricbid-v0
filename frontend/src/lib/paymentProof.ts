/**
 * The built-in "payment screenshot" upload on the public registration form.
 *
 * It is stored as an ordinary custom field rather than a separate config flag,
 * because that is what makes the uploaded image reach the host: file custom
 * fields are uploaded under their `cf_` id (backend/controller/playerController
 * registerPlayerPublic) and exported as a column by the Google Sheets sync,
 * which maps `registrationFormConfig.customFields`. A parallel flag would
 * collect images nothing ever displays.
 *
 * `paymentProofOptOut` records that a host deliberately turned it off, so the
 * field is seeded by default without coming back after being removed.
 */

export const PAYMENT_PROOF_FIELD_ID = "cf_payment_screenshot";

export interface CustomFieldLike {
  id: string;
  label: string;
  type: string;
  required: boolean;
  showToPublic: boolean;
  defaultValue: any;
  options: string[];
}

export const buildPaymentProofField = (): CustomFieldLike => ({
  id: PAYMENT_PROOF_FIELD_ID,
  label: "Payment Screenshot",
  type: "file",
  // Optional on purpose: this is on by default for every tournament, including
  // ones that charge no fee, so it must never block a registration.
  required: false,
  showToPublic: true,
  defaultValue: "",
  options: [],
});

export const hasPaymentProofField = (fields?: { id: string }[] | null): boolean =>
  (fields || []).some((f) => f.id === PAYMENT_PROOF_FIELD_ID);

export const isPaymentProofField = (field: { id: string }): boolean =>
  field.id === PAYMENT_PROOF_FIELD_ID;

/**
 * A host-created file upload that already serves as payment proof (plenty of
 * tournaments made one by hand before this was built in). When one exists the
 * built-in field is NOT seeded, so players are not asked for the screenshot
 * twice, and the host's own field is left alone.
 */
export const findHostProofField = <T extends { id: string; type: string; showToPublic?: boolean }>(
  fields?: T[] | null,
): T | undefined =>
  (fields || []).find(
    (f) => f.type === "file" && f.showToPublic !== false && !isPaymentProofField(f),
  );

/** True when the form asks for a payment screenshot at all, by either route. */
export const asksForPaymentProof = (
  fields?: { id: string; type: string; showToPublic?: boolean }[] | null,
): boolean => hasPaymentProofField(fields) || !!findHostProofField(fields);
