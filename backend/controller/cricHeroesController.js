const sync = require('../services/cricHeroesSyncService');
const { sendSuccess, sendError } = require('../utils');

/**
 * The CricHeroes review screen's API.
 *
 * `requireTournamentAccess` has already established that the caller may manage
 * this tournament, and it resolves the id it checked — so these read
 * `req.body.tournamentId` only after that guard has run.
 */

const review = async (req, res) => {
    try {
        const { tournamentId } = req.body;
        if (!tournamentId) return sendError(res, 400, "tournamentId is required");
        const rows = await sync.reviewForTournament(tournamentId);

        // A quick tally, so the screen can lead with what is left to do.
        const counts = rows.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});
        return sendSuccess(res, 200, "CricHeroes review", { players: rows, counts });
    } catch (error) {
        return sendError(res, 400, error.message || "Could not load the CricHeroes review", error);
    }
};

const resolve = async (req, res) => {
    try {
        const { tournamentId, playerId, cricheroesPlayerId } = req.body;
        if (!tournamentId || !playerId) return sendError(res, 400, "tournamentId and playerId are required");

        // The decision is attributed to the session, never to a userId in the
        // body — the same rule the auction learned the hard way.
        const result = await sync.resolveLink(
            tournamentId,
            playerId,
            cricheroesPlayerId === undefined ? null : cricheroesPlayerId,
            req.userId || null
        );
        return sendSuccess(res, 200, result.status === 'linked' ? "Player linked" : "Marked as no match", result);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not save that decision", error);
    }
};

/**
 * Run the matcher now rather than waiting for the 6am job.
 *
 * It calls a third-party API once per unmatched player with a deliberate delay
 * between requests, so a large tournament takes minutes. It is therefore
 * started and reported on, not awaited: the screen polls /review to watch the
 * numbers move.
 */
const syncNow = async (req, res) => {
    try {
        const { tournamentId, force } = req.body;
        if (!tournamentId) return sendError(res, 400, "tournamentId is required");

        const pending = await sync.selectPlayersToSync(tournamentId, { force: !!force });

        sync.syncTournament(tournamentId, { force: !!force })
            .then((r) => console.log(`[cricHeroes] manual sync finished for ${tournamentId}:`, JSON.stringify(r)))
            .catch((err) => console.error(`[cricHeroes] manual sync failed for ${tournamentId}:`, err.message));

        return sendSuccess(res, 202, `Matching ${pending.length} player(s) in the background`, {
            started: true,
            queued: pending.length,
        });
    } catch (error) {
        return sendError(res, 400, error.message || "Could not start the sync", error);
    }
};

module.exports = { review, resolve, sync: syncNow };
