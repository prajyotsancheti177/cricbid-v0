const express = require('express');
const userController = require('../controller/userController');
const { authMiddleware } = require('../utils/authMiddleware');
const userRouter = express.Router();

// User Login (public)
userRouter.post("/login", userController.loginUser);

// Create User - Protected
userRouter.post("/create", authMiddleware, userController.createUser);

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
