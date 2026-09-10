const express = require('express');
const userController = require('../controller/userController');
const { authMiddleware, roleMiddleware } = require('../utils/authMiddleware');
const userRouter = express.Router();

// User Login (public)
userRouter.post("/login", userController.loginUser);

// Sign in with Google (public) — matches an existing user, never creates one
userRouter.post("/google-login", userController.googleLoginUser);

// Create User - Protected
userRouter.post("/create", authMiddleware, userController.createUser);

// Find someone to grant access to - boss/super_user only
userRouter.get("/search", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.searchUsers);

// Grant/change a role and a host's tournaments - boss/super_user only
userRouter.post("/set-access", authMiddleware, roleMiddleware(['boss', 'super_user']), userController.setUserAccess);

// End the current session - Protected
userRouter.post("/logout", authMiddleware, userController.logoutUser);

// Get User Details - Protected
userRouter.post("/detail", authMiddleware, userController.getUserDetail);

// Get Users Created by a User - Protected
userRouter.post("/my-users", authMiddleware, userController.getUsersByCreator);

// Get Users in Hierarchy (created by user and their descendants) - Protected
userRouter.post("/hierarchy", authMiddleware, userController.getUsersInHierarchy);

// Get All Users (boss only) - Protected
userRouter.post("/all", authMiddleware, userController.getAllUsers);

// Update User - Protected
userRouter.post("/update", authMiddleware, userController.updateUser);

// Delete/Deactivate User - Protected
userRouter.post("/delete", authMiddleware, userController.deleteUser);

module.exports = userRouter;
