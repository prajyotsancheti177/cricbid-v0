const prisma = require("../db/prisma");
const eventService = require("./eventService");

// ─── Points table helpers ────────────────────────────────────────────────────

const NRR_SCALE = 1e6; // store NRR * 1e6 as integer-comparable float

function calcNRR(forRuns, forOvers, againstRuns, againstOvers) {
  if (!forOvers || !againstOvers) return 0;
  return (forRuns / forOvers) - (againstRuns / againstOvers);
}

// ─── Read ────────────────────────────────────────────────────────────────────

const getMatches = async ({ tournamentId }) => {
  return prisma.match.findMany({
    where: { tournamentId },
    include: {
      teamA: { select: { id: true, name: true, logo: true } },
      teamB: { select: { id: true, name: true, logo: true } },
      innings: { orderBy: { inningsNumber: "asc" } },
    },
    orderBy: [{ scheduledAt: "asc" }, { matchNumber: "asc" }],
  });
};

const getMatch = async ({ matchId }) => {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true, logo: true } },
      teamB: { select: { id: true, name: true, logo: true } },
      innings: {
        orderBy: { inningsNumber: "asc" },
        include: { battingTeam: { select: { id: true, name: true } } },
      },
    },
  });
};

// ─── Create / update match ───────────────────────────────────────────────────

const createMatch = async ({
  tournamentId, matchNumber, round, venue, scheduledAt,
  format, totalOvers, teamAId, teamBId,
}) => {
  const match = await prisma.match.create({
    data: {
      tournamentId, matchNumber, round, venue,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      format: format || "T20",
      totalOvers: totalOvers || 20,
      teamAId, teamBId,
      status: "upcoming",
    },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      innings: true,
    },
  });

  eventService.trackEvent({
    userId: null,
    tournamentId: tournamentId || null,
    eventType: "match_created",
    page: "/schedule",
    eventData: { matchId: match.id, tournamentId, teamAId, teamBId, round, matchNumber },
  }).catch(() => {});

  return match;
};

const updateMatch = async ({ matchId, ...data }) => {
  const updateData = {};
  const allowed = ["matchNumber","round","venue","scheduledAt","format","totalOvers","status","tossWonById","tossDecision","resultNote","winnerId"];
  allowed.forEach(k => { if (data[k] !== undefined) updateData[k] = data[k]; });
  if (updateData.scheduledAt) updateData.scheduledAt = new Date(updateData.scheduledAt);
  const updated = await prisma.match.update({ where: { id: matchId }, data: updateData });

  eventService.trackEvent({
    userId: null,
    tournamentId: updated.tournamentId || null,
    eventType: "match_updated",
    page: "/schedule",
    eventData: { matchId, fieldsUpdated: Object.keys(updateData) },
  }).catch(() => {});

  return updated;
};

const deleteMatch = async ({ matchId }) => {
  const deleted = await prisma.match.delete({ where: { id: matchId } });

  eventService.trackEvent({
    userId: null,
    tournamentId: deleted.tournamentId || null,
    eventType: "match_deleted",
    page: "/schedule",
    eventData: { matchId },
  }).catch(() => {});

  return deleted;
};

// ─── Score entry ─────────────────────────────────────────────────────────────

const saveInnings = async ({ matchId, inningsNumber, battingTeamId, runs, wickets, oversBowled, extras, isCompleted }) => {
  return prisma.innings.upsert({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
    create: { matchId, inningsNumber, battingTeamId, runs: runs||0, wickets: wickets||0, oversBowled: oversBowled||0, extras: extras||0, isCompleted: isCompleted||false },
    update: { battingTeamId, runs: runs||0, wickets: wickets||0, oversBowled: oversBowled||0, extras: extras||0, isCompleted: isCompleted||false },
  });
};

// Complete a match — calculate result automatically and mark completed
const completeMatch = async ({ matchId }) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { innings: { orderBy: { inningsNumber: "asc" } } },
  });
  if (!match) throw new Error("Match not found");

  const inn1 = match.innings.find(i => i.inningsNumber === 1);
  const inn2 = match.innings.find(i => i.inningsNumber === 2);
  if (!inn1 || !inn2) throw new Error("Both innings must be entered before completing");

  let winnerId = null;
  let resultNote = "";

  if (inn2.runs > inn1.runs) {
    winnerId = inn2.battingTeamId;
    const wicketsLeft = 10 - inn2.wickets;
    resultNote = `won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}`;
  } else if (inn1.runs > inn2.runs) {
    winnerId = inn1.battingTeamId;
    const margin = inn1.runs - inn2.runs;
    resultNote = `won by ${margin} run${margin !== 1 ? "s" : ""}`;
  } else {
    resultNote = "Match tied";
  }

  // Prefix with winning team name
  if (winnerId) {
    const winTeam = [match.teamAId, match.teamBId].includes(winnerId)
      ? await prisma.team.findUnique({ where: { id: winnerId }, select: { name: true } })
      : null;
    if (winTeam) resultNote = `${winTeam.name} ${resultNote}`;
  }

  const completed = await prisma.match.update({
    where: { id: matchId },
    data: { status: "completed", winnerId, resultNote },
  });

  eventService.trackEvent({
    userId: null,
    tournamentId: completed.tournamentId || null,
    eventType: "match_completed",
    page: "/schedule",
    eventData: { matchId, winnerId, resultNote },
  }).catch(() => {});

  return completed;
};

// ─── Points table ────────────────────────────────────────────────────────────

const getPointsTable = async ({ tournamentId }) => {
  const teams = await prisma.team.findMany({
    where: { touranmentId: tournamentId },
    select: { id: true, name: true, logo: true },
  });

  const matches = await prisma.match.findMany({
    where: { tournamentId, status: "completed" },
    include: { innings: true },
  });

  const table = {};
  teams.forEach(t => {
    table[t.id] = {
      teamId: t.id, teamName: t.name, logo: t.logo,
      played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
      forRuns: 0, forOvers: 0, againstRuns: 0, againstOvers: 0, nrr: 0,
    };
  });

  matches.forEach(m => {
    const a = table[m.teamAId];
    const b = table[m.teamBId];
    if (!a || !b) return;

    const inn1 = m.innings.find(i => i.battingTeamId === m.teamAId);
    const inn2 = m.innings.find(i => i.battingTeamId === m.teamBId);

    a.played++; b.played++;

    if (!m.winnerId) {
      // tie or no result
      a.tied++; b.tied++;
      a.points++; b.points++;
    } else if (m.winnerId === m.teamAId) {
      a.won++; a.points += 2;
      b.lost++;
    } else {
      b.won++; b.points += 2;
      a.lost++;
    }

    if (inn1) {
      a.forRuns    += inn1.runs; a.forOvers    += inn1.oversBowled;
      b.againstRuns += inn1.runs; b.againstOvers += inn1.oversBowled;
    }
    if (inn2) {
      b.forRuns    += inn2.runs; b.forOvers    += inn2.oversBowled;
      a.againstRuns += inn2.runs; a.againstOvers += inn2.oversBowled;
    }
  });

  Object.values(table).forEach(r => {
    r.nrr = parseFloat(calcNRR(r.forRuns, r.forOvers, r.againstRuns, r.againstOvers).toFixed(3));
  });

  return Object.values(table).sort((a, b) =>
    b.points - a.points || b.nrr - a.nrr
  );
};

const bulkCreateMatches = async (matches) => {
  const created = await prisma.$transaction(
    matches.map(m => prisma.match.create({
      data: {
        tournamentId: m.tournamentId,
        matchNumber:  m.matchNumber,
        round:        m.round,
        venue:        m.venue || null,
        scheduledAt:  m.scheduledAt ? new Date(m.scheduledAt) : null,
        format:       m.format  || "T20",
        totalOvers:   m.totalOvers || 20,
        teamAId:      m.teamAId,
        teamBId:      m.teamBId,
        status:       "upcoming",
      },
    }))
  );

  const tournamentId = matches[0]?.tournamentId || null;
  eventService.trackEvent({
    userId: null,
    tournamentId,
    eventType: "matches_bulk_created",
    page: "/schedule",
    eventData: { tournamentId, count: created.length },
  }).catch(() => {});

  return created;
};

module.exports = { getMatches, getMatch, createMatch, updateMatch, deleteMatch, saveInnings, completeMatch, getPointsTable, bulkCreateMatches };
