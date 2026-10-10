import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useOverlaySocket } from "@/hooks/useOverlaySocket";
import {
  getTeamColor,
  formatOverlayPrice,
  getPlayerPhotoUrl,
  getFallbackAvatar,
  overlayPhotoStyle,
} from "@/lib/overlayUtils";
import { useMaskingEligible } from "@/lib/privacyUtils";
import "./overlays.css";

/**
 * Layout 5 — Broadcast strip
 *
 * The television treatment: one slim band across the bottom of the frame and
 * nothing anywhere else, so a camera or a hall feed can run full-bleed behind
 * it. Three parts, from the bottom up:
 *
 *   • a ticker of every team's remaining purse and squad count, always on, so
 *     a viewer who joins mid-lot can see who can still afford what;
 *   • the player band — photo, name, base price on the left, the leading team
 *     and its bid on the right;
 *   • a row of chips: role, category, and the squad numbers when there are any.
 *
 * SOLD and UNSOLD take over the band itself rather than covering the frame —
 * the auctioneer is usually on camera at that moment and should not be hidden.
 */

const BroadcastOverlay = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [params] = useSearchParams();
  const maskingEligible = useMaskingEligible(tournamentId);

  const {
    auctionState,
    soldEvent,
    unsoldEvent,
    clearSoldEvent,
    clearUnsoldEvent,
  } = useOverlaySocket(tournamentId);

  const [result, setResult] = useState<
    | { kind: "sold"; name: string; team: string; amount: number }
    | { kind: "unsold"; name: string }
    | null
  >(null);
  const [enter, setEnter] = useState(false);
  const prevPlayerRef = useRef<string | null>(null);

  /** ?ticker=0 hides the bottom ticker when the stream already has its own. */
  const showTicker = params.get("ticker") !== "0";

  useEffect(() => {
    document.body.classList.add("overlay-mode");
    return () => document.body.classList.remove("overlay-mode");
  }, []);

  const player = auctionState?.currentPlayer ?? null;
  const teams = auctionState?.teams ?? [];
  const leading = teams.find((t) => String(t._id) === String(auctionState?.leadingTeam));

  // Re-trigger the slide when a new player comes up.
  useEffect(() => {
    const id = player ? String(player._id || player.id || player.name) : null;
    if (id === prevPlayerRef.current) return;
    prevPlayerRef.current = id;
    if (!id) return;
    setEnter(false);
    const t = setTimeout(() => setEnter(true), 20);
    return () => clearTimeout(t);
  }, [player]);

  useEffect(() => {
    if (!soldEvent) return;
    setResult({
      kind: "sold",
      name: soldEvent.player?.name || "Player",
      team: soldEvent.team?.name || "",
      amount: soldEvent.amount || 0,
    });
    const t = setTimeout(() => { setResult(null); clearSoldEvent(); }, 5000);
    return () => clearTimeout(t);
  }, [soldEvent, clearSoldEvent]);

  useEffect(() => {
    if (!unsoldEvent) return;
    setResult({ kind: "unsold", name: unsoldEvent.player?.name || "Player" });
    const t = setTimeout(() => { setResult(null); clearUnsoldEvent(); }, 4000);
    return () => clearTimeout(t);
  }, [unsoldEvent, clearUnsoldEvent]);

  const chips: { label: string; value: string }[] = [];
  if (player?.skill) chips.push({ label: "Role", value: player.skill });
  if (player?.playerCategory) chips.push({ label: "Cat", value: player.playerCategory });
  if (player?.age) chips.push({ label: "Age", value: String(player.age) });
  if (auctionState?.playerNumber) chips.push({ label: "Lot", value: String(auctionState.playerNumber) });

  return (
    <div className="bc-root">
      {/* Result takes over the band, so the camera behind stays clear. */}
      {result && (
        <div className={`bc-result bc-result--${result.kind}`}>
          <span className="bc-result-tag">{result.kind === "sold" ? "SOLD" : "UNSOLD"}</span>
          <span className="bc-result-name">{result.name}</span>
          {result.kind === "sold" && (
            <>
              <span className="bc-result-to">to</span>
              <span className="bc-result-team">{result.team}</span>
              <span className="bc-result-amount">{formatOverlayPrice(result.amount)}</span>
            </>
          )}
        </div>
      )}

      {!result && player && (
        <div className={`bc-band${enter ? " bc-band--in" : ""}`}>
          <div className="bc-cell bc-cell--left">
            <span className="bc-cell-label">Base Price</span>
            <span className="bc-cell-value">{formatOverlayPrice(player.basePrice || 0)}</span>
          </div>

          <div className="bc-identity">
            <div className="bc-photo-ring">
              <img
                className="bc-photo"
                src={getPlayerPhotoUrl(player)}
                alt=""
                style={overlayPhotoStyle(player, maskingEligible)}
                onError={(e) => { (e.target as HTMLImageElement).src = getFallbackAvatar(player.name); }}
              />
            </div>
            <span className="bc-name">{player.name}</span>
          </div>

          <div
            className="bc-cell bc-cell--right"
            style={leading ? { borderColor: getTeamColor(leading.name) } : undefined}
          >
            <span className="bc-cell-label">{leading ? leading.name : "No bids yet"}</span>
            <span className="bc-cell-value">
              {formatOverlayPrice(auctionState?.currentBid || player.basePrice || 0)}
            </span>
          </div>
        </div>
      )}

      {!result && player && chips.length > 0 && (
        <div className={`bc-chips${enter ? " bc-chips--in" : ""}`}>
          {chips.map((c) => (
            <span className="bc-chip" key={c.label}>
              <span className="bc-chip-label">{c.label}:</span> {c.value}
            </span>
          ))}
        </div>
      )}

      {showTicker && teams.length > 0 && (
        <div className="bc-ticker">
          <div className="bc-ticker-track">
            {/* Doubled so the loop has no visible seam. */}
            {[...teams, ...teams].map((t, i) => (
              <span className="bc-ticker-item" key={`${t._id}-${i}`}>
                <span className="bc-ticker-dot" style={{ background: getTeamColor(t.name) }} />
                <span className="bc-ticker-team">{t.name}</span>
                <span className="bc-ticker-purse">{formatOverlayPrice(t.remainingBudget || 0)}</span>
                <span className="bc-ticker-slots">
                  ({t.playersCount ?? 0}/{t.maxPlayersPerTeam ?? 0})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastOverlay;
