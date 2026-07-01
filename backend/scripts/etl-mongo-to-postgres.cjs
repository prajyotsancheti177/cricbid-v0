/**
 * ETL: MongoDB (Atlas) -> PostgreSQL (Prisma)
 *
 * Re-runnable: TRUNCATEs the 10 target tables, then reloads from Mongo in
 * dependency order. Reads from Mongo only; writes to the dedicated Postgres
 * (DATABASE_URL). Preserves Mongo ObjectId hex strings as primary keys so the
 * `_id` API contract is kept.
 *
 * Dirty-data strategy:
 *  - Required FK pointing at a missing parent  -> skip the row (counted).
 *  - Optional FK pointing at a missing parent  -> set to null.
 *  - Numeric fields coerced to Int (truncated); phone -> String.
 *  - Enum fields coerced to a valid value (with a sensible default).
 *
 * Usage:  node scripts/etl-mongo-to-postgres.cjs
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { MongoClient, ObjectId } = require('mongodb');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BATCH = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- helpers --------------------------------------------------------------
const hex = (v) => (v == null ? null : (v instanceof ObjectId ? v.toHexString() : String(v)));
const str = (v) => (v == null ? null : String(v));
const int = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const flt = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v) => (v == null ? null : Boolean(v));
const date = (v) => (v instanceof Date ? v : (v ? new Date(v) : null));
const json = (v) => (v == null ? null : v); // Prisma Json accepts plain objects
// Map<string,x> from Mongo comes through as a plain object already
const enumOf = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
// chunk an array
const chunks = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

const stats = {};
const record = (name, { total = 0, inserted = 0, skipped = 0 }) => { stats[name] = { total, inserted, skipped }; };

async function insertMany(model, rows) {
  let inserted = 0;
  const batches = chunks(rows, BATCH);
  let bi = 0;
  for (const batch of batches) {
    bi++;
    let attempt = 0;
    // retry transient connection drops (Supabase free tier drops under bulk load)
    for (;;) {
      try {
        const res = await prisma[model].createMany({ data: batch, skipDuplicates: true });
        inserted += res.count;
        break;
      } catch (e) {
        attempt++;
        const transient = ['P1001', 'P1017', 'P1008'].includes(e.code);
        if (!transient || attempt > 8) throw e;
        const wait = Math.min(1000 * attempt, 5000);
        process.stdout.write(`\n  [${model}] batch ${bi}/${batches.length} ${e.code}, retry ${attempt} in ${wait}ms`);
        await sleep(wait);
        // force a fresh connection — the dropped one won't recover on reuse
        try { await prisma.$disconnect(); } catch {}
        try { await prisma.$connect(); } catch {}
      }
    }
  }
  return inserted;
}

// ---- main -----------------------------------------------------------------
(async () => {
  const mongo = new MongoClient(process.env.MONGO_DB_URI);
  await mongo.connect();
  const db = mongo.db();
  console.log('Connected: Mongo + Postgres\n');

  // 1) Wipe target (reverse dependency order) for idempotent re-runs
  console.log('Truncating target tables...');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "auction_log_bid","auction_log","auction_room_session","user_event",
    "whatsapp_log","ip_geo_cache","player","team","tournament","user"
    RESTART IDENTITY CASCADE;`);

  // valid-id sets, built as we load parents
  const userIds = new Set();
  const tournamentIds = new Set();
  const teamIds = new Set();
  const playerIds = new Set();

  // 2) USERS -----------------------------------------------------------------
  {
    const docs = await db.collection('user').find().toArray();
    const seenEmail = new Set();
    const rows = [];
    let skipped = 0;
    for (const d of docs) {
      const email = str(d.email);
      if (!email || seenEmail.has(email.toLowerCase())) { skipped++; continue; }
      seenEmail.add(email.toLowerCase());
      const p = d.permissions || {};
      const id = hex(d._id);
      rows.push({
        id, name: str(d.name), email, password: str(d.password) || '',
        role: enumOf(d.role, ['boss', 'super_user', 'tournament_host'], 'tournament_host'),
        isActive: d.isActive == null ? true : Boolean(d.isActive),
        logo: str(d.logo),
        canCreateSuperUser: Boolean(p.canCreateSuperUser),
        canCreateTournamentHost: Boolean(p.canCreateTournamentHost),
        canManageTournaments: p.canManageTournaments == null ? true : Boolean(p.canManageTournaments),
        canManageTeams: p.canManageTeams == null ? true : Boolean(p.canManageTeams),
        canManagePlayers: p.canManagePlayers == null ? true : Boolean(p.canManagePlayers),
        createdById: null, // set in second pass (self-FK)
        createdAt: date(d.createdAt) || new Date(),
        updatedAt: date(d.updatedAt) || new Date(),
      });
      userIds.add(id);
    }
    const inserted = await insertMany('user', rows);
    // second pass: self-referential createdBy
    for (const d of docs) {
      const id = hex(d._id), parent = hex(d.createdBy);
      if (userIds.has(id) && parent && userIds.has(parent)) {
        await prisma.user.update({ where: { id }, data: { createdById: parent } });
      }
    }
    record('user', { total: docs.length, inserted, skipped });
  }

  // 3) TOURNAMENTS -----------------------------------------------------------
  {
    const docs = await db.collection('tournament').find().toArray();
    const rows = docs.map((d) => {
      const id = hex(d._id); tournamentIds.add(id);
      return {
        id, name: str(d.name), tournamentHostId: hex(d.tournamentHostId),
        noOfTeams: int(d.noOfTeams), maxPlayersPerTeam: int(d.maxPlayersPerTeam),
        minPlayersPerTeam: int(d.minPlayersPerTeam), totalBudget: int(d.totalBudget),
        playerCategories: Array.isArray(d.playerCategories) ? d.playerCategories.map(String) : [],
        categoryBasePrices: json(d.categoryBasePrices),
        bidIncrementSlabs: json(d.bidIncrementSlabs),
        registrationFormConfig: json(d.registrationFormConfig),
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      };
    });
    record('tournament', { total: docs.length, inserted: await insertMany('tournament', rows) });
  }

  // 4) TEAMS -----------------------------------------------------------------
  {
    const docs = await db.collection('team').find().toArray();
    const rows = docs.map((d) => {
      const id = hex(d._id); teamIds.add(id);
      const o = d.owner || {};
      const t = hex(d.touranmentId);
      return {
        id, name: str(d.name), logo: str(d.logo),
        ownerName: str(o.name), ownerEmail: str(o.email), ownerMobile: str(o.mobile),
        touranmentId: tournamentIds.has(t) ? t : null,
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      };
    });
    record('team', { total: docs.length, inserted: await insertMany('team', rows) });
  }

  // 5) PLAYERS ---------------------------------------------------------------
  {
    const docs = await db.collection('player').find().toArray();
    const rows = docs.map((d) => {
      const id = hex(d._id); playerIds.add(id);
      const t = hex(d.touranmentId), tm = hex(d.teamId);
      return {
        id, name: str(d.name), age: int(d.age), gender: str(d.gender), photo: str(d.photo),
        skill: str(d.skill), mobile: str(d.mobile), email: str(d.email), address: str(d.address),
        touranmentId: tournamentIds.has(t) ? t : null,
        teamId: teamIds.has(tm) ? tm : null,
        sold: bool(d.sold), auctionStatus: bool(d.auctionStatus), amtSold: int(d.amtSold),
        playerCategory: str(d.playerCategory), auctionSerialNumber: int(d.auctionSerialNumber),
        customFields: json(d.customFields),
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      };
    });
    record('player', { total: docs.length, inserted: await insertMany('player', rows) });
  }

  // 6) AUCTION LOGS (+ bids) -------------------------------------------------
  {
    const docs = await db.collection('auction_log').find().toArray();
    const logRows = []; const bidRows = []; let skipped = 0;
    for (const d of docs) {
      const id = hex(d._id);
      const tId = hex(d.tournamentId), pId = hex(d.playerId);
      if (!tournamentIds.has(tId) || !playerIds.has(pId)) { skipped++; continue; } // required FKs
      const wTeam = hex(d.winningTeamId);
      const cBy = hex(d.conductedBy);
      logRows.push({
        id, tournamentId: tId, playerId: pId,
        playerName: str(d.playerName), playerCategory: str(d.playerCategory),
        basePrice: int(d.basePrice) ?? 0,
        auctionMode: enumOf(d.auctionMode, ['category', 'manual'], 'manual'),
        status: enumOf(d.status, ['sold', 'unsold'], 'unsold'),
        winningTeamId: teamIds.has(wTeam) ? wTeam : null,
        winningTeamName: str(d.winningTeamName), finalPrice: int(d.finalPrice),
        totalBids: int(d.totalBids) ?? 0, uniqueTeamsBidding: int(d.uniqueTeamsBidding) ?? 0,
        auctionStartedAt: date(d.auctionStartedAt), auctionEndedAt: date(d.auctionEndedAt),
        totalDurationSeconds: int(d.totalDurationSeconds),
        conductedById: userIds.has(cBy) ? cBy : null,
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      });
      // embedded bids -> child rows (teamId is required FK -> skip bids w/ missing team)
      if (Array.isArray(d.bids)) {
        for (const b of d.bids) {
          const bTeam = hex(b.teamId);
          if (!teamIds.has(bTeam)) continue;
          bidRows.push({
            auctionLogId: id, teamId: bTeam, teamName: str(b.teamName) || '',
            bidAmount: int(b.bidAmount) ?? 0, bidIncrement: int(b.bidIncrement),
            timestamp: date(b.timestamp), bidOrder: int(b.bidOrder) ?? 0,
          });
        }
      }
    }
    const insLogs = await insertMany('auctionLog', logRows);
    const insBids = await insertMany('auctionLogBid', bidRows);
    record('auction_log', { total: docs.length, inserted: insLogs, skipped });
    record('auction_log_bid', { total: bidRows.length, inserted: insBids });
  }

  // 7) AUCTION ROOM SESSIONS -------------------------------------------------
  {
    const docs = await db.collection('auction_room_session').find().toArray();
    const rows = []; let skipped = 0;
    for (const d of docs) {
      const tId = hex(d.tournamentId);
      if (!tournamentIds.has(tId)) { skipped++; continue; } // required FK
      const host = hex(d.hostUserId);
      rows.push({
        id: hex(d._id), tournamentId: tId, tournamentName: str(d.tournamentName),
        sessionStartedAt: date(d.sessionStartedAt), sessionEndedAt: date(d.sessionEndedAt),
        sessionDurationMinutes: int(d.sessionDurationMinutes),
        hostUserId: userIds.has(host) ? host : null, hostUserName: str(d.hostUserName),
        uniqueViewerUserIds: Array.isArray(d.uniqueViewerUserIds) ? d.uniqueViewerUserIds.map(hex) : [],
        anonymousViewerIPs: Array.isArray(d.anonymousViewerIPs) ? d.anonymousViewerIPs.map(String) : [],
        totalUniqueViewers: int(d.totalUniqueViewers) ?? 0, totalJoins: int(d.totalJoins) ?? 0,
        peakConcurrentViewers: int(d.peakConcurrentViewers) ?? 0, peakViewerTimestamp: date(d.peakViewerTimestamp),
        playersAuctioned: int(d.playersAuctioned) ?? 0, playersSold: int(d.playersSold) ?? 0,
        playersUnsold: int(d.playersUnsold) ?? 0, totalBids: int(d.totalBids) ?? 0,
        viewerHistory: json(d.viewerHistory),
        status: enumOf(d.status, ['active', 'ended', 'abandoned'], 'ended'),
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      });
    }
    record('auction_room_session', { total: docs.length, inserted: await insertMany('auctionRoomSession', rows), skipped });
  }

  // 8) USER EVENTS (large, analytics-only history) ---------------------------
  // Skippable: 162k historical events feed only the deferred analytics page.
  // Set SKIP_USER_EVENTS=1 to skip. Failure here is non-fatal (records partial).
  if (process.env.SKIP_USER_EVENTS === '1') {
    const total = await db.collection('user_event').countDocuments();
    record('user_event', { total, inserted: 0, skipped: total });
  } else {
    const docs = await db.collection('user_event').find().toArray();
    const rows = docs.map((d) => {
      const u = hex(d.userId), t = hex(d.tournamentId);
      return {
        id: hex(d._id), userId: userIds.has(u) ? u : null, sessionId: str(d.sessionId),
        tournamentId: tournamentIds.has(t) ? t : null,
        eventType: str(d.eventType) || 'unknown', eventData: json(d.eventData),
        page: str(d.page), userAgent: str(d.userAgent), ipAddress: str(d.ipAddress),
        timestamp: date(d.timestamp) || new Date(),
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      };
    });
    try {
      record('user_event', { total: docs.length, inserted: await insertMany('userEvent', rows) });
    } catch (e) {
      console.warn(`\n  [user_event] load aborted (${e.code}); continuing. Re-run later or use SKIP_USER_EVENTS=1.`);
      const cnt = await prisma.userEvent.count();
      record('user_event', { total: docs.length, inserted: cnt, skipped: docs.length - cnt });
    }
  }

  // 9) WHATSAPP LOGS ---------------------------------------------------------
  {
    const docs = await db.collection('whatsapp_log').find().toArray();
    const rows = docs.map((d) => {
      const p = hex(d.playerId), t = hex(d.tournamentId);
      return {
        id: hex(d._id), messageType: str(d.messageType) || 'unknown', templateName: str(d.templateName),
        recipientMobile: str(d.recipientMobile) || '',
        playerId: playerIds.has(p) ? p : null, playerName: str(d.playerName),
        tournamentId: tournamentIds.has(t) ? t : null, tournamentName: str(d.tournamentName),
        teamName: str(d.teamName), amtSold: int(d.amtSold),
        status: str(d.status) || 'unknown', messageId: str(d.messageId), errorMessage: str(d.errorMessage),
        timestamp: date(d.timestamp) || new Date(),
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      };
    });
    record('whatsapp_log', { total: docs.length, inserted: await insertMany('whatsappLog', rows) });
  }

  // 10) IP GEO CACHE ---------------------------------------------------------
  {
    const docs = await db.collection('ip_geo_cache').find().toArray();
    const seenIp = new Set(); const rows = []; let skipped = 0;
    for (const d of docs) {
      const ip = str(d.ipAddress);
      if (!ip || seenIp.has(ip)) { skipped++; continue; } // unique constraint
      seenIp.add(ip);
      rows.push({
        id: hex(d._id), ipAddress: ip, city: str(d.city), region: str(d.region),
        country: str(d.country), countryCode: str(d.countryCode), lat: flt(d.lat), lon: flt(d.lon),
        isp: str(d.isp), isValid: d.isValid == null ? true : Boolean(d.isValid),
        cachedAt: date(d.cachedAt) || new Date(),
        createdAt: date(d.createdAt) || new Date(), updatedAt: date(d.updatedAt) || new Date(),
      });
    }
    record('ip_geo_cache', { total: docs.length, inserted: await insertMany('ipGeoCache', rows), skipped });
  }

  // ---- reconciliation report ---------------------------------------------
  console.log('\n=== ETL reconciliation ===');
  console.log('table'.padEnd(24), 'mongo'.padStart(8), 'inserted'.padStart(10), 'skipped'.padStart(8));
  for (const [k, v] of Object.entries(stats)) {
    console.log(k.padEnd(24), String(v.total).padStart(8), String(v.inserted).padStart(10), String(v.skipped).padStart(8));
  }

  await mongo.close();
  await prisma.$disconnect();
  console.log('\nETL complete.');
})().catch(async (e) => {
  console.error('ETL FAILED:', e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
