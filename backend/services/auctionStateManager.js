/**
 * Auction State Manager
 * In-memory state management for active auctions
 * Each tournament can have one active auction session
 */

// Store active auctions by tournamentId
const activeAuctions = new Map();

/**
 * Create or get an auction session for a tournament
 */
const getOrCreateAuction = (tournamentId) => {
  if (!activeAuctions.has(tournamentId)) {
    activeAuctions.set(tournamentId, {
      tournamentId,
      isActive: false,
      auctionMode: null, // 'category' | 'manual'
      selectedCategory: null,
      currentPlayer: null,
      currentBid: 0,
      leadingTeam: null,
      bidHistory: [],
      teamBids: {}, // { teamId: lastBidAmount }
      teams: [],
      playerNumber: 1,
      bidPrice: 0, // Current increment
      auctioneerSocketId: null,
      auctioneerUserId: null, // Track by User ID for reconnection
      bidIncrementSlabs: [],
      connectedViewers: new Set()
    });
  }
  return activeAuctions.get(tournamentId);
};

/**
 * Get auction state (safe copy without socket-specific data)
 */
const getAuctionState = (tournamentId) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction) return null;

  return {
    tournamentId: auction.tournamentId,
    isActive: auction.isActive,
    auctionMode: auction.auctionMode,
    selectedCategory: auction.selectedCategory,
    currentPlayer: auction.currentPlayer,
    currentBid: auction.currentBid,
    leadingTeam: auction.leadingTeam,
    teamBids: auction.teamBids,
    teams: auction.teams,
    playerNumber: auction.playerNumber,
    bidPrice: auction.bidPrice,
    hasAuctioneer: !!auction.auctioneerSocketId,
    viewerCount: auction.connectedViewers.size
  };
};

/**
 * Set auctioneer for a tournament
 */
const setAuctioneer = (tournamentId, socketId, userId) => {
  const auction = getOrCreateAuction(tournamentId);

  // If already has auctioneer, check if it's the same user trying to reconnect
  if (auction.auctioneerSocketId && auction.auctioneerSocketId !== socketId) {
    if (userId && auction.auctioneerUserId === userId) {
      // Reconnecting same user
      auction.auctioneerSocketId = socketId;
      return { success: true };
    }
    return { success: false, error: "Another user is already conducting this auction" };
  }

  auction.auctioneerSocketId = socketId;
  auction.auctioneerUserId = userId;
  auction.isActive = true;
  return { success: true };
};

/**
 * Check if a socket is the auctioneer
 */
const isAuctioneer = (tournamentId, socketId) => {
  const auction = activeAuctions.get(tournamentId);
  return auction && auction.auctioneerSocketId === socketId;
};

/**
 * Add a viewer to the auction
 */
const addViewer = (tournamentId, socketId) => {
  const auction = getOrCreateAuction(tournamentId);
  auction.connectedViewers.add(socketId);
  return auction.connectedViewers.size;
};

/**
 * Remove a viewer from the auction
 */
const removeViewer = (tournamentId, socketId) => {
  const auction = activeAuctions.get(tournamentId);
  if (auction) {
    auction.connectedViewers.delete(socketId);

    // If the auctioneer disconnected, clear the auctioneer
    if (auction.auctioneerSocketId === socketId) {
      auction.auctioneerSocketId = null;
      // Keep state but mark as paused
      console.log(`Auctioneer disconnected from tournament ${tournamentId}`);
    }

    return auction.connectedViewers.size;
  }
  return 0;
};

/**
 * Start auction with player selection
 */
const startAuction = (tournamentId, { mode, category, teams, bidIncrementSlabs }) => {
  const auction = getOrCreateAuction(tournamentId);
  auction.isActive = true;
  auction.auctionMode = mode;
  auction.selectedCategory = category || null;
  auction.teams = teams || [];
  auction.bidIncrementSlabs = bidIncrementSlabs || [];
  auction.playerNumber = 1;
  return auction;
};

/**
 * Select a player for auction
 */
const selectPlayer = (tournamentId, player, bidIncrementSlabs) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction) return { success: false, error: "Auction not found" };

  auction.currentPlayer = player;
  auction.currentBid = player.basePrice || 0;
  auction.leadingTeam = null;
  auction.teamBids = {};
  auction.bidHistory = [];
  auction.bidOrder = 0; // Reset bid order counter

  // Set initial bid increment
  if (bidIncrementSlabs && bidIncrementSlabs.length > 0) {
    const slab = bidIncrementSlabs.find(s =>
      auction.currentBid >= s.minBid &&
      (s.maxBid === null || auction.currentBid <= s.maxBid)
    );
    auction.bidPrice = slab ? slab.increment : 100;
  } else {
    auction.bidPrice = 100;
  }

  return { success: true, state: getAuctionState(tournamentId) };
};

/**
 * Get current bid increment based on bid amount
 */
const getCurrentBidIncrement = (tournamentId, bidAmount) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction || !auction.bidIncrementSlabs.length) return 100;

  const slab = auction.bidIncrementSlabs.find(s =>
    bidAmount >= s.minBid &&
    (s.maxBid === null || bidAmount <= s.maxBid)
  );

  return slab ? slab.increment : 100;
};

/**
 * Place a bid
 */
const placeBid = (tournamentId, teamId, teams) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction || !auction.currentPlayer) {
    return { success: false, error: "No active auction or player" };
  }

  const team = teams.find(t => t._id === teamId);
  if (!team) {
    return { success: false, error: "Team not found" };
  }

  // Calculate new bid
  let newBid;
  if (auction.leadingTeam === null) {
    // First bid - use base price
    newBid = auction.currentBid;
  } else {
    // Subsequent bid
    newBid = auction.currentBid + auction.bidPrice;
  }

  // Note: Budget, max biddable, and slot checks are intentionally removed.
  // The frontend highlights teams as warnings but bidding is never blocked.

  // Increment bid order
  auction.bidOrder = (auction.bidOrder || 0) + 1;

  // Save to history with proper format for auction log
  auction.bidHistory.push({
    teamId: teamId,
    teamName: team.name,
    bidAmount: newBid,
    bidIncrement: auction.bidPrice,
    bidOrder: auction.bidOrder,
    timestamp: new Date()
  });

  // Update state
  auction.currentBid = newBid;
  auction.leadingTeam = teamId;
  auction.teamBids[teamId] = newBid;

  // Calculate next increment
  auction.bidPrice = getCurrentBidIncrement(tournamentId, newBid);

  return {
    success: true,
    state: getAuctionState(tournamentId),
    newBid,
    teamName: team.name
  };
};

/**
 * Undo last bid
 */
const undoBid = (tournamentId) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction || auction.bidHistory.length === 0) {
    return { success: false, error: "No bids to undo" };
  }

  // Remove the last bid
  const removedBid = auction.bidHistory.pop();
  auction.bidOrder = (auction.bidOrder || 1) - 1;

  // Rebuild teamBids map
  auction.teamBids = {};
  auction.bidHistory.forEach(bid => {
    auction.teamBids[bid.teamId] = bid.bidAmount;
  });

  // Restore state from previous bid or reset to base price
  if (auction.bidHistory.length > 0) {
    const previousBid = auction.bidHistory[auction.bidHistory.length - 1];
    auction.currentBid = previousBid.bidAmount;
    auction.leadingTeam = previousBid.teamId;
    auction.bidPrice = getCurrentBidIncrement(tournamentId, auction.currentBid);
  } else {
    // No more bids, reset to base price
    auction.currentBid = auction.currentPlayer?.basePrice || 0;
    auction.leadingTeam = null;
    auction.bidPrice = getCurrentBidIncrement(tournamentId, auction.currentBid);
  }

  return {
    success: true,
    state: getAuctionState(tournamentId)
  };
};

/**
 * Mark player as sold
 */
const markSold = (tournamentId) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction || !auction.currentPlayer || !auction.leadingTeam) {
    return { success: false, error: "Cannot mark sold - no leading team" };
  }

  const result = {
    success: true,
    player: auction.currentPlayer,
    teamId: auction.leadingTeam,
    team: auction.teams.find(t => t._id === auction.leadingTeam),
    amount: auction.currentBid,
    bids: [...auction.bidHistory] // Return copy of bid history
  };

  // Update the winning team's stats in-memory
  const winningTeam = auction.teams.find(t => t._id === result.teamId);
  if (winningTeam) {
    winningTeam.playersCount = (winningTeam.playersCount || 0) + 1;
    winningTeam.remainingBudget = (winningTeam.remainingBudget || 0) - result.amount;
  }

  // Increment player number
  auction.playerNumber++;

  // Clear current player state (will be set by next selectPlayer)
  auction.currentPlayer = null;
  auction.currentBid = 0;
  auction.leadingTeam = null;
  auction.teamBids = {};
  auction.bidHistory = [];

  return result;
};

/**
 * Mark player as unsold
 */
const markUnsold = (tournamentId) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction || !auction.currentPlayer) {
    return { success: false, error: "No player to mark unsold" };
  }

  const result = {
    success: true,
    player: auction.currentPlayer,
    bids: [...auction.bidHistory]
  };

  // Increment player number
  auction.playerNumber++;

  // Clear current player state
  auction.currentPlayer = null;
  auction.currentBid = 0;
  auction.leadingTeam = null;
  auction.teamBids = {};
  auction.bidHistory = [];

  return result;
};

/**
 * Update teams data
 */
const updateTeams = (tournamentId, teams) => {
  const auction = activeAuctions.get(tournamentId);
  if (auction) {
    auction.teams = teams;
  }
};

/**
 * Update bid increment slabs mid-auction (live)
 */
const updateBidIncrementSlabs = (tournamentId, slabs) => {
  const auction = activeAuctions.get(tournamentId);
  if (!auction) return { success: false, error: "Auction not found" };

  auction.bidIncrementSlabs = slabs || [];

  // Recalculate current bidPrice based on new slabs
  if (auction.currentPlayer && auction.currentBid > 0) {
    auction.bidPrice = getCurrentBidIncrement(tournamentId, auction.currentBid);
  }

  return { success: true, state: getAuctionState(tournamentId) };
};

/**
 * End auction session
 */
const endAuction = (tournamentId) => {
  const auction = activeAuctions.get(tournamentId);
  if (auction) {
    auction.isActive = false;
    auction.auctioneerSocketId = null;
  }
};

/**
 * Clean up auction (remove from memory)
 */
const cleanupAuction = (tournamentId) => {
  activeAuctions.delete(tournamentId);
};

/**
 * Get all active auctions metadata
 */
const getAllActiveAuctions = () => {
  // console.log("Getting all active auctions. Total in map:", activeAuctions.size);
  const auctions = [];
  for (const [tournamentId, auction] of activeAuctions.entries()) {
    // console.log(`Checking auction ${tournamentId}: isActive=${auction.isActive}`);
    if (auction.isActive) {
      auctions.push({
        tournamentId: auction.tournamentId,
        viewerCount: auction.connectedViewers.size,
        hasAuctioneer: !!auction.auctioneerSocketId,
        creationTime: Date.now() // or store creation time in state
      });
    }
  }
  return auctions;
};

module.exports = {
  getOrCreateAuction,
  getAuctionState,
  setAuctioneer,
  isAuctioneer,
  addViewer,
  removeViewer,
  startAuction,
  selectPlayer,
  placeBid,
  undoBid,
  markSold,
  markUnsold,
  updateTeams,
  endAuction,
  cleanupAuction,
  getCurrentBidIncrement,
  getAllActiveAuctions,
  updateBidIncrementSlabs
};
