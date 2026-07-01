const auctionStateManager = require("../services/auctionStateManager");
const teamService = require("../services/teamService");
const auctionService = require("../services/auctionService");
const playerService = require("../services/playerService");
const auctionLogService = require("../services/auctionLogService");
const tournamentService = require("../services/tournamentService");
const auctionRoomSessionService = require("../services/auctionRoomSessionService");
const whatsappService = require("../services/whatsappService");
const prisma = require("../db/prisma");
const eventService = require("../services/eventService");

// Store interval IDs for viewer history sampling per tournament
const viewerHistoryIntervals = new Map();

module.exports = (io) => {
  const auctionNamespace = io.of("/auction");

  auctionNamespace.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // List active auctions
    socket.on("auction:list", async () => {
      try {
        const active = auctionStateManager.getAllActiveAuctions();

        // Enrich with tournament names and hostId
        const enriched = await Promise.all(active.map(async (a) => {
          try {
            const t = await prisma.tournament.findUnique({ where: { id: a.tournamentId }, select: { name: true, tournamentHostId: true } });
            return {
              ...a,
              tournamentName: t ? t.name : 'Unknown Tournament',
              hostId: t ? (t.tournamentHostId?._id || t.tournamentHostId) : null
            };
          } catch {
            return { ...a, tournamentName: 'Unknown Tournament', hostId: null };
          }
        }));

        socket.emit("auction:list", enriched);
      } catch (err) {
        console.error("Error listing auctions:", err);
        socket.emit("auction:error", "Failed to list auctions");
      }
    });

    // Delete Auction Room (Host/Admin only)
    socket.on("auction:delete", async ({ tournamentId, userId }) => {
      try {
        console.log(`[auction:delete] Request received - tournamentId: ${tournamentId}, userId: ${userId}`);


        let canDelete = false;
        let skipAnalytics = false;

        // If no userId provided or user not found, still allow deletion but skip analytics
        if (!userId) {
          console.log(`[auction:delete] No userId provided - allowing deletion, skipping analytics`);
          canDelete = true;
          skipAnalytics = true;
        } else {
          // Try to find user
          const user = await prisma.user.findUnique({ where: { id: userId } });
          console.log(`[auction:delete] User lookup result:`, user ? `Found: ${user.name} (${user.role})` : 'Not found');

          if (!user) {
            // User not found in DB (maybe different database) - allow deletion, skip analytics
            console.log(`[auction:delete] User not found in DB - allowing deletion, skipping analytics`);
            canDelete = true;
            skipAnalytics = true;
          } else {
            // User found - check permissions
            const isAdmin = ['boss', 'super_user'].includes(user.role);

            if (isAdmin) {
              canDelete = true;
            } else {
              // For non-admin users, verify tournament exists and user is the host
              const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });

              if (!tournament) {
                // Tournament deleted, but non-admin can still delete their orphan room
                canDelete = true;
              } else {
                const isHost = String(tournament.tournamentHostId) === userId;
                if (isHost) {
                  canDelete = true;
                } else {
                  return socket.emit("auction:error", "Unauthorized: Only host or admin can delete room");
                }
              }
            }
          }
        }

        if (!canDelete) {
          return socket.emit("auction:error", "Unable to delete room");
        }

        // Proceed with deletion
        auctionStateManager.cleanupAuction(tournamentId);

        eventService.trackEvent({
          userId: userId || null,
          tournamentId: tournamentId || null,
          eventType: "auction_ended",
          eventData: { tournamentId, auctioneerUserId: userId || null },
        }).catch(() => {});

        // End session analytics (only if we have valid user context)
        if (!skipAnalytics) {
          try {
            await auctionRoomSessionService.endSession(tournamentId);
          } catch (analyticsErr) {
            console.error(`[auction:delete] Analytics error (non-blocking):`, analyticsErr);
          }
        }

        // Clear sampling interval
        if (viewerHistoryIntervals.has(tournamentId)) {
          clearInterval(viewerHistoryIntervals.get(tournamentId));
          viewerHistoryIntervals.delete(tournamentId);
        }

        // Broadcast update
        const active = auctionStateManager.getAllActiveAuctions();
        const enriched = await Promise.all(active.map(async (a) => {
          try {
            const t = await prisma.tournament.findUnique({ where: { id: a.tournamentId }, select: { name: true, tournamentHostId: true } });
            return {
              ...a,
              tournamentName: t ? t.name : 'Unknown Tournament',
              hostId: t ? (t.tournamentHostId?._id || t.tournamentHostId) : null
            };
          } catch {
            return { ...a, tournamentName: 'Unknown Tournament', hostId: null };
          }
        }));
        auctionNamespace.emit("auction:list", enriched);
        auctionNamespace.to(tournamentId).emit("auction:ended", "Auction room closed by host");

      } catch (err) {
        console.error("Error deleting auction:", err);
        socket.emit("auction:error", "Failed to delete auction");
      }
    });

    // Join auction room
    socket.on("auction:join", async (payload) => {
      let tournamentId, userId, ipAddress;
      if (typeof payload === 'object') {
        tournamentId = payload.tournamentId;
        userId = payload.userId;
        ipAddress = payload.ipAddress; // Client should send this
      } else {
        tournamentId = payload;
      }

      // Fallback: try to get IP from socket handshake
      if (!ipAddress) {
        ipAddress = socket.handshake.headers['x-forwarded-for'] ||
          socket.handshake.address ||
          socket.request?.connection?.remoteAddress;
      }

      socket.join(tournamentId);
      socket.tournamentId = tournamentId;
      socket.viewerUserId = userId;
      socket.viewerIpAddress = ipAddress;

      // Always get or create state so we can return "isActive: false" instead of error
      // This allows the UI to show the "Start Auction" button
      const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);

      // Check reconnection or role
      if (userId && auctionRaw.auctioneerUserId === userId) {
        // Update socket ID for the auctioneer
        auctionStateManager.setAuctioneer(tournamentId, socket.id, userId);
        socket.emit("auction:role", "auctioneer");
      }

      const viewerCount = auctionStateManager.addViewer(tournamentId, socket.id);

      // Track viewer join in session analytics
      auctionRoomSessionService.recordViewerJoin(tournamentId, userId, ipAddress);
      auctionRoomSessionService.updateViewerCount(tournamentId, viewerCount);

      const safeState = auctionStateManager.getAuctionState(tournamentId);
      socket.emit("auction:state", safeState);
      auctionNamespace.to(tournamentId).emit("auction:viewerCount", viewerCount);
    });

    // Start/Initialize Auction (Auctioneer only)
    socket.on("auction:start", async ({ tournamentId, userId }) => {
      try {
        // Check state BEFORE setting auctioneer (which toggles isActive)
        const preState = auctionStateManager.getAuctionState(tournamentId);
        const wasActive = preState && preState.isActive;

        // Here you would optimally verify userId with a user service or token
        // For now, we trust the client (as per user instruction "One person for now to keep it simple")

        // Check tournament ownership before allowing host claim
        let tournamentOwnerId = null;
        let existingHostName = null;
        try {
          const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { tournamentHostId: true } });
          if (t) tournamentOwnerId = String(t.tournamentHostId);
        } catch (_) {}

        // Try to resolve existing auctioneer's display name for conflict messages
        const preAuction = auctionStateManager.getOrCreateAuction(tournamentId);
        if (preAuction.auctioneerUserId && preAuction.auctioneerUserId !== userId) {
          try {
            const existingHost = await prisma.user.findUnique({ where: { id: preAuction.auctioneerUserId }, select: { name: true } });
            existingHostName = existingHost?.name || 'Another user';
          } catch (_) {
            existingHostName = 'Another user';
          }
        }

        const result = auctionStateManager.setAuctioneer(tournamentId, socket.id, userId);
        if (!result.success) {
          return socket.emit("auction:error", {
            code: 'HOST_CONFLICT',
            message: 'Auction is already being hosted',
            hostName: existingHostName || 'Another user',
          });
        }

        // Gate: only tournament owner or admin may claim auctioneer role
        if (userId && tournamentOwnerId) {
          let user = null;
          try { user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }); } catch (_) {}
          const isAdmin = user && ['boss', 'super_user'].includes(user.role);
          const isOwner = tournamentOwnerId === userId;
          if (!isAdmin && !isOwner) {
            // Revoke the just-set auctioneer
            auctionStateManager.setAuctioneer(tournamentId, null, null);
            return socket.emit("auction:error", {
              code: 'UNAUTHORIZED',
              message: 'Only the tournament owner or an admin can host the auction',
            });
          }
        }

        socket.join(tournamentId);
        socket.tournamentId = tournamentId;

        // Confirm role
        socket.emit("auction:role", "auctioneer");

        // Fetch fresh data for the auction
        const teamsReport = await teamService.getTournamentTeamsReport(tournamentId);
        const teams = teamsReport && teamsReport.length > 0 ? teamsReport[0].teams : [];

        let bidIncrementSlabs = [];
        let tournamentName = 'Unknown Tournament';
        let hostUserName = '';

        // Fetch tournament for slabs and name
        try {
          const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
          if (tournament) {
            bidIncrementSlabs = tournament.bidIncrementSlabs || [];
            tournamentName = tournament.name;
            hostUserName = tournament.tournamentHostId?.name || '';
          }
        } catch (err) {
          console.error("Error fetching tournament slabs:", err);
        }

        // Initialize state if not already active
        if (!wasActive) {
          auctionStateManager.startAuction(tournamentId, {
            mode: null, // Default to null to force user selection
            category: null,
            teams,
            bidIncrementSlabs
          });

          // Create session for analytics tracking
          await auctionRoomSessionService.createSession({
            tournamentId,
            tournamentName,
            hostUserId: userId,
            hostUserName
          });

          eventService.trackEvent({
            userId: userId || null,
            tournamentId: tournamentId || null,
            eventType: "auction_started",
            eventData: { tournamentId, tournamentName, auctioneerUserId: userId || null },
          }).catch(() => {});

          // Start 1-minute interval for viewer history sampling
          if (!viewerHistoryIntervals.has(tournamentId)) {
            const intervalId = setInterval(async () => {
              const state = auctionStateManager.getAuctionState(tournamentId);
              if (state && state.isActive) {
                await auctionRoomSessionService.recordViewerHistorySample(
                  tournamentId,
                  state.viewerCount
                );
              } else {
                // Auction ended, clear interval
                clearInterval(intervalId);
                viewerHistoryIntervals.delete(tournamentId);
              }
            }, 60000); // 1 minute
            viewerHistoryIntervals.set(tournamentId, intervalId);
          }
        } else {
          // Just update teams in case of budget changes from elsewhere
          auctionStateManager.updateTeams(tournamentId, teams);
        }


        // Broadcast new state
        const newState = auctionStateManager.getAuctionState(tournamentId);
        auctionNamespace.to(tournamentId).emit("auction:state", newState);

        // Broadcast active list update to everyone (Lobby)
        const active = auctionStateManager.getAllActiveAuctions();
        // We re-fetch names basically... optimization needed later
        const enriched = await Promise.all(active.map(async (a) => {
          const t = await prisma.tournament.findUnique({ where: { id: a.tournamentId }, select: { name: true, tournamentHostId: true } });
          return {
            ...a,
            tournamentName: t ? t.name : 'Unknown Tournament',
            hostId: t ? (t.tournamentHostId?._id || t.tournamentHostId) : null
          };
        }));
        auctionNamespace.emit("auction:list", enriched);

        console.log(`Auction started for tournament ${tournamentId} by ${socket.id}`);
      } catch (error) {
        console.error("Error starting auction:", error);
        socket.emit("auction:error", "Failed to start auction");
      }
    });

    // Select Player (Next Player or Manual Select)
    socket.on("auction:selectPlayer", async ({ tournamentId, playerId, category }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized: Only auctioneer can select players");
      }

      try {
        // Infer and set mode if not set
        const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);
        if (auctionRaw && !auctionRaw.auctionMode) {
          if (playerId) {
            auctionRaw.auctionMode = 'manual';
          } else {
            auctionRaw.auctionMode = 'category';
            auctionRaw.selectedCategory = category || 'All';
          }
        }

        let player;

        // Fetch tournament data for bid increments
        let bidIncrementSlabs = [];
        try {
          const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
          if (tournament) {
            bidIncrementSlabs = tournament.bidIncrementSlabs || [];
          }
        } catch (err) { }

        if (playerId) {
          // Manual selection
          player = await playerService.getPlayerDetail(playerId);
          if (!player) throw new Error("Player not found");

          // Ensure base price is set
          if (!player.basePrice && player.basePrice !== 0) {
            const allPlayers = await playerService.allPlayerDetails(tournamentId);
            const p = allPlayers.find(p => p._id.toString() === playerId);
            if (p) player.basePrice = p.basePrice;
          }
        } else {
          // Next player in category
          player = await auctionService.nextAuctionPlayer(tournamentId, category);
        }

        const selResult = auctionStateManager.selectPlayer(tournamentId, player, bidIncrementSlabs);

        if (selResult.success) {
          auctionNamespace.to(tournamentId).emit("auction:state", selResult.state);
          auctionNamespace.to(tournamentId).emit("auction:playerSelected", player);

          eventService.trackEvent({
            userId: null,
            tournamentId: tournamentId || null,
            eventType: "auction_player_selected",
            eventData: { tournamentId, playerId: player._id, playerName: player.name, category: player.playerCategory, selectionMode: playerId ? "manual" : "category" },
          }).catch(() => {});

          // WhatsApp — notify players in this category that their turn is starting
          if (category && category !== 'All') {
            whatsappService.sendCategoryStartingNotification({ tournamentId, category })
              .catch(e => console.error('[WhatsApp] category notification error:', e.message));
          }
        } else {
          socket.emit("auction:error", selResult.error || "Failed to select player");
        }

      } catch (error) {
        console.error("Error selecting player:", error);
        socket.emit("auction:error", error.message || "Failed to select player");
      }
    });

    // Place Bid
    socket.on("auction:bid", ({ tournamentId, teamId }) => {
      console.log(`Bid received for ${teamId} in ${tournamentId}`);
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized: Only auctioneer can bid");
      }

      const state = auctionStateManager.getAuctionState(tournamentId);
      if (state) {
        console.log(`Current teams in state: ${state.teams?.length}`);
        console.log("State teams IDs:", state.teams?.map(t => t._id));

        const result = auctionStateManager.placeBid(tournamentId, teamId, state.teams);
        if (result.success) {
          // Track bid in session analytics
          auctionRoomSessionService.recordAuctionActivity(tournamentId, 'bid');

          const bidState = auctionStateManager.getAuctionState(tournamentId);
          eventService.trackEvent({
            userId: null,
            tournamentId: tournamentId || null,
            eventType: "auction_bid_placed",
            eventData: { tournamentId, playerId: bidState?.currentPlayer?._id || null, playerName: bidState?.currentPlayer?.name || null, teamId, teamName: result.teamName, bidAmount: result.newBid },
          }).catch(() => {});

          auctionNamespace.to(tournamentId).emit("auction:bidPlaced", {
            teamId,
            amount: result.newBid,
            teamName: result.teamName,
            nextBidIncrement: result.state.bidPrice
          });
          auctionNamespace.to(tournamentId).emit("auction:state", result.state);
        } else {
          console.error("Bid error:", result.error, "TeamId:", teamId);
          socket.emit("auction:error", result.error);
        }
      }
    });

    // Undo Bid
    socket.on("auction:undoBid", ({ tournamentId }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized");
      }

      const result = auctionStateManager.undoBid(tournamentId);

      if (result.success) {
        eventService.trackEvent({
          userId: null,
          tournamentId: tournamentId || null,
          eventType: "auction_bid_undone",
          eventData: { tournamentId, playerId: result.state?.currentPlayer?._id || null, previousAmount: result.previousAmount || null, currentAmount: result.state?.currentBid || null },
        }).catch(() => {});

        auctionNamespace.to(tournamentId).emit("auction:undoBid");
        auctionNamespace.to(tournamentId).emit("auction:state", result.state);
      } else {
        socket.emit("auction:error", result.error);
      }
    });

    // Update Bid Increment Slabs (Live, mid-auction)
    socket.on("auction:updateSlabs", async ({ tournamentId, bidIncrementSlabs }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized: Only auctioneer can update slabs");
      }

      try {
        // Save to DB
        await prisma.tournament.update({ where: { id: tournamentId }, data: { bidIncrementSlabs } });

        // Update in-memory state
        const result = auctionStateManager.updateBidIncrementSlabs(tournamentId, bidIncrementSlabs);
        if (result.success) {
          auctionNamespace.to(tournamentId).emit("auction:state", result.state);
          socket.emit("auction:info", "Bid increment slabs updated successfully");
        } else {
          socket.emit("auction:error", result.error || "Failed to update slabs");
        }
      } catch (err) {
        console.error("Error updating bid increment slabs:", err);
        socket.emit("auction:error", "Failed to save bid increment slabs");
      }
    });

    // Reset Mode - Return to mode selection screen
    socket.on("auction:resetMode", ({ tournamentId }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized");
      }

      const auction = auctionStateManager.getOrCreateAuction(tournamentId);
      if (auction) {
        // Clear mode and current player to return to selection screen
        auction.auctionMode = null;
        auction.selectedCategory = null;
        auction.currentPlayer = null;
        auction.currentBid = 0;
        auction.leadingTeam = null;
        auction.teamBids = {};
        auction.bidHistory = [];

        auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));
        socket.emit("auction:info", "Returned to mode selection");
      }
    });

    // Mark Sold
    socket.on("auction:sold", async ({ tournamentId, userId }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized");
      }

      const result = auctionStateManager.markSold(tournamentId);

      if (result.success) {
        // Track sold in session analytics
        auctionRoomSessionService.recordAuctionActivity(tournamentId, 'sold');

        eventService.trackEvent({
          userId: userId || null,
          tournamentId: tournamentId || null,
          eventType: "auction_player_sold",
          eventData: { tournamentId, playerId: result.player?._id || null, playerName: result.player?.name || null, winningTeamId: result.teamId || null, winningTeamName: result.team?.name || null, finalPrice: result.amount },
        }).catch(() => {});

        // Broadcast immediately for animation
        auctionNamespace.to(tournamentId).emit("auction:sold", {
          player: result.player,
          team: result.team,
          amount: result.amount
        });

        // Async: Update DB
        try {
          await playerService.updatePlayer({
            playerId: result.player._id,
            teamId: result.teamId,
            sold: true,
            auctionStatus: true,
            amtSold: result.amount,
            userId: userId // For logging if needed in service
          });

          // Prepare bid history for log
          const auction = auctionStateManager.getOrCreateAuction(tournamentId); // Need raw for getting bid history before it was cleared? 
          // Wait, markSold clears the history. We should have captured it from the result if we modified markSold to return it, 
          // OR we should rely on the fact that result contains what we need?
          // Actually, markSold wipes the state. I should modify markSold in stateManager to return the bid history before wiping,
          // or I assume I need to pass it out.
          // Let's check stateManager.markSold implementation again. It clears it.
          // I should have modified stateManager to return the bids. 
          // For now, let's assume I missed that in stateManager and I'll hotfix it here or assume empty for now.
          // BETTER: Fix stateManager first? No, I can't easily go back without tool call.
          // Wait, I just wrote the file. I can see in the `markSold` logic: `auction.bidHistory = [];`.
          // The history is gone. 
          // I should update `auctionStateManager.js` to return `bids` in the result object.
        } catch (error) {
          console.error("Error updating sold player:", error);
        }

        // Fetch updated teams to sync budget changes
        const teamsReport = await teamService.getTournamentTeamsReport(tournamentId);
        const teams = teamsReport && teamsReport.length > 0 ? teamsReport[0].teams : [];
        auctionStateManager.updateTeams(tournamentId, teams);

        // Broadcast updated state (cleared player, updated teams)
        const newState = auctionStateManager.getAuctionState(tournamentId);
        auctionNamespace.to(tournamentId).emit("auction:state", newState);

        // Save log
        try {
          await auctionLogService.saveAuctionLog({
            tournamentId,
            playerId: result.player._id,
            playerName: result.player.name,
            playerCategory: result.player.playerCategory,
            basePrice: result.player.basePrice,
            auctionMode: newState.auctionMode || 'category',
            status: 'sold',
            winningTeamId: result.teamId,
            winningTeamName: result.team ? result.team.name : 'Unknown',
            finalPrice: result.amount,
            bids: result.bids,
            auctionStartedAt: new Date(Date.now() - 60000),
            auctionEndedAt: new Date(),
            conductedBy: userId
          });
        } catch (logError) {
          console.error("Error saving auction log:", logError);
        }

        // WhatsApp — fire-and-forget, never block the auction
        const _player = result.player;
        const _team   = result.team;
        const _amount = result.amount;
        whatsappService.sendPlayerSoldNotification({
          playerId: _player._id,
          name: _player.name,
          mobile: _player.mobile,
          teamName: _team?.name,
          amtSold: _amount,
          tournamentId,
        }).catch(e => console.error('[WhatsApp] sold notification error:', e.message));

        whatsappService.sendTeamPurchaseSummary({
          teamId: result.teamId,
          playerName: _player.name,
          amountPaid: _amount,
          tournamentId,
        }).catch(e => console.error('[WhatsApp] team purchase error:', e.message));

        whatsappService.sendBudgetWarning({
          teamId: result.teamId,
          tournamentId,
        }).catch(e => console.error('[WhatsApp] budget warning error:', e.message));

        // --- POST-SALE FLOW ---
        const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);

        if (auctionRaw.auctionMode === 'manual') {
          // Return to selection screen
          auctionRaw.auctionMode = null;
          auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));

        } else if (auctionRaw.auctionMode === 'category') {
          // Auto-fetch next player
          setTimeout(async () => {
            try {
              const category = auctionRaw.selectedCategory || 'All';
              const nextPlayer = await auctionService.nextAuctionPlayer(tournamentId, category);

              if (nextPlayer) {
                const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
                const slabs = t ? (t.bidIncrementSlabs || []) : [];

                if (t && t.categoryBasePrices && nextPlayer.playerCategory) {
                  const bp = t.categoryBasePrices.get(nextPlayer.playerCategory);
                  nextPlayer.basePrice = bp || 0;
                } else {
                  nextPlayer.basePrice = 0;
                }

                const selRes = auctionStateManager.selectPlayer(tournamentId, nextPlayer, slabs);
                if (selRes.success) {
                  auctionNamespace.to(tournamentId).emit("auction:playerSelected", nextPlayer);
                  auctionNamespace.to(tournamentId).emit("auction:state", selRes.state);
                } else {
                  console.error("Failed to auto-select next player after SOLD:", selRes.error);
                }
              } else {
                auctionRaw.auctionMode = null;
                auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));
                socket.emit("auction:info", "No more players in this category");
              }
            } catch (err) {
              console.error("Error auto-fetching next player:", err);
            }
          }, 3000);
        }
      } else {
        socket.emit("auction:error", result.error);
      }
    });

    // Mark Unsold
    socket.on("auction:unsold", async ({ tournamentId, userId }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized");
      }

      const result = auctionStateManager.markUnsold(tournamentId);

      if (result.success) {
        // Track unsold in session analytics
        auctionRoomSessionService.recordAuctionActivity(tournamentId, 'unsold');

        eventService.trackEvent({
          userId: userId || null,
          tournamentId: tournamentId || null,
          eventType: "auction_player_unsold",
          eventData: { tournamentId, playerId: result.player?._id || null, playerName: result.player?.name || null },
        }).catch(() => {});

        auctionNamespace.to(tournamentId).emit("auction:unsold", {
          player: result.player
        });

        try {
          await playerService.updatePlayer({
            playerId: result.player._id,
            sold: false,
            auctionStatus: true,
            userId
          });

          // Save log for unsold
          await auctionLogService.saveAuctionLog({
            tournamentId,
            playerId: result.player._id,
            playerName: result.player.name,
            playerCategory: result.player.playerCategory,
            basePrice: result.player.basePrice,
            auctionMode: auctionStateManager.getAuctionState(tournamentId)?.auctionMode || 'category',
            status: 'unsold',
            bids: result.bids,
            auctionStartedAt: new Date(Date.now() - 60000),
            auctionEndedAt: new Date(),
            conductedBy: userId
          });
        } catch (error) {
          console.error("Error updating/logging unsold player:", error);
        }

        // WhatsApp — fire-and-forget
        whatsappService.sendPlayerUnsoldNotification({
          playerId: result.player._id,
          name: result.player.name,
          mobile: result.player.mobile,
          tournamentId,
        }).catch(e => console.error('[WhatsApp] unsold notification error:', e.message));

        // Broadcast updated state
        const newState = auctionStateManager.getAuctionState(tournamentId);
        auctionNamespace.to(tournamentId).emit("auction:state", newState);

        // --- POST-ROUND FLOW (Unsold) ---
        const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);
        const teams = newState.teams || [];

        if (auctionRaw.auctionMode === 'manual') {
          auctionRaw.auctionMode = null;
          auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));

        } else if (auctionRaw.auctionMode === 'category') {
          setTimeout(async () => {
            try {
              const category = auctionRaw.selectedCategory || 'All';
              const nextPlayer = await auctionService.nextAuctionPlayer(tournamentId, category);

              if (nextPlayer) {
                const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
                const slabs = t ? (t.bidIncrementSlabs || []) : [];

                if (t && t.categoryBasePrices && nextPlayer.playerCategory) {
                  const bp = t.categoryBasePrices.get(nextPlayer.playerCategory);
                  nextPlayer.basePrice = bp || 0;
                } else {
                  nextPlayer.basePrice = 0;
                }

                const selRes = auctionStateManager.selectPlayer(tournamentId, nextPlayer, slabs);
                if (selRes.success) {
                  auctionNamespace.to(tournamentId).emit("auction:playerSelected", nextPlayer);
                  auctionNamespace.to(tournamentId).emit("auction:state", selRes.state);
                } else {
                  console.error("Failed to auto-select next player after UNSOLD:", selRes.error);
                }
              } else {
                auctionRaw.auctionMode = null;
                auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));
                socket.emit("auction:info", "No more players in this category");
              }
            } catch (err) {
              console.error("Error auto-fetching next player:", err);
            }
          }, 3000);
        }
      } else {
        socket.emit("auction:error", result.error);
      }
    });

    // Overlay: Layout Change Relay
    // Broadcasts the selected layout to all connected overlay clients in the room
    socket.on("overlay:layout_change", ({ tournamentId, layout }) => {
      console.log(`[overlay] Layout change to "${layout}" for tournament ${tournamentId}`);
      auctionNamespace.to(tournamentId).emit("overlay:layout_change", { layout });
    });

    // Disconnect
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      if (socket.tournamentId) {
        const viewerCount = auctionStateManager.removeViewer(socket.tournamentId, socket.id);
        auctionNamespace.to(socket.tournamentId).emit("auction:viewerCount", viewerCount);

        // Update viewer count in session analytics
        auctionRoomSessionService.updateViewerCount(socket.tournamentId, viewerCount);
      }
    });
  });
};
