const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

async function deleteStaleGeoCache() {
  const cutoff = new Date(Date.now() - TTL_MS);
  try {
    const result = await prisma.ipGeoCache.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });
    console.log(
      `[geoCleanup] Deleted ${result.count} stale ip_geo_cache rows older than ${cutoff.toISOString()}`
    );
  } catch (err) {
    console.error("[geoCleanup] Error during ip_geo_cache cleanup:", err);
  }
}

/**
 * Run cleanup once immediately — call at startup to clear any backlog
 * accumulated while the job was not running.
 */
async function runOnce() {
  console.log("[geoCleanup] Running startup ip_geo_cache TTL cleanup...");
  await deleteStaleGeoCache();
}

/**
 * Schedule a daily cron job at 02:00 AM server time.
 * Call this once from the application entry point.
 */
function scheduleGeoCleanup() {
  // "0 2 * * *" = at 02:00 every day
  cron.schedule("0 2 * * *", async () => {
    console.log("[geoCleanup] Running scheduled ip_geo_cache TTL cleanup...");
    await deleteStaleGeoCache();
  });
  console.log("[geoCleanup] Daily cleanup job scheduled (runs at 02:00 AM).");
}

module.exports = { runOnce, scheduleGeoCleanup };
