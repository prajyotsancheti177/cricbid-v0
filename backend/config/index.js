const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
    port: process.env.PORT,
    mongoDBUri: process.env.MONGO_DB_URI,
    metaApiKey: process.env.META_API_KEY,
    // Web OAuth client id from Google Cloud Console. Google sign-in stays off
    // until this is set, so shipping the code does not enable a half-configured
    // login.
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    // Where to send the browser back to after Google's redirect-mode sign-in.
    appUrl: (process.env.APP_URL || 'https://cricbid.online').replace(/\/$/, ''),
    /**
     * Which devices use redirect-mode Google sign-in instead of the popup.
     *
     *   'mobile' (default) — phones and tablets only
     *   'true'             — every device
     *   'false'            — nobody; popup everywhere
     *
     * The popup hands the credential back through window.opener, which mobile
     * browsers routinely prevent: the popup opens, hangs on Google's own
     * /gsi/transform page, and nothing comes back. Redirect mode has no popup
     * and no opener, so none of that applies.
     *
     * Desktop stays on the popup because it works there, and because redirect
     * mode needs its callback registered under the OAuth client's Authorised
     * redirect URIs — without that Google refuses the request outright.
     */
    googleRedirectMode: (String(process.env.GOOGLE_REDIRECT_MODE || 'mobile').toLowerCase()),
}