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
    // Redirect-mode sign-in only works once its callback URL is registered
    // under the OAuth client's Authorised redirect URIs. Until then Google
    // rejects the request, so this stays OFF and the popup flow is used.
    googleRedirectMode: String(process.env.GOOGLE_REDIRECT_MODE || '').toLowerCase() === 'true',
}