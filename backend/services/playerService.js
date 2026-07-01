const prisma = require("../db/prisma");
const whatsappService = require("./whatsappService");
const { serializePlayer } = require("../utils/serialize");

// ---- coercion helpers (Postgres typing) ----------------------------------
const toInt = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(typeof v === 'string' ? v.replace(/"/g, '').trim() : v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
};
const toStr = (v) => (v === undefined || v === null ? undefined : String(v));
const toBool = (v) => {
    if (typeof v === 'string') {
        const c = v.replace(/"/g, '').trim().toLowerCase();
        return c === 'yes' || c === 'true';
    }
    return Boolean(v);
};

// Build a Prisma player payload from a loose input, only including provided keys.
const buildPlayerData = (input) => {
    const d = {};
    if (input.name !== undefined) d.name = typeof input.name === 'string' ? input.name : String(input.name);
    if (input.age !== undefined) d.age = toInt(input.age) ?? null;
    if (input.gender !== undefined) d.gender = toStr(input.gender);
    if (input.photo !== undefined) d.photo = toStr(input.photo);
    if (input.skill !== undefined) d.skill = toStr(input.skill);
    if (input.mobile !== undefined) d.mobile = toStr(input.mobile); // Number -> String column
    if (input.email !== undefined) d.email = toStr(input.email);
    if (input.address !== undefined) d.address = toStr(input.address);
    if (input.touranmentId !== undefined) d.touranmentId = toStr(input.touranmentId);
    if (input.teamId !== undefined) d.teamId = input.teamId ? toStr(input.teamId) : null;
    if (input.sold !== undefined) d.sold = toBool(input.sold);
    if (input.auctionStatus !== undefined) d.auctionStatus = toBool(input.auctionStatus);
    if (input.amtSold !== undefined) d.amtSold = toInt(input.amtSold) ?? null;
    if (input.playerCategory !== undefined) d.playerCategory = toStr(input.playerCategory);
    if (input.auctionSerialNumber !== undefined) d.auctionSerialNumber = toInt(input.auctionSerialNumber) ?? null;
    if (input.customFields !== undefined) d.customFields = input.customFields ?? null;
    return d;
};

const basePriceFor = (tournament, category) => {
    const map = tournament?.categoryBasePrices;
    if (map && category) return map[category] || 0;
    return 0;
};

// serialize + attach teamName (from included team) + basePrice
const formatPlayer = (p, tournament) => {
    const s = serializePlayer(p);
    if (p.team && p.team.name) s.teamName = p.team.name;
    s.basePrice = basePriceFor(tournament, p.playerCategory);
    return s;
};

const registerPlayer = async (playerInput) => {
    const name = (playerInput.name || '').trim();
    const existing = await prisma.player.findFirst({
        where: { touranmentId: playerInput.touranmentId, name },
    });
    if (existing) {
        throw new Error(`A player with the exact name "${name}" is already registered in this tournament!`);
    }

    let finalSerialNumber = toInt(playerInput.auctionSerialNumber);
    if (!finalSerialNumber) {
        const maxSerialPlayer = await prisma.player.findFirst({
            where: { touranmentId: playerInput.touranmentId },
            orderBy: { auctionSerialNumber: 'desc' },
            select: { auctionSerialNumber: true },
        });
        finalSerialNumber = (maxSerialPlayer?.auctionSerialNumber || 0) + 1;
    }

    const data = buildPlayerData({ ...playerInput, name });
    data.auctionSerialNumber = finalSerialNumber;
    const saved = await prisma.player.create({ data });
    return serializePlayer(saved);
};

const allPlayerDetails = async (touranmentId) => {
    const playerDetails = await prisma.player.findMany({
        where: { touranmentId },
        orderBy: { auctionSerialNumber: 'asc' },
        include: { team: { select: { id: true, name: true } } },
    });
    const tournamentData = await prisma.tournament.findUnique({ where: { id: touranmentId } });
    return playerDetails.map((p) => formatPlayer(p, tournamentData));
};

const getPlayerDetail = async (playerId) => {
    const playerDetail = await prisma.player.findUnique({
        where: { id: playerId },
        include: { team: { select: { id: true, name: true } } },
    });
    if (!playerDetail) return null;

    let tournamentData = null;
    if (playerDetail.touranmentId && playerDetail.playerCategory) {
        try {
            tournamentData = await prisma.tournament.findUnique({ where: { id: playerDetail.touranmentId } });
        } catch (err) { /* non-critical */ }
    }
    return formatPlayer(playerDetail, tournamentData);
};

const updatePlayer = async (playerInput) => {
    const existingPlayer = await prisma.player.findUnique({ where: { id: playerInput.playerId } });
    if (!existingPlayer) {
        throw new Error("Player not found");
    }

    const updateData = buildPlayerData(playerInput);
    const updatedPlayer = await prisma.player.update({
        where: { id: playerInput.playerId },
        data: updateData,
        include: { team: { select: { id: true, name: true } } },
    });

    // Check if player was just sold (wasn't sold before, but is sold now)
    const wasJustSold = !existingPlayer.sold && (playerInput.sold === true || playerInput.sold === 1);

    if (wasJustSold && updatedPlayer) {
        try {
            const teamName = updatedPlayer.team?.name ||
                (playerInput.teamId
                    ? (await prisma.team.findUnique({ where: { id: playerInput.teamId } }))?.name
                    : 'Unknown Team');

            const tournament = await prisma.tournament.findUnique({ where: { id: updatedPlayer.touranmentId } });
            const tournamentName = tournament?.name || 'Tournament';
            const whatsappEnabled = tournament?.features?.whatsappNotifications !== false;

            if (!whatsappEnabled) return;
            await whatsappService.sendPlayerSoldNotification({
                name: updatedPlayer.name,
                mobile: updatedPlayer.mobile,
                teamName: teamName,
                amtSold: updatedPlayer.amtSold || playerInput.amtSold,
                tournamentName: tournamentName,
                tournamentId: tournament?.id,
            });

            if (playerInput.teamId) {
                await whatsappService.sendTeamPurchaseSummary({
                    teamId: playerInput.teamId,
                    playerName: updatedPlayer.name,
                    amountPaid: updatedPlayer.amtSold || playerInput.amtSold,
                    tournamentId: updatedPlayer.touranmentId,
                });
            }
        } catch (whatsappError) {
            console.error('WhatsApp notification failed:', whatsappError.message);
        }
    }

    // Check if player went unsold (auctionStatus changed to true but sold is false)
    const wentUnsold = !existingPlayer.auctionStatus &&
        (playerInput.auctionStatus === true || playerInput.auctionStatus === 1) &&
        !updatedPlayer.sold;

    if (wentUnsold && updatedPlayer) {
        try {
            const tournament = await prisma.tournament.findUnique({ where: { id: updatedPlayer.touranmentId } });
            const tournamentName = tournament?.name || 'Tournament';
            if (tournament?.features?.whatsappNotifications === false) return;
            await whatsappService.sendPlayerUnsoldNotification({
                name: updatedPlayer.name,
                mobile: updatedPlayer.mobile,
                tournamentName: tournamentName,
            });
        } catch (whatsappError) {
            console.error('WhatsApp unsold notification failed:', whatsappError.message);
        }
    }

    return serializePlayer(updatedPlayer);
};

const deletePlayer = async (playerId) => {
    try {
        const deleted = await prisma.player.delete({ where: { id: playerId } });
        return serializePlayer(deleted);
    } catch (e) {
        if (e.code === 'P2025') return null;
        throw e;
    }
};

const getPlayerCategories = async (touranmentId) => {
    const rows = await prisma.player.findMany({
        where: { touranmentId },
        distinct: ['playerCategory'],
        select: { playerCategory: true },
    });
    return rows.map((r) => r.playerCategory).filter((c) => c !== null && c !== undefined);
};

const bulkCreatePlayers = async (playersData, touranmentId) => {
    const playerNames = playersData.map((p) => p.name);
    const duplicateNames = playerNames.filter((name, index) => playerNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
        throw new Error(`Duplicate player names found in CSV: ${[...new Set(duplicateNames)].join(', ')}`);
    }

    const existingPlayers = await prisma.player.findMany({
        where: { touranmentId, name: { in: playerNames } },
    });
    const existingPlayerMap = {};
    existingPlayers.forEach((p) => { existingPlayerMap[p.name.toLowerCase().trim()] = p; });

    const teams = await prisma.team.findMany({ where: { touranmentId } });
    const teamNameMap = {};
    teams.forEach((t) => { teamNameMap[t.name.toLowerCase().trim()] = t.id; });

    const maxSerialPlayer = await prisma.player.findFirst({
        where: { touranmentId },
        orderBy: { auctionSerialNumber: 'desc' },
        select: { auctionSerialNumber: true },
    });
    let currentSerial = (maxSerialPlayer?.auctionSerialNumber || 0);

    const newPlayers = [];
    let updatedCount = 0;
    const unmatchedTeams = [];

    for (const p of playersData) {
        const existing = existingPlayerMap[p.name.toLowerCase().trim()];

        if (existing) {
            const updateFields = {};
            if (p.age !== undefined && p.age !== '' && p.age !== 0) updateFields.age = Number(p.age);
            if (p.photo && p.photo.trim()) updateFields.photo = p.photo.trim();
            if (p.playerCategory && p.playerCategory.trim()) updateFields.playerCategory = p.playerCategory.trim();
            if (p.mobile !== undefined && p.mobile !== '' && p.mobile !== 0) updateFields.mobile = String(p.mobile);
            if (p.skill && p.skill.trim()) updateFields.skill = p.skill.trim();
            if (p.auctionSerialNumber !== undefined && p.auctionSerialNumber !== null && p.auctionSerialNumber !== '') {
                updateFields.auctionSerialNumber = Number(p.auctionSerialNumber);
            }
            if (p.sold !== undefined && p.sold !== '') {
                const soldValue = toBool(p.sold);
                updateFields.sold = soldValue;
                if (soldValue) updateFields.auctionStatus = true;
            }
            if (p.teamName && p.teamName.trim() && p.teamName.toLowerCase() !== 'unsold') {
                const teamId = teamNameMap[p.teamName.toLowerCase().trim()];
                if (teamId) updateFields.teamId = teamId;
                else if (!unmatchedTeams.includes(p.teamName)) unmatchedTeams.push(p.teamName);
            }
            if (p.amtSold !== undefined && p.amtSold !== '' && p.amtSold !== '0' && Number(p.amtSold) > 0) {
                updateFields.amtSold = Number(p.amtSold);
            }
            if (Object.keys(updateFields).length > 0) {
                await prisma.player.update({ where: { id: existing.id }, data: updateFields });
                updatedCount++;
            }
        } else {
            let serialNumber;
            if (p.auctionSerialNumber !== undefined && p.auctionSerialNumber !== null && p.auctionSerialNumber !== '') {
                const parsed = Number(p.auctionSerialNumber);
                serialNumber = isNaN(parsed) ? undefined : parsed;
            }
            if (!serialNumber) { currentSerial++; serialNumber = currentSerial; }

            let teamId = p.teamId || undefined;
            if (!teamId && p.teamName && p.teamName.trim() && p.teamName.toLowerCase() !== 'unsold') {
                const resolvedTeamId = teamNameMap[p.teamName.toLowerCase().trim()];
                if (resolvedTeamId) teamId = resolvedTeamId;
                else if (!unmatchedTeams.includes(p.teamName)) unmatchedTeams.push(p.teamName);
            }

            const sold = (p.sold !== undefined && p.sold !== null && p.sold !== '') ? toBool(p.sold) : false;

            let amtSold;
            if (p.amtSold !== undefined && p.amtSold !== null && p.amtSold !== '') {
                const cleanAmt = typeof p.amtSold === 'string' ? p.amtSold.replace(/"/g, '').trim() : p.amtSold;
                const parsed = Number(cleanAmt);
                if (!isNaN(parsed) && parsed > 0) amtSold = parsed;
            }

            newPlayers.push({
                name: p.name,
                age: p.age ? Number(p.age) : null,
                photo: p.photo || null,
                playerCategory: p.playerCategory || null,
                mobile: p.mobile ? String(p.mobile) : null,
                skill: p.skill ? p.skill.trim() : null,
                auctionSerialNumber: serialNumber,
                touranmentId: touranmentId,
                teamId: teamId || null,
                sold: sold,
                auctionStatus: sold ? true : false,
                amtSold: amtSold ?? null,
            });
        }
    }

    let createdCount = 0;
    if (newPlayers.length > 0) {
        const res = await prisma.player.createMany({ data: newPlayers });
        createdCount = res.count;
    }

    return {
        created: createdCount,
        updated: updatedCount,
        total: createdCount + updatedCount,
        unmatchedTeams: unmatchedTeams,
        message: `Created ${createdCount} new player(s), updated ${updatedCount} existing player(s)${unmatchedTeams.length > 0 ? `. Teams not found: ${unmatchedTeams.join(', ')}` : ''}`,
    };
};

const resetUnsoldPlayers = async (touranmentId) => {
    const result = await prisma.player.updateMany({
        where: { touranmentId, auctionStatus: true, sold: false },
        data: { auctionStatus: false },
    });
    return {
        count: result.count,
        message: `${result.count} unsold player(s) reset successfully`,
    };
};

/**
 * Delete all players for a tournament
 */
const deleteAllPlayersByTournament = async (tournamentId) => {
    if (!tournamentId) {
        throw new Error("Tournament ID is required");
    }
    const result = await prisma.player.deleteMany({ where: { touranmentId: tournamentId } });
    return {
        deletedCount: result.count,
        message: `Successfully deleted ${result.count} players`,
    };
};

/**
 * Bulk update existing players for a tournament from CSV data
 */
const bulkUpdatePlayers = async (playersData, touranmentId) => {
    const notFound = [];
    let updatedCount = 0;

    const teams = await prisma.team.findMany({ where: { touranmentId } });
    const teamNameMap = {};
    teams.forEach((t) => { teamNameMap[t.name.toLowerCase().trim()] = t.id; });

    for (const playerData of playersData) {
        const existingPlayer = await prisma.player.findFirst({
            where: { touranmentId, name: playerData.name },
        });
        if (!existingPlayer) {
            notFound.push(playerData.name);
            continue;
        }

        const updateFields = {};
        if (playerData.sold !== undefined && playerData.sold !== '') {
            const soldValue = toBool(playerData.sold);
            updateFields.sold = soldValue;
            if (soldValue) updateFields.auctionStatus = true;
        }
        if (playerData.teamName && playerData.teamName.trim() && playerData.teamName.toLowerCase() !== 'unsold') {
            const teamId = teamNameMap[playerData.teamName.toLowerCase().trim()];
            if (teamId) updateFields.teamId = teamId;
        }
        if (playerData.amtSold !== undefined && playerData.amtSold !== '' && playerData.amtSold !== '0') {
            updateFields.amtSold = Number(playerData.amtSold);
        }
        if (playerData.playerCategory && playerData.playerCategory.trim()) {
            updateFields.playerCategory = playerData.playerCategory.trim();
        }
        if (playerData.skill && playerData.skill.trim()) {
            updateFields.skill = playerData.skill.trim();
        }
        if (playerData.auctionSerialNumber !== undefined && playerData.auctionSerialNumber !== '') {
            updateFields.auctionSerialNumber = Number(playerData.auctionSerialNumber);
        }

        if (Object.keys(updateFields).length > 0) {
            await prisma.player.update({ where: { id: existingPlayer.id }, data: updateFields });
            updatedCount++;
        }
    }

    return {
        updated: updatedCount,
        notFound: notFound,
        message: `Successfully updated ${updatedCount} player(s)${notFound.length > 0 ? `. Not found: ${notFound.join(', ')}` : ''}`,
    };
};

/**
 * Get stats for the auction overlay
 */
const getOverlayStats = async (touranmentId) => {
    const topPlayers = await prisma.player.findMany({
        where: { touranmentId, sold: true },
        orderBy: { amtSold: 'desc' },
        take: 5,
        include: { team: { select: { id: true, name: true } } },
    });
    const recentPlayers = await prisma.player.findMany({
        where: { touranmentId, sold: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { team: { select: { id: true, name: true } } },
    });

    const formatPlayers = (playerList) => playerList.map((p) => {
        const s = serializePlayer(p);
        if (p.team && p.team.name) s.teamName = p.team.name;
        return s;
    });

    return {
        topPlayers: formatPlayers(topPlayers),
        recentPlayers: formatPlayers(recentPlayers),
    };
};

module.exports = {
    registerPlayer,
    allPlayerDetails,
    getPlayerDetail,
    updatePlayer,
    deletePlayer,
    getPlayerCategories,
    bulkCreatePlayers,
    resetUnsoldPlayers,
    deleteAllPlayersByTournament,
    bulkUpdatePlayers,
    getOverlayStats,
};
