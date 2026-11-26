const express = require('express');
const userController = require('../controller/userController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const { passwordLoginLimits, googleLoginLimit } = require('../utils/rateLimit');
const userRouter = express.Router();

// User Login (public)
userRouter.post("/login", ...passwordLoginLimits, userController.loginUser);

// Sign in with Google (public)
userRouter.post("/google-login", googleLoginLimit, userController.googleLoginUser);

// Google redirect-mode sign-in: Google POSTs the credential here directly,
// so no popup and no window.opener handoff is involved. It answers with a
// one-time code, which the login page exchanges together with its nonce.
userRouter.post("/google-callback", googleLoginLimit, userController.googleCallback);
userRouter.post("/google-exchange", googleLoginLimit, userController.googleExchange);

// Link Google to the signed-in account (after a password sign-in proved it)
userRouter.post("/link-google", authMiddleware, googleLoginLimit, userController.linkGoogle);

// Clear someone's Google link so their next Google sign-in links afresh
userRouter.post("/unlink-google", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.unlinkGoogle);

// The devices this account is signed in on, and signing out of all of them
userRouter.get("/sessions", authMiddleware, userController.listSessions);
userRouter.post("/logout-all", authMiddleware, userController.logoutAll);

// Create User - Protected
userRouter.post("/create", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.createUser);

// Find someone to grant access to - boss/super_user only
userRouter.get("/search", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.searchUsers);

// Grant/change a role and a host's tournaments - boss/super_user only
userRouter.post("/set-access", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.setUserAccess);

// End the current session - Protected
userRouter.post("/logout", authMiddleware, userController.logoutUser);

// Get User Details - Protected
userRouter.post("/detail", authMiddleware, userController.getUserDetail);

// Get Users Created by a User - Protected
userRouter.post("/my-users", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.getUsersByCreator);

// Get Users in Hierarchy (created by user and their descendants) - Protected
userRouter.post("/hierarchy", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.getUsersInHierarchy);

// Get All Users (boss only) - Protected
userRouter.post("/all", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.getAllUsers);

// Update User - Protected
userRouter.post("/update", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.updateUser);

// Delete/Deactivate User - Protected
userRouter.post("/delete", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.deleteUser);

module.exports = userRouter;
