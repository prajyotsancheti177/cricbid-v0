/**
 * Serializers mapping Prisma rows back to the legacy Mongoose API shapes.
 * Keeps `_id` (ObjectId hex preserved through ETL), rebuilds flattened/embedded
 * structures (owner{}, permissions{}), and replicates `.populate()` outputs.
 */

// Player: id->_id; teamId is an object when the team relation is included
// (replicating populate('teamId','name')), else the raw id string.
const serializePlayer = (p) => {
    if (!p) return p;
    let teamId = p.teamId ?? null;
    if (p.team && typeof p.team === 'object') {
        teamId = { _id: p.team.id, name: p.team.name };
    }
    return {
        _id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        photo: p.photo,
        skill: p.skill,
        mobile: p.mobile,
        email: p.email,
        address: p.address,
        touranmentId: p.touranmentId,
        teamId,
        sold: p.sold,
        auctionStatus: p.auctionStatus,
        amtSold: p.amtSold,
        playerCategory: p.playerCategory,
        auctionSerialNumber: p.auctionSerialNumber,
        customFields: p.customFields ?? undefined,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    };
};

// Team: id->_id; owner{} rebuilt from flattened columns.
const serializeTeam = (t) => {
    if (!t) return t;
    return {
        _id: t.id,
        name: t.name,
        logo: t.logo,
        owner: { name: t.ownerName, email: t.ownerEmail, mobile: t.ownerMobile },
        touranmentId: t.touranmentId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    };
};

// Tournament: id->_id. tournamentHostId stays a string (original populate was a
// no-op — the schema had no ref).
const serializeTournament = (t) => {
    if (!t) return t;
    return {
        _id: t.id,
        name: t.name,
        tournamentHostId: t.tournamentHostId,
        noOfTeams: t.noOfTeams,
        maxPlayersPerTeam: t.maxPlayersPerTeam,
        minPlayersPerTeam: t.minPlayersPerTeam,
        totalBudget: t.totalBudget,
        playerCategories: t.playerCategories ?? [],
        categoryBasePrices: t.categoryBasePrices ?? undefined,
        bidIncrementSlabs: t.bidIncrementSlabs ?? undefined,
        registrationFormConfig: t.registrationFormConfig ?? undefined,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    };
};

module.exports = { serializePlayer, serializeTeam, serializeTournament };
