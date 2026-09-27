const agentRequestService = require('../services/agentRequestService');
const { sendSuccess, sendError } = require('../utils');

/**
 * The Assistant queue.
 *
 * Two audiences: admins on the website, who type requests and answer plans,
 * and the runner, which claims work and reports back. They authenticate
 * differently — see agentRequestRoutes.js — but both end up here.
 */

const createRequest = async (req, res) => {
    try {
        const request = await agentRequestService.create({
            requestText: req.body.requestText,
            tournamentId: req.body.tournamentId,
            userId: req.userId,
        });
        return sendSuccess(res, 201, "Request queued", request);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not queue that request", error);
    }
};

const listRequests = async (req, res) => {
    try {
        const requests = await agentRequestService.list({
            limit: req.body.limit,
            tournamentId: req.body.tournamentId,
        });
        return sendSuccess(res, 200, `${requests.length} request(s)`, requests);
    } catch (error) {
        return sendError(res, 400, "Could not load requests", error);
    }
};

const getRequest = async (req, res) => {
    try {
        const request = await agentRequestService.detail(req.body.requestId || req.params.id);
        return sendSuccess(res, 200, "Request", request);
    } catch (error) {
        return sendError(res, 404, error.message || "Request not found", error);
    }
};

const decideRequest = async (req, res) => {
    try {
        const request = await agentRequestService.decide(req.body.requestId, {
            approve: req.body.approve === true,
            userId: req.userId,
        });
        return sendSuccess(res, 200, request.status === 'approved' ? "Approved" : "Rejected", request);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not answer that plan", error);
    }
};

const cancelRequest = async (req, res) => {
    try {
        const request = await agentRequestService.cancel(req.body.requestId);
        return sendSuccess(res, 200, "Cancelled", request);
    } catch (error) {
        return sendError(res, 400, error.message || "Could not cancel", error);
    }
};

/* ---------------------------------------------------------------- runner --- */

const claimNext = async (req, res) => {
    try {
        const mode = req.body.mode === 'execute' ? 'execute' : 'plan';
        const request = await agentRequestService.claimNext(mode);
        return sendSuccess(res, 200, request ? "Claimed" : "Nothing to do", request);
    } catch (error) {
        return sendError(res, 400, "Could not claim work", error);
    }
};

const submitPlan = async (req, res) => {
    try {
        const request = await agentRequestService.attachPlan(req.body.requestId, {
            plan: req.body.plan,
            kind: req.body.kind,
        });
        return sendSuccess(res, 200, "Plan attached", request);
    } catch (error) {
        return sendError(res, 400, "Could not attach the plan", error);
    }
};

const submitResult = async (req, res) => {
    try {
        const request = await agentRequestService.finish(req.body.requestId, {
            result: req.body.result,
            error: req.body.error,
        });
        return sendSuccess(res, 200, "Result recorded", request);
    } catch (error) {
        return sendError(res, 400, "Could not record the result", error);
    }
};

const reportFailure = async (req, res) => {
    try {
        const request = await agentRequestService.fail(req.body.requestId, req.body.error);
        return sendSuccess(res, 200, "Marked failed", request);
    } catch (error) {
        return sendError(res, 400, "Could not mark it failed", error);
    }
};

module.exports = {
    createRequest,
    listRequests,
    getRequest,
    decideRequest,
    cancelRequest,
    claimNext,
    submitPlan,
    submitResult,
    reportFailure,
};
