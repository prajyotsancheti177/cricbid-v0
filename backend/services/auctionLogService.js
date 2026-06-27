const prisma = require("../db/prisma");

// Auction log -> legacy Mongoose shape. Replicates populate of playerId,
// winningTeamId and bids.teamId as nested {_id,...} objects.
const serializeLog = (log) => {
    if (!log) return log;
    const out = {
        _id: log.id,
        tournamentId: log.tournamentId,
        playerId: log.player ? { _id: log.player.id, name: log.player.name, photo: log.player.photo, playerCategory: log.player.playerCategory } : log.playerId,
        playerName: log.playerName,
        playerCategory: log.playerCategory,
        basePrice: log.basePrice,
        auctionMode: log.auctionMode,
        status: log.status,
        winningTeamId: log.winningTeam ? { _id: log.winningTeam.id, name: log.winningTeam.name, logo: log.winningTeam.logo } : log.winningTeamId,
        winningTeamName: log.winningTeamName,
        finalPrice: log.finalPrice,
        totalBids: log.totalBids,
        uniqueTeamsBidding: log.uniqueTeamsBidding,
        auctionStartedAt: log.auctionStartedAt,
        auctionEndedAt: log.auctionEndedAt,
        totalDurationSeconds: log.totalDurationSeconds,
        conductedBy: log.conductedById,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
    };
    if (log.bids) {
        out.bids = log.bids.map((b) => ({
            _id: b.id,
            teamId: b.team ? { _id: b.team.id, name: b.team.name, logo: b.team.logo } : b.teamId,
            teamName: b.teamName,
            bidAmount: b.bidAmount,
            bidIncrement: b.bidIncrement,
            timestamp: b.timestamp,
            bidOrder: b.bidOrder,
        }));
    }
    return out;
};

/**
 * Save complete auction log when auction ends (with embedded bids -> child rows)
 */
const saveAuctionLog = async (auctionData) => {
    const {
        tournamentId, playerId, playerName, playerCategory, basePrice, auctionMode,
        status, winningTeamId, winningTeamName, finalPrice, bids,
        auctionStartedAt, auctionEndedAt, conductedBy,
    } = auctionData;

    const totalBids = bids ? bids.length : 0;
    const uniqueTeams = bids ? [...new Set(bids.map((b) => b.teamId?.toString()))].length : 0;

    let durationSeconds = null;
    if (auctionStartedAt && auctionEndedAt) {
        durationSeconds = Math.floor((new Date(auctionEndedAt) - new Date(auctionStartedAt)) / 1000);
    }

    const created = await prisma.auctionLog.create({
        data: {
            tournamentId,
            playerId,
            playerName,
            playerCategory,
            basePrice: basePrice ?? 0,
            auctionMode,
            status,
            winningTeamId: winningTeamId || null,
            winningTeamName: winningTeamName || null,
            finalPrice: finalPrice || null,
            totalBids,
            uniqueTeamsBidding: uniqueTeams,
            auctionStartedAt: auctionStartedAt ? new Date(auctionStartedAt) : null,
            auctionEndedAt: auctionEndedAt ? new Date(auctionEndedAt) : new Date(),
            totalDurationSeconds: durationSeconds,
            conductedById: conductedBy || null,
            bids: bids && bids.length ? {
                create: bids.map((b) => ({
                    teamId: b.teamId,
                    teamName: b.teamName,
                    bidAmount: b.bidAmount,
                    bidIncrement: b.bidIncrement ?? null,
                    timestamp: b.timestamp ? new Date(b.timestamp) : null,
                    bidOrder: b.bidOrder,
                })),
            } : undefined,
        },
        include: { bids: true },
    });

    return serializeLog(created);
};

/**
 * Get all auction logs for a tournament
 */
const getAuctionLogsByTournament = async (tournamentId, filters = {}) => {
    const where = { tournamentId };
    if (filters.status) where.status = filters.status;
    if (filters.playerCategory) where.playerCategory = filters.playerCategory;

    const logs = await prisma.auctionLog.findMany({
        where,
        include: {
            player: { select: { id: true, name: true, photo: true } },
            winningTeam: { select: { id: true, name: true, logo: true } },
        },
        orderBy: { auctionEndedAt: 'desc' },
    });
    return logs.map(serializeLog);
};

/**
 * Get auction log for a specific player
 */
const getAuctionLogByPlayer = async (playerId) => {
    const log = await prisma.auctionLog.findFirst({
        where: { playerId },
        include: {
            player: { select: { id: true, name: true, photo: true, playerCategory: true } },
            winningTeam: { select: { id: true, name: true, logo: true } },
            bids: { include: { team: { select: { id: true, name: true, logo: true } } } },
        },
    });
    return serializeLog(log);
};

/**
 * Get auction statistics for a tournament
 */
const getAuctionStats = async (tournamentId) => {
    const logs = await prisma.auctionLog.findMany({
        where: { tournamentId },
        select: { status: true, finalPrice: true, totalBids: true, totalDurationSeconds: true },
    });
    if (logs.length === 0) {
        return { totalAuctions: 0, totalSold: 0, totalUnsold: 0, totalRevenue: 0, avgSoldPrice: 0, avgBidsPerAuction: 0, avgDurationSeconds: 0 };
    }
    const sold = logs.filter((l) => l.status === 'sold');
    const unsold = logs.filter((l) => l.status === 'unsold');
    const totalRevenue = sold.reduce((a, l) => a + (l.finalPrice || 0), 0);
    const avg = (arr, f) => (arr.length ? arr.reduce((a, x) => a + (f(x) || 0), 0) / arr.length : 0);
    return {
        totalAuctions: logs.length,
        totalSold: sold.length,
        totalUnsold: unsold.length,
        totalRevenue,
        avgSoldPrice: sold.length ? totalRevenue / sold.length : 0,
        avgBidsPerAuction: avg(logs, (l) => l.totalBids),
        avgDurationSeconds: avg(logs, (l) => l.totalDurationSeconds),
    };
};

/**
 * Get top bidding teams for a tournament
 */
const getTopBiddingTeams = async (tournamentId) => {
    const bids = await prisma.auctionLogBid.findMany({
        where: { auctionLog: { tournamentId } },
        select: { teamId: true, teamName: true, auctionLog: { select: { winningTeamId: true } } },
    });
    const byTeam = new Map();
    for (const b of bids) {
        let e = byTeam.get(b.teamId);
        if (!e) { e = { _id: b.teamId, teamName: b.teamName, totalBids: 0, totalWins: 0 }; byTeam.set(b.teamId, e); }
        e.totalBids++;
        if (b.auctionLog?.winningTeamId && b.auctionLog.winningTeamId === b.teamId) e.totalWins++;
    }
    return [...byTeam.values()].sort((a, b) => b.totalBids - a.totalBids).slice(0, 10);
};

module.exports = {
    saveAuctionLog,
    getAuctionLogsByTournament,
    getAuctionLogByPlayer,
    getAuctionStats,
    getTopBiddingTeams,
};
