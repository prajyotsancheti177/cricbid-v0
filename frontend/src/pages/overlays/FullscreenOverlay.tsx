import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useOverlaySocket } from "@/hooks/useOverlaySocket";
import {
  getTeamColor,
  getPlayerPhotoUrl,
  getFallbackAvatar,
  getTeamFallbackAvatar,
} from "@/lib/overlayUtils";
import { getDriveThumbnail } from "@/lib/imageUtils";
import "./overlays.css";

/**
 * Layout 2 — Fullscreen (No Camera)
 *
 * Fully opaque 1920×1080 page. No camera source required in this OBS scene.
 * Displays player photo, name, base price, current bid, bidding team logo,
 * and countdown timer. Background gradient changes with leading team color.
 *
 * SOLD: full-screen gold flash + confetti + SOLD stamp
 * UNSOLD: card shakes, fades to grey, UNSOLD stamp
 */
const FullscreenOverlay = () => {
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

  const [showContent, setShowContent] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [showUnsold, setShowUnsold] = useState(false);
  const [bidPulse, setBidPulse] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const prevPlayerRef = useRef<string | null>(null);

  // Capture sold/unsold info for display during animation
  const [soldInfo, setSoldInfo] = useState<{
    playerName: string;
    teamName: string;
    amount: number;
  } | null>(null);

  const currentPlayer = auctionState?.currentPlayer || null;
  const currentBid = auctionState?.currentBid || 0;
  const leadingTeam = auctionState?.leadingTeam || null;
  const teams = auctionState?.teams || [];
  const bidPrice = auctionState?.bidPrice || 0;

  const leadingTeamData = teams.find((t) => t._id === leadingTeam);
  const teamColor = leadingTeamData
    ? getTeamColor(leadingTeamData.name || leadingTeamData._id || "")
    : "#6366f1";

  // Show content when player changes
  useEffect(() => {
    if (currentPlayer) {
      const newPlayerId = currentPlayer._id || currentPlayer.name;
      if (newPlayerId !== prevPlayerRef.current) {
        setShowContent(false);
        setTimeout(() => {
          setContentKey((k) => k + 1);
          setShowContent(true);
        }, 150);
        prevPlayerRef.current = newPlayerId;
      }
    } else {
      setShowContent(false);
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
      setSoldInfo({
        playerName: soldEvent.player?.name || currentPlayer?.name || "",
        teamName: soldEvent.team?.name || leadingTeamData?.name || "",
        amount: soldEvent.amount || currentBid,
      });
      setShowSold(true);
      const t = setTimeout(() => {
        setShowSold(false);
        setSoldInfo(null);
        setShowContent(false);
        clearSoldEvent();
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [soldEvent, clearSoldEvent]);

  // UNSOLD animation
  useEffect(() => {
    if (unsoldEvent) {
      setShowUnsold(true);
      const t = setTimeout(() => {
        setShowUnsold(false);
        setShowContent(false);
        clearUnsoldEvent();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [unsoldEvent, clearUnsoldEvent]);

  return (
    <div
      className="overlay-root"
      style={{
        background: `linear-gradient(145deg, #0f0a1e 0%, ${teamColor}22 50%, #0d1b2a 100%)`,
        transition: "background 0.8s ease",
        position: "relative",
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />

      {/* Header Bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "28px 60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="overlay-live-dot" />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            LIVE AUCTION
          </span>
        </div>
        {auctionState?.selectedCategory &&
          auctionState.selectedCategory !== "All" && (
            <span className="overlay-category-badge">
              {auctionState.selectedCategory}
            </span>
          )}
        <div
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            fontWeight: 500,
          }}
        >
          {auctionState?.viewerCount
            ? `${auctionState.viewerCount} viewers`
            : ""}
        </div>
      </div>

      {/* Main Content */}
      {showContent && currentPlayer ? (
        <div
          key={contentKey}
          className="anim-fade-in"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "120px 80px 60px",
            gap: 80,
          }}
        >
          {/* Left: Player Photo */}
          <div
            style={{
              flexShrink: 0,
              position: "relative",
            }}
          >
            <img
              src={getPlayerPhotoUrl(currentPlayer)}
              alt={currentPlayer.name}
              className="overlay-player-photo-lg"
              onError={(e) => {
                e.currentTarget.src = getFallbackAvatar(currentPlayer.name);
              }}
            />
            {/* Glow ring behind photo */}
            <div
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: 28,
                border: `2px solid ${teamColor}40`,
                boxShadow: `0 0 60px ${teamColor}30`,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Right: Player Data */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 24,
              maxWidth: 800,
            }}
          >
            {/* Player Name */}
            <div>
              {currentPlayer.auctionSerialNumber && (
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  #{currentPlayer.auctionSerialNumber}
                </span>
              )}
              <h1 className="overlay-player-name">{currentPlayer.name}</h1>
            </div>

            {/* Badges Row */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {currentPlayer.playerCategory && (
                <span className="overlay-category-badge">
                  {currentPlayer.playerCategory}
                </span>
              )}
              {currentPlayer.skill && (
                <span className="overlay-skill-badge">
                  {currentPlayer.skill}
                </span>
              )}
            </div>

            {/* Base Price */}
            <div>
              <span className="overlay-label">Base Price</span>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.8)",
                  marginTop: 4,
                }}
              >
                {currentPlayer.basePrice ?? 0} Pts.
              </div>
            </div>

            <div className="overlay-divider" />

            {/* Current Bid */}
            <div>
              <span className="overlay-label">Current Bid</span>
              <div
                className={`overlay-bid-amount ${bidPulse ? "anim-bid-pulse" : ""}`}
                style={{ marginTop: 8 }}
              >
                {currentBid} Pts.
              </div>
            </div>

            {/* Leading Team */}
            {leadingTeamData && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginTop: 8,
                }}
              >
                <img
                  src={getDriveThumbnail(leadingTeamData.logo)}
                  alt={leadingTeamData.name}
                  className="overlay-team-logo"
                  onError={(e) => {
                    e.currentTarget.src = getTeamFallbackAvatar(
                      leadingTeamData.name
                    );
                  }}
                />
                <div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
                    Leading Bid
                  </div>
                  <span className="overlay-team-name" style={{ color: teamColor }}>
                    {leadingTeamData.name}
                  </span>
                </div>
                <span className="overlay-live-dot" style={{ marginLeft: 8 }} />
              </div>
            )}

            {!leadingTeamData && (
              <div
                style={{
                  fontSize: 22,
                  color: "rgba(255,255,255,0.3)",
                  fontStyle: "italic",
                  marginTop: 8,
                }}
              >
                Waiting for bids...
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standby Screen */
        !showSold &&
        !showUnsold && (
          <div className="overlay-standby">
            <div className="overlay-standby-logo">🏏 CricBid</div>
            <div className="overlay-standby-text">
              {isConnected
                ? auctionState?.isActive
                  ? "Next player coming up..."
                  : "Auction starting soon"
                : "Connecting to auction..."}
            </div>
            <span
              className="overlay-live-dot"
              style={{
                background: isConnected ? "#22c55e" : "#6b7280",
                boxShadow: isConnected
                  ? "0 0 12px rgba(34, 197, 94, 0.6)"
                  : "none",
              }}
            />
          </div>
        )
      )}

      {/* SOLD Overlay */}
      {showSold && (
        <div className="overlay-sold-container anim-sold-flash">
          <div className="overlay-sold-bg" />
          <div
            style={{
              textAlign: "center",
              zIndex: 101,
              position: "relative",
            }}
          >
            <div className="overlay-sold-stamp anim-stamp">SOLD!</div>
            {soldInfo && (
              <div
                className="anim-fade-in"
                style={{
                  marginTop: 40,
                  fontSize: 36,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                <div>{soldInfo.playerName}</div>
                <div
                  style={{
                    fontSize: 28,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 8,
                  }}
                >
                  to {soldInfo.teamName} for{" "}
                  <span style={{ color: "#fbbf24", fontWeight: 900 }}>
                    {soldInfo.amount} Pts.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UNSOLD Overlay */}
      {showUnsold && (
        <div className="overlay-unsold-container">
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
            }}
          />
          <div
            style={{
              textAlign: "center",
              zIndex: 101,
              position: "relative",
            }}
          >
            <div className="overlay-unsold-stamp anim-stamp">UNSOLD</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FullscreenOverlay;
