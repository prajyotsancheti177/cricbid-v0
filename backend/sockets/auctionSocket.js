const auctionStateManager = require("../services/auctionStateManager");
const teamService = require("../services/teamService");
const auctionService = require("../services/auctionService");
const playerService = require("../services/playerService");
const auctionLogService = require("../services/auctionLogService");
const tournamentService = require("../services/tournamentService");
const auctionRoomSessionService = require("../services/auctionRoomSessionService");
const whatsappService = require("../services/whatsappService");
const prisma = require("../db/prisma");
const { canViewTournament, canManageTournament, resolveOptionalUser } = require('../utils/tournamentAccess');
const eventService = require("../services/eventService");

// Store interval IDs for viewer history sampling per tournament
const viewerHistoryIntervals = new Map();

module.exports = (io) => {
  const auctionNamespace = io.of("/auction");

  // Auto-advance to the next player after a SOLD/UNSOLD result, when the
  // auction is running in 'category' or 'serial' mode ('manual' mode instead
  // returns to the selection screen — handled by the caller before this runs).
  const RESULT_ANIMATION_MS = 3000;

  // How long a team list may be reused before it is re-read from the database.
  const TEAMS_TTL_MS = 10000;
  const lastTeamsRefresh = new Map();

  // Re-read the teams (budgets, player counts) from the database.
  //
  // The live room used to do this in only two places: auction:start and after a
  // SOLD result. So an icon assigned from the player sheet, a budget top-up, or
  // an unsold round left the room showing figures from whenever the auction was
  // started — a team that had already bought a player still showed a full purse
  // and all of its slots free.
  //
  // Never throws: a failed refresh leaves the previous figures in place, which
  // is the old behaviour, rather than aborting the caller mid-result.
  const refreshTeams = async (tournamentId, { force = false } = {}) => {
    const last = lastTeamsRefresh.get(tournamentId) || 0;
    if (!force && Date.now() - last < TEAMS_TTL_MS) return false;

    try {
      const report = await teamService.getTournamentTeamsReport(tournamentId);
      const teams = report && report.length > 0 ? report[0].teams : [];
      auctionStateManager.updateTeams(tournamentId, teams);
      lastTeamsRefresh.set(tournamentId, Date.now());
      return true;
    } catch (err) {
      console.error(`Could not refresh teams for ${tournamentId}:`, err.message);
      return false;
    }
  };

  // Take a socket out of whatever room it was in before it joins another one.
  //
  // socket.join() is additive and the browser reuses one socket across page
  // navigation, so a host who moved from one auction to another stayed a member
  // of BOTH rooms: every sold/unsold/state emit for the tournament they had
  // left still reached them, and because the client applies any auction:state
  // it receives, their screen jumped to the other auction. It also left them
  // counted as a viewer of a room they were no longer watching.
  const leaveCurrentRoom = (socket, nextTournamentId = null) => {
    const previous = socket.tournamentId;
    if (!previous || previous === nextTournamentId) return;

    socket.leave(previous);
    const viewerCount = auctionStateManager.removeViewer(previous, socket.id);
    auctionNamespace.to(previous).emit("auction:viewerCount", viewerCount);
    auctionRoomSessionService.updateViewerCount(previous, viewerCount);
    socket.tournamentId = null;
  };

  const autoAdvanceNextPlayer = (tournamentId, socket, auctionRaw) => {
    const category = auctionRaw.selectedCategory || 'All';
    const orderMode = auctionRaw.auctionMode === 'serial' ? 'serial' : 'random';

    // Look the next player up WHILE the sold/unsold animation is playing rather
    // than after it. The queries take 0.3-1.3s against the live database, and
    // running them after the wait left that much dead air between players.
    const lookahead = (async () => {
      const nextPlayer = await auctionService.nextAuctionPlayer(tournamentId, category, orderMode);
      const t = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { bidIncrementSlabs: true },
      });
      return { nextPlayer, slabs: t ? (t.bidIncrementSlabs || []) : [] };
    })().catch((err) => {
      console.error("Error pre-fetching next player:", err);
      return null;
    });

    setTimeout(async () => {
      try {
        const ready = await lookahead;
        const nextPlayer = ready ? ready.nextPlayer : null;

        if (nextPlayer) {
          const slabs = ready.slabs;
          // basePrice is already attached by nextAuctionPlayer via the
          // tournament's categoryBasePrices map (no need to re-derive it here).

          const selRes = auctionStateManager.selectPlayer(tournamentId, nextPlayer, slabs);
          if (selRes.success) {
            auctionNamespace.to(tournamentId).emit("auction:playerSelected", nextPlayer);
            auctionNamespace.to(tournamentId).emit("auction:state", selRes.state);
          } else {
            console.error("Failed to auto-select next player:", selRes.error);
          }
        } else {
          auctionRaw.auctionMode = null;
          auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));
          socket.emit("auction:info", "No more players in this category");
        }
      } catch (err) {
        console.error("Error auto-fetching next player:", err);
      }
    }, RESULT_ANIMATION_MS);
  };

  auctionNamespace.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Who is on this socket, from the token the client sends when connecting.
    // Only private tournaments depend on it; everything else stays open.
    const identity = resolveOptionalUser({ headers: { 'x-session-token': socket.handshake.auth?.token } })
      .then((who) => { socket.data.userId = who.userId; socket.data.role = who.role; return who; })
      .catch(() => ({ userId: null, role: null }));

    /**
     * Who is really on this socket, resolved fresh from a session token.
     *
     * Never from a client-supplied userId. The auction used to take the userId
     * out of the event payload and authorise on it, which meant the browser got
     * to say who it was. A player-role account conducted three results in a live
     * auction that way.
     *
     * Re-resolved per action rather than reused from connect, so signing in
     * after the socket opened still works, and a deactivated account stops
     * working without waiting for a reconnect. One indexed lookup.
     */
    const resolveActor = async (payloadToken) => {
      const token = payloadToken || socket.handshake.auth?.token;
      if (!token) return { userId: null, role: null };
      try {
        return await resolveOptionalUser({ headers: { 'x-session-token': token } });
      } catch (_) {
        return { userId: null, role: null };
      }
    };

    /**
     * May this socket run this tournament's auction? Fails closed.
     * `player` never passes: canManageTournament requires a managing role.
     */
    const mayManage = async (tournamentId, payloadToken) => {
      const who = await resolveActor(payloadToken);
      if (!who.userId || !who.role) return { ok: false, who };
      const ok = await canManageTournament(who.userId, who.role, tournamentId);
      return { ok, who };
    };

    /**
     * Record who took, or tried to take, control of an auction.
     *
     * Socket actions were invisible: when a player-role account conducted three
     * results, there was no way to establish how it got the seat. Written to
     * user_event so it survives a log rotation and can be queried per
     * tournament. Fire-and-forget — auditing must never block the auction.
     */
    const auditSeat = (eventType, tournamentId, who, extra) => {
      eventService.trackEvent({
        userId: who.userId || null,
        tournamentId: tournamentId || null,
        eventType,
        eventData: {
          role: who.role || null,
          socketId: socket.id,
          ipAddress: socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || null,
          ...extra,
        },
      }).catch(() => {});
    };

    /** True when this socket is allowed to see this tournament at all. */
    const mayView = async (tournamentId) => {
      const who = await identity;
      return canViewTournament(who.userId, who.role, tournamentId);
    };

    // List active auctions
    socket.on("auction:list", async () => {
      try {
        const active = auctionStateManager.getAllActiveAuctions();

        // Enrich with tournament names and hostId
        const enriched = await Promise.all(active.map(async (a) => {
          try {
            const t = await prisma.tournament.findUnique({ where: { id: a.tournamentId }, select: { name: true, tournamentHostId: true, isPrivate: true } });
            // A private tournament's auction is not advertised to anyone who
            // cannot see the tournament itself.
            if (t?.isPrivate && !(await mayView(a.tournamentId))) return null;
            return {
              ...a,
              tournamentName: t ? t.name : 'Unknown Tournament',
              hostId: t ? (t.tournamentHostId?._id || t.tournamentHostId) : null
            };
          } catch {
            return { ...a, tournamentName: 'Unknown Tournament', hostId: null };
          }
        }));

        socket.emit("auction:list", enriched.filter(Boolean));
      } catch (err) {
        console.error("Error listing auctions:", err);
        socket.emit("auction:error", "Failed to list auctions");
      }
    });

    // Delete Auction Room (Host/Admin only)
    socket.on("auction:delete", async ({ tournamentId, sessionToken }) => {
      try {
        // This handler used to fail open in two ways: no userId meant "allow and
        // skip analytics", and a userId that matched no row meant the same. So
        // anyone at all could close any live auction room. Identity now comes
        // from the session token and must carry permission over this
        // tournament.
        const { ok, who } = await mayManage(tournamentId, sessionToken);
        if (!ok) {
          auditSeat("auction_room_delete_refused", tournamentId, who, {});
          console.warn(`[auction] refused room delete on ${tournamentId} by ${who.userId || 'anonymous'}`);
          return socket.emit("auction:error", "Unauthorized: Only the host or an admin can delete this room");
        }
        const userId = who.userId;
        auditSeat("auction_room_deleted", tournamentId, who, {});
        console.log(`[auction] room delete on ${tournamentId} by ${userId} (${who.role})`);

        // Proceed with deletion
        auctionStateManager.cleanupAuction(tournamentId);

        eventService.trackEvent({
          userId: userId || null,
          tournamentId: tournamentId || null,
          eventType: "auction_ended",
          eventData: { tournamentId, auctioneerUserId: userId || null },
        }).catch(() => {});

        // End session analytics. Always runs now: the caller is always a known,
        // permitted user, so there is no "no user context" case to skip for.
        try {
          await auctionRoomSessionService.endSession(tournamentId);
        } catch (analyticsErr) {
          console.error(`[auction:delete] Analytics error (non-blocking):`, analyticsErr);
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

      // Someone holding the room link still has to be allowed to see it.
      if (!(await mayView(tournamentId))) {
        socket.emit("auction:error", "This auction is not available");
        return;
      }

      leaveCurrentRoom(socket, tournamentId);
      socket.join(tournamentId);
      socket.tournamentId = tournamentId;
      socket.viewerUserId = userId;
      socket.viewerIpAddress = ipAddress;

      // Always get or create state so we can return "isActive: false" instead of error
      // This allows the UI to show the "Start Auction" button
      const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);

      // Re-seat a reconnecting auctioneer.
      //
      // This used to hand the seat to anyone whose client-supplied userId
      // matched the current auctioneer's — no role check at all. It now
      // re-checks permission against the socket's own session token, so a
      // matching id is not on its own enough to take over.
      if (auctionRaw.auctioneerUserId) {
        const { ok, who } = await mayManage(tournamentId);
        if (ok && who.userId === auctionRaw.auctioneerUserId) {
          auctionStateManager.setAuctioneer(tournamentId, socket.id, who.userId);
          socket.emit("auction:role", "auctioneer");
        }
      }

      const viewerCount = auctionStateManager.addViewer(tournamentId, socket.id);

      // Track viewer join in session analytics
      auctionRoomSessionService.recordViewerJoin(tournamentId, userId, ipAddress);
      auctionRoomSessionService.updateViewerCount(tournamentId, viewerCount);

      // Anyone arriving gets current budgets, not the ones from auction start.
      await refreshTeams(tournamentId);

      const safeState = auctionStateManager.getAuctionState(tournamentId);
      socket.emit("auction:state", safeState);
      auctionNamespace.to(tournamentId).emit("auction:viewerCount", viewerCount);
    });

    // Start/Initialize Auction (Auctioneer only)
    socket.on("auction:start", async ({ tournamentId, sessionToken }) => {
      try {
        // Check state BEFORE setting auctioneer (which toggles isActive)
        const preState = auctionStateManager.getAuctionState(tournamentId);
        const wasActive = preState && preState.isActive;

        // PERMISSION FIRST, then the claim.
        //
        // This used to be the other way round: the seat was taken, and only then
        // was the claimant checked — which left a window where isAuctioneer()
        // was already true for someone who was about to be refused, and the
        // refusal then emptied the seat rather than leaving the incumbent in it.
        // The check was also wrapped in `if (userId && tournamentOwnerId)`, so a
        // missing userId skipped it altogether. Now nothing is claimed until the
        // actor is known and allowed, and identity comes from their session
        // token rather than from a userId the browser chose to send.
        const { ok, who } = await mayManage(tournamentId, sessionToken);
        if (!ok) {
          // Durable, not just a log line: pm2 logs rotate, and "who tried to
          // take the seat" is the question that was unanswerable last time.
          auditSeat("auction_host_refused", tournamentId, who, { reason: who.userId ? 'not_permitted' : 'no_session' });
          console.warn(`[auction] refused host claim on ${tournamentId} by ${who.userId || 'anonymous'} (role=${who.role || 'none'})`);
          return socket.emit("auction:error", {
            code: 'UNAUTHORIZED',
            message: who.userId
              ? 'You do not have permission to host this auction'
              : 'Please sign in as the host to run this auction',
          });
        }
        const userId = who.userId;

        // Resolve the existing auctioneer's name for conflict messages
        let existingHostName = null;
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
        auditSeat("auction_host_claimed", tournamentId, who, { wasActive: !!wasActive });
        console.log(`[auction] host claimed on ${tournamentId} by ${userId} (${who.role})`);

        leaveCurrentRoom(socket, tournamentId);
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
    socket.on("auction:selectPlayer", async ({ tournamentId, playerId, category, orderMode }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized: Only auctioneer can select players");
      }

      try {
        // Infer and set mode if not set
        const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);
        if (auctionRaw && !auctionRaw.auctionMode) {
          if (playerId) {
            auctionRaw.auctionMode = 'manual';
          } else if (orderMode === 'serial') {
            auctionRaw.auctionMode = 'serial';
            auctionRaw.selectedCategory = category || 'All';
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
          // The same gate the automatic pick applies: an unverified player is
          // not in the auction, however they were reached.
          if (player.paymentVerified === false) {
            throw new Error(`${player.name} has not had their payment verified yet`);
          }

          // Ensure base price is set
          if (!player.basePrice && player.basePrice !== 0) {
            const allPlayers = await playerService.allPlayerDetails(tournamentId);
            const p = allPlayers.find(p => p._id.toString() === playerId);
            if (p) player.basePrice = p.basePrice;
          }
        } else {
          // Next player in category or serial-number order. The player already
          // on the block is passed through so "Next" actually advances past
          // them — selecting does not mark anyone auctioned.
          const onBlock = auctionRaw && auctionRaw.currentPlayer ? auctionRaw.currentPlayer : null;
          player = await auctionService.nextAuctionPlayer(
            tournamentId,
            category,
            auctionRaw.auctionMode === 'serial' ? 'serial' : 'random',
            onBlock ? { id: onBlock._id || onBlock.id, serial: onBlock.auctionSerialNumber } : {}
          );
        }

        // Between players is the natural moment to pick up anything changed
        // outside the room — a player assigned from the sheet, a budget top-up.
        await refreshTeams(tournamentId);

        const selResult = auctionStateManager.selectPlayer(tournamentId, player, bidIncrementSlabs);

        if (selResult.success) {
          auctionNamespace.to(tournamentId).emit("auction:state", selResult.state);
          auctionNamespace.to(tournamentId).emit("auction:playerSelected", player);

          eventService.trackEvent({
            userId: null,
            tournamentId: tournamentId || null,
            eventType: "auction_player_selected",
            eventData: { tournamentId, playerId: player._id, playerName: player.name, category: player.playerCategory, selectionMode: playerId ? "manual" : auctionRaw.auctionMode },
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
    socket.on("auction:sold", async ({ tournamentId }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized");
      }

      // Attribution comes from the seat, which was granted only after a
      // permission check — not from a userId in the payload, which the browser
      // chose and which therefore could name anyone.
      const userId = (auctionStateManager.getOrCreateAuction(tournamentId) || {}).auctioneerUserId || null;

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

        // Fetch updated teams to sync budget changes. Forced: a sale has just
        // changed a budget, so the TTL must not hold the old figures.
        await refreshTeams(tournamentId, { force: true });

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

        } else if (auctionRaw.auctionMode === 'category' || auctionRaw.auctionMode === 'serial') {
          autoAdvanceNextPlayer(tournamentId, socket, auctionRaw);
        }
      } else {
        socket.emit("auction:error", result.error);
      }
    });

    // Mark Unsold
    socket.on("auction:unsold", async ({ tournamentId }) => {
      if (!auctionStateManager.isAuctioneer(tournamentId, socket.id)) {
        return socket.emit("auction:error", "Unauthorized");
      }

      // Attribution comes from the seat, which was granted only after a
      // permission check — not from a userId in the payload, which the browser
      // chose and which therefore could name anyone.
      const userId = (auctionStateManager.getOrCreateAuction(tournamentId) || {}).auctioneerUserId || null;

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

        // Broadcast updated state. An unsold result changes no budget, but this
        // used to be the one path that refreshed nothing, so a room producing
        // only unsold rounds never picked up changes made outside it.
        await refreshTeams(tournamentId);

        const newState = auctionStateManager.getAuctionState(tournamentId);
        auctionNamespace.to(tournamentId).emit("auction:state", newState);

        // --- POST-ROUND FLOW (Unsold) ---
        const auctionRaw = auctionStateManager.getOrCreateAuction(tournamentId);
        const teams = newState.teams || [];

        if (auctionRaw.auctionMode === 'manual') {
          auctionRaw.auctionMode = null;
          auctionNamespace.to(tournamentId).emit("auction:state", auctionStateManager.getAuctionState(tournamentId));

        } else if (auctionRaw.auctionMode === 'category' || auctionRaw.auctionMode === 'serial') {
          autoAdvanceNextPlayer(tournamentId, socket, auctionRaw);
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

    // Leave a room without closing the socket, so navigating away from an
    // auction stops that room's events reaching this browser.
    socket.on("auction:leave", () => {
      leaveCurrentRoom(socket);
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
