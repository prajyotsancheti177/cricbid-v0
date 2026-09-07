/**
 * Turns analytics page paths into something a human can read.
 *
 * Page views are recorded with the raw route — "/team/cmtn41gtv0486p8pia7a59n5v"
 * — which is right for storage (ids are stable, names are not) but useless in a
 * report. These helpers resolve the ids to tournament and team names for display
 * only; nothing about how events are stored changes.
 */

const prisma = require("../db/prisma");

/** Routes whose first captured group is a tournament id, with a label for the rest. */
const TOURNAMENT_ROUTES = [
    { re: /^\/tournament\/([^/]+)\/manage\/?(.*)$/, section: (m) => (m[2] ? `Manage: ${m[2].replace(/\//g, " / ")}` : "Manage") },
    { re: /^\/tournament\/([^/]+)\/?$/,             section: () => "Tournament page" },
    { re: /^\/register\/public\/([^/]+)\/?$/,       section: () => "Player registration" },
    { re: /^\/register\/([^/]+)\/?$/,               section: () => "Player registration" },
    { re: /^\/team-register\/([^/]+)\/?$/,          section: () => "Team registration" },
    { re: /^\/auction\/room\/([^/]+)\/?$/,          section: () => "Auction room" },
    { re: /^\/overlay\/([^/]+)\/(.+)$/,             section: (m) => `Overlay: ${m[2]}` },
];

/** Routes whose first captured group is a team id. */
const TEAM_ROUTES = [
    { re: /^\/team\/([^/]+)\/?$/, section: () => null },
];

const matchRoute = (page, routes) => {
    for (const route of routes) {
        const m = String(page || "").match(route.re);
        if (m) return { id: m[1], section: route.section(m) };
    }
    return null;
};

/** Ids referenced by a batch of pages, so they can be resolved in two queries. */
const extractIds = (pages) => {
    const tournamentIds = new Set();
    const teamIds = new Set();
    for (const page of pages) {
        const t = matchRoute(page, TOURNAMENT_ROUTES);
        if (t) { tournamentIds.add(t.id); continue; }
        const team = matchRoute(page, TEAM_ROUTES);
        if (team) teamIds.add(team.id);
    }
    return { tournamentIds: [...tournamentIds], teamIds: [...teamIds] };
};

/**
 * Builds page -> label for the given pages. Unresolvable ids (deleted
 * tournaments, teams from another era) are left as the raw path rather than
 * being labelled with a guess.
 *
 * @param {string[]} pages
 * @returns {Promise<Map<string, string>>}
 */
const buildPageLabels = async (pages) => {
    const labels = new Map();
    const unique = [...new Set((pages || []).filter(Boolean))];
    if (unique.length === 0) return labels;

    const { tournamentIds, teamIds } = extractIds(unique);

    const [tournaments, teams] = await Promise.all([
        tournamentIds.length
            ? prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true } })
            : [],
        teamIds.length
            ? prisma.team.findMany({
                where: { id: { in: teamIds } },
                select: { id: true, name: true, touranmentId: true },
              })
            : [],
    ]);

    const tournamentName = new Map(tournaments.map(t => [t.id, t.name]));

    // A team's tournament may not be among the pages we just resolved, so look
    // up any that are still missing — a team name alone is ambiguous across
    // tournaments ("Gurudev Capitals" exists in several).
    const missing = [...new Set(teams.map(t => t.touranmentId).filter(id => id && !tournamentName.has(id)))];
    if (missing.length) {
        const extra = await prisma.tournament.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } });
        extra.forEach(t => tournamentName.set(t.id, t.name));
    }

    const teamById = new Map(teams.map(t => [t.id, t]));

    for (const page of unique) {
        const t = matchRoute(page, TOURNAMENT_ROUTES);
        if (t) {
            const name = tournamentName.get(t.id);
            if (name) labels.set(page, t.section ? `${name} — ${t.section}` : name);
            continue;
        }
        const teamRoute = matchRoute(page, TEAM_ROUTES);
        if (teamRoute) {
            const team = teamById.get(teamRoute.id);
            if (team) {
                const tname = tournamentName.get(team.touranmentId);
                labels.set(page, tname ? `${team.name} (${tname})` : team.name);
            }
        }
    }

    return labels;
};

/** Attaches a `label` to rows carrying a page path under `key`. */
const withPageLabels = async (rows, key = "page") => {
    const labels = await buildPageLabels((rows || []).map(r => r[key]));
    return (rows || []).map(r => ({ ...r, label: labels.get(r[key]) || null }));
};

module.exports = { buildPageLabels, withPageLabels, extractIds };
