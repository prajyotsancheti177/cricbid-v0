import playerPhoto from "@/assets/demo-player-pushkar.jpg";

/**
 * Data for the demo walkthrough.
 *
 * Identities are real, taken from the Chhatrapati Shivaji Maharaj Khel Mahotsav
 * (Youthika Sports) auction: the player, his registration photo, the eight teams
 * and their crests, and the tournament's player/bid counts.
 *
 * The bid amounts are illustrative. The demo shows the closing moments of a lot
 * rather than a full replay, so the ladder below is a short, purpose-built
 * sequence chosen to show three things in about ten seconds: the counting bid
 * animation, the increment slab stepping up as it crosses its boundary, and
 * teams turning red as the price passes what they can afford.
 */

export const TOURNAMENT = {
    name: "Chhatrapati Shivaji Maharaj Khel Mahotsav",
    organiser: "Youthika Sports",
    date: "11 July 2026",
    playersAuctioned: 105,
    playersSold: 66,
    totalSpend: 168400,
    totalBids: 1808,
    durationMinutes: 193,
    peakViewers: 24,
    /** The tournament's real configured category base prices. */
    categories: [
        { name: "Icon", basePrice: 4000 },
        { name: "Regular", basePrice: 1500 },
    ],
    /** The real increment ladder. The demo replay crosses this boundary live. */
    slabs: [
        { from: 0, to: 3999, increment: 50 },
        { from: 4000, to: null, increment: 100 },
    ],
} as const;

/** The real eight teams, with their production logo URLs. */
export const TEAMS = [
    { name: "Sledgers United", owner: "Mr. Tarang Totla", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783699856271-235118803.jpg" },
    { name: "Lumen", owner: "Prajwal Bhagat", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783698308705-168479769.jpg" },
    { name: "Patel Strikers", owner: "Mr. Abubakar Patel", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783698514830-772089959.jpg" },
    { name: "Terra", owner: "Vikrant Rajput, Anshuman Desai, Ayush Israni", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783693471760-435743852.jpg" },
    { name: "Redfit", owner: "Ms. Pournima Rajput", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783698445161-387393571.jpg" },
    { name: "Ather", owner: "Mr. Sumit Soni", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783698566912-48577585.jpg" },
    { name: "Sk.Infra", owner: "Mr. Salman Suri", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783698367691-67985881.jpg" },
    { name: "MOP Dominators", owner: "Mr. Uday Fepale", logo: "https://the-ps-aws-bucket.s3.ap-south-1.amazonaws.com/cricBid/uploads/logo-1783699791766-231722908.jpg" },
] as const;

/** The player the replay follows — the tournament's record sale. */
export const FEATURED_PLAYER = {
    name: "Pushkar Sancheti",
    /**
     * His real registration photo, bundled with the app rather than linked.
     * The production record stores a Google Drive URL, which redirects and
     * loads slowly — too unreliable for the hero image of a marketing page.
     */
    photo: playerPhoto,
    category: "Regular",
    lotNumber: 39,
    basePrice: 1500,
    finalPrice: 4600,
    soldTo: "Sledgers United",
    totalBids: 10,
    teamsBidding: 4,
} as const;

/** Top sales of the night. Names and bid counts are real; amounts illustrative. */
export const TOP_SALES = [
    { name: "Pushkar Sancheti", price: 4600, team: "Sledgers United", bids: 156 },
    { name: "Shivraj Singh", price: 4200, team: "Lumen", bids: 135 },
    { name: "Nadeem", price: 3900, team: "Patel Strikers", bids: 126 },
    { name: "Sohil Pathan", price: 3600, team: "Ather", bids: 120 },
    { name: "Mohammad Usman", price: 2900, team: "MOP Dominators", bids: 95 },
    { name: "Deepak Harne", price: 2400, team: "Sk.Infra", bids: 83 },
] as const;

/** Where the increment steps up, matching the tournament's slab config. */
export const SLAB_BOUNDARY = 4000;

export interface ReplayBid {
    order: number;
    team: string;
    amount: number;
    /** The increment this bid applied. Steps up at SLAB_BOUNDARY. */
    increment: number;
}

/**
 * The closing ten bids of the lot: a straight duel between two teams, crossing
 * the slab boundary at 4,000 so the increment visibly changes from +50 to +100
 * partway through.
 */
const LADDER: [string, number][] = [
    ["Redfit", 3850],
    ["Patel Strikers", 3900],
    ["Lumen", 3950],
    ["Sledgers United", 4000],
    ["Lumen", 4100],
    ["Sledgers United", 4200],
    ["Lumen", 4300],
    ["Sledgers United", 4400],
    ["Lumen", 4500],
    ["Sledgers United", 4600],
];

export const BID_LADDER: ReplayBid[] = LADDER.map(([team, amount], index) => ({
    order: index + 1,
    team,
    amount,
    increment: index === 0 ? 0 : amount - LADDER[index - 1][1],
}));

/**
 * Purse state for each team at this point in the auction.
 *
 * `maxBiddable` is what drives the red tiles: the live components mark a team
 * unable to bid when the next bid would exceed its ceiling, when its purse is
 * short, or when its squad is full. The numbers here are chosen so the two teams
 * in the duel stay live to the end while the rest drop out at different moments
 * — including one whose squad is already full, so both block reasons are shown.
 */
export const DEMO_TEAM_STATE: Record<string, { purse: number; slotsUsed: number; maxBiddable: number }> = {
    "Sledgers United": { purse: 12400, slotsUsed: 9, maxBiddable: 9000 },
    Lumen: { purse: 11800, slotsUsed: 9, maxBiddable: 9000 },
    "Patel Strikers": { purse: 6200, slotsUsed: 10, maxBiddable: 4150 },
    Terra: { purse: 5400, slotsUsed: 10, maxBiddable: 3900 },
    Redfit: { purse: 5900, slotsUsed: 11, maxBiddable: 4050 },
    Ather: { purse: 3600, slotsUsed: 11, maxBiddable: 2400 },
    // Squad already full — blocked regardless of purse.
    "Sk.Infra": { purse: 4800, slotsUsed: 14, maxBiddable: 4800 },
    "MOP Dominators": { purse: 2700, slotsUsed: 12, maxBiddable: 1800 },
};

export const SQUAD_SIZE = 14;

/**
 * The auction is denominated in points, not rupees — every screen in the live
 * room renders amounts as "N Pts", so the demo must too.
 */
export const formatPts = (amount: number) => `${amount.toLocaleString("en-IN")} Pts`;
