import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import apiConfig from "@/config/apiConfig";
import "./overlays.css";

/**
 * Layout 4 — "Auction is starting in …"
 *
 * The holding card a stream sits on before the first player goes up. OBS points
 * a Browser Source at it, the room fills, and the clock does the talking.
 *
 * The target time, in order of preference:
 *   ?at=2026-10-12T19:30:00+05:30   an exact moment (ISO, or epoch ms)
 *   ?in=15                          minutes from when the page loads
 *   the tournament's auctionDate
 *
 * Other knobs, all optional:
 *   ?title=Auction is Starting in   replace the headline
 *   ?note=Doors open 7pm            a line under the clock
 *   ?transparent=1                  no background, to composite over video
 *
 * It deliberately holds at 00:00 rather than counting negative, and swaps the
 * headline once it lands — a stream that starts late should not be announcing
 * a countdown that finished nine minutes ago.
 */

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** ms → H:MM:SS, or MM:SS under an hour, which is the usual case. */
const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

const CountdownOverlay = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [params] = useSearchParams();

  const [tournamentName, setTournamentName] = useState<string>("");
  const [auctionDate, setAuctionDate] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const transparent = params.get("transparent") === "1";
  const headline = params.get("title") || "Auction is Starting in";
  const note = params.get("note") || "";

  // Resolved once: ?in= is relative to page load, so recomputing it every tick
  // would freeze the clock.
  const loadedAt = useRef(Date.now());

  useEffect(() => {
    document.body.classList.add("overlay-mode");
    return () => document.body.classList.remove("overlay-mode");
  }, []);

  // A second is plenty — the display never shows anything finer.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // The tournament supplies the name, and the fallback target.
  useEffect(() => {
    if (!tournamentId) return;
    fetch(`${apiConfig.baseUrl}/api/tournament/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!b?.data) return;
        setTournamentName(b.data.name || "");
        setAuctionDate(b.data.auctionDate || null);
      })
      .catch(() => { /* the clock still works from ?at= or ?in= */ });
  }, [tournamentId]);

  const target = useMemo<number | null>(() => {
    const at = params.get("at");
    if (at) {
      const asNumber = Number(at);
      const parsed = Number.isFinite(asNumber) && at.trim() !== "" ? asNumber : Date.parse(at);
      if (Number.isFinite(parsed)) return parsed;
    }
    const mins = Number(params.get("in"));
    if (Number.isFinite(mins) && mins > 0) return loadedAt.current + mins * 60_000;
    if (auctionDate) {
      const parsed = Date.parse(auctionDate);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }, [params, auctionDate]);

  const remaining = target === null ? null : target - now;
  const landed = remaining !== null && remaining <= 0;

  return (
    <div className={`cd-root${transparent ? " cd-root--transparent" : ""}`}>
      <div className="cd-vignette" aria-hidden="true" />

      <div className="cd-content">
        {tournamentName && <p className="cd-tournament">{tournamentName}</p>}

        <div className="cd-headline-row">
          <span className="cd-rule" aria-hidden="true" />
          <h1 className="cd-headline">
            {landed ? (
              <>
                Auction is <em>Starting</em> Now
              </>
            ) : (
              headline.split(/(Starting)/i).map((part, i) =>
                /^starting$/i.test(part) ? <em key={i}>{part}</em> : <span key={i}>{part}</span>
              )
            )}
          </h1>
          <span className="cd-rule" aria-hidden="true" />
        </div>

        {!landed && (
          <p className="cd-clock" role="timer">
            {remaining === null ? "--:--" : formatRemaining(remaining)}
          </p>
        )}

        {note && <p className="cd-note">{note}</p>}
        {remaining === null && !note && (
          <p className="cd-note">Starting shortly</p>
        )}
      </div>
    </div>
  );
};

export default CountdownOverlay;
