const prisma = require("../db/prisma");

const createBackup = async (tournamentId, userId, userRole, label) => {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Tournament not found");

    if (userRole === "tournament_host" && String(tournament.tournamentHostId) !== userId)
        throw new Error("Unauthorized");

    const players = await prisma.player.findMany({
        where: { touranmentId: tournamentId },
        select: { id: true, name: true, sold: true, auctionStatus: true, teamId: true, amtSold: true },
    });

    const soldCount = players.filter((p) => p.sold).length;

    const backup = await prisma.tournamentBackup.create({
        data: {
            tournamentId,
            label: label || null,
            snapshot: { players },
            playerCount: players.length,
            soldCount,
        },
    });

    return serializeBackup(backup);
};

const listBackups = async (tournamentId, userId, userRole) => {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Tournament not found");

    if (userRole === "tournament_host" && String(tournament.tournamentHostId) !== userId)
        throw new Error("Unauthorized");

    const backups = await prisma.tournamentBackup.findMany({
        where: { tournamentId },
        orderBy: { createdAt: "desc" },
        select: { id: true, label: true, playerCount: true, soldCount: true, createdAt: true },
    });

    return backups.map((b) => ({
        _id: b.id,
        label: b.label,
        playerCount: b.playerCount,
        soldCount: b.soldCount,
        createdAt: b.createdAt,
    }));
};

const restoreBackup = async (backupId, tournamentId, userId, userRole) => {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Tournament not found");

    if (userRole === "tournament_host" && String(tournament.tournamentHostId) !== userId)
        throw new Error("Unauthorized");

    const backup = await prisma.tournamentBackup.findUnique({ where: { id: backupId } });
    if (!backup || backup.tournamentId !== tournamentId) throw new Error("Backup not found");

    const snapshotPlayers = backup.snapshot?.players ?? [];
    const snapshotMap = new Map(snapshotPlayers.map((p) => [p.id, p]));

    // All current players in this tournament
    const currentPlayers = await prisma.player.findMany({
        where: { touranmentId: tournamentId },
        select: { id: true },
    });

    await prisma.$transaction(
        currentPlayers.map((p) => {
            const snap = snapshotMap.get(p.id);
            if (snap) {
                return prisma.player.update({
                    where: { id: p.id },
                    data: {
                        sold: snap.sold ?? false,
                        auctionStatus: snap.auctionStatus ?? false,
                        teamId: snap.teamId ?? null,
                        amtSold: snap.amtSold ?? null,
                    },
                });
            }
            // Player added after the backup — reset to unsold
            return prisma.player.update({
                where: { id: p.id },
                data: { sold: false, auctionStatus: false, teamId: null, amtSold: null },
            });
        })
    );

    return { restored: currentPlayers.length, fromSnapshot: snapshotPlayers.length };
};

const deleteBackup = async (backupId, tournamentId, userId, userRole) => {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Tournament not found");

    if (userRole === "tournament_host" && String(tournament.tournamentHostId) !== userId)
        throw new Error("Unauthorized");

    const backup = await prisma.tournamentBackup.findUnique({ where: { id: backupId } });
    if (!backup || backup.tournamentId !== tournamentId) throw new Error("Backup not found");

    await prisma.tournamentBackup.delete({ where: { id: backupId } });
    return { deleted: true };
};

const serializeBackup = (b) => ({
    _id: b.id,
    label: b.label,
    playerCount: b.playerCount,
    soldCount: b.soldCount,
    createdAt: b.createdAt,
});

module.exports = { createBackup, listBackups, restoreBackup, deleteBackup };
