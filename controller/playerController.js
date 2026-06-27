const { Schema, default: mongoose } = require("mongoose");
const players = require("../models/players");
const team = require("../models/team");

const playersService = require("../services/playerService");
const { sendSuccess, sendError } = require("../utils");


const registerPlayer = async (req, res) => {
    try {
        const player = await playersService.registerPlayer(req.body);
        return sendSuccess(res, 201, "Player registered successfully!", player)
    } catch (error) {
        return sendError(res, 400, "Failed to register player!", error)
    }
}

const allPlayerDetails = async (req, res) => {
    try {
        const playerDetails = await playersService.allPlayerDetails(req.body.touranmentId);
        return sendSuccess(res, 200, "All player details fetched successfully!", playerDetails)
    } catch (error) {
        return sendError(res, 400, "Failed to fetch player details!", error)
    }
};

const getPlayerDetail = async (req, res) => {
    try {
        const playerDetail = await playersService.getPlayerDetail(req.body.playerId);
        return sendSuccess(res, 200, "Player detail fetched successfully!", playerDetail)
    } catch (error) {
        return sendError(res, 400, "Failed to fetch player detail!", error)
    }
};

const updatePlayer = async (req, res) => {
    try {
        const updatedPlayer = await playersService.updatePlayer(req.body);
        return sendSuccess(res, 200, "Player updated successfully", updatedPlayer);
    } catch (error) {
        return sendError(res, 400, "Failed to update player!", error);
    }
};

const deletePlayer = async (req, res) => {
    try {
        const deletedPlayer = await playersService.deletePlayer(req.body.playerId);
        return sendSuccess(res, 200, "Player deleted successfully", deletedPlayer);
    } catch (error) {
        return sendError(res, 400, "Failed to delete player!", error);
    }
};

const getPlayerCategories = async (req, res) => {
    try {
        const categories = await playersService.getPlayerCategories(req.body.touranmentId);
        return sendSuccess(res, 200, "Player categories fetched successfully", categories);
    } catch (error) {
        return sendError(res, 400, "Failed to get player categories!", error);
    }
};

const bulkCreatePlayers = async (req, res) => {
    try {
        const result = await playersService.bulkCreatePlayers(req.body.players, req.body.touranmentId);
        return sendSuccess(res, 201, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to create players!", error);
    }
};

const resetUnsoldPlayers = async (req, res) => {
    try {
        const result = await playersService.resetUnsoldPlayers(req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to reset unsold players!", error);
    }
};

const deleteAllPlayers = async (req, res) => {
    try {
        const result = await playersService.deleteAllPlayersByTournament(req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to delete players!", error);
    }
};

const bulkUpdatePlayers = async (req, res) => {
    try {
        const result = await playersService.bulkUpdatePlayers(req.body.players, req.body.touranmentId);
        return sendSuccess(res, 200, result.message, result);
    } catch (error) {
        return sendError(res, 400, "Failed to update players!", error);
    }
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
    deleteAllPlayers,
    bulkUpdatePlayers
};