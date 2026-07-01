const express = require('express');
const router = express.Router();

// Import all route modules
const userRouter = require('./userRoutes');
const tournamentRouter = require('./tournamentRoutes');
const teamRouter = require('./teamRoutes');
const playerRouter = require('./playerRoutes');
const auctionRouter = require('./auctionRoutes');
const whatsappRouter = require('./whatsappRoutes');
const eventRouter = require('./eventRoutes');
const auctionLogRouter = require('./auctionLogRoutes');
const backupRouter = require('./backupRoutes');
const matchRouter   = require('./matchRoutes');
const scoringRouter = require('./scoringRoutes');
const playerProfileRouter = require('./playerProfileRoutes');

// Mount routes with their base paths
router.use("/user", userRouter);
router.use("/tournament", tournamentRouter);
router.use("/team", teamRouter);
router.use("/player", playerRouter);
router.use("/player-profile", playerProfileRouter);
router.use("/auction", auctionRouter);
router.use("/whatsapp", whatsappRouter);
router.use("/event", eventRouter);
router.use("/auction-log", auctionLogRouter);
router.use("/backup", backupRouter);
router.use("/match", matchRouter);
router.use("/scoring", scoringRouter);

module.exports = router;
