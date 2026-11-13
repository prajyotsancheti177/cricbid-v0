const plannerService = require("../services/plannerService");
const { sendSuccess, sendError } = require("../utils");

// Owner-facing calls are authorised by the team token in the body and nothing
// else, so the message on a bad token must not distinguish "no such token" from
// "not your team". plannerService raises the same error for both.
const getBoard = async (req, res) => {
    try {
        const board = await plannerService.getBoard(req.body.token);
        return sendSuccess(res, 200, "Plan fetched successfully", board);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to fetch plan", error);
    }
};

const addPick = async (req, res) => {
    try {
        const board = await plannerService.addPick(req.body);
        return sendSuccess(res, 200, "Added to your plan", board);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to add that player", error);
    }
};

const setPickAmount = async (req, res) => {
    try {
        const board = await plannerService.setPickAmount(req.body);
        return sendSuccess(res, 200, "Plan updated", board);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to update that player", error);
    }
};

const removePick = async (req, res) => {
    try {
        const board = await plannerService.removePick(req.body);
        return sendSuccess(res, 200, "Removed from your plan", board);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to remove that player", error);
    }
};

const reorderCategory = async (req, res) => {
    try {
        const board = await plannerService.reorderCategory(req.body);
        return sendSuccess(res, 200, "Order updated", board);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to reorder your plan", error);
    }
};

const getLinks = async (req, res) => {
    try {
        const links = await plannerService.listPlannerLinks({ tournamentId: req.body.tournamentId });
        return sendSuccess(res, 200, "Planner links fetched successfully", links);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to fetch planner links", error);
    }
};

const resetLink = async (req, res) => {
    try {
        const link = await plannerService.resetPlannerToken({ teamId: req.body.teamId });
        return sendSuccess(res, 200, "Planner link reset successfully", link);
    } catch (error) {
        return sendError(res, 400, error.message || "Failed to reset that planner link", error);
    }
};

module.exports = { getBoard, addPick, setPickAmount, removePick, reorderCategory, getLinks, resetLink };
