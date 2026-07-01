const scoringService = require("../services/scoringService");
const { sendSuccess, sendError } = require("../utils");

const startInnings = async (req, res) => {
  try {
    const { matchId, inningsNumber, battingTeamId, striker1Id, striker2Id, openingBowlerId } = req.body;
    if (!matchId || !inningsNumber || !battingTeamId || !striker1Id || !striker2Id || !openingBowlerId)
      return sendError(res, 400, "matchId, inningsNumber, battingTeamId, striker1Id, striker2Id, openingBowlerId required");
    const data = await scoringService.startInnings(req.body);
    return sendSuccess(res, 201, "Innings started", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const recordBall = async (req, res) => {
  try {
    const { matchId, inningsNumber, batsmanId, bowlerId } = req.body;
    if (!matchId || !inningsNumber || !batsmanId || !bowlerId)
      return sendError(res, 400, "matchId, inningsNumber, batsmanId, bowlerId required");
    const data = await scoringService.recordBall(req.body);
    // Emit via socket if available
    const io = req.app.get("io");
    if (io) io.to(`scoring:${matchId}`).emit("scoring:ball", data);
    return sendSuccess(res, 200, "Ball recorded", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const undoLastBall = async (req, res) => {
  try {
    const { matchId, inningsNumber } = req.body;
    if (!matchId || !inningsNumber) return sendError(res, 400, "matchId, inningsNumber required");
    const data = await scoringService.undoLastBall({ matchId, inningsNumber });
    const io = req.app.get("io");
    if (io) io.to(`scoring:${matchId}`).emit("scoring:undo", data);
    return sendSuccess(res, 200, "Undone", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const addBatsman = async (req, res) => {
  try {
    const { matchId, inningsNumber, playerId, teamId, battingOrder } = req.body;
    if (!matchId || !inningsNumber || !playerId || !teamId)
      return sendError(res, 400, "matchId, inningsNumber, playerId, teamId required");
    const data = await scoringService.addBatsman(req.body);
    return sendSuccess(res, 200, "Batsman added", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const setBowler = async (req, res) => {
  try {
    const { matchId, inningsNumber, playerId, teamId } = req.body;
    if (!matchId || !inningsNumber || !playerId || !teamId)
      return sendError(res, 400, "matchId, inningsNumber, playerId, teamId required");
    const data = await scoringService.setBowler(req.body);
    return sendSuccess(res, 200, "Bowler set", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const getLiveState = async (req, res) => {
  try {
    const { matchId, inningsNumber } = req.body;
    if (!matchId || !inningsNumber) return sendError(res, 400, "matchId, inningsNumber required");
    const data = await scoringService.getLiveState({ matchId, inningsNumber });
    return data ? sendSuccess(res, 200, "Live state", data) : sendError(res, 404, "Innings not started");
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const getScorecard = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return sendError(res, 400, "matchId required");
    const data = await scoringService.getScorecard({ matchId });
    return sendSuccess(res, 200, "Scorecard", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const getTournamentStats = async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const data = await scoringService.getTournamentStats({ tournamentId });
    return sendSuccess(res, 200, "Stats", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const getCommentary = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return sendError(res, 400, "matchId required");
    const data = await scoringService.getCommentary({ matchId });
    return sendSuccess(res, 200, "Commentary", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

module.exports = { startInnings, recordBall, undoLastBall, addBatsman, setBowler, getLiveState, getScorecard, getTournamentStats, getCommentary };
