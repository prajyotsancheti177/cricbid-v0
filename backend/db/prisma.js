/**
 * Shared Prisma client singleton.
 * Uses @prisma/adapter-pg (WASM/driverAdapters mode) so no native engine binary is needed.
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function createPrismaClient() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

const prisma = global.__prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
