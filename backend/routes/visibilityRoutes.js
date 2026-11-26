const express = require('express');
const controller = require('../controller/visibilityController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { requireVisible } = require('../utils/requireVisible');

const visibilityRouter = express.Router();

// What the caller's own role sees (public: signed out sees nothing)
visibilityRouter.get("/me", controller.getMine);

// The control page. Super users may look (if the boss lets them see the page);
// only a boss may change anything (checked again in the service).
const viewers = [authMiddleware, roleMiddleware(['boss', 'super_user']), requireVisible('page.visibility')];
visibilityRouter.get("/matrix", viewers, controller.getMatrix);
visibilityRouter.get("/history", viewers, controller.getHistory);
visibilityRouter.put("/", authMiddleware, roleMiddleware(['boss']), controller.updateMatrix);

module.exports = visibilityRouter;
