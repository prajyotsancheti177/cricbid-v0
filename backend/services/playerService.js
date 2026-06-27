const { Schema, default: mongoose } = require("mongoose");
const players = require("../models/players");
// const { updateMany } = require("../models/tournamentHost");
const team = require("../models/team");
const whatsappService = require("./whatsappService");

const registerPlayer = async (playerInput) => {
    // Check for exact name match within the same tournament
    const player = await players.findOne({ 
        touranmentId: playerInput.touranmentId, 
        name: playerInput.name.trim() 
    });
    
    if (player) {
        throw new Error(`A player with the exact name "${playerInput.name.trim()}" is already registered in this tournament!`);
    }
    // Determine serial number
    let finalSerialNumber = playerInput.auctionSerialNumber;
    if (!finalSerialNumber) {
        // Get next serial number
        const maxSerialPlayer = await players.findOne({ touranmentId: playerInput.touranmentId })
            .sort({ auctionSerialNumber: -1 })
            .select('auctionSerialNumber');

        finalSerialNumber = (maxSerialPlayer?.auctionSerialNumber || 0) + 1;
    }

    const newPlayer = new players({
        ...playerInput,
        auctionSerialNumber: finalSerialNumber
    });
    const savedPlayer = await newPlayer.save();
    return savedPlayer;
}

const allPlayerDetails = async (touranmentId) => {
    // Populate teamId to get team name for sold players
    const playerDetails = await players.find({ touranmentId: touranmentId })
        .sort({ auctionSerialNumber: 1 })
        .populate('teamId', 'name');

    // Fetch tournament to get base prices for each category
    const Tournament = require('../models/tournament');
    const tournamentData = await Tournament.findById(touranmentId);

    // Add base price and teamName to each player based on their category
    const playersWithBasePrices = playerDetails.map(player => {
        const playerObj = player.toObject();
        if (tournamentData && tournamentData.categoryBasePrices && playerObj.playerCategory) {
            const basePrice = tournamentData.categoryBasePrices.get(playerObj.playerCategory);
            playerObj.basePrice = basePrice || 0;
        } else {
            playerObj.basePrice = 0;
        }
        // Add teamName from populated teamId
        if (playerObj.teamId && playerObj.teamId.name) {
            playerObj.teamName = playerObj.teamId.name;
        }
        return playerObj;
    });

    return playersWithBasePrices;
}

const getPlayerDetail = async (playerId) => {
    const playerDetail = await players.findById(playerId)
        .populate('teamId', 'name');
    if (!playerDetail) return null;

    const playerObj = playerDetail.toObject();

    // Add teamName from populated teamId
    if (playerObj.teamId && playerObj.teamId.name) {
        playerObj.teamName = playerObj.teamId.name;
    }

    // Add basePrice from tournament
    if (playerObj.touranmentId && playerObj.playerCategory) {
        try {
            const Tournament = require('../models/tournament');
            const tournamentData = await Tournament.findById(playerObj.touranmentId);
            if (tournamentData && tournamentData.categoryBasePrices) {
                const basePrice = tournamentData.categoryBasePrices.get(playerObj.playerCategory);
                playerObj.basePrice = basePrice || 0;
            }
        } catch (err) {
            // Non-critical, continue without base price
        }
    }

    return playerObj;
}

const updatePlayer = async (playerInput) => {
    // Get the player before update to check if it's being marked as sold
    const existingPlayer = await players.findById(playerInput.playerId);

    if (!existingPlayer) {
        throw new Error("Player not found");
    }

    // Update the player
    const updatedPlayer = await players.findByIdAndUpdate(
        playerInput.playerId,
        playerInput,
        { new: true }
    ).populate('teamId', 'name');

    console.log('Updated Player:', updatedPlayer);
    console.log('Existing Player:', existingPlayer);
    console.log('Player Input:', playerInput);
    // Check if player was just sold (wasn't sold before, but is sold now)
    const wasJustSold = !existingPlayer.sold && (playerInput.sold === true || playerInput.sold === 1);
    console.log('Was just sold:', wasJustSold);



    // If player was just sold, send WhatsApp notification
    if (wasJustSold && updatedPlayer) {
        console.log('Preparing to send WhatsApp notification for sold player.---------------');
        try {
            // Get team name
            const teamName = updatedPlayer.teamId?.name ||
                (playerInput.teamId ?
                    (await team.findById(playerInput.teamId))?.name :
                    'Unknown Team');

            // Get tournament name
            const Tournament = require('../models/tournament');
            const tournament = await Tournament.findById(updatedPlayer.touranmentId);
            const tournamentName = tournament?.name || 'Tournament';

            await whatsappService.sendPlayerSoldNotification({
                name: updatedPlayer.name,
                mobile: updatedPlayer.mobile,
                teamName: teamName,
                amtSold: updatedPlayer.amtSold || playerInput.amtSold,
                tournamentName: tournamentName,
                tournamentId: tournament._id
            });

            // Also send team purchase summary to team owner
            if (playerInput.teamId) {
                await whatsappService.sendTeamPurchaseSummary({
                    teamId: playerInput.teamId,
                    playerName: updatedPlayer.name,
                    amountPaid: updatedPlayer.amtSold || playerInput.amtSold,
                    tournamentId: updatedPlayer.touranmentId
                });
            }
        } catch (whatsappError) {
            // Log error but don't fail the update
            console.error('WhatsApp notification failed:', whatsappError.message);
        }
    }

    // Check if player went unsold (auctionStatus changed to true but sold is false)
    const wentUnsold = !existingPlayer.auctionStatus &&
        (playerInput.auctionStatus === true || playerInput.auctionStatus === 1) &&
        !updatedPlayer.sold;

    // If player went unsold, send WhatsApp notification
    if (wentUnsold && updatedPlayer) {
        console.log('Preparing to send WhatsApp notification for unsold player.---------------');
        try {
            // Get tournament name
            const Tournament = require('../models/tournament');
            const tournament = await Tournament.findById(updatedPlayer.touranmentId);
            const tournamentName = tournament?.name || 'Tournament';

            await whatsappService.sendPlayerUnsoldNotification({
                name: updatedPlayer.name,
                mobile: updatedPlayer.mobile,
                tournamentName: tournamentName
            });
        } catch (whatsappError) {
            // Log error but don't fail the update
            console.error('WhatsApp unsold notification failed:', whatsappError.message);
        }
    }

    return updatedPlayer;
}

const deletePlayer = async (playerId) => {
    const deletedPlayer = await players.findByIdAndDelete(playerId);
    return deletedPlayer;
}

const getPlayerCategories = async (touranmentId) => {
    const categories = await players.distinct("playerCategory", { touranmentId: touranmentId });
    return categories;
}

const bulkCreatePlayers = async (playersData, touranmentId) => {
    // Check for duplicates in the input data
    const playerNames = playersData.map(p => p.name);
    const duplicateNames = playerNames.filter((name, index) => playerNames.indexOf(name) !== index);

    if (duplicateNames.length > 0) {
        const err = new Error(`Duplicate player names found in CSV: ${[...new Set(duplicateNames)].join(', ')}`);
        throw err;
    }

    // Check for existing players in database
    const existingPlayers = await players.find({
        touranmentId: touranmentId,
        name: { $in: playerNames }
    });

    const existingPlayerMap = {};
    existingPlayers.forEach(p => {
        existingPlayerMap[p.name.toLowerCase().trim()] = p;
    });

    // Pre-fetch all teams for this tournament for quick lookup by name
    const teams = await team.find({ touranmentId: touranmentId });
    const teamNameMap = {};
    teams.forEach(t => {
        teamNameMap[t.name.toLowerCase().trim()] = t._id;
    });
    console.log(`[BulkCreate] Tournament: ${touranmentId}, Teams found: ${teams.length}, Team names: [${teams.map(t => t.name).join(', ')}]`);

    // Get starting serial number for auto-generation (only used if not provided in CSV)
    const maxSerialPlayer = await players.findOne({ touranmentId: touranmentId })
        .sort({ auctionSerialNumber: -1 })
        .select('auctionSerialNumber');

    let currentSerial = (maxSerialPlayer?.auctionSerialNumber || 0);

    const newPlayers = [];
    let updatedCount = 0;
    const unmatchedTeams = [];

    for (const p of playersData) {
        const existing = existingPlayerMap[p.name.toLowerCase().trim()];

        if (existing) {
            // Update existing player with all provided fields
            const updateFields = {};

            if (p.age !== undefined && p.age !== '' && p.age !== 0) updateFields.age = Number(p.age);
            if (p.photo && p.photo.trim()) updateFields.photo = p.photo.trim();
            if (p.playerCategory && p.playerCategory.trim()) updateFields.playerCategory = p.playerCategory.trim();
            if (p.mobile !== undefined && p.mobile !== '' && p.mobile !== 0) updateFields.mobile = Number(p.mobile);
            if (p.skill && p.skill.trim()) updateFields.skill = p.skill.trim();

            // Update serial number if provided
            if (p.auctionSerialNumber !== undefined && p.auctionSerialNumber !== null && p.auctionSerialNumber !== '') {
                updateFields.auctionSerialNumber = Number(p.auctionSerialNumber);
            }

            // Update sold status
            if (p.sold !== undefined && p.sold !== '') {
                const soldValue = typeof p.sold === 'string'
                    ? p.sold.toLowerCase() === 'yes' || p.sold.toLowerCase() === 'true'
                    : Boolean(p.sold);
                updateFields.sold = soldValue;
                if (soldValue) {
                    updateFields.auctionStatus = true;
                }
            }

            // Update team by name lookup
            if (p.teamName && p.teamName.trim() && p.teamName.toLowerCase() !== 'unsold') {
                const teamId = teamNameMap[p.teamName.toLowerCase().trim()];
                if (teamId) {
                    updateFields.teamId = teamId;
                    console.log(`[BulkCreate] UPDATE: Matched team "${p.teamName}" -> ${teamId} for player "${p.name}"`);
                } else {
                    console.log(`[BulkCreate] UPDATE: Team "${p.teamName}" NOT FOUND for player "${p.name}"`);
                    if (!unmatchedTeams.includes(p.teamName)) unmatchedTeams.push(p.teamName);
                }
            }

            // Update amount sold
            if (p.amtSold !== undefined && p.amtSold !== '' && p.amtSold !== '0' && Number(p.amtSold) > 0) {
                updateFields.amtSold = Number(p.amtSold);
            }

            if (Object.keys(updateFields).length > 0) {
                await players.findByIdAndUpdate(existing._id, { $set: updateFields });
                updatedCount++;
            }
        } else {
            // Prepare new player for creation
            let serialNumber;
            if (p.auctionSerialNumber !== undefined && p.auctionSerialNumber !== null && p.auctionSerialNumber !== '') {
                const parsed = Number(p.auctionSerialNumber);
                serialNumber = isNaN(parsed) ? undefined : parsed;
            }
            if (!serialNumber) {
                currentSerial++;
                serialNumber = currentSerial;
            }

            // Resolve teamId from teamName if provided
            let teamId = p.teamId || undefined;
            if (!teamId && p.teamName && p.teamName.trim() && p.teamName.toLowerCase() !== 'unsold') {
                const resolvedTeamId = teamNameMap[p.teamName.toLowerCase().trim()];
                if (resolvedTeamId) {
                    teamId = resolvedTeamId;
                    console.log(`[BulkCreate] NEW: Matched team "${p.teamName}" -> ${teamId} for player "${p.name}"`);
                } else {
                    console.log(`[BulkCreate] NEW: Team "${p.teamName}" NOT FOUND for player "${p.name}". Available: [${Object.keys(teamNameMap).join(', ')}]`);
                    if (!unmatchedTeams.includes(p.teamName)) unmatchedTeams.push(p.teamName);
                }
            } else if (!p.teamName || !p.teamName.trim() || p.teamName.toLowerCase() === 'unsold') {
                console.log(`[BulkCreate] NEW: No team for player "${p.name}" (teamName: "${p.teamName || ''}")`)
            }

            // Resolve sold status — handle string values like 'Yes', 'No', 'true', 'false'
            let sold = false;
            if (p.sold !== undefined && p.sold !== null && p.sold !== '') {
                if (typeof p.sold === 'string') {
                    const cleanSold = p.sold.replace(/"/g, '').trim().toLowerCase();
                    sold = cleanSold === 'yes' || cleanSold === 'true';
                } else {
                    sold = Boolean(p.sold);
                }
            }

            // Resolve amtSold — handle quoted strings and empty values
            let amtSold = undefined;
            if (p.amtSold !== undefined && p.amtSold !== null && p.amtSold !== '') {
                const cleanAmt = typeof p.amtSold === 'string' ? p.amtSold.replace(/"/g, '').trim() : p.amtSold;
                const parsed = Number(cleanAmt);
                if (!isNaN(parsed) && parsed > 0) {
                    amtSold = parsed;
                }
            }

            newPlayers.push({
                name: p.name,
                age: p.age ? Number(p.age) : undefined,
                photo: p.photo || undefined,
                playerCategory: p.playerCategory || undefined,
                mobile: p.mobile ? Number(p.mobile) : undefined,
                skill: p.skill ? p.skill.trim() : undefined,
                auctionSerialNumber: serialNumber,
                touranmentId: touranmentId,
                teamId: teamId,
                sold: sold,
                auctionStatus: sold ? true : false,
                amtSold: amtSold,
            });
        }
    }

    let createdPlayers = [];
    if (newPlayers.length > 0) {
        createdPlayers = await players.insertMany(newPlayers);
    }

    return {
        created: createdPlayers.length,
        updated: updatedCount,
        total: createdPlayers.length + updatedCount,
        unmatchedTeams: unmatchedTeams,
        message: `Created ${createdPlayers.length} new player(s), updated ${updatedCount} existing player(s)${unmatchedTeams.length > 0 ? `. Teams not found: ${unmatchedTeams.join(', ')}` : ''}`
    };
}

const resetUnsoldPlayers = async (touranmentId) => {
    // Find and update all unsold players (auctionStatus = true, sold = false)
    const result = await players.updateMany(
        {
            touranmentId: touranmentId,
            auctionStatus: true,
            sold: false
        },
        {
            $set: { auctionStatus: false }
        }
    );

    return {
        count: result.modifiedCount,
        message: `${result.modifiedCount} unsold player(s) reset successfully`
    };
}

/**
 * Delete all players for a tournament
 * @param {String} tournamentId - Tournament ID
 * @returns {Object} Deletion result with count
 */
const deleteAllPlayersByTournament = async (tournamentId) => {
    if (!tournamentId) {
        throw new Error("Tournament ID is required");
    }

    const result = await players.deleteMany({
        touranmentId: new mongoose.Types.ObjectId(tournamentId)
    });

    return {
        deletedCount: result.deletedCount,
        message: `Successfully deleted ${result.deletedCount} players`
    };
};

/**
 * Bulk update existing players for a tournament from CSV data
 * Matches players by name + tournamentId, updates auction-related fields
 * @param {Array} playersData - Array of player update objects
 * @param {String} touranmentId - Tournament ID
 * @returns {Object} Update result with counts
 */
const bulkUpdatePlayers = async (playersData, touranmentId) => {
    const notFound = [];
    let updatedCount = 0;

    // Pre-fetch all teams for this tournament for quick lookup by name
    const teams = await team.find({ touranmentId: touranmentId });
    const teamNameMap = {};
    teams.forEach(t => {
        teamNameMap[t.name.toLowerCase().trim()] = t._id;
    });

    for (const playerData of playersData) {
        // Find the player by name + tournament
        const existingPlayer = await players.findOne({
            touranmentId: touranmentId,
            name: playerData.name
        });

        if (!existingPlayer) {
            notFound.push(playerData.name);
            continue;
        }

        const updateFields = {};

        // Update sold status
        if (playerData.sold !== undefined && playerData.sold !== '') {
            const soldValue = typeof playerData.sold === 'string'
                ? playerData.sold.toLowerCase() === 'yes' || playerData.sold.toLowerCase() === 'true'
                : Boolean(playerData.sold);
            updateFields.sold = soldValue;
            // If marked as sold, also set auctionStatus to true
            if (soldValue) {
                updateFields.auctionStatus = true;
            }
        }

        // Update team by name lookup
        if (playerData.teamName && playerData.teamName.trim() && playerData.teamName.toLowerCase() !== 'unsold') {
            const teamId = teamNameMap[playerData.teamName.toLowerCase().trim()];
            if (teamId) {
                updateFields.teamId = teamId;
            }
        }

        // Update amount sold
        if (playerData.amtSold !== undefined && playerData.amtSold !== '' && playerData.amtSold !== '0') {
            updateFields.amtSold = Number(playerData.amtSold);
        }

        // Update category if provided
        if (playerData.playerCategory && playerData.playerCategory.trim()) {
            updateFields.playerCategory = playerData.playerCategory.trim();
        }

        // Update skill if provided
        if (playerData.skill && playerData.skill.trim()) {
            updateFields.skill = playerData.skill.trim();
        }

        // Update serial number if provided
        if (playerData.auctionSerialNumber !== undefined && playerData.auctionSerialNumber !== '') {
            updateFields.auctionSerialNumber = Number(playerData.auctionSerialNumber);
        }

        // Only update if there are fields to update
        if (Object.keys(updateFields).length > 0) {
            await players.findByIdAndUpdate(existingPlayer._id, { $set: updateFields });
            updatedCount++;
        }
    }

    return {
        updated: updatedCount,
        notFound: notFound,
        message: `Successfully updated ${updatedCount} player(s)${notFound.length > 0 ? `. Not found: ${notFound.join(', ')}` : ''}`
    };
};

/**
 * Get stats for the auction overlay
 * @param {String} touranmentId - Tournament ID
 * @returns {Object} Top 5 players and last 5 sold players
 */
const getOverlayStats = async (touranmentId) => {
    // Top 5 highest bidded players
    const topPlayers = await players.find({
        touranmentId: touranmentId,
        sold: true
    })
    .sort({ amtSold: -1 })
    .limit(5)
    .populate('teamId', 'name');

    // Last 5 sold players (recently sold)
    const recentPlayers = await players.find({
        touranmentId: touranmentId,
        sold: true
    })
    .sort({ updatedAt: -1 })
    .limit(5)
    .populate('teamId', 'name');

    const formatPlayers = (playerList) => {
        return playerList.map(p => {
            const playerObj = p.toObject();
            if (playerObj.teamId && playerObj.teamId.name) {
                playerObj.teamName = playerObj.teamId.name;
            }
            return playerObj;
        });
    };

    return {
        topPlayers: formatPlayers(topPlayers),
        recentPlayers: formatPlayers(recentPlayers)
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
    getOverlayStats
}