const axios = require('axios');
const config = require('../config');
const prisma = require('../db/prisma');
const whatsappLogService = require('./whatsappLogService');

// ─── Default config (all enabled) ────────────────────────────────────────────
const DEFAULT_WHATSAPP_CONFIG = {
  playerSold:        { enabled: true },
  playerUnsold:      { enabled: true },
  teamPurchase:      { enabled: true },
  postAuctionPlayer: { enabled: false },
  postAuctionOwner:  { enabled: false },
  auctionReminder:   { enabled: false },
  categoryStarting:  { enabled: false },
  budgetWarning:     { enabled: false, thresholdPercent: 80 },
};

const getWhatsAppConfig = async (tournamentId) => {
  if (!tournamentId) return DEFAULT_WHATSAPP_CONFIG;
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { whatsappConfig: true },
  });
  return { ...DEFAULT_WHATSAPP_CONFIG, ...(t?.whatsappConfig || {}) };
};

const isEnabled = async (tournamentId, templateKey) => {
  const cfg = await getWhatsAppConfig(tournamentId);
  return cfg[templateKey]?.enabled !== false;
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const WA_URL = 'https://graph.facebook.com/v22.0/815105745024217/messages';

const formatMobile = (mobile) => {
  const s = mobile.toString().trim();
  return s.startsWith('+') ? s : `+91${s}`;
};

const formatAmount = (amt) => {
  if (!amt && amt !== 0) return 'N/A';
  if (amt >= 10000000) return `${(amt / 10000000).toFixed(2)} Cr`;
  if (amt >= 100000)   return `${(amt / 100000).toFixed(2)} L`;
  return amt.toLocaleString('en-IN');
};

const safeLog = async (logData) => {
  try { await whatsappLogService.logMessage(logData); } catch {}
};

const sendTemplate = async ({ to, templateName, bodyParams, buttonParam, logData }) => {
  const components = [
    { type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text: String(text) })) },
  ];
  if (buttonParam !== undefined) {
    components.push({
      type: 'button', sub_type: 'url', index: '0',
      parameters: [{ type: 'text', text: String(buttonParam) }],
    });
  }
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: { name: templateName, language: { code: 'en' }, components },
  };
  const headers = {
    Authorization: `Bearer ${config.metaApiKey}`,
    'Content-Type': 'application/json',
  };
  const response = await axios.post(WA_URL, payload, { headers });
  logData.status = 'success';
  logData.messageId = response.data?.messages?.[0]?.id;
  await safeLog(logData);
  return response.data;
};

// ─── 1. Player sold ───────────────────────────────────────────────────────────
const sendPlayerSoldNotification = async (playerData) => {
  const { name, mobile, teamName, amtSold, tournamentId, playerId } = playerData;
  let { tournamentName } = playerData;
  const logData = {
    messageType: 'player_sold', templateName: 'sold_message',
    recipientMobile: mobile, playerId, playerName: name,
    tournamentId, tournamentName, teamName, amtSold, status: 'failed', timestamp: new Date(),
  };
  try {
    if (!mobile) { logData.errorMessage = 'Mobile missing'; await safeLog(logData); return null; }
    if (!await isEnabled(tournamentId, 'playerSold')) {
      console.log('[WhatsApp] playerSold disabled for tournament', tournamentId); return null;
    }
    if (!tournamentName && tournamentId) {
      const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
      tournamentName = t?.name || 'Tournament';
      logData.tournamentName = tournamentName;
    }
    const to = formatMobile(mobile);
    logData.recipientMobile = to;
    return await sendTemplate({
      to, templateName: 'sold_message',
      bodyParams: [name || 'Player', teamName || 'Unknown Team', amtSold ? `${amtSold}` : 'N/A', tournamentName || 'Tournament'],
      buttonParam: '/' + (tournamentId || 'a'),
      logData,
    });
  } catch (err) {
    logData.errorMessage = err.response?.data?.error?.message || err.message;
    await safeLog(logData); return null;
  }
};

// ─── 2. Player unsold ─────────────────────────────────────────────────────────
const sendPlayerUnsoldNotification = async (playerData) => {
  const { name, mobile, tournamentId, playerId } = playerData;
  let { tournamentName } = playerData;
  const logData = {
    messageType: 'player_unsold', templateName: 'unsold_message',
    recipientMobile: mobile, playerId, playerName: name,
    tournamentId, tournamentName, status: 'failed', timestamp: new Date(),
  };
  try {
    if (!mobile) { logData.errorMessage = 'Mobile missing'; await safeLog(logData); return null; }
    if (!await isEnabled(tournamentId, 'playerUnsold')) return null;
    if (!tournamentName && tournamentId) {
      const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
      tournamentName = t?.name || 'Tournament';
      logData.tournamentName = tournamentName;
    }
    const to = formatMobile(mobile);
    logData.recipientMobile = to;
    return await sendTemplate({
      to, templateName: 'unsold_message',
      bodyParams: [name || 'Player', tournamentName || 'Tournament'],
      logData,
    });
  } catch (err) {
    logData.errorMessage = err.response?.data?.error?.message || err.message;
    await safeLog(logData); return null;
  }
};

// ─── 3. Team purchase summary (to owner after each buy) ───────────────────────
const sendTeamPurchaseSummary = async ({ teamId, playerName, amountPaid, tournamentId }) => {
  const logData = {
    messageType: 'team_purchase_summary', templateName: 'team_purchase_summary',
    tournamentId, status: 'failed', timestamp: new Date(),
  };
  try {
    if (!await isEnabled(tournamentId, 'teamPurchase')) return null;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team?.ownerMobile) { logData.errorMessage = 'Owner mobile missing'; await safeLog(logData); return null; }
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    const totalBudget = tournament?.totalBudget || 0;
    const teamPlayers = await prisma.player.findMany({
      where: { teamId, sold: true }, select: { name: true, amtSold: true },
    });
    const budgetUsed = teamPlayers.reduce((s, p) => s + (p.amtSold || 0), 0);
    const squadList = teamPlayers.map(p => p.name).slice(0, 6).join(', ') +
      (teamPlayers.length > 6 ? ` +${teamPlayers.length - 6} more` : '');
    const to = formatMobile(team.ownerMobile);
    logData.recipientMobile = to;
    logData.teamName = team.name;
    return await sendTemplate({
      to, templateName: 'team_purchase_summary',
      bodyParams: [
        team.ownerName || 'Team Owner',
        playerName,
        formatAmount(amountPaid),
        String(teamPlayers.length),
        formatAmount(budgetUsed),
        formatAmount(totalBudget - budgetUsed),
        squadList || 'No players yet',
      ],
      buttonParam: teamId,
      logData,
    });
  } catch (err) {
    logData.errorMessage = err.response?.data?.error?.message || err.message;
    await safeLog(logData); return null;
  }
};

// ─── 4. Post-auction: message to each player with their result ────────────────
const sendPostAuctionPlayerSummaries = async ({ tournamentId }) => {
  if (!await isEnabled(tournamentId, 'postAuctionPlayer')) return { skipped: true };
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const tournamentName = tournament?.name || 'Tournament';
  const players = await prisma.player.findMany({
    where: { touranmentId: tournamentId, mobile: { not: null } },
    include: { team: { select: { name: true } } },
  });
  let success = 0, failed = 0;
  for (const player of players) {
    const logData = {
      messageType: 'post_auction_player', templateName: 'post_auction_player_summary',
      recipientMobile: player.mobile, playerId: player.id, playerName: player.name,
      tournamentId, tournamentName, status: 'failed', timestamp: new Date(),
    };
    try {
      const teamName = player.sold && player.team?.name ? player.team.name : 'UNSOLD';
      const to = formatMobile(player.mobile);
      logData.recipientMobile = to;
      await sendTemplate({
        to, templateName: 'post_auction_player_summary',
        bodyParams: [player.name || 'Player', tournamentName, teamName],
        buttonParam: '/' + tournamentId,
        logData,
      });
      success++;
    } catch (err) {
      logData.errorMessage = err.response?.data?.error?.message || err.message;
      await safeLog(logData); failed++;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { totalSent: players.length, success, failed };
};

// ─── 5. Post-auction: message to each team owner with full squad ──────────────
const sendPostAuctionOwnerSummaries = async ({ tournamentId }) => {
  if (!await isEnabled(tournamentId, 'postAuctionOwner')) return { skipped: true };
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const tournamentName = tournament?.name || 'Tournament';
  const teams = await prisma.team.findMany({
    where: { touranmentId: tournamentId, ownerMobile: { not: null } },
    include: { players: { where: { sold: true }, select: { name: true, amtSold: true } } },
  });
  let success = 0, failed = 0;
  for (const team of teams) {
    const logData = {
      messageType: 'post_auction_owner', templateName: 'post_auction_owner_summary',
      tournamentId, tournamentName, teamName: team.name, status: 'failed', timestamp: new Date(),
    };
    try {
      const budgetUsed = team.players.reduce((s, p) => s + (p.amtSold || 0), 0);
      const squadList = team.players.map(p => p.name).join(', ') || 'No players';
      const to = formatMobile(team.ownerMobile);
      logData.recipientMobile = to;
      await sendTemplate({
        to, templateName: 'post_auction_owner_summary',
        bodyParams: [
          team.ownerName || 'Team Owner',
          team.name || 'Your Team',
          tournamentName,
          String(team.players.length),
          formatAmount(budgetUsed),
          squadList,
        ],
        buttonParam: '/' + tournamentId,
        logData,
      });
      success++;
    } catch (err) {
      logData.errorMessage = err.response?.data?.error?.message || err.message;
      await safeLog(logData); failed++;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { totalSent: teams.length, success, failed };
};

// ─── 6. Auction reminder broadcast (manual trigger) ──────────────────────────
const sendAuctionReminderBroadcast = async ({ tournamentId, customMessage }) => {
  if (!await isEnabled(tournamentId, 'auctionReminder')) return { skipped: true };
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const tournamentName = tournament?.name || 'Tournament';
  const note = customMessage || `The ${tournamentName} auction is starting soon. Get ready!`;
  const recipients = [];
  const players = await prisma.player.findMany({
    where: { touranmentId: tournamentId, mobile: { not: null } },
    select: { id: true, name: true, mobile: true },
  });
  players.forEach(p => recipients.push({ id: p.id, name: p.name, mobile: p.mobile, type: 'player' }));
  const teams = await prisma.team.findMany({
    where: { touranmentId: tournamentId, ownerMobile: { not: null } },
    select: { id: true, ownerName: true, ownerMobile: true },
  });
  teams.forEach(t => recipients.push({ id: t.id, name: t.ownerName, mobile: t.ownerMobile, type: 'owner' }));
  // Deduplicate by formatted mobile
  const seen = new Map();
  recipients.forEach(r => { const m = formatMobile(r.mobile); if (!seen.has(m)) seen.set(m, { ...r, mobile: m }); });
  const unique = Array.from(seen.values());
  let success = 0, failed = 0;
  for (const r of unique) {
    const logData = {
      messageType: 'auction_announcement', templateName: 'auction_announcement',
      recipientMobile: r.mobile, tournamentId, tournamentName, status: 'failed', timestamp: new Date(),
    };
    try {
      await sendTemplate({
        to: r.mobile, templateName: 'auction_announcement',
        bodyParams: [r.name || 'Player', tournamentName, note],
        buttonParam: '/' + tournamentId,
        logData,
      });
      success++;
    } catch (err) {
      logData.errorMessage = err.response?.data?.error?.message || err.message;
      await safeLog(logData); failed++;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return { totalSent: unique.length, success, failed };
};

// ─── 7. Category starting notification (auto-triggered) ──────────────────────
const sendCategoryStartingNotification = async ({ tournamentId, category }) => {
  if (!await isEnabled(tournamentId, 'categoryStarting')) return null;
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const tournamentName = tournament?.name || 'Tournament';
  const players = await prisma.player.findMany({
    where: { touranmentId: tournamentId, playerCategory: category, mobile: { not: null }, sold: false },
    select: { id: true, name: true, mobile: true },
  });
  for (const player of players) {
    const logData = {
      messageType: 'category_starting', templateName: 'category_auction_starting',
      recipientMobile: formatMobile(player.mobile), playerId: player.id,
      playerName: player.name, tournamentId, tournamentName, status: 'failed', timestamp: new Date(),
    };
    try {
      await sendTemplate({
        to: logData.recipientMobile, templateName: 'category_auction_starting',
        bodyParams: [player.name || 'Player', category, tournamentName],
        logData,
      });
    } catch (err) {
      logData.errorMessage = err.response?.data?.error?.message || err.message;
      await safeLog(logData);
    }
    await new Promise(r => setTimeout(r, 80));
  }
};

// ─── 8. Budget warning to team owner ─────────────────────────────────────────
const sendBudgetWarning = async ({ teamId, tournamentId }) => {
  const cfg = await getWhatsAppConfig(tournamentId);
  if (!cfg.budgetWarning?.enabled) return null;
  const threshold = cfg.budgetWarning?.thresholdPercent ?? 80;
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team?.ownerMobile) return null;
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  const totalBudget = tournament?.totalBudget || 0;
  if (!totalBudget) return null;
  const budgetUsed = await prisma.player.aggregate({
    where: { teamId, sold: true }, _sum: { amtSold: true },
  });
  const used = budgetUsed._sum.amtSold || 0;
  const pct = Math.round((used / totalBudget) * 100);
  if (pct < threshold) return null; // only send once threshold crossed
  const logData = {
    messageType: 'budget_warning', templateName: 'budget_warning',
    recipientMobile: formatMobile(team.ownerMobile), tournamentId,
    teamName: team.name, status: 'failed', timestamp: new Date(),
  };
  try {
    return await sendTemplate({
      to: logData.recipientMobile, templateName: 'budget_warning',
      bodyParams: [
        team.ownerName || 'Team Owner',
        team.name || 'Your Team',
        String(pct),
        formatAmount(totalBudget - used),
      ],
      logData,
    });
  } catch (err) {
    logData.errorMessage = err.response?.data?.error?.message || err.message;
    await safeLog(logData); return null;
  }
};

// ─── Legacy broadcast (keep for backward compat) ─────────────────────────────
const sendAuctionAnnouncementBroadcast = sendAuctionReminderBroadcast;
const getAnnouncementRecipientCount = async ({ tournamentId }) => {
  const playerCount = await prisma.player.count({ where: { touranmentId: tournamentId, mobile: { not: null } } });
  const teamOwnerCount = await prisma.team.count({ where: { touranmentId: tournamentId, ownerMobile: { not: null } } });
  return { playerCount, teamOwnerCount, estimatedTotal: playerCount + teamOwnerCount };
};

module.exports = {
  DEFAULT_WHATSAPP_CONFIG,
  getWhatsAppConfig,
  sendPlayerSoldNotification,
  sendPlayerUnsoldNotification,
  sendTeamPurchaseSummary,
  sendPostAuctionPlayerSummaries,
  sendPostAuctionOwnerSummaries,
  sendAuctionReminderBroadcast,
  sendCategoryStartingNotification,
  sendBudgetWarning,
  // legacy
  sendAuctionAnnouncementBroadcast,
  getAnnouncementRecipientCount,
};
