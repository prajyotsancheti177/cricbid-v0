import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useOverlaySocket } from "@/hooks/useOverlaySocket";
import {
  getTeamColor,
  formatOverlayPrice,
  getPlayerPhotoUrl,
  getFallbackAvatar,
  getTeamFallbackAvatar,
} from "@/lib/overlayUtils";
import { getDriveThumbnail } from "@/lib/imageUtils";
import apiConfig from "@/config/apiConfig";
import "./overlays.css";

/**
 * Layout 1 — Camera with HUD (Lower Third)
 *
 * Transparent background with a lower-third panel showing:
 * - Player name, category, skill
 * - Base price and current bid
 * - Leading team name + logo
 *
 * Designed for OBS Browser Source at 1920×1080.
 * The host's camera feed shows behind this overlay.
 */
const CameraHudOverlay = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const {
    isConnected,
    auctionState,
    soldEvent,
    unsoldEvent,
    lastBid,
    clearSoldEvent,
    clearUnsoldEvent,
  } = useOverlaySocket(tournamentId);

  const [showPanel, setShowPanel] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [showUnsold, setShowUnsold] = useState(false);
  const [bidPulse, setBidPulse] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);

  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [showTopPlayersPanel, setShowTopPlayersPanel] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showPromoBanner, setShowPromoBanner] = useState(false);
  const [overlayStats, setOverlayStats] = useState<any>(null);

  const prevPlayerRef = useRef<string | null>(null);

  // Force transparent background via CSS class for OBS Browser Source
  useEffect(() => {
    document.body.classList.add("overlay-mode");
    return () => {
      document.body.classList.remove("overlay-mode");
    };
  }, []);

  const currentPlayer = auctionState?.currentPlayer || null;
  const currentBid = auctionState?.currentBid || 0;
  const leadingTeam = auctionState?.leadingTeam || null;
  const teams = auctionState?.teams || [];
  const bidPrice = auctionState?.bidPrice || 0;

  const leadingTeamData = teams.find((t) => t._id === leadingTeam);
  const teamColor = leadingTeamData
    ? getTeamColor(leadingTeamData.name || leadingTeamData._id || "")
    : "#6366f1";

  // Fetch overlay stats (Top Players & Recent)
  const fetchOverlayStats = async () => {
    try {
      const response = await fetch(`${apiConfig.baseUrl}/api/player/overlay-stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId })
      });
      const data = await response.json();
      if (data.success) setOverlayStats(data.data);
    } catch (e) {
      console.error("Failed to fetch overlay stats", e);
    }
  };

  // Interval Logic
  useEffect(() => {
    if (!tournamentId) return;
    fetchOverlayStats(); // Initial fetch

    // 60-second interval for Teams Panel
    const teamsInterval = setInterval(() => {
      setShowTeamsPanel(true);
      setTimeout(() => setShowTeamsPanel(false), 15000);
    }, 60000);

    // 120-second interval for Top Players Panel
    const topPlayersInterval = setInterval(() => {
      fetchOverlayStats().then(() => {
        setShowTopPlayersPanel(true);
        setTimeout(() => setShowTopPlayersPanel(false), 15000);
      });
    }, 120000);

    // 60-second interval for QR Code (offset by 30s so it doesn't clash with Teams panel)
    let qrInterval: NodeJS.Timeout;
    const qrTimeout = setTimeout(() => {
      setShowQR(true);
      setTimeout(() => setShowQR(false), 15000);
      qrInterval = setInterval(() => {
        setShowQR(true);
        setTimeout(() => setShowQR(false), 15000);
      }, 60000);
    }, 30000);

    // Promo banner: 60s off, 30s on
    let promoInterval: NodeJS.Timeout;
    let promoTimeout: NodeJS.Timeout;
    const initialPromoTimeout = setTimeout(() => {
      setShowPromoBanner(true);
      promoTimeout = setTimeout(() => setShowPromoBanner(false), 30000);
      promoInterval = setInterval(() => {
        setShowPromoBanner(true);
        promoTimeout = setTimeout(() => setShowPromoBanner(false), 30000);
      }, 90000);
    }, 60000);

    return () => {
      clearInterval(teamsInterval);
      clearInterval(topPlayersInterval);
      clearTimeout(qrTimeout);
      if (qrInterval) clearInterval(qrInterval);
      clearTimeout(initialPromoTimeout);
      if (promoTimeout) clearTimeout(promoTimeout);
      if (promoInterval) clearInterval(promoInterval);
    };
  }, [tournamentId]);

  // Show/hide panel when player changes (trigger Intro first)
  useEffect(() => {
    if (currentPlayer) {
      const newPlayerId = currentPlayer._id || currentPlayer.name;
      if (newPlayerId !== prevPlayerRef.current) {
        setShowPanel(false);
        setShowIntro(true); // Trigger intro sequence
        setTimeout(() => {
          setShowIntro(false); // Hide intro
          setPlayerKey((k) => k + 1);
          setShowPanel(true); // Bring in lower third
        }, 4000); // 4-second intro
        prevPlayerRef.current = newPlayerId;
      }
    } else {
      setShowPanel(false);
      setShowIntro(false);
      prevPlayerRef.current = null;
    }
  }, [currentPlayer]);

  // Bid pulse animation
  useEffect(() => {
    if (lastBid) {
      setBidPulse(true);
      const t = setTimeout(() => setBidPulse(false), 400);
      return () => clearTimeout(t);
    }
  }, [lastBid]);

  // SOLD animation
  useEffect(() => {
    if (soldEvent) {
      setShowSold(true);
      const t = setTimeout(() => {
        setShowSold(false);
        setShowPanel(false);
        clearSoldEvent();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [soldEvent, clearSoldEvent]);

  // UNSOLD animation
  useEffect(() => {
    if (unsoldEvent) {
      setShowUnsold(true);
      const t = setTimeout(() => {
        setShowUnsold(false);
        setShowPanel(false);
        clearUnsoldEvent();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [unsoldEvent, clearUnsoldEvent]);

  return (
    <div className="overlay-root overlay-transparent">
      {/* Top Marquee */}
      {overlayStats?.recentPlayers?.length > 0 && (
        <div className="overlay-marquee-container">
          <div className="overlay-marquee-content">
            {/* Duplicate content to create seamless loop */}
            {[...Array(2)].map((_, loopIdx) => (
              <div key={loopIdx} style={{ display: "flex", alignItems: "center" }}>
                <div className="overlay-marquee-item">
                  <span style={{ color: "rgba(255,255,255,0.6)", marginRight: 8 }}>RECENT BUYS:</span>
                </div>
                {overlayStats.recentPlayers.map((p: any, idx: number) => (
                  <div key={`${loopIdx}-${idx}`} className="overlay-marquee-item">
                    <img src={getDriveThumbnail(p.photo)} style={{ width: 24, height: 24, borderRadius: "50%", marginRight: 10, objectFit: "cover" }} onError={(e) => e.currentTarget.src = getFallbackAvatar(p.name)} />
                    <span>{p.name}</span>
                    <span style={{ color: "#a78bfa", margin: "0 8px" }}>sold to</span>
                    <span style={{ color: getTeamColor(p.teamName || "") }}>{p.teamName}</span>
                    <span style={{ marginLeft: 8, color: "#fbbf24" }}>({p.amtSold} Pts)</span>
                    {idx < overlayStats.recentPlayers.length - 1 && <span className="overlay-marquee-separator">•</span>}
                  </div>
                ))}
                <span className="overlay-marquee-separator" style={{ marginRight: 50 }}>✦</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotional Banner */}
      {showPromoBanner && (
        <div
          className="overlay-glass anim-fade-in"
          style={{
            position: "absolute",
            top: overlayStats?.recentPlayers?.length > 0 ? 40 : 0,
            left: 0,
            width: "100%",
            padding: "10px 24px",
            borderRadius: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            fontSize: 20,
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.95)",
            zIndex: 80,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none"
          }}
        >
          <span style={{ color: "#a78bfa" }}>⚡</span>
          To conduct hassle free auctions with advanced features contact <span style={{ color: "#fbbf24", fontWeight: 900 }}>8208216407</span>
        </div>
      )}

      {/* Teams Info Panel (Right side, triggered every 60s) */}
      {showTeamsPanel && teams.length > 0 && (
        <div className="overlay-side-panel right anim-slide-in-right" onAnimationEnd={(e) => {
          if (!showTeamsPanel && e.animationName === "slideOutRight") {
            // cleanup
          }
        }}>
          <div className="overlay-panel-title">Teams Overview</div>
          <div className="overlay-panel-content-scroll">
            <div className="overlay-scroll-inner">
              {[...Array(2)].map((_, loopIdx) => (
                <div key={loopIdx} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                  {teams.map(team => {
                    const slotsAvailable = (team.maxPlayersPerTeam || 15) - (team.playersCount || 0);
                    return (
                      <div key={team._id} className="overlay-list-item">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img src={getDriveThumbnail(team.logo)} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", background: "white" }} onError={(e) => e.currentTarget.src = getTeamFallbackAvatar(team.name)} />
                          <div className="overlay-item-name" style={{ color: getTeamColor(team.name || "") }}>{team.name}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div className="overlay-item-value">{team.remainingBudget} <span className="overlay-item-sub">Pts</span></div>
                          <div className="overlay-item-sub">{slotsAvailable} slots left</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Players Panel (Left side, triggered every 120s) */}
      {showTopPlayersPanel && overlayStats?.topPlayers?.length > 0 && (
        <div className="overlay-side-panel left anim-slide-in-left">
          <div className="overlay-panel-title">Top Players</div>
          {overlayStats.topPlayers.map((player: any) => (
            <div key={player._id} className="overlay-list-item">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={getDriveThumbnail(player.photo)} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `2px solid ${getTeamColor(player.teamName || "")}` }} onError={(e) => e.currentTarget.src = getFallbackAvatar(player.name)} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="overlay-item-name">{player.name}</div>
                  <div className="overlay-item-sub" style={{ color: getTeamColor(player.teamName || "") }}>{player.teamName}</div>
                </div>
              </div>
              <div className="overlay-item-value" style={{ color: "#fbbf24" }}>{player.amtSold}</div>
            </div>
          ))}
        </div>
      )}

      {/* Full-Screen Intro Sequence */}
      {showIntro && currentPlayer && (
        <div className="overlay-intro-container anim-intro-sequence">
          <div className="overlay-intro-bg" />
          <div className="overlay-intro-content">
            <img src={getPlayerPhotoUrl(currentPlayer)} className="overlay-intro-photo" onError={(e) => e.currentTarget.src = getFallbackAvatar(currentPlayer.name)} />
            {currentPlayer.auctionSerialNumber && (
              <div className="overlay-intro-serial">#{currentPlayer.auctionSerialNumber}</div>
            )}
            <div className="overlay-intro-name">{currentPlayer.name}</div>
            <div style={{ display: "flex", gap: 15, marginTop: 20 }}>
              {currentPlayer.playerCategory && <span className="overlay-category-badge">{currentPlayer.playerCategory}</span>}
              {currentPlayer.skill && <span className="overlay-skill-badge">{currentPlayer.skill}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Lower Third Components */}
      {showPanel && currentPlayer && (
        <>
          {/* 1. Separate Photo Card (Bottom Left) */}
          <div key={`photo-${playerKey}`} className="anim-slide-up overlay-photo-card" style={{ borderColor: teamColor }}>
            <img
              src={getPlayerPhotoUrl(currentPlayer)}
              alt={currentPlayer.name}
              onError={(e) => {
                e.currentTarget.src = getFallbackAvatar(currentPlayer.name);
              }}
            />
          </div>

          {/* 2. Redesigned Lower Third Data Pill (Shifted Right) */}
          <div
            style={{
              position: "absolute",
              bottom: 48,
              left: 400, /* Safely placed to the right of the photo card */
              right: 48, /* Stretch till right edge */
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <div
              key={playerKey}
              className="anim-slide-up overlay-glass"
              style={{
                padding: "20px 40px",
                display: "flex",
                alignItems: "center",
                gap: 40,
                borderBottom: `6px solid ${teamColor}`,
                borderRadius: "24px", // flat uniform radius
                background: "rgba(15, 10, 30, 0.95)",
                boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 40px ${teamColor}30`,
                width: "100%", // Fill the container width
              }}
            >
              {/* Player Name & Badges */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    letterSpacing: -1,
                    lineHeight: 1.1,
                    whiteSpace: "normal", // allow wrap
                    wordWrap: "break-word",
                  }}
                >
                  {currentPlayer.auctionSerialNumber && (
                    <span style={{ color: "rgba(255,255,255,0.4)", marginRight: 12 }}>
                      #{currentPlayer.auctionSerialNumber}
                    </span>
                  )}
                  {currentPlayer.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {currentPlayer.playerCategory && (
                    <span className="overlay-category-badge" style={{ fontSize: 15, padding: "4px 16px" }}>
                      {currentPlayer.playerCategory}
                    </span>
                  )}
                  {currentPlayer.skill && (
                    <span className="overlay-skill-badge" style={{ fontSize: 15, padding: "4px 16px" }}>
                      {currentPlayer.skill}
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 2, height: 80, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent)", flexShrink: 0 }} />

              {/* 3. Current Bid & Team */}
              <div style={{ textAlign: "right", minWidth: 260, flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 3, marginBottom: 4 }}>
                  CURRENT BID
                </div>
                <div
                  className={`overlay-bid-amount ${bidPulse ? "anim-bid-pulse" : ""}`}
                  style={{ fontSize: 68, marginBottom: 8 }}
                >
                  {currentBid} <span style={{ fontSize: 40 }}>Pts.</span>
                </div>

                {leadingTeamData ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: teamColor,
                        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                      }}
                    >
                      {leadingTeamData.name}
                    </span>
                    <img
                      src={getDriveThumbnail(leadingTeamData.logo)}
                      alt={leadingTeamData.name}
                      className="overlay-team-logo-sm"
                      style={{ width: 36, height: 36 }}
                      onError={(e) => {
                        e.currentTarget.src = getTeamFallbackAvatar(
                          leadingTeamData.name
                        );
                      }}
                    />
                    <span className="overlay-live-dot" />
                  </div>
                ) : (
                  <div style={{ fontSize: 18, fontStyle: "italic", color: "rgba(255,255,255,0.3)" }}>
                    Waiting for bids...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SOLD Overlay */}
      {showSold && (
        <div className="overlay-sold-container anim-sold-flash">
          <div className="overlay-sold-bg" />
          <div className="overlay-sold-stamp anim-stamp">SOLD!</div>
        </div>
      )}

      {/* UNSOLD Overlay */}
      {showUnsold && (
        <div className="overlay-unsold-container">
          <div className="overlay-unsold-stamp anim-stamp">UNSOLD</div>
        </div>
      )}

      {/* QR Code Overlay (Top Left) */}
      {/* showQR && (
        <div className="anim-slide-in-left overlay-glass" style={{
          position: "absolute",
          top: 48,
          left: 48,
          padding: "20px",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          background: "rgba(15, 10, 30, 0.95)",
          border: "2px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          zIndex: 90
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color: "#fbbf24", textTransform: "uppercase" }}>
            Scan to follow live
          </div>
          <div style={{ background: "white", padding: "8px", borderRadius: "8px" }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + "/tournament/" + tournamentId)}`} 
              alt="QR Code" 
              style={{ width: 120, height: 120 }} 
            />
          </div>
        </div>
      ) */}

      {/* Standby — no player, auction might not be active */}
      {!currentPlayer && !showSold && !showUnsold && (
        <div style={{ position: "absolute", bottom: 40, right: 40 }}>
          <div
            className="overlay-glass"
            style={{
              padding: "16px 32px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: isConnected ? 0.6 : 0.3,
            }}
          >
            <span
              className="overlay-live-dot"
              style={{
                background: isConnected ? "#22c55e" : "#6b7280",
                boxShadow: isConnected
                  ? "0 0 12px rgba(34, 197, 94, 0.6)"
                  : "none",
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {isConnected
                ? auctionState?.isActive
                  ? "LIVE — Waiting for player..."
                  : "Connected — Auction not started"
                : "Connecting..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraHudOverlay;
