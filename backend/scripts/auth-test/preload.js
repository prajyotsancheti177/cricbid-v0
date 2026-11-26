/**
 * Test-only preload for the Google sign-in harness. Load with:
 *
 *   node --require ./scripts/auth-test/preload.js ./server/index.js
 *
 * It does four things, and refuses to do anything at all unless DATABASE_URL
 * points at this machine. The point of the harness is that it cannot touch
 * production: backend/.env points at the production database, so a missing
 * override must stop the process rather than quietly fall through to it.
 *
 *  1. Guard: exits unless DATABASE_URL's host is localhost / 127.0.0.1.
 *  2. Drops the Supabase SSL option for a local Postgres (db/prisma.js always
 *     sets one, and a stock local server refuses SSL).
 *  3. Stubs mongoose.connect when AUTH_TEST_STUB_MONGO=1, so the legacy Mongo
 *     connection at boot neither needs a server nor crashes Node on rejection.
 *  4. When AUTH_TEST_FAKE_GOOGLE=1, accepts ID tokens of the form
 *     `fake.<base64url JSON payload>` in place of Google-signed ones, checking
 *     aud / exp / iat the way google-auth-library does (±300 s skew). Real
 *     Google tokens still go through the real verifier, so a browser sign-in
 *     against the same server keeps working.
 */

const url = process.env.DATABASE_URL || '';
let host = '';
try { host = new URL(url).hostname; } catch { /* handled below */ }
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error(`[auth-test] refusing to start: DATABASE_URL host is "${host || 'unset'}", not local.`);
    process.exit(1);
}

// 2. No SSL for the local database.
const pg = require('pg');
const OrigPool = pg.Pool;
pg.Pool = class LocalPool extends OrigPool {
    constructor(cfg = {}) {
        const c = { ...cfg };
        delete c.ssl;
        super(c);
    }
};

// 3. No Mongo.
if (process.env.AUTH_TEST_STUB_MONGO === '1') {
    const mongoose = require('mongoose');
    mongoose.connect = async () => mongoose;
}

// 4. Fake Google tokens.
if (process.env.AUTH_TEST_FAKE_GOOGLE === '1') {
    const { OAuth2Client } = require('google-auth-library');
    const realVerify = OAuth2Client.prototype.verifyIdToken;
    OAuth2Client.prototype.verifyIdToken = async function (opts) {
        const token = opts && opts.idToken;
        if (typeof token === 'string' && token.startsWith('fake.')) {
            const payload = JSON.parse(Buffer.from(token.slice(5), 'base64url').toString('utf8'));
            if (payload.aud !== opts.audience) throw new Error('Wrong recipient, payload audience != requiredAudience');
            const now = Math.floor(Date.now() / 1000);
            if (payload.iat && payload.iat - 300 > now) throw new Error('Token used too early');
            if (payload.exp && payload.exp + 300 < now) throw new Error('Token used too late');
            return { getPayload: () => payload };
        }
        return realVerify.call(this, opts);
    };
}

console.log('[auth-test] preload active: local DB', host, '| fake google:', process.env.AUTH_TEST_FAKE_GOOGLE === '1');
