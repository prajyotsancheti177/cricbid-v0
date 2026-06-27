import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useOverlaySocket, BidPlacedData } from "@/hooks/useOverlaySocket";
import {
  getTeamColor,
  getPlayerPhotoUrl,
  getFallbackAvatar,
  getTeamFallbackAvatar,
} from "@/lib/overlayUtils";
import { getDriveThumbnail } from "@/lib/imageUtils";
import "./overlays.css";

/**
 * Layout 3 — Split Screen (Camera + Data Panel)
 *
 * Left 50%: transparent (camera bleeds through in OBS)
 * Right 50%: opaque data panel with all auction fields + recent bids feed
 * Vertical divider with team-color glow effect
 *
 * Designed for OBS Browser Source at 1920×1080.
 */

interface BidHistoryItem {
  teamName: string;
  amount: number;
  teamId: string;
  timestamp: number;
}

const SplitScreenOverlay = () => {
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
  const [bidHistory, setBidHistory] = useState<BidHistoryItem[]>([]);
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

  // Show content when player changes
  useEffect(() => {
    if (currentPlayer) {
      const newPlayerId = currentPlayer._id || currentPlayer.name;
      if (newPlayerId !== prevPlayerRef.current) {
        setShowContent(false);
        setBidHistory([]);
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

  // Track bid history
  useEffect(() => {
    if (lastBid) {
      setBidPulse(true);
      const t = setTimeout(() => setBidPulse(false), 400);

      setBidHistory((prev) => [
        {
          teamName: lastBid.teamName,
          amount: lastBid.amount,
          teamId: lastBid.teamId,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 9), // Keep last 10 bids
      ]);

      return () => clearTimeout(t);
    }
  }, [lastBid]);

  // SOLD animation
  useEffect(() => {
    if (soldEvent) {
      setShowSold(true);
      const t = setTimeout(() => {
        setShowSold(false);
        setShowContent(false);
        setBidHistory([]);
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
        setShowContent(false);
        setBidHistory([]);
        clearUnsoldEvent();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [unsoldEvent, clearUnsoldEvent]);

  return (
    <div className="overlay-root overlay-transparent" style={{ position: "relative" }}>
      {/* Left half: fully transparent (camera shows through) */}

      {/* Right half: opaque data panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          background: `linear-gradient(180deg, #0f0a1eF0 0%, ${teamColor}18 50%, #0d1b2aF0 100%)`,
          transition: "background 0.8s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Subtle pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)",
            backgroundSize: "30px 30px",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "32px 40px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="overlay-live-dot" />
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              LIVE AUCTION
            </span>
          </div>
          <span
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.35)",
              fontWeight: 500,
            }}
          >
            {auctionState?.viewerCount
              ? `${auctionState.viewerCount} viewers`
              : ""}
          </span>
        </div>

        {/* Content */}
        {showContent && currentPlayer ? (
          <div
            key={contentKey}
            className="anim-slide-right"
            style={{
              flex: 1,
              padding: "0 40px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              position: "relative",
              zIndex: 2,
              overflow: "hidden",
            }}
          >
            {/* Player Photo + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <img
                src={getPlayerPhotoUrl(currentPlayer)}
                alt={currentPlayer.name}
                onError={(e) => {
                  e.currentTarget.src = getFallbackAvatar(currentPlayer.name);
                }}
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 20,
                  objectFit: "cover",
                  objectPosition: "top center",
                  border: `3px solid ${teamColor}60`,
                  boxShadow: `0 10px 40px rgba(0,0,0,0.4), 0 0 30px ${teamColor}20`,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                {currentPlayer.auctionSerialNumber && (
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.3)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    #{currentPlayer.auctionSerialNumber}
                  </span>
                )}
                <h2
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    letterSpacing: -0.5,
                    lineHeight: 1.1,
                    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    margin: 0,
                  }}
                >
                  {currentPlayer.name}
                </h2>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {currentPlayer.playerCategory && (
                    <span className="overlay-category-badge" style={{ fontSize: 14, padding: "4px 14px" }}>
                      {currentPlayer.playerCategory}
                    </span>
                  )}
                  {currentPlayer.skill && (
                    <span className="overlay-skill-badge" style={{ fontSize: 14, padding: "4px 14px" }}>
                      {currentPlayer.skill}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="overlay-divider" />

            {/* Bid Info */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
                <span className="overlay-label" style={{ fontSize: 16 }}>Base Price</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                  {currentPlayer.basePrice ?? 0} Pts.
                </span>
              </div>
            </div>

            <div
              className="overlay-glass-light"
              style={{ padding: "24px 28px", textAlign: "center" }}
            >
              <span className="overlay-label" style={{ fontSize: 14, marginBottom: 8, display: "block" }}>
                Current Bid
              </span>
              <div
                className={`overlay-bid-amount-sm ${bidPulse ? "anim-bid-pulse" : ""}`}
                style={{ fontSize: 52 }}
              >
                {currentBid} Pts.
              </div>
              {bidPrice > 0 && (
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginTop: 4, display: "block" }}>
                  Next increment: +{bidPrice} Pts.
                </span>
              )}
            </div>

            {/* Leading Team */}
            {leadingTeamData ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  borderRadius: 16,
                  background: `${teamColor}15`,
                  border: `1px solid ${teamColor}30`,
                }}
              >
                <img
                  src={getDriveThumbnail(leadingTeamData.logo)}
                  alt={leadingTeamData.name}
                  className="overlay-team-logo"
                  style={{ width: 52, height: 52 }}
                  onError={(e) => {
                    e.currentTarget.src = getTeamFallbackAvatar(leadingTeamData.name);
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Bidding
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: teamColor }}>
                    {leadingTeamData.name}
                  </span>
                </div>
                <span className="overlay-live-dot" />
              </div>
            ) : (
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  textAlign: "center",
                  fontSize: 18,
                  color: "rgba(255,255,255,0.3)",
                  fontStyle: "italic",
                }}
              >
                Waiting for bids...
              </div>
            )}

            {/* Recent Bids Feed */}
            {bidHistory.length > 0 && (
              <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Recent Bids
                </span>
                <div style={{ overflow: "hidden" }}>
                  {bidHistory.slice(0, 5).map((bid, i) => (
                    <div
                      key={`${bid.timestamp}-${i}`}
                      className={`overlay-bid-item ${i === 0 ? "overlay-bid-item-active anim-bid-enter" : ""}`}
                      style={{ padding: "8px 12px", fontSize: 14 }}
                    >
                      <img
                        src={getDriveThumbnail(
                          teams.find((t) => t._id === bid.teamId)?.logo
                        )}
                        alt={bid.teamName}
                        className="overlay-team-logo-sm"
                        style={{ width: 28, height: 28 }}
                        onError={(e) => {
                          e.currentTarget.src = getTeamFallbackAvatar(bid.teamName);
                        }}
                      />
                      <span style={{ fontWeight: 700, flex: 1, color: i === 0 ? "#c4b5fd" : "rgba(255,255,255,0.6)" }}>
                        {bid.teamName}
                      </span>
                      <span style={{ fontWeight: 800, color: i === 0 ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
                        {bid.amount} Pts.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standby */
          !showSold &&
          !showUnsold && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                position: "relative",
                zIndex: 2,
              }}
            >
              <div className="overlay-standby-logo" style={{ fontSize: 36 }}>
                🏏 CricBid
              </div>
              <div className="overlay-standby-text" style={{ fontSize: 20 }}>
                {isConnected
                  ? auctionState?.isActive
                    ? "Next player coming up..."
                    : "Auction starting soon"
                  : "Connecting..."}
              </div>
            </div>
          )
        )}

        {/* SOLD Overlay (right panel only) */}
        {showSold && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              background: "rgba(0,0,0,0.4)",
            }}
          >
            <div className="overlay-sold-stamp anim-stamp" style={{ fontSize: 80 }}>
              SOLD!
            </div>
          </div>
        )}

        {/* UNSOLD Overlay (right panel only) */}
        {showUnsold && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              background: "rgba(0,0,0,0.5)",
            }}
          >
            <div className="overlay-unsold-stamp anim-stamp" style={{ fontSize: 70 }}>
              UNSOLD
            </div>
          </div>
        )}
      </div>

      {/* Vertical Divider — positioned at the center line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 4,
          background: `linear-gradient(180deg, transparent 5%, ${teamColor}80 30%, ${teamColor} 50%, ${teamColor}80 70%, transparent 95%)`,
          boxShadow: `0 0 30px ${teamColor}40, 0 0 60px ${teamColor}20`,
          transition: "all 0.8s ease",
          zIndex: 10,
        }}
      />
    </div>
  );
};

export default SplitScreenOverlay;
