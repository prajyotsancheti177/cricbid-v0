#!/usr/bin/env node
/**
 * The read-only window the Assistant runner is allowed to look through.
 *
 * Rather than granting a headless Claude Code session a shell against the
 * production database, it gets this: a fixed set of read operations over one
 * tournament, and a CSV writer that can only write into the export directory.
 * Everything it can do is visible in this file.
 *
 * Usage:
 *   node scripts/agentQuery.cjs summary   --tournament <id>
 *   node scripts/agentQuery.cjs sample    --tournament <id> [--limit 5]
 *   node scripts/agentQuery.cjs tournaments
 *   node scripts/agentQuery.cjs csv       --tournament <id> --fields serial,name,mobile [--out name.csv]
 *
 * Fields: serial, name, mobile, category, skill, age, gender, email, team,
 *         sold, amount, basePrice, paymentVerified
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const prisma = require("../db/prisma");

/** CSVs land here and nowhere else, whatever is asked for. */
const EXPORT_DIR = process.env.AGENT_EXPORT_DIR || path.join(os.homedir(), "Downloads");

const FIELDS = {
  serial: { header: "Serial Number", pick: (p) => p.auctionSerialNumber },
  name: { header: "Player Name", pick: (p) => p.name },
  mobile: { header: "Phone Number", pick: (p) => p.mobile },
  category: { header: "Category", pick: (p) => p.playerCategory },
  skill: { header: "Skill", pick: (p) => p.skill },
  age: { header: "Age", pick: (p) => p.age },
  gender: { header: "Gender", pick: (p) => p.gender },
  email: { header: "Email", pick: (p) => p.email },
  team: { header: "Team", pick: (p) => p.team?.name ?? "" },
  sold: { header: "Sold", pick: (p) => (p.sold ? "Yes" : "No") },
  amount: { header: "Amount Sold", pick: (p) => p.amtSold ?? "" },
  paymentVerified: { header: "Payment Verified", pick: (p) => (p.paymentVerified ? "Yes" : "No") },
  basePrice: { header: "Base Price", pick: (p, t) => (t.categoryBasePrices || {})[p.playerCategory] ?? "" },
};

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};

const csvCell = (value) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const loadTournament = async (id) => {
  if (!id) throw new Error("--tournament <id> is required");
  const t = await prisma.tournament.findUnique({
    where: { id: String(id) },
    select: { id: true, name: true, playerCategories: true, categoryBasePrices: true, isPrivate: true },
  });
  if (!t) throw new Error(`No tournament with id ${id}`);
  return t;
};

const loadPlayers = (id) =>
  prisma.player.findMany({
    where: { touranmentId: String(id) },
    orderBy: { auctionSerialNumber: "asc" },
    include: { team: { select: { name: true } } },
  });

const commands = {
  /** Which tournaments exist, so a request naming one by name can be resolved. */
  async tournaments() {
    const rows = await prisma.tournament.findMany({
      select: { id: true, name: true, isPrivate: true, _count: { select: { players: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((t) => ({ id: t.id, name: t.name, players: t._count.players, isPrivate: t.isPrivate }));
  },

  /** Shape of one tournament: counts by category, and what is missing. */
  async summary() {
    const t = await loadTournament(arg("tournament"));
    const players = await loadPlayers(t.id);
    const byCategory = {};
    for (const p of players) byCategory[p.playerCategory || "(blank)"] = (byCategory[p.playerCategory || "(blank)"] || 0) + 1;

    return {
      tournament: t.name,
      id: t.id,
      players: players.length,
      byCategory,
      categoryBasePrices: t.categoryBasePrices || {},
      missing: {
        mobile: players.filter((p) => !p.mobile).length,
        serial: players.filter((p) => p.auctionSerialNumber === null).length,
        category: players.filter((p) => !p.playerCategory).length,
      },
      sold: players.filter((p) => p.sold).length,
      serialRange: players.length
        ? [Math.min(...players.map((p) => p.auctionSerialNumber ?? Infinity)), Math.max(...players.map((p) => p.auctionSerialNumber ?? -Infinity))]
        : null,
    };
  },

  /** A few real rows, so a plan can quote them back to the person approving. */
  async sample() {
    const t = await loadTournament(arg("tournament"));
    const limit = Math.min(Math.max(Number(arg("limit", 5)) || 5, 1), 25);
    const players = await loadPlayers(t.id);
    return {
      tournament: t.name,
      showing: Math.min(limit, players.length),
      of: players.length,
      rows: players.slice(0, limit).map((p) => ({
        serial: p.auctionSerialNumber, name: p.name, mobile: p.mobile,
        category: p.playerCategory, skill: p.skill, sold: p.sold,
      })),
    };
  },

  /** Write the CSV. The only thing in this file that creates anything. */
  async csv() {
    const t = await loadTournament(arg("tournament"));
    const requested = String(arg("fields", "serial,name,mobile")).split(",").map((f) => f.trim()).filter(Boolean);

    const unknown = requested.filter((f) => !FIELDS[f]);
    if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(", ")}. Available: ${Object.keys(FIELDS).join(", ")}`);

    const players = await loadPlayers(t.id);
    const lines = [requested.map((f) => csvCell(FIELDS[f].header)).join(",")];
    for (const p of players) lines.push(requested.map((f) => csvCell(FIELDS[f].pick(p, t))).join(","));

    // The name may be suggested, but never the directory.
    const suggested = path.basename(String(arg("out", `${(t.name || "tournament").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_players.csv`)));
    const outPath = path.join(EXPORT_DIR, suggested.endsWith(".csv") ? suggested : `${suggested}.csv`);
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    fs.writeFileSync(outPath, lines.join("\n") + "\n");

    return { tournament: t.name, rows: players.length, fields: requested, file: outPath };
  },
};

(async () => {
  const command = process.argv[2];
  if (!commands[command]) {
    console.log(JSON.stringify({ error: `Unknown command "${command || ""}"`, available: Object.keys(commands) }, null, 1));
    process.exit(1);
  }
  try {
    console.log(JSON.stringify(await commands[command](), null, 1));
    process.exit(0);
  } catch (e) {
    console.log(JSON.stringify({ error: e.message }, null, 1));
    process.exit(1);
  }
})();
