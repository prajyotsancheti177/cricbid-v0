const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
    port: process.env.PORT,
    mongoDBUri: process.env.MONGO_DB_URI,
    metaApiKey: process.env.META_API_KEY
}