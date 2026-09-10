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
}