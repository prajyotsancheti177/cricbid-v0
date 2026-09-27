const express = require('express');
const controller = require('../controller/agentRequestController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireRunnerToken } = require('../utils/runnerAuth');

const agentRequestRouter = express.Router();

/**
 * The Assistant queue.
 *
 * Website side — boss and super_user only. A request can trigger data changes
 * and code changes, so it is not something a tournament host is given.
 */
const admin = [authMiddleware, roleMiddleware(['boss', 'super_user'])];

agentRequestRouter.post("/create", ...admin, controller.createRequest);
agentRequestRouter.post("/list", ...admin, controller.listRequests);
agentRequestRouter.post("/detail", ...admin, controller.getRequest);
agentRequestRouter.post("/decide", ...admin, controller.decideRequest);
agentRequestRouter.post("/cancel", ...admin, controller.cancelRequest);

/**
 * Runner side — a shared token, because the runner is a machine with no
 * session. It can only move work through the queue: claim, attach a plan,
 * report an outcome. It can never approve anything; that is a person's job and
 * needs a real login.
 */
agentRequestRouter.post("/runner/claim", requireRunnerToken, controller.claimNext);
agentRequestRouter.post("/runner/plan", requireRunnerToken, controller.submitPlan);
agentRequestRouter.post("/runner/result", requireRunnerToken, controller.submitResult);
agentRequestRouter.post("/runner/fail", requireRunnerToken, controller.reportFailure);

module.exports = agentRequestRouter;
