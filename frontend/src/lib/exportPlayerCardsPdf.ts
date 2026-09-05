import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";

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
    align-items:flex-start;
    gap:8px;
    min-width:0;
  }
  .pcg-root .badge{
    background:linear-gradient(135deg,#2ecc71,#1ca557);
    color:#062b14;
    font-size:10px;
    font-weight:800;
    padding:2px 7px;
    border-radius:4px;
    flex-shrink:0;
    margin-top:1px;
  }
  .pcg-root .player-name{
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
      <span class="badge">#${serialNum}</span>
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
  teamName: string
): string {
  const rangeStart = startIndex + 1;
  const rangeEnd = startIndex + players.length;
  const cardsHtml = players.map((p, i) => buildCard(p, startIndex + i)).join("");

  return `
  <div class="page">
    <div class="page-header">
      <div class="player-range">Team Players ${rangeStart} - ${rangeEnd} of ${totalCount}</div>
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

/** Group heading for players who have not been sold yet. */
const UNASSIGNED_GROUP = "Available Players";
/** Sold, but with no team on record — older tournaments carry data like this. */
const SOLD_NO_TEAM_GROUP = "Sold Players";

/**
 * Fetches every player in a tournament, groups them by team, and generates a
 * "player card" style PDF (one card per player, grouped/paginated by team).
 *
 * Players who have not been sold are grouped under "Available Players", so the
 * export is useful before the auction — sharing the full player list with team
 * owners is the main reason it gets run.
 */
export async function exportPlayerCardsPdf(
  tournamentName: string,
  overrideTournamentId?: string,
  cardsPerPage: number = CARDS_PER_PAGE_DEFAULT
): Promise<void> {
  const tournamentId = overrideTournamentId || getSelectedTournamentId();
  if (!tournamentId) {
    throw new Error("No tournament selected");
  }

  // Read the player list rather than team rosters: an unsold player belongs to
  // no team, so team rosters cannot see them at all.
  const playersRes = await fetch(`${apiConfig.baseUrl}/api/player/all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ touranmentId: tournamentId }),
  });

  if (!playersRes.ok) {
    throw new Error("Failed to fetch data for PDF export");
  }

  const playersData = await playersRes.json();
  const allPlayersRaw: RawPlayer[] = playersData.data ?? [];

  const groupOrder: string[] = [];
  const byGroup = new Map<string, RawPlayer[]>();
  for (const player of allPlayersRaw) {
    const key = player.sold
      ? (player.teamName || SOLD_NO_TEAM_GROUP)
      : UNASSIGNED_GROUP;
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      groupOrder.push(key);
    }
    byGroup.get(key)!.push(player);
  }

  const toGroup = (name: string) => ({
    name,
    players: (byGroup.get(name) ?? []).sort(
      (a, b) => (a.auctionSerialNumber ?? 999999) - (b.auctionSerialNumber ?? 999999)
    ),
  });

  // Teams first, then the two catch-all groups.
  const trailing = [SOLD_NO_TEAM_GROUP, UNASSIGNED_GROUP];
  const groupedTeams = [
    ...groupOrder.filter((n) => !trailing.includes(n)).map(toGroup),
    ...trailing.filter((n) => byGroup.has(n)).map(toGroup),
  ].filter((t) => t.players.length > 0);

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

  let pagesHtml = "";
  for (const team of groupedTeams) {
    for (let i = 0; i < team.players.length; i += cardsPerPage) {
      const chunk = team.players.slice(i, i + cardsPerPage);
      pagesHtml += buildPage(chunk, i, team.players.length, tournamentName, team.name);
    }
  }

  const root = document.createElement("div");
  root.className = "pcg-root";
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
    pdf.save(`${safeName}_player_cards.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}
