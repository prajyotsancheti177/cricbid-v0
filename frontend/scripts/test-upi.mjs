/**
 * Tests for src/lib/upi.ts — the UPI deep-link builder.
 *
 * The repo has no frontend test runner, so this compiles upi.ts with tsc into a
 * temp dir and asserts against the real source. Run it directly:
 *
 *   node frontend/scripts/test-upi.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "..", "src", "lib", "upi.ts");
const outDir = mkdtempSync(path.join(tmpdir(), "upi-test-"));

try {
  execFileSync("npx", ["tsc", source, "--outDir", outDir, "--module", "esnext",
    "--target", "es2020", "--moduleResolution", "bundler"], { stdio: "inherit" });

  const upi = await import(pathToFileURL(path.join(outDir, "upi.js")).href);
  const { buildUpiUri, normalizeUpiId, isPhoneUpiId, parseUpiAmount, resolvePaymentMode } = upi;

  const check = (label, fn) => { fn(); console.log(`  ok  ${label}`); };

  // Security-critical: a hostile payee name must not inject a second payee.
  check("payee name cannot inject a second pa= or am=", () => {
    const uri = buildUpiUri({
      upiId: "club@okhdfcbank",
      payeeName: "Evil&pa=attacker@ybl&am=99999",
      amount: 500,
    });
    assert.equal((uri.match(/[?&]pa=/g) || []).length, 1, "exactly one pa=");
    assert.equal((uri.match(/[?&]am=/g) || []).length, 1, "exactly one am=");
    assert.ok(uri.includes("pn=Evil%26pa%3Dattacker%40ybl%26am%3D99999"), "name is encoded");
    assert.ok(!uri.includes("attacker@ybl"), "attacker VPA never appears unencoded");
    assert.ok(uri.includes("pa=club%40okhdfcbank"), "real payee preserved");
  });

  check("payment note is encoded and length-capped", () => {
    const uri = buildUpiUri({ upiId: "club@okhdfcbank", text: "Fee&am=1 " + "x".repeat(200) });
    assert.equal((uri.match(/[?&]am=/g) || []).length, 0, "no am= injected via note");
    const note = new URL(uri.replace("upi://", "https://")).searchParams.get("tn");
    assert.ok(note.length <= 80, "note capped at 80 chars");
  });

  check("amount is optional and emitted as toFixed(2)", () => {
    assert.ok(buildUpiUri({ upiId: "club@okhdfcbank", amount: 500 }).includes("am=500.00"));
    assert.ok(!buildUpiUri({ upiId: "club@okhdfcbank" }).includes("am="));
    assert.equal(parseUpiAmount(0), null);
    assert.equal(parseUpiAmount(-5), null);
    assert.equal(parseUpiAmount(100001), null);
    assert.equal(parseUpiAmount("abc"), null);
    assert.equal(parseUpiAmount(499.5), 499.5);
  });

  check("mobile numbers normalize to <digits>@upi", () => {
    assert.equal(normalizeUpiId("+91 93098-48331"), "9309848331@upi");
    assert.equal(normalizeUpiId("9309848331"), "9309848331@upi");
    assert.equal(isPhoneUpiId("9309848331"), true);
    assert.equal(isPhoneUpiId("club@okhdfcbank"), false);
    assert.equal(normalizeUpiId("1234567890"), null, "must start 6-9");
    assert.equal(normalizeUpiId("not a upi id"), null);
    assert.equal(buildUpiUri({ upiId: "garbage" }), null, "unusable payee yields no link");
  });

  check("currency is always INR and a legacy panel stays qr", () => {
    assert.ok(buildUpiUri({ upiId: "club@okhdfcbank" }).includes("cu=INR"));
    assert.equal(resolvePaymentMode({ enabled: true, qrImage: "x" }), "qr");
    assert.equal(resolvePaymentMode({ mode: "both" }), "both");
  });

  console.log("\nRESULT: PASS — upi deep-link builder behaved as expected");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
