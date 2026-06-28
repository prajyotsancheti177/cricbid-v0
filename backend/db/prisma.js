/**
 * Shared Prisma client singleton.
 * Used by services being migrated from Mongoose to PostgreSQL.
 * (Mongoose connection in ./index.js still serves not-yet-ported services.)
 */
const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
