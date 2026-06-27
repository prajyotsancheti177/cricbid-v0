const axios = require('axios');
const config = require('../config');
const prisma = require('../db/prisma');
const whatsappLogService = require('./whatsappLogService');

/**
 * Safe wrapper for logging - never throws
 */
const safeLog = async (logData) => {
    try {
        await whatsappLogService.logMessage(logData);
    } catch (error) {
        console.error('[WhatsApp] Failed to write log:', error.message);
    }
};


/**
 * Send WhatsApp notification when a player is sold
 * @param {Object} playerData - Player information
 * @param {string} playerData.name - Player name
 * @param {string} playerData.mobile - Player mobile number
 * @param {string} playerData.teamName - Team name that bought the player
 * @param {number} playerData.amtSold - Amount for which player was sold
 * @param {string} playerData.tournamentName - Tournament name (optional, will be fetched if not provided)
 * @param {string} playerData.tournamentId - Tournament ID (required if tournamentName not provided)
 */
const sendPlayerSoldNotification = async (playerData) => {
    let logData = {
        messageType: 'player_sold',
        templateName: 'sold_message',
        recipientMobile: playerData.mobile,
        playerId: playerData.playerId,
        playerName: playerData.name,
        tournamentId: playerData.tournamentId,
        tournamentName: playerData.tournamentName,
        teamName: playerData.teamName,
        amtSold: playerData.amtSold,
        status: 'failed',
        timestamp: new Date()
    };

    try {
        console.log(playerData);
    
        let { name, mobile, teamName, amtSold, tournamentName, tournamentId } = playerData;
        
        // Fetch tournament name dynamically if not provided
        if (!tournamentName && tournamentId) {
            const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
            tournamentName = tournament?.name || 'Tournament';
            logData.tournamentName = tournamentName;
        }

        if (!mobile) {
            console.log('[WhatsApp] Player mobile number missing, skipping sold notification');
            logData.errorMessage = 'Mobile number missing';
            try { await whatsappLogService.logMessage(logData); } catch (e) { /* ignore log errors */ }
            return null;
        }

        // Format mobile number - ensure it starts with country code
        let formattedMobile = mobile.toString();
        if (!formattedMobile.startsWith('+')) {
            // Assuming Indian numbers, add +91
            formattedMobile = `+91${formattedMobile}`;
        }
        logData.recipientMobile = formattedMobile;

        const url = 'https://graph.facebook.com/v22.0/815105745024217/messages';
        
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedMobile,
            type: "template",
            template: {
                name: "sold_message",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: name || "Player"
                            },
                            {
                                type: "text",
                                text: teamName || "Unknown Team"
                            },
                            {
                                type: "text",
                                text: amtSold ? `${amtSold}` : "N/A"
                            },
                            {
                                type: "text",
                                text: tournamentName || "Tournament"
                            }
                        ]
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: "0",
                        parameters: [
                            {
                                type: "text",
                                text: "/" + (tournamentId || "a")
                            }
                        ]
                    }
                ]
            }
        };

        const headers = {
            'Authorization': `Bearer ${config.metaApiKey}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, payload, { headers });
        
        console.log('WhatsApp notification sent successfully:', response.data);
        
        // Log success
        logData.status = 'success';
        logData.messageId = response.data?.messages?.[0]?.id;
        await whatsappLogService.logMessage(logData);
        
        return response.data;

    } catch (error) {
        console.error('[WhatsApp] Error sending sold notification:', error.response?.data || error.message);
        
        // Log failure - wrapped in try-catch so logging errors don't crash server
        try {
            logData.errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
            await whatsappLogService.logMessage(logData);
        } catch (logError) {
            console.error('[WhatsApp] Failed to log error:', logError.message);
        }
        
        // Never throw - gracefully return null
        return null;
    }
};

/**
 * Send WhatsApp notification when a player goes unsold
 * @param {Object} playerData - Player information
 * @param {string} playerData.name - Player name
 * @param {string} playerData.mobile - Player mobile number
 * @param {string} playerData.tournamentName - Tournament name (optional, will be fetched if not provided)
 * @param {string} playerData.tournamentId - Tournament ID (required if tournamentName not provided)
 */
const sendPlayerUnsoldNotification = async (playerData) => {
    let logData = {
        messageType: 'player_unsold',
        templateName: 'unsold_message',
        recipientMobile: playerData.mobile,
        playerId: playerData.playerId,
        playerName: playerData.name,
        tournamentId: playerData.tournamentId,
        tournamentName: playerData.tournamentName,
        status: 'failed',
        timestamp: new Date()
    };

    try {
        let { name, mobile, tournamentName, tournamentId } = playerData;
        
        // Fetch tournament name dynamically if not provided
        if (!tournamentName && tournamentId) {
            const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
            tournamentName = tournament?.name || 'Tournament';
            logData.tournamentName = tournamentName;
        }

        if (!mobile) {
            console.log('[WhatsApp] Player mobile number missing, skipping unsold notification');
            logData.errorMessage = 'Mobile number missing';
            try { await whatsappLogService.logMessage(logData); } catch (e) { /* ignore log errors */ }
            return null;
        }

        // Format mobile number - ensure it starts with country code
        let formattedMobile = mobile.toString();
        if (!formattedMobile.startsWith('+')) {
            // Assuming Indian numbers, add +91
            formattedMobile = `+91${formattedMobile}`;
        }
        logData.recipientMobile = formattedMobile;

        const url = 'https://graph.facebook.com/v22.0/815105745024217/messages';
        
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedMobile,
            type: "template",
            template: {
                name: "unsold_message",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: name || "Player"
                            },
                            {
                                type: "text",
                                text: tournamentName || "Tournament"
                            }
                        ]
                    }
                ]
            }
        };

        const headers = {
            'Authorization': `Bearer ${config.metaApiKey}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, payload, { headers });
        
        console.log('WhatsApp unsold notification sent successfully:', response.data);
        
        // Log success
        logData.status = 'success';
        logData.messageId = response.data?.messages?.[0]?.id;
        await whatsappLogService.logMessage(logData);
        
        return response.data;

    } catch (error) {
        console.error('[WhatsApp] Error sending unsold notification:', error.response?.data || error.message);
        
        // Log failure - wrapped in try-catch so logging errors don't crash server
        try {
            logData.errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
            await whatsappLogService.logMessage(logData);
        } catch (logError) {
            console.error('[WhatsApp] Failed to log error:', logError.message);
        }
        
        // Never throw - gracefully return null
        return null;
    }
};

/**
 * Send WhatsApp announcement to all players and team owners for a tournament
 * @param {Object} params - Parameters
 * @param {string} params.tournamentId - Tournament ID
 * @param {string} params.tournamentName - Tournament name (optional, will be fetched if not provided)
 * @returns {Object} Result with success/failure counts
 */
const sendAuctionAnnouncementBroadcast = async ({ tournamentId, tournamentName }) => {
    // Fetch tournament name if not provided
    if (!tournamentName && tournamentId) {
        const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        tournamentName = tournament?.name || 'Tournament';
    }

    // Collect all recipients
    const recipients = [];

    // Get all players with mobile numbers
    const players = await prisma.player.findMany({
        where: { touranmentId: tournamentId, mobile: { not: null } },
        select: { name: true, mobile: true },
    });

    players.forEach(player => {
        if (player.mobile) {
            recipients.push({
                name: player.name || 'Player',
                mobile: player.mobile.toString(),
                type: 'player'
            });
        }
    });

    // Get all team owners with mobile numbers
    const teams = await prisma.team.findMany({
        where: { touranmentId: tournamentId, ownerMobile: { not: null } },
        select: { ownerName: true, ownerMobile: true },
    });

    teams.forEach(team => {
        if (team.ownerMobile) {
            recipients.push({
                name: team.ownerName || 'Team Owner',
                mobile: team.ownerMobile.toString(),
                type: 'teamOwner'
            });
        }
    });
    
    // Deduplicate by mobile number
    const uniqueMobiles = new Map();
    recipients.forEach(r => {
        const formattedMobile = r.mobile.startsWith('+') ? r.mobile : `+91${r.mobile}`;
        if (!uniqueMobiles.has(formattedMobile)) {
            uniqueMobiles.set(formattedMobile, { ...r, mobile: formattedMobile });
        }
    });
    
    const uniqueRecipients = Array.from(uniqueMobiles.values());
    
    console.log(`[WhatsApp] Broadcasting auction announcement to ${uniqueRecipients.length} recipients for tournament ${tournamentId}`);
    
    let successCount = 0;
    let failureCount = 0;
    const results = [];
    
    // Send to each recipient
    for (const recipient of uniqueRecipients) {
        try {
            const logData = {
                messageType: 'auction_announcement',
                templateName: 'auction_announcement',
                recipientMobile: recipient.mobile,
                tournamentId,
                tournamentName,
                status: 'failed',
                timestamp: new Date()
            };
            
            const url = 'https://graph.facebook.com/v22.0/815105745024217/messages';
            
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: recipient.mobile,
                type: "template",
                template: {
                    name: "auction_announcement",
                    language: {
                        code: "en"
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: recipient.name
                                },
                                {
                                    type: "text",
                                    text: tournamentName
                                }
                            ]
                        },
                        {
                            type: "button",
                            sub_type: "url",
                            index: "0",
                            parameters: [
                                {
                                    type: "text",
                                    text: "/" + tournamentId
                                }
                            ]
                        }
                    ]
                }
            };
            
            const headers = {
                'Authorization': `Bearer ${config.metaApiKey}`,
                'Content-Type': 'application/json'
            };
            
            const response = await axios.post(url, payload, { headers });
            
            logData.status = 'success';
            logData.messageId = response.data?.messages?.[0]?.id;
            await safeLog(logData);
            
            successCount++;
            results.push({ mobile: recipient.mobile, status: 'success' });
            
        } catch (error) {
            console.error(`[WhatsApp] Failed to send to ${recipient.mobile}:`, error.response?.data || error.message);
            failureCount++;
            results.push({ mobile: recipient.mobile, status: 'failed', error: error.message });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[WhatsApp] Broadcast complete: ${successCount} success, ${failureCount} failed`);
    
    return {
        totalRecipients: uniqueRecipients.length,
        successCount,
        failureCount,
        results
    };
};

/**
 * Get count of recipients for auction announcement (preview without sending)
 * @param {Object} params - Parameters
 * @param {string} params.tournamentId - Tournament ID
 * @returns {Object} Recipient counts
 */
const getAnnouncementRecipientCount = async ({ tournamentId }) => {
    // Get player count with mobile numbers
    const playerCount = await prisma.player.count({
        where: { touranmentId: tournamentId, mobile: { not: null } },
    });

    // Get team owner count with mobile numbers
    const teamOwnerCount = await prisma.team.count({
        where: { touranmentId: tournamentId, ownerMobile: { not: null } },
    });
    
    // Note: actual unique count may be less due to deduplication
    return {
        playerCount,
        teamOwnerCount,
        estimatedTotal: playerCount + teamOwnerCount,
        note: "Actual count may be less if some players are also team owners"
    };
};

/**
 * Send team purchase summary to team owner when they buy a player
 * @param {Object} params - Parameters
 * @param {string} params.teamId - Team ID
 * @param {string} params.playerName - Name of player just bought
 * @param {number} params.amountPaid - Amount paid for the player
 * @param {string} params.tournamentId - Tournament ID
 */
const sendTeamPurchaseSummary = async ({ teamId, playerName, amountPaid, tournamentId }) => {
    let logData = {
        messageType: 'team_purchase_summary',
        templateName: 'team_purchase_summary',
        tournamentId,
        status: 'failed',
        timestamp: new Date()
    };

    try {
        // Get team info
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team || !team.ownerMobile) {
            console.log('[WhatsApp] Team owner mobile not found, skipping summary');
            return null;
        }

        // Get tournament for budget
        const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
        const totalBudget = tournament?.totalBudget || 0;

        // Get all players bought by this team
        const teamPlayers = await prisma.player.findMany({
            where: { teamId: teamId, sold: true },
            select: { name: true, amtSold: true },
        });
        
        // Calculate totals
        const playerCount = teamPlayers.length;
        const budgetUsed = teamPlayers.reduce((sum, p) => sum + (p.amtSold || 0), 0);
        const budgetRemaining = totalBudget - budgetUsed;
        
        // Build squad list with commas (no newlines allowed in WhatsApp parameters)
        const squadList = teamPlayers
            .slice(0, 5)
            .map(p => p.name)
            .join(', ');
        const squadDisplay = teamPlayers.length > 5 
            ? squadList + ` (+${teamPlayers.length - 5} more)`
            : (squadList || "No players yet");
        
        // Format currency
        const formatCurrency = (amt) => {
            if (amt >= 10000000) return `${(amt / 10000000).toFixed(2)} Cr`;
            if (amt >= 100000) return `${(amt / 100000).toFixed(2)} L`;
            return amt.toLocaleString('en-IN');
        };
        
        // Format mobile
        let formattedMobile = team.ownerMobile.toString();
        if (!formattedMobile.startsWith('+')) {
            formattedMobile = `+91${formattedMobile}`;
        }
        
        logData.recipientMobile = formattedMobile;
        logData.teamName = team.name;
        
        const url = 'https://graph.facebook.com/v22.0/815105745024217/messages';
        
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedMobile,
            type: "template",
            template: {
                name: "team_purchase_summary",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: team.ownerName || "Team Owner" },
                            { type: "text", text: playerName },
                            { type: "text", text: formatCurrency(amountPaid) },
                            { type: "text", text: playerCount.toString() },
                            { type: "text", text: formatCurrency(budgetUsed) },
                            { type: "text", text: formatCurrency(budgetRemaining) },
                            { type: "text", text: squadDisplay }
                        ]
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: "0",
                        parameters: [
                            { type: "text", text: teamId.toString() }
                        ]
                    }
                ]
            }
        };
        
        const headers = {
            'Authorization': `Bearer ${config.metaApiKey}`,
            'Content-Type': 'application/json'
        };
        
        const response = await axios.post(url, payload, { headers });
        
        console.log('[WhatsApp] Team purchase summary sent:', response.data);
        
        logData.status = 'success';
        logData.messageId = response.data?.messages?.[0]?.id;
        await safeLog(logData);
        
        return response.data;
        
    } catch (error) {
        console.error('[WhatsApp] Team purchase summary failed:', error.response?.data || error.message);
        logData.errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
        await safeLog(logData);
        return null;
    }
};

module.exports = {
    sendPlayerSoldNotification,
    sendPlayerUnsoldNotification,
    sendAuctionAnnouncementBroadcast,
    getAnnouncementRecipientCount,
    sendTeamPurchaseSummary
};

