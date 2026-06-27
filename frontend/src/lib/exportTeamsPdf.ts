import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import apiConfig from "@/config/apiConfig";
import { getSelectedTournamentId } from "@/lib/tournamentUtils";

interface PlayerRow {
  name: string;
  playerCategory: string;
  mobile: string | number;
}

interface TeamWithPlayers {
  name: string;
  players: PlayerRow[];
}

/**
 * Fetches all teams and players for the current tournament,
 * groups players by team, and generates a beautifully formatted PDF.
 */
export async function exportTeamsPdf(tournamentName: string, overrideTournamentId?: string): Promise<void> {
  const tournamentId = overrideTournamentId || getSelectedTournamentId();
  if (!tournamentId) {
    throw new Error("No tournament selected");
  }

  // Fetch teams (players are already embedded via MongoDB $lookup)
  const teamsRes = await fetch(`${apiConfig.baseUrl}/api/team/all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ touranmentId: tournamentId }),
  });

  if (!teamsRes.ok) {
    throw new Error("Failed to fetch data for PDF export");
  }

  const teamsData = await teamsRes.json();
  const teams: any[] = teamsData.data?.[0]?.teams ?? [];

  // Build the ordered list — players are already nested in each team
  const teamsWithPlayers: TeamWithPlayers[] = teams.map((t) => ({
    name: t.name,
    players: (t.players ?? []).map((p: any) => ({
      name: p.name ?? "—",
      playerCategory: p.playerCategory ?? "—",
      mobile: p.mobile ?? "—",
    })),
  }));

  // ── PDF Generation ──────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Colors (minimalist slate/charcoal palette) ───────────────────
  const PRIMARY: [number, number, number] = [30, 41, 59]; // slate-800
  const PRIMARY_LIGHT: [number, number, number] = [51, 65, 85]; // slate-700
  const ACCENT: [number, number, number] = [71, 85, 105]; // slate-600
  const DARK: [number, number, number] = [15, 23, 42]; // slate-900
  const TABLE_HEAD_BG: [number, number, number] = [30, 41, 59]; // slate-800
  const TABLE_HEAD_TEXT: [number, number, number] = [255, 255, 255];
  const TABLE_STRIPE: [number, number, number] = [241, 245, 249]; // slate-100
  const TABLE_BORDER: [number, number, number] = [203, 213, 225]; // slate-300

  // ── Title Banner ────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 38, "F");
  // Subtle accent stripe
  doc.setFillColor(100, 116, 139); // slate-500
  doc.rect(0, 38, pageWidth, 1.5, "F");

  // Tournament name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  doc.text(tournamentName || "Tournament", pageWidth / 2, 17, {
    align: "center",
  });

  // Subtitle
  doc.setFontSize(15);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text("Team-wise Player List", pageWidth / 2, 27, { align: "center" });

  // Date
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184); // slate-400
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(`Generated on ${dateStr}`, pageWidth / 2, 35, { align: "center" });

  let yPos = 48;

  // ── Team Tables ─────────────────────────────────────────────────
  for (let i = 0; i < teamsWithPlayers.length; i++) {
    const team = teamsWithPlayers[i];

    // Check if we need a new page (need at least 50mm for header + 1 row)
    if (yPos > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      yPos = 16;
    }

    // ── Team Header Bar ───────────────────────────────────────────
    const headerHeight = 13;
    const marginX = 14;
    const tableWidth = pageWidth - marginX * 2;

    // Header background
    doc.setFillColor(...ACCENT);
    doc.roundedRect(marginX, yPos, tableWidth, headerHeight, 2, 2, "F");

    // Team name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(team.name, marginX + 6, yPos + 9);

    // Player count badge
    const countText = `${team.players.length} players`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const countWidth = doc.getTextWidth(countText) + 6;
    const badgeX = marginX + tableWidth - countWidth - 4;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(badgeX, yPos + 3.5, countWidth, 6, 1.5, 1.5, "F");
    doc.setTextColor(...PRIMARY);
    doc.text(countText, badgeX + 3, yPos + 8);

    yPos += headerHeight + 1;

    // ── Table ─────────────────────────────────────────────────────
    if (team.players.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(150, 150, 150);
      doc.text("No players assigned to this team", marginX + 6, yPos + 6);
      yPos += 14;
    } else {
      const tableData = team.players.map((p, idx) => [
        (idx + 1).toString(),
        p.name,
        p.playerCategory,
        p.mobile?.toString() ?? "—",
      ]);

      autoTable(doc, {
        startY: yPos,
        margin: { left: marginX, right: marginX },
        head: [["#", "Player Name", "Category", "Phone Number"]],
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: 13,
          cellPadding: 4,
          lineColor: TABLE_BORDER,
          lineWidth: 0.3,
          textColor: DARK,
          font: "helvetica",
        },
        headStyles: {
          fillColor: TABLE_HEAD_BG,
          textColor: TABLE_HEAD_TEXT,
          fontStyle: "bold",
          fontSize: 13,
          halign: "left",
          cellPadding: 4.5,
        },
        alternateRowStyles: {
          fillColor: TABLE_STRIPE,
        },
        columnStyles: {
          0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 44, halign: "center" },
          3: { cellWidth: 42, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.column.index === 1 && data.section === "body") {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Get the final Y position after the table
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ── Footer on last page ─────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PRIMARY);
  doc.rect(0, pageH - 8, pageWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `${tournamentName} • Generated by CricBid`,
    pageWidth / 2,
    pageH - 3,
    { align: "center" }
  );

  // ── Save ────────────────────────────────────────────────────────
  const safeName = (tournamentName || "tournament")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();
  doc.save(`${safeName}_teams.pdf`);
}
