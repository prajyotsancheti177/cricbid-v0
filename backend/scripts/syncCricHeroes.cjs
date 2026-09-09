#!/usr/bin/env node
/**
 * Manual CricHeroes sync runner.
 *
 * Follows the repo's write rule: running it with no flag prints the plan and
 * writes nothing. Only `--confirm` touches the database.
 *
 *   node scripts/syncCricHeroes.cjs --tournament <id> [--city "Aurangabad (Maharashtra)"]
 *   node scripts/syncCricHeroes.cjs --tournament <id> --confirm
 *
 * Options:
 *   --tournament <id>   tournament to sync (defaults to CRICHEROES_SYNC_TOURNAMENT_IDS)
 *   --city <name>       tournament city, used to break name ties
 *   --limit <n>         only process the first n players (useful for a smoke test)
 *   --force             re-search players already linked or parked as ambiguous
 *   --confirm           actually write
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const cricHeroesSyncService = require('../services/cricHeroesSyncService');

const argv = process.argv.slice(2);
const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
};

const CONFIRMED = argv.includes('--confirm');
const FORCE = argv.includes('--force');
const LIMIT = flag('limit') ? Number(flag('limit')) : null;

const tournamentId =
    flag('tournament') ||
    String(process.env.CRICHEROES_SYNC_TOURNAMENT_IDS || '').split(',')[0].trim();

const city = flag('city') || process.env.CRICHEROES_SYNC_CITY || null;

(async () => {
    if (!tournamentId) {
        console.error('No tournament id. Pass --tournament <id> or set CRICHEROES_SYNC_TOURNAMENT_IDS.');
        process.exit(1);
    }

    console.log(`Tournament : ${tournamentId}`);
    console.log(`City hint  : ${city || '(none)'}`);
    console.log(`Mode       : ${CONFIRMED ? 'WRITE' : 'DRY RUN (no writes)'}${FORCE ? ' +force' : ''}`);
    if (LIMIT) console.log(`Limit      : ${LIMIT} players`);
    console.log('');

    const summary = await cricHeroesSyncService.syncTournament(tournamentId, {
        preferredCity: city,
        force: FORCE,
        limit: LIMIT,
        dryRun: !CONFIRMED
    });

    for (const row of summary.plan) {
        if (row.action === 'link') {
            console.log(`  LINK       ${row.player}  ->  ${row.matched}  [#${row.cricheroesPlayerId}, conf ${row.confidence}]`);
        } else if (row.action === 'refresh-stats') {
            console.log(`  REFRESH    ${row.player}  (#${row.cricheroesPlayerId})`);
        } else if (row.action === 'ambiguous') {
            console.log(`  AMBIGUOUS  ${row.player}  ?  ${row.candidates.join(' | ')}`);
        } else if (row.action === 'not_found') {
            console.log(`  NOT FOUND  ${row.player}`);
        } else if (row.action === 'error') {
            console.log(`  ERROR      ${row.player}  ${row.message}`);
        }
    }

    console.log('');
    console.log(`${summary.tournamentName}: ${summary.considered} considered — ` +
        `${summary.linked} linked, ${summary.ambiguous} ambiguous, ` +
        `${summary.notFound} not found, ${summary.errors} errors`);
    if (CONFIRMED) {
        console.log(`Stats: ${summary.statsFetched} fetched, ${summary.statsSkipped} still fresh.`);
    } else {
        console.log('Dry run — nothing written. Re-run with --confirm to apply.');
    }
})()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => process.exit(0));
