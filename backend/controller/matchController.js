const matchService = require("../services/matchService");
const { sendSuccess, sendError } = require("../utils");

const getMatches = async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const data = await matchService.getMatches({ tournamentId });
    return sendSuccess(res, 200, "Matches fetched", data);
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const getMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return sendError(res, 400, "matchId required");
    const data = await matchService.getMatch({ matchId });
    return data ? sendSuccess(res, 200, "Match fetched", data) : sendError(res, 404, "Not found");
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const createMatch = async (req, res) => {
  try {
    const { tournamentId, teamAId, teamBId } = req.body;
    if (!tournamentId || !teamAId || !teamBId) return sendError(res, 400, "tournamentId, teamAId, teamBId required");
    const data = await matchService.createMatch(req.body);
    return sendSuccess(res, 201, "Match created", data);
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const updateMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return sendError(res, 400, "matchId required");
    const data = await matchService.updateMatch(req.body);
    return sendSuccess(res, 200, "Match updated", data);
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const deleteMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return sendError(res, 400, "matchId required");
    await matchService.deleteMatch({ matchId });
    return sendSuccess(res, 200, "Match deleted");
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const saveInnings = async (req, res) => {
  try {
    const { matchId, inningsNumber, battingTeamId } = req.body;
    if (!matchId || !inningsNumber || !battingTeamId) return sendError(res, 400, "matchId, inningsNumber, battingTeamId required");
    const data = await matchService.saveInnings(req.body);
    return sendSuccess(res, 200, "Innings saved", data);
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const completeMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return sendError(res, 400, "matchId required");
    const data = await matchService.completeMatch({ matchId });
    return sendSuccess(res, 200, "Match completed", data);
  } catch (err) { return sendError(res, 500, err.message || "Failed"); }
};

const getPointsTable = async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) return sendError(res, 400, "tournamentId required");
    const data = await matchService.getPointsTable({ tournamentId });
    return sendSuccess(res, 200, "Points table", data);
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

const bulkCreateMatches = async (req, res) => {
  try {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) return sendError(res, 400, "matches array required");
    const data = await matchService.bulkCreateMatches(matches);
    return sendSuccess(res, 201, `${data.length} matches created`, data);
  } catch (err) { return sendError(res, 500, "Failed", err); }
};

module.exports = { getMatches, getMatch, createMatch, updateMatch, deleteMatch, saveInnings, completeMatch, getPointsTable, bulkCreateMatches };
