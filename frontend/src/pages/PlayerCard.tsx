import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Copy, Download, Loader2, Play, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import apiConfig from "@/config/apiConfig";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * The public, shareable player card.
 *
 * Reached from the sold WhatsApp message, posted to an Instagram story or a
 * WhatsApp status. Two controls: a theme, and which blocks appear.
 *
 * Why the card is drawn at a fixed pixel size and scaled with a transform:
 * html2canvas rasterises the live DOM, so the exported PNG is only predictable
 * if the node has the exact dimensions we intend. The card renders at 540px
 * wide and exports at scale 2, giving the 1080px width every platform wants.
 */

const STORY = { w: 540, h: 960 };
const SQUARE = { w: 540, h: 540 };

interface CardStats {
  totalMatches: number | null;
  totalRuns: number | null;
  totalWickets: number | null;
  battingStrikeRate: number | null;
  battingAverage: number | null;
  highestScore: string | null;
  catches: number | null;
}

interface CardData {
  shareCode: string;
  player: {
    name: string | null;
    photo: string | null;
    skill: string | null;
    category: string | null;
    lot: number | null;
    sold: boolean;
    amtSold: number | null;
  };
  team: { name: string | null; logo: string | null } | null;
  tournament: { id: string; name: string | null; logo: string | null; streamUrl: string | null } | null;
  stats: CardStats | null;
}

type Composition = "stamp" | "centre" | "board";

interface Theme {
  key: string;
  name: string;
  composition: Composition;
  ground: string;
  rays: string;
  glow: string;
  ink: string;
  muted: string;
  panel: string;
  accent: string;
  onAccent: string;
  line: string;
  price: string;
  stamp: "red" | "neon" | "none";
  italic: boolean;
}

const THEMES: Theme[] = [
  {
    key: "stamp", name: "Gold Stamp", composition: "stamp",
    ground: "#0a0604",
    rays: "repeating-linear-gradient(104deg, #1a0d05 0 38px, #130a04 38px 76px)",
    glow: "radial-gradient(ellipse at 50% 0%, rgba(240,140,20,0.55) 0%, rgba(240,140,20,0.16) 44%, rgba(240,140,20,0) 70%)",
    ink: "#ffffff", muted: "#c99b4a", panel: "#241307",
    accent: "#f0b429", onAccent: "#16120a", line: "#7a5a1e", price: "#f0b429",
    stamp: "red", italic: true,
  },
  {
    key: "floodlit", name: "Floodlit", composition: "centre",
    ground: "#050a14",
    rays: "repeating-linear-gradient(72deg, #0b1a33 0 30px, #061020 30px 60px)",
    glow: "radial-gradient(ellipse at 50% 0%, rgba(56,132,255,0.5) 0%, rgba(56,132,255,0.12) 46%, rgba(56,132,255,0) 72%)",
    ink: "#ffffff", muted: "#8fa8cc", panel: "#0e1b33",
    accent: "#f0b429", onAccent: "#16120a", line: "#28406b", price: "#f0b429",
    stamp: "red", italic: true,
  },
  {
    key: "neon", name: "Neon Night", composition: "stamp",
    ground: "#0a0414",
    rays: "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 15px)",
    glow: "radial-gradient(ellipse at 50% 100%, rgba(217,70,239,0.45) 0%, rgba(217,70,239,0.1) 48%, rgba(217,70,239,0) 74%)",
    ink: "#ffffff", muted: "#b38ecf", panel: "#170b24",
    accent: "#e879f9", onAccent: "#1b0620", line: "#3b2152", price: "#e879f9",
    stamp: "neon", italic: false,
  },
  {
    key: "board", name: "Scoreboard", composition: "board",
    ground: "#f4f1e8",
    rays: "none",
    glow: "none",
    ink: "#15223b", muted: "#5d6b85", panel: "#ddd8c7",
    accent: "#15223b", onAccent: "#f4f1e8", line: "#15223b", price: "#15223b",
    stamp: "none", italic: false,
  },
  {
    key: "midnight", name: "Midnight", composition: "centre",
    ground: "#0d0d14",
    rays: "none",
    glow: "none",
    ink: "#ffffff", muted: "#8b8ba0", panel: "#1a1424",
    accent: "#7c3aed", onAccent: "#ffffff", line: "#312b45", price: "#4ade80",
    stamp: "none", italic: false,
  },
];

const BLOCKS = [
  { key: "photo", label: "My photo" },
  { key: "result", label: "What I sold for" },
  { key: "category", label: "Category and role" },
  { key: "tournament", label: "Tournament name" },
  { key: "stats", label: "CricHeroes stats" },
] as const;

type BlockKey = (typeof BLOCKS)[number]["key"];

const money = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-IN") : "";

const initials = (name: string | null) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Two lines where the name allows it, so the display type can run large. */
const nameLines = (name: string | null) => {
  const parts = (name || "Player").trim().split(/\s+/);
  if (parts.length === 1) return [parts[0]];
  const first = parts.slice(0, Math.max(1, parts.length - 1)).join(" ");
  return [first, parts[parts.length - 1]];
};

const PlayerCard = () => {
  const { code } = useParams<{ code: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState("stamp");
  const [square, setSquare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<Record<BlockKey, boolean>>({
    photo: true, result: true, category: true, tournament: true, stats: false,
  });
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${apiConfig.baseUrl}/api/player-card?code=${encodeURIComponent(code || "")}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) throw new Error(json?.message || "No card found for that link");
        if (!live) return;
        setCard(json.data as CardData);
        // Stats are off unless this player actually has them — most do not.
        if ((json.data as CardData).stats) setShow((s) => ({ ...s, stats: true }));
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not open this card");
      }
    })();
    return () => { live = false; };
  }, [code]);

  const theme = useMemo(
    () => THEMES.find((t) => t.key === themeKey) || THEMES[0],
    [themeKey]
  );
  const size = square ? SQUARE : STORY;
  const shortUrl = card ? `cricbid.online/c/${card.shareCode}` : "";
  const fullUrl = card ? `${window.location.origin}/c/${card.shareCode}` : "";

  /** Rasterise the card at 2x, which is 1080px wide — the size every app wants. */
  const toBlob = useCallback(async (): Promise<Blob | null> => {
    if (!artRef.current) return null;
    const canvas = await html2canvas(artRef.current, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      width: size.w,
      height: size.h,
      windowWidth: size.w,
      windowHeight: size.h,
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }, [size.w, size.h]);

  const fileName = `${(card?.player.name || "player").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-cricbid.png`;

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const shareCard = async () => {
    setBusy(true);
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("Could not make the image");
      const file = new File([blob], fileName, { type: "image/png" });

      // The link cannot be attached to an Instagram story by us, so put it on
      // the clipboard first — then it is a paste into the link sticker.
      try { await navigator.clipboard.writeText(fullUrl); } catch { /* not fatal */ }

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: `${card?.player.name} · ${shortUrl}` });
      } else {
        download(blob);
        toast.success("Card saved. The link is on your clipboard too.");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast.error("Could not share that — try Save image instead.");
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async () => {
    setBusy(true);
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("no blob");
      download(blob);
    } catch {
      toast.error("Could not save the image. Open this link in Chrome and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — long-press the link instead");
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f16] px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">This card could not be opened</p>
          <p className="mt-2 text-sm text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f16] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const img = (which: "photo" | "teamLogo" | "tournamentLogo") =>
    `${apiConfig.baseUrl}/api/player-card/image?code=${encodeURIComponent(card.shareCode)}&which=${which}`;

  const p = card.player;
  const [lineA, lineB] = nameLines(p.name);
  const display = theme.italic ? "italic" : "normal";
  const roleBits = [p.category, p.skill].filter(Boolean).join(" · ");
  const showResult = show.result && p.sold;
  const statFigures = card.stats
    ? [
        { label: "Matches", value: card.stats.totalMatches },
        { label: "Runs", value: card.stats.totalRuns },
        { label: "Wickets", value: card.stats.totalWickets },
      ].filter((s) => typeof s.value === "number")
    : [];

  // ── the card itself ───────────────────────────────────────────────────────
  const photoBox = (round: boolean, px: number) => (
    <div
      style={{
        width: px, height: px, borderRadius: round ? "50%" : 14,
        border: `5px solid ${theme.accent}`, background: theme.panel,
        display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0,
      }}
    >
      {p.photo ? (
        <img
          src={img("photo")}
          alt={p.name || "Player"}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: px * 0.4, fontWeight: 700, color: theme.accent }}>
          {initials(p.name)}
        </span>
      )}
    </div>
  );

  const stampMark = theme.stamp === "none" || !p.sold ? null : theme.stamp === "neon" ? (
    <p style={{
      margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: 46,
      lineHeight: 1, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#ffffff", textShadow: `0 0 10px ${theme.accent}, 0 0 26px ${theme.accent}`,
    }}>Sold</p>
  ) : (
    <div style={{ transform: "rotate(-13deg)", display: "inline-block" }}>
      <div style={{ border: "5px solid #e11d2f", borderRadius: 9, padding: "4px 16px 7px", background: "rgba(0,0,0,0.3)" }}>
        <p style={{
          margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontStyle: "italic",
          fontSize: 54, lineHeight: 0.82, fontWeight: 700, letterSpacing: "0.05em",
          color: "#e11d2f", textTransform: "uppercase",
        }}>Sold</p>
      </div>
    </div>
  );

  const footer = (
    <div style={{
      height: 52, flexShrink: 0, background: theme.composition === "board" ? theme.accent : "#0f0f16",
      borderTop: `2px solid ${theme.composition === "board" ? theme.accent : theme.accent}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px",
    }}>
      <p style={{ margin: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, fontWeight: 600, color: theme.composition === "board" ? "#c4b5fd" : "#a78bfa" }}>
        {shortUrl}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 7, background: "#7c3aed" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 18h16M7 18V9M12 18V5M17 18v-6" /></svg>
        </span>
        <span style={{ fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: 23, fontWeight: 700, color: "#ffffff" }}>CricBid</span>
      </div>
    </div>
  );

  const tournamentRow = show.tournament && card.tournament && (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {card.tournament.logo && (
        <img src={img("tournamentLogo")} alt="" crossOrigin="anonymous"
          style={{ width: 48, height: 48, borderRadius: 10, background: "#fff", objectFit: "contain", flexShrink: 0 }} />
      )}
      <p style={{
        margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontStyle: display,
        fontSize: 27, lineHeight: 0.98, fontWeight: 700, textTransform: "uppercase", color: theme.accent,
      }}>{card.tournament.name}</p>
    </div>
  );

  const resultRow = showResult && (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {card.team?.logo && (
          <img src={img("teamLogo")} alt="" crossOrigin="anonymous"
            style={{ width: 56, height: 56, borderRadius: 11, background: "#fff", objectFit: "contain", flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted }}>Sold to</p>
          <p style={{
            margin: "3px 0 0", fontFamily: "'Barlow Condensed', Inter, sans-serif", fontStyle: display,
            fontSize: 28, lineHeight: 0.92, fontWeight: 700, textTransform: "uppercase",
          }}>{card.team?.name}</p>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted }}>Points</p>
        <p style={{
          margin: "1px 0 0", fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: 58,
          lineHeight: 0.86, fontWeight: 700, color: theme.price, fontVariantNumeric: "tabular-nums",
        }}>{money(p.amtSold)}</p>
      </div>
    </div>
  );

  const statsRow = show.stats && statFigures.length > 0 && (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${statFigures.length}, minmax(0, 1fr))`, gap: 10 }}>
      {statFigures.map((s) => (
        <div key={s.label} style={{ background: theme.panel, borderRadius: 12, padding: "11px 13px" }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.muted }}>{s.label}</p>
          <p style={{ margin: "3px 0 0", fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: 32, lineHeight: 1, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );

  const notSoldRow = show.result && !p.sold && (
    <div style={{ border: `1px solid ${theme.line}`, borderRadius: 12, padding: "12px 15px" }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.muted }}>
        Registered{p.lot ? ` · lot ${p.lot}` : ""}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 700 }}>Going into the auction</p>
    </div>
  );

  const art = (
    <div
      ref={artRef}
      style={{
        width: size.w, height: size.h, boxSizing: "border-box", position: "relative",
        overflow: "hidden", background: theme.ground, color: theme.ink,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {theme.rays !== "none" && <div style={{ position: "absolute", inset: 0, background: theme.rays }} />}
      {theme.glow !== "none" && (
        <div style={{ position: "absolute", left: "-10%", top: "-32%", width: "120%", height: "86%", background: theme.glow }} />
      )}
      {theme.rays !== "none" && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: "46%",
          background: `linear-gradient(to top, ${theme.ground} 32%, ${theme.ground}b8 70%, transparent)`,
        }} />
      )}

      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
        {theme.composition === "board" ? (
          <>
            <div style={{ background: theme.accent, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexShrink: 0 }}>
              <p style={{ margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: 25, fontWeight: 700, textTransform: "uppercase", color: theme.onAccent }}>
                {show.tournament ? card.tournament?.name : "Player card"}
              </p>
              {p.lot && <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.onAccent, opacity: 0.75 }}>Lot {p.lot}</p>}
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                {show.photo && photoBox(false, square ? 150 : 210)}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontSize: square ? 44 : 54, lineHeight: 0.86, fontWeight: 700, textTransform: "uppercase" }}>
                    {lineA}{lineB && <><br />{lineB}</>}
                  </h1>
                  {show.category && roleBits && (
                    <p style={{ margin: "10px 0 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>{roleBits}</p>
                  )}
                </div>
              </div>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
                {statsRow}
                {resultRow}
                {notSoldRow}
              </div>
            </div>
          </>
        ) : theme.composition === "centre" ? (
          <div style={{ flex: 1, minHeight: 0, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {tournamentRow}
            {show.photo && photoBox(true, square ? 160 : 250)}
            <h1 style={{
              margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontStyle: display,
              fontSize: square ? 42 : 58, lineHeight: 0.88, fontWeight: 700, textTransform: "uppercase",
              textAlign: "center", textShadow: "0 2px 14px rgba(0,0,0,0.75)",
            }}>
              {lineA}{lineB && <><br />{lineB}</>}
            </h1>
            {show.category && roleBits && (
              <span style={{ padding: "5px 13px", borderRadius: 999, background: theme.accent, color: theme.onAccent, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{roleBits}</span>
            )}
            <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
              {statsRow}
              {stampMark && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 92 }}>{stampMark}</div>
              )}
              {resultRow}
              {notSoldRow}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {tournamentRow}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 style={{
                  margin: 0, fontFamily: "'Barlow Condensed', Inter, sans-serif", fontStyle: display,
                  fontSize: square ? 46 : 62, lineHeight: 0.86, fontWeight: 700, textTransform: "uppercase",
                  textShadow: "0 3px 16px rgba(0,0,0,0.8)",
                }}>
                  {lineA}{lineB && <><br />{lineB}</>}
                </h1>
                {show.category && roleBits && (
                  <span style={{ display: "inline-block", marginTop: 11, padding: "5px 11px", borderRadius: 4, background: "rgba(0,0,0,0.5)", border: `1px solid ${theme.line}`, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.accent }}>
                    {roleBits}{p.lot ? ` · Lot ${p.lot}` : ""}
                  </span>
                )}
              </div>
              {show.photo && photoBox(true, square ? 150 : 246)}
            </div>
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {stampMark && (
                <div style={{ display: "flex", alignItems: "center", height: 92, marginBottom: 2 }}>{stampMark}</div>
              )}
              {statsRow}
              {resultRow}
              {notSoldRow}
            </div>
          </div>
        )}
        {footer}
      </div>
    </div>
  );

  // Fit the fixed-size art into whatever width the phone gives us.
  const scale = Math.min(1, 330 / size.w);

  return (
    <div className="min-h-screen bg-[#0f0f16] text-white">
      <div className="mx-auto max-w-md px-4 pb-8 pt-5">
        <p className="text-center text-sm font-bold">{p.name}</p>
        <p className="mt-0.5 text-center text-xs text-white/50">
          {p.sold ? "Your card is ready to share" : "Your player card"}
        </p>

        {/* The card, scaled for display. The export uses the unscaled node. */}
        <div className="mt-4 flex justify-center">
          <div style={{ width: size.w * scale, height: size.h * scale }}>
            {/* The wrapper needs the art's own size: it clips, and a narrower
                box would cut the card off rather than scale it. */}
            <div style={{
              width: size.w, height: size.h,
              transform: `scale(${scale})`, transformOrigin: "top left",
              borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 34px rgba(0,0,0,0.5)",
            }}>
              {art}
            </div>
          </div>
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-white/40">Theme</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setThemeKey(t.key)}
              aria-pressed={t.key === themeKey}
              className="min-h-11 rounded-xl border-2 px-2 text-xs font-bold transition-transform duration-150 ease-out active:scale-[0.97]"
              style={{
                borderColor: t.key === themeKey ? "#7c3aed" : "#2e2e3a",
                background: t.ground,
                color: t.key === "board" ? t.ink : t.accent,
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-white/40">Shape</p>
        <div className="mt-2 flex gap-2">
          {[
            { label: "Story 9:16", on: !square, set: false },
            { label: "Square 1:1", on: square, set: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setSquare(o.set)}
              aria-pressed={o.on}
              className={`min-h-11 flex-1 rounded-xl border text-[13px] font-semibold transition-colors duration-150 ease-out active:scale-[0.97] ${
                o.on ? "border-violet-600 bg-violet-600/15 text-white" : "border-white/15 text-white/70"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-white/40">What to show</p>
        <div className="mt-2 flex flex-col gap-2">
          {BLOCKS.map((b) => {
            const disabled = b.key === "stats" && !card.stats;
            const on = show[b.key] && !disabled;
            return (
              <button
                key={b.key}
                type="button"
                disabled={disabled}
                onClick={() => setShow((s) => ({ ...s, [b.key]: !s[b.key] }))}
                aria-pressed={on}
                className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left transition-colors duration-150 ease-out disabled:opacity-40"
                style={{ borderColor: on ? "#3b3b4d" : "#22222c", background: on ? "#17171f" : "transparent" }}
              >
                <span
                  className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-md border"
                  style={{ background: on ? "#7c3aed" : "transparent", borderColor: on ? "#7c3aed" : "#3b3b4d" }}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-sm font-semibold">{b.label}</span>
                {disabled && <span className="text-[11px] text-white/40">not linked</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            onClick={shareCard}
            disabled={busy}
            className="h-12 w-full rounded-xl bg-violet-600 text-[15px] font-bold transition-transform duration-150 ease-out active:scale-[0.98] hover:bg-violet-500"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Share my card
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={saveImage} disabled={busy}
              className="h-11 flex-1 rounded-xl border-white/15 text-[13px] transition-transform duration-150 ease-out active:scale-[0.97]">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Save image
            </Button>
            <Button type="button" variant="outline" onClick={copyLink}
              className="h-11 flex-1 rounded-xl border-white/15 text-[13px] transition-transform duration-150 ease-out active:scale-[0.97]">
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
            </Button>
          </div>
          {card.tournament?.streamUrl && (
            <a
              href={card.tournament.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-[13px] font-semibold text-white/80 transition-colors duration-150 ease-out hover:border-white/30 hover:text-white"
            >
              <Play className="h-3.5 w-3.5" /> Watch the auction
            </a>
          )}
          <p className="mt-1 text-center text-[11px] leading-relaxed text-white/40">
            Posting to an Instagram story? The link is copied for you — add a Link sticker and paste it.
            If saving does nothing, open this page in Chrome.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
