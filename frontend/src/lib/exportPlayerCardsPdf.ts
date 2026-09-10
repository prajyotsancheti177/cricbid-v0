import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";
import { jsonAuthHeaders } from "@/lib/auth";

interface RawPlayer {
  name?: string;
  age?: number | string;
  mobile?: number | string;
  skill?: string;
  photo?: string;
  playerCategory?: string;
  amtSold?: number;
  sold?: boolean;
  auctionSerialNumber?: number;
  teamName?: string;
  /** The API returns this either as an id or as a populated { _id, name }. */
  teamId?: string | { _id?: string };
  basePrice?: number;
}

const CARDS_PER_PAGE_DEFAULT = 12;
const PAGE_WIDTH_PX = 794; // A4 @ 96dpi

const STYLE_ID = "pcg-player-cards-style";

/** Injects the card-page CSS (scoped under .pcg-root) once per document. */
function ensureStylesInjected() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
  .pcg-root{
    font-family: 'Trebuchet MS', 'Verdana', sans-serif;
  }
  .pcg-root .page{
    width:${PAGE_WIDTH_PX}px;
    min-height:1123px;
    background:
      radial-gradient(ellipse at top right, #4a0f28 0%, transparent 55%),
      radial-gradient(ellipse at bottom left, #3a0d20 0%, transparent 60%),
      linear-gradient(160deg, #1a0a14 0%, #240a18 45%, #1a0814 100%);
    padding:24px 28px 32px;
    position:relative;
    overflow:hidden;
  }
  .pcg-root .page-header{
    text-align:center;
    margin-bottom:24px;
    position:relative;
  }
  .pcg-root .presents-line{
    font-size:9px;
    letter-spacing:2px;
    color:#c98aa0;
    text-transform:uppercase;
    margin-bottom:2px;
    font-weight:600;
  }
  .pcg-root .doctors-line{
    font-size:9px;
    letter-spacing:1px;
    color:#c98aa0;
    text-transform:uppercase;
    margin-bottom:8px;
  }
  .pcg-root .main-title{
    font-size:22px;
    font-weight:800;
    letter-spacing:1.5px;
    text-transform:uppercase;
    color:#ffffff;
    text-shadow: 0 0 18px rgba(230,67,122,0.45);
  }
  .pcg-root .team-title-wrapper{
    margin-top: 18px;
  }
  .pcg-root .team-title{
    font-size: 26px;
    font-weight: 800;
    color: #f0c040;
    text-transform: uppercase;
    letter-spacing: 2px;
    background: linear-gradient(90deg, transparent, rgba(240, 192, 64, 0.12), transparent);
    padding: 8px 60px;
    border-top: 1px solid rgba(240, 192, 64, 0.3);
    border-bottom: 1px solid rgba(240, 192, 64, 0.3);
    display: inline-block;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  }
  .pcg-root .player-range{
    position:absolute;
    top:0;
    right:0;
    font-size:9px;
    color:#9a8590;
    letter-spacing:0.5px;
  }
  .pcg-root .grid{
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    gap:16px;
  }
  .pcg-root .card{
    background:linear-gradient(160deg, #0f0a14 0%, #16101c 100%);
    border:1px solid #3a2a36;
    border-left:4px solid #2ecc71;
    border-radius:8px;
    padding:12px 14px 14px;
    display:flex;
    flex-direction:column;
    gap:8px;
    position:relative;
    min-width:0;
  }
  .pcg-root .card-top{
    display:flex;
    /* Stay top-aligned: a name that wraps to two lines would otherwise drag a
       centred badge down to the middle of the block. The badge box is taller
       than the name's first line, so nudge the name down to meet it. */
    align-items:flex-start;
    gap:8px;
    min-width:0;
  }
  .pcg-root .badge{
    background:linear-gradient(135deg,#2ecc71,#1ca557);
    color:#062b14;
    font-size:11px;
    font-weight:800;
    /* Roomier than the digits need. html2canvas positions text from font
       metrics that differ between engines: in some the glyphs land ~4.5px
       lower than in Chrome, which clipped them against a snug box. The slack
       is the safety net; calibrateBadgeText() below does the centring. Do not
       tighten this to make the pill look neater — that is the bug. */
    line-height:14px;
    padding:4px 9px 5px;
    border-radius:4px;
    flex-shrink:0;
    display:inline-block;
    text-align:center;
    font-variant-numeric:tabular-nums;
    margin-top:0;
  }
  .pcg-root .badge-num{
    display:inline-block;
    /* Set by calibrateBadgeText() from what this browser actually rasterises. */
    position:relative;
    top:var(--pcg-num-shift, 0px);
  }
  .pcg-root .player-name{
    margin-top:3px;
    font-size:14px;
    font-weight:800;
    color:#fff;
    line-height:1.25;
    text-transform:uppercase;
    letter-spacing:0.2px;
    overflow-wrap: break-word;
    word-break: break-word;
    flex:1;
    min-width:0;
  }
  .pcg-root .card-body{
    display:flex;
    gap:12px;
    align-items:stretch;
  }
  .pcg-root .photo-box{
    width:75px;
    flex-shrink:0;
    border-radius:6px;
    overflow:hidden;
    background:#3a2230;
    border:1px solid #4a2e3a;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:7px;
    color:#c98aa0;
    text-align:center;
    line-height:1.2;
    position:relative;
    min-height:95px;
    max-height:115px;
  }
  .pcg-root .photo-box img{
    width:100%;
    height:100%;
    object-fit:cover;
    object-position:top;
  }
  .pcg-root .photo-placeholder-text{
    font-size:8px;
    font-weight:700;
    letter-spacing:0.5px;
    color:#a87690;
  }
  .pcg-root .info-table{
    flex:1;
    font-size:10px;
    display:flex;
    flex-direction:column;
    gap:4px;
    min-width:0;
  }
  .pcg-root .info-row{
    display:flex;
    justify-content:space-between;
    gap:6px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    padding-bottom:2px;
  }
  .pcg-root .info-row:last-child{
    border-bottom:none;
  }
  .pcg-root .info-label{
    color:#8a7880;
    font-weight:600;
    letter-spacing:0.3px;
    white-space:nowrap;
  }
  .pcg-root .info-value{
    color:#fff;
    font-weight:700;
    text-align:right;
    overflow-wrap: break-word;
    word-break: break-word;
    min-width:0;
  }
  .pcg-root .info-value.cat-value{
    color:#7fd8a0;
  }
  .pcg-root .info-value.sold-value{
    color:#f0c040;
  }
  `;
  document.head.appendChild(style);
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getInitialsPlaceholder(name: string): string {
  const clean = (name || "?").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return initials || "?";
}

function convertImgToBase64(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 300;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now();
  });
}

function buildCard(player: RawPlayer, index: number): string {
  const name = escapeHtml(player.name || "Unknown Player");
  const mobile = player.mobile ? escapeHtml(player.mobile) : "—";
  const category = player.playerCategory ? escapeHtml(player.playerCategory) : "—";
  const age = player.age !== null && player.age !== undefined && player.age !== "" ? escapeHtml(player.age) : "—";
  const role = escapeHtml(player.skill || "—");
  const amtSold = player.amtSold ?? 0;
  // Before the auction nobody has a sale price, so the card shows the base
  // price instead — that is what team owners need when reviewing the list.
  const basePrice = player.basePrice ?? 0;
  const priceLabel = player.sold ? "SOLD" : "BASE";
  const priceValue = player.sold
    ? `₹${escapeHtml(amtSold)}`
    : (basePrice > 0 ? `₹${escapeHtml(basePrice)}` : "—");
  const serialNum = player.auctionSerialNumber != null ? escapeHtml(player.auctionSerialNumber) : index + 1;

  const photoHtml = player.photo
    ? `<img src="${escapeHtml(player.photo)}" alt="${name}" crossorigin="anonymous" loading="eager">`
    : `<span class="photo-placeholder-text">${escapeHtml(getInitialsPlaceholder(player.name || ""))}<br>PHOTO</span>`;

  return `
  <div class="card">
    <div class="card-top">
      <span class="badge"><span class="badge-num">#${serialNum}</span></span>
      <div class="player-name">${name}</div>
    </div>
    <div class="card-body">
      <div class="photo-box">${photoHtml}</div>
      <div class="info-table">
        <div class="info-row">
          <span class="info-label">MOBILE</span>
          <span class="info-value">${mobile}</span>
        </div>
        <div class="info-row">
          <span class="info-label">CATEGORY</span>
          <span class="info-value cat-value">${category}</span>
        </div>
        <div class="info-row">
          <span class="info-label">AGE</span>
          <span class="info-value">${age}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ROLE</span>
          <span class="info-value" title="${role}">${role}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${priceLabel}</span>
          <span class="info-value sold-value">${priceValue}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function buildPage(
  players: RawPlayer[],
  startIndex: number,
  totalCount: number,
  champName: string,
  teamName: string,
  rangeNoun: string = "Team Players"
): string {
  const rangeStart = startIndex + 1;
  const rangeEnd = startIndex + players.length;
  const cardsHtml = players.map((p, i) => buildCard(p, startIndex + i)).join("");

  return `
  <div class="page">
    <div class="page-header">
      <div class="player-range">${rangeNoun} ${rangeStart} - ${rangeEnd} of ${totalCount}</div>
      <div class="main-title">${escapeHtml(champName)}</div>
      <div class="team-title-wrapper">
        <div class="team-title">${escapeHtml(teamName)}</div>
      </div>
    </div>
    <div class="grid">
      ${cardsHtml}
    </div>
  </div>`;
}

function waitForImages(container: HTMLElement, timeoutMs = 8000): Promise<void[]> {
  const imgs = Array.from(container.querySelectorAll("img"));
  const promises = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, timeoutMs);
    });
  });
  return Promise.all(promises);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Works out how far off-centre this browser's html2canvas puts the badge text,
 * and returns the correction in CSS px (negative moves the number up).
 *
 * html2canvas derives text position from font metrics, and engines disagree:
 * the same markup that centres in Chrome rendered ~4.5px lower elsewhere,
 * riding the bottom of the pill (and clipping against a tighter one). Rather
 * than hard-code a nudge that would then be wrong in Chrome, rasterise one
 * throwaway badge and measure the result.
 *
 * Returns 0 on any failure — the pill has enough slack that an uncorrected
 * badge still renders intact, just low.
 */
async function calibrateBadgeText(): Promise<number> {
  const SCALE = 4;
  let probe: HTMLElement | null = null;
  try {
    probe = document.createElement("div");
    probe.className = "pcg-root";
    probe.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;";
    probe.innerHTML = `<span class="badge"><span class="badge-num">#8</span></span>`;
    document.body.appendChild(probe);

    const badge = probe.querySelector<HTMLElement>(".badge");
    if (!badge) return 0;

    const canvas = await html2canvas(badge, { backgroundColor: null, scale: SCALE, logging: false });
    const { width: w, height: h } = canvas;
    const data = canvas.getContext("2d")?.getImageData(0, 0, w, h).data;
    if (!data) return 0;

    // Only look down the middle of the pill, clear of its rounded corners.
    const xa = Math.floor(w * 0.25);
    const xb = Math.floor(w * 0.75);
    let pillTop = Infinity, pillBottom = -1, inkTop = Infinity, inkBottom = -1;

    for (let y = 0; y < h; y++) {
      for (let x = xa; x < xb; x++) {
        const p = (y * w + x) * 4;
        const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
        if (a < 30) continue;
        if (g > 110 && g > r + 40 && g > b + 40) {
          if (y < pillTop) pillTop = y;
          if (y > pillBottom) pillBottom = y;
        } else if (r < 90 && g < 100 && b < 90) {
          if (y < inkTop) inkTop = y;
          if (y > inkBottom) inkBottom = y;
        }
      }
    }

    if (pillBottom < 0 || inkBottom < 0 || inkTop === Infinity) return 0;

    const above = inkTop - pillTop;
    const below = pillBottom - inkBottom;
    const shift = ((above - below) / 2) / SCALE; // >0 means the text sits low

    // Cap it: a wild reading means the scan misfired, not that the text is 20px out.
    if (!Number.isFinite(shift) || Math.abs(shift) > 10) return 0;
    return -shift;
  } catch {
    return 0;
  } finally {
    if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
  }
}

/** Group heading for players who have not been sold yet. */
const UNASSIGNED_GROUP = "Available Players";

/**
 * A team is considered done once it has this many players. When every team has
 * reached it the auction is treated as finished, and the team-wise export drops
 * the "Available Players" section — at that point the leftovers are not on offer
 * any more, so printing them alongside the squads is misleading.
 */
const MIN_SOLD_PER_TEAM = 4;
/** Sold, but with no team on record — older tournaments carry data like this. */
const SOLD_NO_TEAM_GROUP = "Sold Players";

export type CardsGrouping = "team" | "category" | "overall";

export interface PlayerCardsOptions {
  /** How the cards are grouped into sections, one section per page run. */
  grouping?: CardsGrouping;
  /** Cards on a single page. Raising it keeps a large squad on one page. */
  cardsPerPage?: number;
  /** For "category" and "overall": how many players each section shows. */
  topN?: number;
}

/**
 * Ranking used by the "top N" groupings.
 *
 * Sold price first, so after an auction the most expensive players lead. Base
 * price breaks ties, and serial number is the final fallback — which is what
 * decides the order before an auction has happened, when every amount is 0.
 */
const byRank = (a: RawPlayer, b: RawPlayer) => {
  const amt = (Number(b.amtSold) || 0) - (Number(a.amtSold) || 0);
  if (amt !== 0) return amt;
  const base = (Number(b.basePrice) || 0) - (Number(a.basePrice) || 0);
  if (base !== 0) return base;
  return (a.auctionSerialNumber ?? 999999) - (b.auctionSerialNumber ?? 999999);
};

/**
 * Every team has at least MIN_SOLD_PER_TEAM players sold to it.
 *
 * Counted against the real team list, not the players: a team that has bought
 * nobody yet appears nowhere in the player data, and inferring the teams from
 * the players would silently skip it and call an unfinished auction complete.
 * With no teams at all (nothing has been set up yet) this is false, never
 * vacuously true.
 */
function isAuctionComplete(
  teams: { _id: string; name?: string }[],
  players: RawPlayer[]
): boolean {
  if (!teams.length) return false;

  const soldPerTeam = new Map<string, number>(teams.map((t) => [String(t._id), 0]));
  // Fall back to matching on name: teamId is populated for players fetched via
  // /api/player/all but not everywhere, and a squad miscounted as empty would
  // wrongly report the auction as unfinished.
  const idByName = new Map<string, string>(
    teams.filter((t) => t.name).map((t) => [t.name!.trim().toLowerCase(), String(t._id)])
  );

  for (const p of players) {
    if (!p.sold) continue;
    const rawId = typeof p.teamId === "object" && p.teamId !== null ? p.teamId._id : p.teamId;
    const id = rawId
      ? String(rawId)
      : idByName.get((p.teamName || "").trim().toLowerCase()) || "";
    if (soldPerTeam.has(id)) soldPerTeam.set(id, (soldPerTeam.get(id) ?? 0) + 1);
  }

  return [...soldPerTeam.values()].every((n) => n >= MIN_SOLD_PER_TEAM);
}

/**
 * Fetches every player in a tournament and generates a "player card" style PDF.
 *
 * Grouping:
 *  - "team"     one section per team, ordered by what each player went for,
 *               with unsold players under "Available Players" so the export is
 *               useful before the auction too.
 *  - "category" one section per player category, each showing its top N.
 *  - "overall"  a single section with the tournament's top N.
 */
export async function exportPlayerCardsPdf(
  tournamentName: string,
  overrideTournamentId?: string,
  options: PlayerCardsOptions = {}
): Promise<void> {
  const grouping: CardsGrouping = options.grouping || "team";
  const topN = Math.max(1, Number(options.topN) || 5);
  const cardsPerPage = Math.max(1, Number(options.cardsPerPage) || CARDS_PER_PAGE_DEFAULT);

  const tournamentId = overrideTournamentId || getSelectedTournamentId();
  if (!tournamentId) {
    throw new Error("No tournament selected");
  }

  // Read the player list rather than team rosters: an unsold player belongs to
  // no team, so team rosters cannot see them at all.
  const playersRes = await fetch(`${apiConfig.baseUrl}/api/player/all`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ touranmentId: tournamentId }),
  });

  if (!playersRes.ok) {
    throw new Error("Failed to fetch data for PDF export");
  }

  const playersData = await playersRes.json();
  const allPlayersRaw: RawPlayer[] = playersData.data ?? [];

  // Only the team-wise export needs to know whether the auction has finished.
  // If the team list can't be read, fall through as "not complete" so the
  // available players are still printed rather than silently dropped.
  let auctionComplete = false;
  if (grouping === "team") {
    try {
      const teamsRes = await fetch(`${apiConfig.baseUrl}/api/team/all`, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ touranmentId: tournamentId }),
      });
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        const teams = teamsData.data?.[0]?.teams ?? [];
        auctionComplete = isAuctionComplete(teams, allPlayersRaw);
      }
    } catch {
      /* leave auctionComplete false */
    }
  }

  // Bucket the players into sections according to the chosen grouping.
  const groupOrder: string[] = [];
  const byGroup = new Map<string, RawPlayer[]>();
  const push = (key: string, player: RawPlayer) => {
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      groupOrder.push(key);
    }
    byGroup.get(key)!.push(player);
  };

  if (grouping === "overall") {
    allPlayersRaw.forEach((p) => push(`Top ${topN} Players`, p));
  } else if (grouping === "category") {
    allPlayersRaw.forEach((p) => push(p.playerCategory?.trim() || "Uncategorised", p));
  } else {
    allPlayersRaw.forEach((p) =>
      push(p.sold ? p.teamName || SOLD_NO_TEAM_GROUP : UNASSIGNED_GROUP, p)
    );
  }

  const isTopMode = grouping === "category" || grouping === "overall";

  const toGroup = (name: string) => {
    const players = [...(byGroup.get(name) ?? [])].sort(byRank);
    // Every section is ranked by what the player went for; only the top-N
    // sections are trimmed. In the unsold sections nobody has a price, so the
    // ranking falls through to serial order there.
    return isTopMode ? { name, players: players.slice(0, topN) } : { name, players };
  };

  let groupedTeams: { name: string; players: RawPlayer[] }[];
  if (grouping === "team") {
    // Teams first, then the catch-all groups. Once every squad is filled the
    // unsold players are no longer "available", so that section is dropped;
    // sold players with no team on record still belong in the document.
    const trailing = auctionComplete ? [SOLD_NO_TEAM_GROUP] : [SOLD_NO_TEAM_GROUP, UNASSIGNED_GROUP];
    const excluded = auctionComplete ? [UNASSIGNED_GROUP] : [];
    groupedTeams = [
      ...groupOrder.filter((n) => !trailing.includes(n) && !excluded.includes(n)).map(toGroup),
      ...trailing.filter((n) => byGroup.has(n)).map(toGroup),
    ];
  } else {
    // Biggest category first, so the headline section leads the document.
    groupedTeams = [...groupOrder]
      .sort((a, b) => (byGroup.get(b)?.length ?? 0) - (byGroup.get(a)?.length ?? 0))
      .map(toGroup);
  }
  groupedTeams = groupedTeams.filter((t) => t.players.length > 0);

  if (groupedTeams.length === 0) {
    throw new Error("No players found for this tournament");
  }

  // Convert remote photo URLs to base64 up-front so html2canvas can render them cross-origin.
  const allPlayers = groupedTeams.flatMap((t) => t.players);
  const BATCH_SIZE = 10;
  for (let i = 0; i < allPlayers.length; i += BATCH_SIZE) {
    const batch = allPlayers.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (p) => {
        if (p.photo && !p.photo.startsWith("data:")) {
          p.photo = await convertImgToBase64(p.photo);
        }
      })
    );
  }

  ensureStylesInjected();
  const badgeShift = await calibrateBadgeText();

  let pagesHtml = "";
  for (const team of groupedTeams) {
    for (let i = 0; i < team.players.length; i += cardsPerPage) {
      const chunk = team.players.slice(i, i + cardsPerPage);
      pagesHtml += buildPage(
        chunk, i, team.players.length, tournamentName, team.name,
        grouping === "team" ? "Team Players" : "Players"
      );
    }
  }

  const root = document.createElement("div");
  root.className = "pcg-root";
  root.style.setProperty("--pcg-num-shift", `${badgeShift.toFixed(2)}px`);
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.left = "-10000px";
  root.style.zIndex = "-1";
  root.innerHTML = pagesHtml;
  document.body.appendChild(root);

  try {
    await waitForImages(root);
    await sleep(300);

    const pages = Array.from(root.querySelectorAll<HTMLElement>(".page"));
    const pdf = new jsPDF({ unit: "px", format: [PAGE_WIDTH_PX, pages[0].offsetHeight], compress: true });
    let first = true;

    for (const page of pages) {
      await waitForImages(page, 5000);
      await sleep(100);

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 8000,
        backgroundColor: "#1a0a14",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pageHeightPx = (canvas.height / canvas.width) * PAGE_WIDTH_PX;

      if (!first) {
        pdf.addPage([PAGE_WIDTH_PX, pageHeightPx], "p");
      } else {
        pdf.internal.pageSize.width = PAGE_WIDTH_PX;
        pdf.internal.pageSize.height = pageHeightPx;
      }
      pdf.addImage(imgData, "JPEG", 0, 0, PAGE_WIDTH_PX, pageHeightPx);
      first = false;
    }

    const safeName = (tournamentName || "tournament").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

    // Which bundle produced this file. Invisible in the page, readable from the
    // PDF's properties — enough to tell a stale export from a current one
    // without guessing.
    const bundle = document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')
      ?.src.match(/index-([A-Za-z0-9_-]+)\.js/)?.[1] || "dev";
    pdf.setProperties({
      title: `${tournamentName} — player cards`,
      creator: `CricBid (build ${bundle})`,
      subject: `Generated ${new Date().toISOString()} · badge shift ${badgeShift.toFixed(2)}px`,
    });

    pdf.save(`${safeName}_player_cards.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}
