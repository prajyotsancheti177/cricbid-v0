const cron = require('node-cron');
const cricHeroesSyncService = require('../services/cricHeroesSyncService');

/**
 * Daily CricHeroes enrichment job.
 *
 * Runs at 06:00 server time, before anyone is looking at a player sheet, and
 * walks the configured tournaments' players looking for their CricHeroes
 * profiles and stats.
 *
 * Configured entirely from backend/.env so the target can change without a
 * deploy:
 *
 *   CRICHEROES_SYNC_ENABLED=true
 *   CRICHEROES_SYNC_TOURNAMENT_IDS=cmtmuj9wa03sqp8pin6pg1v6q
 *   CRICHEROES_SYNC_CITY=Aurangabad (Maharashtra)
 *
 * Off unless CRICHEROES_SYNC_ENABLED is exactly "true", so a deploy that ships
 * this code does not silently start hitting a third party.
 */

const SCHEDULE = '0 6 * * *'; // 06:00 daily

const isEnabled = () => String(process.env.CRICHEROES_SYNC_ENABLED || '').toLowerCase() === 'true';

const targetTournamentIds = () =>
    String(process.env.CRICHEROES_SYNC_TOURNAMENT_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const preferredCity = () => process.env.CRICHEROES_SYNC_CITY || null;

/**
 * Run the sync once across all configured tournaments.
 * Swallows per-tournament failures so one bad id cannot stop the rest.
 */
async function runOnce({ force = false } = {}) {
    const tournamentIds = targetTournamentIds();
    if (tournamentIds.length === 0) {
        console.log('[cricHeroesSync] No CRICHEROES_SYNC_TOURNAMENT_IDS configured — nothing to do.');
        return [];
    }

    const city = preferredCity();
    const summaries = [];

    for (const tournamentId of tournamentIds) {
        const startedAt = Date.now();
        try {
            const summary = await cricHeroesSyncService.syncTournament(tournamentId, {
                preferredCity: city,
                force
            });
            const seconds = Math.round((Date.now() - startedAt) / 1000);
            console.log(
                `[cricHeroesSync] ${summary.tournamentName}: ` +
                `${summary.considered} considered, ${summary.linked} linked, ` +
                `${summary.ambiguous} ambiguous, ${summary.notFound} not found, ` +
                `${summary.errors} errors, ${summary.statsFetched} stat fetches ` +
                `(${summary.statsSkipped} still fresh) in ${seconds}s`
            );
            summaries.push(summary);
        } catch (err) {
            console.error(`[cricHeroesSync] Tournament ${tournamentId} failed:`, err.message);
        }
    }

    return summaries;
}

/**
 * Schedule the daily 06:00 run. Call once from the application entry point.
 *
 * Unlike geoCleanup this does not also run at startup — it makes hundreds of
 * outbound requests, and a restart loop during an event would repeat them.
 */
function scheduleCricHeroesSync() {
    if (!isEnabled()) {
        console.log('[cricHeroesSync] Disabled (set CRICHEROES_SYNC_ENABLED=true to enable).');
        return;
    }

    cron.schedule(SCHEDULE, async () => {
        console.log('[cricHeroesSync] Running scheduled CricHeroes sync...');
        await runOnce();
    });

    const ids = targetTournamentIds();
    console.log(
        `[cricHeroesSync] Daily sync scheduled (06:00) for ${ids.length} tournament(s): ${ids.join(', ')}`
    );
}

module.exports = { runOnce, scheduleCricHeroesSync, SCHEDULE };
