const crypto = require('crypto');
const prisma = require('../db/prisma');

/**
 * The public, shareable player card.
 *
 * This is the one endpoint in the codebase that is deliberately readable by
 * anyone with the link — the whole point is that a player posts it to an
 * Instagram story. So the payload is built field by field and carries no
 * mobile, email, address, payment or auth data. Never widen it by spreading a
 * Player row into the response.
 */

// No 0/O/1/I/5/S: the code is printed on the image and people retype it.
const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
const CODE_LENGTH = 6;

const randomCode = () => {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
};

/**
 * Give a player a short code, once. Collisions are vanishingly unlikely
 * (29^6) but a unique index means we would rather retry than throw.
 */
const ensureShareCode = async (playerId, existing) => {
    if (existing) return existing;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = randomCode();
        try {
            const updated = await prisma.player.update({
                where: { id: playerId },
                data: { shareCode: code },
                select: { shareCode: true },
            });
            return updated.shareCode;
        } catch (e) {
            if (e.code !== 'P2002') throw e;
        }
    }
    throw new Error("Could not allocate a share code");
};

const isHttpUrl = (value) => {
    const s = String(value ?? '').trim();
    if (!s) return null;
    try {
        const u = new URL(s);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? s : null;
    } catch {
        return null;
    }
};

/**
 * Card data for one player, by id or by short code.
 *
 * `stats` is only present when the CricHeroes link was actually confirmed —
 * an ambiguous or not-found link is the same as having no stats, and the card
 * is designed to look finished without them.
 */
const getCard = async ({ playerId, code }) => {
    const where = code ? { shareCode: String(code).toUpperCase() } : { id: playerId };
    if (!code && !playerId) throw new Error("A player is required");

    const player = await prisma.player.findUnique({
        where,
        select: {
            id: true, name: true, photo: true, skill: true, playerCategory: true,
            auctionSerialNumber: true, sold: true, amtSold: true, shareCode: true,
            team: { select: { id: true, name: true, logo: true } },
            tournament: {
                select: { id: true, name: true, features: true, categoryBasePrices: true },
            },
            cricHeroesLink: { select: { status: true, cricheroesPlayerId: true } },
        },
    });
    if (!player) throw new Error("No card found for that link");

    const shareCode = await ensureShareCode(player.id, player.shareCode);

    const features = (player.tournament && player.tournament.features) || {};

    let stats = null;
    const link = player.cricHeroesLink;
    if (link && link.status === 'linked' && link.cricheroesPlayerId) {
        const row = await prisma.cricHeroesStat.findUnique({
            where: { cricheroesPlayerId: link.cricheroesPlayerId },
            select: {
                totalMatches: true, totalRuns: true, totalWickets: true,
                battingAverage: true, battingStrikeRate: true, highestScore: true,
                bowlingEconomy: true, bestBowling: true, catches: true,
                playingRole: true, battingHand: true, fetchedAt: true,
            },
        });
        if (row) stats = row;
    }

    const basePrices = (player.tournament && player.tournament.categoryBasePrices) || {};

    return {
        shareCode,
        player: {
            name: player.name,
            photo: player.photo,
            skill: player.skill,
            category: player.playerCategory,
            lot: player.auctionSerialNumber,
            sold: player.sold === true,
            amtSold: player.sold === true ? player.amtSold ?? null : null,
            basePrice: player.playerCategory ? Number(basePrices[player.playerCategory]) || null : null,
        },
        team: player.sold === true && player.team
            ? { name: player.team.name, logo: player.team.logo }
            : null,
        tournament: player.tournament
            ? {
                id: player.tournament.id,
                name: player.tournament.name,
                logo: features.brandLogo || null,
                streamUrl: isHttpUrl(features.streamUrl),
            }
            : null,
        stats,
    };
};

/**
 * The stored URL of one image on a card, for the same-origin proxy.
 *
 * html2canvas has to read the pixels back out of the canvas to make a PNG,
 * and our S3 bucket sends no CORS headers — so a photo loaded straight from
 * S3 taints the canvas and the share silently produces nothing. Serving the
 * bytes from our own origin is what makes the image exportable at all.
 */
const getCardImageUrl = async ({ code, which }) => {
    const KINDS = ['photo', 'teamLogo', 'tournamentLogo'];
    if (!KINDS.includes(which)) throw new Error("Unknown image");

    const player = await prisma.player.findUnique({
        where: { shareCode: String(code || '').toUpperCase() },
        select: {
            photo: true,
            team: { select: { logo: true } },
            tournament: { select: { features: true } },
        },
    });
    if (!player) throw new Error("No card found for that link");

    if (which === 'photo') return player.photo || null;
    if (which === 'teamLogo') return (player.team && player.team.logo) || null;
    const features = (player.tournament && player.tournament.features) || {};
    return features.brandLogo || null;
};

module.exports = { getCard, ensureShareCode, randomCode, getCardImageUrl };
