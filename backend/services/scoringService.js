const prisma = require("../db/prisma");
const eventService = require("./eventService");

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Compute overs string e.g. 18.4 from balls (legal deliveries)
const toOversFloat = (balls) => {
  const ov = Math.floor(balls / 6);
  const b  = balls % 6;
  return parseFloat(`${ov}.${b}`);
};

// Auto-generate ball commentary
const makeCommentary = ({ batRuns, isExtra, extraType, extraRuns, isWicket, wicketType, batsmanName, bowlerName, fielderName, outBatsmanName }) => {
  if (isWicket) {
    const how = wicketType === "caught"    ? `c ${fielderName || "?"} b ${bowlerName}` :
                wicketType === "bowled"    ? `b ${bowlerName}` :
                wicketType === "lbw"       ? `lbw b ${bowlerName}` :
                wicketType === "stumped"   ? `st ${fielderName || "?"} b ${bowlerName}` :
                wicketType === "run_out"   ? `run out (${fielderName || "?"})` :
                wicketType === "hit_wicket"? `hit wicket b ${bowlerName}` :
                wicketType;
    return `OUT! ${outBatsmanName || batsmanName} ${how}`;
  }
  if (isExtra) {
    if (extraType === "wide")   return `Wide${extraRuns > 1 ? ` +${extraRuns - 1} run${extraRuns > 2 ? "s" : ""}` : ""}`;
    if (extraType === "no_ball") return `No ball${batRuns ? ` +${batRuns} off bat` : ""}`;
    if (extraType === "bye")    return `${extraRuns} bye${extraRuns > 1 ? "s" : ""}`;
    if (extraType === "leg_bye") return `${extraRuns} leg bye${extraRuns > 1 ? "s" : ""}`;
  }
  if (batRuns === 0) return "Dot ball";
  if (batRuns === 4) return `FOUR! ${batsmanName}`;
  if (batRuns === 6) return `SIX! ${batsmanName} launches it!`;
  return `${batRuns} run${batRuns > 1 ? "s" : ""}`;
};

// Fetch player name from Player table (graceful fallback)
const playerName = async (id) => {
  if (!id) return "Unknown";
  try {
    const p = await prisma.player.findUnique({ where: { id }, select: { name: true } });
    return p?.name || "Unknown";
  } catch { return "Unknown"; }
};

// ─── Start innings ────────────────────────────────────────────────────────────

const startInnings = async ({ matchId, inningsNumber, battingTeamId, striker1Id, striker2Id, openingBowlerId }) => {
  // Upsert the Innings row (may already exist from schedule section)
  const innings = await prisma.innings.upsert({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
    create: { matchId, inningsNumber, battingTeamId },
    update: { battingTeamId },
  });

  // Upsert batsman rows
  await prisma.batsmanInnings.upsert({
    where: { inningsId_playerId: { inningsId: innings.id, playerId: striker1Id } },
    create: { inningsId: innings.id, matchId, inningsNumber, playerId: striker1Id, teamId: battingTeamId, battingOrder: 1 },
    update: {},
  });
  await prisma.batsmanInnings.upsert({
    where: { inningsId_playerId: { inningsId: innings.id, playerId: striker2Id } },
    create: { inningsId: innings.id, matchId, inningsNumber, playerId: striker2Id, teamId: battingTeamId, battingOrder: 2 },
    update: {},
  });

  // Upsert bowler row
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { teamAId: true, teamBId: true } });
  const bowlingTeamId = match.teamAId === battingTeamId ? match.teamBId : match.teamAId;
  await prisma.bowlerInnings.upsert({
    where: { inningsId_playerId: { inningsId: innings.id, playerId: openingBowlerId } },
    create: { inningsId: innings.id, matchId, inningsNumber, playerId: openingBowlerId, teamId: bowlingTeamId },
    update: {},
  });

  // Mark match live
  await prisma.match.update({ where: { id: matchId }, data: { status: "live" } });

  eventService.trackEvent({
    userId: null,
    tournamentId: null,
    eventType: "innings_started",
    page: "/scoring",
    eventData: { matchId, inningsNumber, battingTeamId },
  }).catch(() => {});

  return innings;
};

// ─── Record a ball ────────────────────────────────────────────────────────────

const recordBall = async ({
  matchId, inningsNumber,
  batsmanId, nonStrikerId, bowlerId,
  batRuns, isExtra, extraType, extraRuns,
  isWicket, wicketType, outBatsmanId, fielderId,
}) => {
  const innings = await prisma.innings.findUnique({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
  });
  if (!innings) throw new Error("Innings not found");

  // Count legal deliveries already bowled this innings to get over/ball
  const legalBalls = await prisma.ballEvent.count({
    where: { inningsId: innings.id, isLegalDelivery: true },
  });
  const overNumber  = Math.floor(legalBalls / 6);
  const ballInOver  = (legalBalls % 6) + 1;
  const isLegal     = !(extraType === "wide" || extraType === "no_ball");

  const totalRuns = (batRuns || 0) + (extraRuns || 0);

  // Names for commentary
  const [bName, bowlName, fielderName, outName] = await Promise.all([
    playerName(batsmanId),
    playerName(bowlerId),
    playerName(fielderId),
    playerName(outBatsmanId || (isWicket ? batsmanId : null)),
  ]);

  const commentary = makeCommentary({
    batRuns: batRuns || 0, isExtra: !!isExtra, extraType, extraRuns: extraRuns || 0,
    isWicket: !!isWicket, wicketType,
    batsmanName: bName, bowlerName: bowlName, fielderName: fielderName, outBatsmanName: outName,
  });

  // Create ball event
  const ball = await prisma.ballEvent.create({
    data: {
      inningsId: innings.id, matchId, inningsNumber,
      overNumber, ballInOver, isLegalDelivery: isLegal,
      batsmanId, nonStrikerId, bowlerId,
      batRuns: batRuns || 0,
      isExtra: !!isExtra, extraType: extraType || null, extraRuns: extraRuns || 0,
      totalRuns,
      isWicket: !!isWicket, wicketType: wicketType || null,
      outBatsmanId: isWicket ? (outBatsmanId || batsmanId) : null,
      fielderId: fielderId || null,
      commentary,
    },
  });

  // ── Update innings totals ──
  await prisma.innings.update({
    where: { id: innings.id },
    data: {
      runs:    { increment: totalRuns },
      wickets: { increment: isWicket ? 1 : 0 },
      oversBowled: toOversFloat(legalBalls + (isLegal ? 1 : 0)),
      extras:  { increment: extraRuns || 0 },
    },
  });

  // ── Update batter ──
  const actualOut = isWicket ? (outBatsmanId || batsmanId) : null;
  if (batRuns || isWicket) {
    await prisma.batsmanInnings.updateMany({
      where: { inningsId: innings.id, playerId: batsmanId },
      data: {
        runs:       { increment: batRuns || 0 },
        ballsFaced: { increment: isLegal ? 1 : 0 },
        fours:      { increment: batRuns === 4 ? 1 : 0 },
        sixes:      { increment: batRuns === 6 ? 1 : 0 },
      },
    });
  } else if (isLegal) {
    await prisma.batsmanInnings.updateMany({
      where: { inningsId: innings.id, playerId: batsmanId },
      data: { ballsFaced: { increment: 1 } },
    });
  }

  // Mark out batsman
  if (isWicket && actualOut) {
    const howOut = commentary.replace(/^OUT! /, "");
    await prisma.batsmanInnings.updateMany({
      where: { inningsId: innings.id, playerId: actualOut },
      data: { isOut: true, howOut, wicketType: wicketType || null, bowlerId: fielderId ? undefined : bowlerId, fielderId: fielderId || null },
    });

    // Record fall of wicket
    const currentWickets = innings.wickets + 1;
    const totalBallsSoFar = legalBalls + (isLegal ? 1 : 0);
    await prisma.fallOfWicket.create({
      data: {
        inningsId: innings.id, matchId,
        wicketNumber: currentWickets,
        playerId: actualOut,
        runs: innings.runs + totalRuns,
        balls: totalBallsSoFar,
        overNumber: Math.floor(totalBallsSoFar / 6),
        ballInOver: (totalBallsSoFar % 6) || 6,
      },
    });
  }

  // ── Update bowler ──
  await prisma.bowlerInnings.updateMany({
    where: { inningsId: innings.id, playerId: bowlerId },
    data: {
      balls:   { increment: isLegal ? 1 : 0 },
      runs:    { increment: totalRuns },
      wickets: { increment: (isWicket && wicketType !== "run_out") ? 1 : 0 },
      wides:   { increment: extraType === "wide" ? 1 : 0 },
      noBalls: { increment: extraType === "no_ball" ? 1 : 0 },
    },
  });

  eventService.trackEvent({
    userId: null,
    tournamentId: null,
    eventType: "ball_recorded",
    page: "/scoring",
    eventData: { matchId, inningsNumber, overNumber, ballInOver, batRuns: batRuns || 0, isWicket: !!isWicket, extraType: extraType || null },
  }).catch(() => {});

  return { ball, commentary };
};

// ─── Undo last ball ───────────────────────────────────────────────────────────

const undoLastBall = async ({ matchId, inningsNumber }) => {
  const innings = await prisma.innings.findUnique({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
  });
  if (!innings) throw new Error("Innings not found");

  const last = await prisma.ballEvent.findFirst({
    where: { inningsId: innings.id },
    orderBy: { createdAt: "desc" },
  });
  if (!last) throw new Error("No balls to undo");

  // Reverse all stat updates atomically
  await prisma.$transaction([
    // Delete ball
    prisma.ballEvent.delete({ where: { id: last.id } }),

    // Reverse innings totals
    prisma.innings.update({
      where: { id: innings.id },
      data: {
        runs:    { decrement: last.totalRuns },
        wickets: { decrement: last.isWicket ? 1 : 0 },
        extras:  { decrement: last.extraRuns },
      },
    }),

    // Reverse batter stats
    prisma.batsmanInnings.updateMany({
      where: { inningsId: innings.id, playerId: last.batsmanId },
      data: {
        runs:       { decrement: last.batRuns },
        ballsFaced: { decrement: last.isLegalDelivery ? 1 : 0 },
        fours:      { decrement: last.batRuns === 4 ? 1 : 0 },
        sixes:      { decrement: last.batRuns === 6 ? 1 : 0 },
      },
    }),

    // Reverse bowler stats
    prisma.bowlerInnings.updateMany({
      where: { inningsId: innings.id, playerId: last.bowlerId },
      data: {
        balls:   { decrement: last.isLegalDelivery ? 1 : 0 },
        runs:    { decrement: last.totalRuns },
        wickets: { decrement: (last.isWicket && last.wicketType !== "run_out") ? 1 : 0 },
        wides:   { decrement: last.extraType === "wide" ? 1 : 0 },
        noBalls: { decrement: last.extraType === "no_ball" ? 1 : 0 },
      },
    }),
  ]);

  // If it was a wicket, undo the batsman dismissal and remove FoW
  if (last.isWicket && last.outBatsmanId) {
    await prisma.batsmanInnings.updateMany({
      where: { inningsId: innings.id, playerId: last.outBatsmanId },
      data: { isOut: false, howOut: null, wicketType: null },
    });
    const fow = await prisma.fallOfWicket.findFirst({
      where: { inningsId: innings.id },
      orderBy: { wicketNumber: "desc" },
    });
    if (fow) await prisma.fallOfWicket.delete({ where: { id: fow.id } });
  }

  // Recalculate oversBowled
  const remaining = await prisma.ballEvent.count({ where: { inningsId: innings.id, isLegalDelivery: true } });
  await prisma.innings.update({ where: { id: innings.id }, data: { oversBowled: toOversFloat(remaining) } });

  eventService.trackEvent({
    userId: null,
    tournamentId: null,
    eventType: "ball_undone",
    page: "/scoring",
    eventData: { matchId, inningsNumber },
  }).catch(() => {});

  return { undone: last };
};

// ─── Add new batsman after wicket ────────────────────────────────────────────

const addBatsman = async ({ matchId, inningsNumber, playerId, teamId, battingOrder }) => {
  const innings = await prisma.innings.findUnique({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
  });
  if (!innings) throw new Error("Innings not found");

  const result = await prisma.batsmanInnings.upsert({
    where: { inningsId_playerId: { inningsId: innings.id, playerId } },
    create: { inningsId: innings.id, matchId, inningsNumber, playerId, teamId, battingOrder },
    update: {},
  });

  eventService.trackEvent({
    userId: null,
    tournamentId: null,
    eventType: "batsman_added",
    page: "/scoring",
    eventData: { matchId, inningsNumber, playerId, battingOrder },
  }).catch(() => {});

  return result;
};

// ─── Add / switch bowler ──────────────────────────────────────────────────────

const setBowler = async ({ matchId, inningsNumber, playerId, teamId }) => {
  const innings = await prisma.innings.findUnique({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
  });
  if (!innings) throw new Error("Innings not found");

  const result = await prisma.bowlerInnings.upsert({
    where: { inningsId_playerId: { inningsId: innings.id, playerId } },
    create: { inningsId: innings.id, matchId, inningsNumber, playerId, teamId },
    update: {},
  });

  eventService.trackEvent({
    userId: null,
    tournamentId: null,
    eventType: "bowler_set",
    page: "/scoring",
    eventData: { matchId, inningsNumber, playerId },
  }).catch(() => {});

  return result;
};

// ─── Live state (for scorer panel to resume after refresh) ───────────────────

const getLiveState = async ({ matchId, inningsNumber }) => {
  const innings = await prisma.innings.findUnique({
    where: { matchId_inningsNumber: { matchId, inningsNumber } },
  });
  if (!innings) return null;

  const [balls, batters, bowlers, fow] = await Promise.all([
    prisma.ballEvent.findMany({
      where: { inningsId: innings.id },
      orderBy: [{ overNumber: "asc" }, { ballInOver: "asc" }],
    }),
    prisma.batsmanInnings.findMany({ where: { inningsId: innings.id }, orderBy: { battingOrder: "asc" } }),
    prisma.bowlerInnings.findMany({ where: { inningsId: innings.id } }),
    prisma.fallOfWicket.findMany({ where: { inningsId: innings.id }, orderBy: { wicketNumber: "asc" } }),
  ]);

  // Balls this over
  const totalLegal = balls.filter(b => b.isLegalDelivery).length;
  const thisOverStart = Math.floor(totalLegal / 6) * 6;
  const thisOverBalls = balls.filter(b => {
    const ballLegalIndex = balls.filter(x => x.isLegalDelivery && x.createdAt <= b.createdAt).length;
    return ballLegalIndex > thisOverStart;
  });

  return { innings, balls, batters, bowlers, fow, thisOverBalls, totalLegal };
};

// ─── Full scorecard ───────────────────────────────────────────────────────────

const getScorecard = async ({ matchId }) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
      innings: {
        orderBy: { inningsNumber: "asc" },
        include: {
          batsmanInnings: { orderBy: { battingOrder: "asc" } },
          bowlerInnings:  true,
          fallOfWickets:  { orderBy: { wicketNumber: "asc" } },
          partnerships:   { orderBy: { wicketNumber: "asc" } },
        },
      },
    },
  });
  if (!match) throw new Error("Match not found");

  // Attach player names to each row
  const allPlayerIds = new Set();
  match.innings.forEach(inn => {
    inn.batsmanInnings.forEach(b => { allPlayerIds.add(b.playerId); if (b.bowlerId) allPlayerIds.add(b.bowlerId); if (b.fielderId) allPlayerIds.add(b.fielderId); });
    inn.bowlerInnings.forEach(b => allPlayerIds.add(b.playerId));
    inn.fallOfWickets.forEach(f => allPlayerIds.add(f.playerId));
  });
  const players = await prisma.player.findMany({
    where: { id: { in: [...allPlayerIds] } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  return { match, nameMap };
};

// ─── Tournament stats / leaderboards ─────────────────────────────────────────

const getTournamentStats = async ({ tournamentId }) => {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const matchIds = matches.map(m => m.id);
  if (matchIds.length === 0) {
    return { mostRuns: [], mostWickets: [], bestStrikeRate: [], bestEconomy: [], mostSixes: [], mostFours: [] };
  }

  const [batting, outs, bowling] = await Promise.all([
    prisma.batsmanInnings.groupBy({
      by: ["playerId", "teamId"],
      where: { matchId: { in: matchIds }, didNotBat: false },
      _sum: { runs: true, ballsFaced: true, fours: true, sixes: true },
      _count: { _all: true },
    }),
    prisma.batsmanInnings.groupBy({
      by: ["playerId"],
      where: { matchId: { in: matchIds }, isOut: true },
      _count: { _all: true },
    }),
    prisma.bowlerInnings.groupBy({
      by: ["playerId", "teamId"],
      where: { matchId: { in: matchIds } },
      _sum: { balls: true, runs: true, wickets: true },
      _count: { _all: true },
    }),
  ]);

  const outsMap = Object.fromEntries(outs.map(o => [o.playerId, o._count._all]));

  // Resolve player + team names
  const playerIds = new Set([...batting.map(b => b.playerId), ...bowling.map(b => b.playerId)]);
  const teamIds   = new Set([...batting.map(b => b.teamId),   ...bowling.map(b => b.teamId)]);
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: [...playerIds] } }, select: { id: true, name: true, photo: true } }),
    prisma.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id: true, name: true } }),
  ]);
  const pMap = Object.fromEntries(players.map(p => [p.id, p]));
  const tMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const batRows = batting.map(b => {
    const runs = b._sum.runs || 0;
    const balls = b._sum.ballsFaced || 0;
    const dismissals = outsMap[b.playerId] || 0;
    return {
      playerId: b.playerId,
      name: pMap[b.playerId]?.name || "Unknown",
      photo: pMap[b.playerId]?.photo || null,
      teamId: b.teamId,
      teamName: tMap[b.teamId] || "",
      innings: b._count._all,
      runs,
      balls,
      fours: b._sum.fours || 0,
      sixes: b._sum.sixes || 0,
      strikeRate: balls > 0 ? +((runs / balls) * 100).toFixed(1) : 0,
      average: dismissals > 0 ? +(runs / dismissals).toFixed(1) : null, // null = not out enough times
      notOuts: b._count._all - dismissals,
    };
  });

  const bowlRows = bowling.map(b => {
    const balls = b._sum.balls || 0;
    const runs = b._sum.runs || 0;
    const wickets = b._sum.wickets || 0;
    return {
      playerId: b.playerId,
      name: pMap[b.playerId]?.name || "Unknown",
      photo: pMap[b.playerId]?.photo || null,
      teamId: b.teamId,
      teamName: tMap[b.teamId] || "",
      innings: b._count._all,
      balls,
      overs: Math.floor(balls / 6) + (balls % 6) / 10, // display float e.g. 3.4
      runs,
      wickets,
      economy: balls > 0 ? +((runs / balls) * 6).toFixed(2) : 0,
      bowlingAvg: wickets > 0 ? +(runs / wickets).toFixed(1) : null,
    };
  });

  return {
    mostRuns:       [...batRows].sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate).slice(0, 20),
    mostWickets:    [...bowlRows].filter(r => r.wickets > 0 || r.balls > 0).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy).slice(0, 20),
    bestStrikeRate: [...batRows].filter(r => r.balls >= 20).sort((a, b) => b.strikeRate - a.strikeRate).slice(0, 20),
    bestEconomy:    [...bowlRows].filter(r => r.balls >= 36).sort((a, b) => a.economy - b.economy).slice(0, 20),
    mostSixes:      [...batRows].filter(r => r.sixes > 0).sort((a, b) => b.sixes - a.sixes).slice(0, 20),
    mostFours:      [...batRows].filter(r => r.fours > 0).sort((a, b) => b.fours - a.fours).slice(0, 20),
  };
};

// ─── Ball-by-ball commentary feed ────────────────────────────────────────────

const getCommentary = async ({ matchId }) => {
  const innings = await prisma.innings.findMany({
    where: { matchId },
    orderBy: { inningsNumber: "asc" },
    include: { battingTeam: { select: { id: true, name: true } } },
  });

  const balls = await prisma.ballEvent.findMany({
    where: { matchId },
    orderBy: [{ inningsNumber: "desc" }, { createdAt: "desc" }],
  });

  const playerIds = new Set();
  balls.forEach(b => {
    playerIds.add(b.batsmanId);
    playerIds.add(b.bowlerId);
    if (b.outBatsmanId) playerIds.add(b.outBatsmanId);
    if (b.fielderId) playerIds.add(b.fielderId);
  });
  const players = await prisma.player.findMany({
    where: { id: { in: [...playerIds] } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  return { innings, balls, nameMap };
};

module.exports = { startInnings, recordBall, undoLastBall, addBatsman, setBowler, getLiveState, getScorecard, getTournamentStats, getCommentary };
