/**
 * Shared Prisma client singleton.
 * Uses @prisma/adapter-pg (WASM/driverAdapters mode) so no native engine binary is needed.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const supabaseCa = fs.readFileSync(path.join(__dirname, '../certs/supabase-ca.pem'), 'utf8');

function createPrismaClient() {
    // Strip query params (sslmode, connection_limit, ...): they're meaningless to
    // node-postgres's Pool, and pg-connection-string now treats sslmode=require as
    // verify-full, which silently overrides the explicit `ssl.ca` option below.
    const url = new URL(process.env.DATABASE_URL);
    url.search = '';

    const pool = new Pool({
        connectionString: url.toString(),
        ssl: { ca: supabaseCa },
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

const prisma = global.__prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
