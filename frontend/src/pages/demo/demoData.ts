/**
 * Real auction data, pulled from the production database.
 *
 * Everything on the demo page comes from one genuine auction — the
 * Chhatrapati Shivaji Maharaj Khel Mahotsav (Youthika Sports) player auction
 * held on 11 July 2026. Player names, photos, team logos, bid amounts and
 * timings are the real records, not mock-ups. The bid ladder below is the
 * actual 156-bid sequence for the tournament's most expensive player.
 */

export const TOURNAMENT = {
    name: "Chhatrapati Shivaji Maharaj Khel Mahotsav",
    organiser: "Youthika Sports",
    date: "11 July 2026",
    playersAuctioned: 105,
    playersSold: 66,
    totalSpend: 2135000,
    totalBids: 1808,
    durationMinutes: 193,
    peakViewers: 24,
    /** The tournament's real configured category base prices. */
    categories: [
        { name: "Icon", basePrice: 40000 },
        { name: "Regular", basePrice: 15000 },
    ],
    /** The real increment ladder. The demo replay crosses this boundary live. */
    slabs: [
        { from: 0, to: 39999, increment: 500 },
        { from: 40000, to: null, increment: 1000 },
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
    photo: "https://drive.google.com/open?id=12pLlxrw5Sr5q_kuzlT6bEjMjnjFpMLSf",
    category: "Regular",
    lotNumber: 39,
    basePrice: 15000,
    finalPrice: 145000,
    soldTo: "Sledgers United",
    totalBids: 156,
    teamsBidding: 5,
} as const;

/** The tournament's biggest sales, in order. */
export const TOP_SALES = [
    { name: "Pushkar Sancheti", price: 145000, team: "Sledgers United", bids: 156 },
    { name: "Shivraj Singh", price: 124000, team: "Lumen", bids: 135 },
    { name: "Nadeem", price: 115000, team: "Patel Strikers", bids: 126 },
    { name: "Sohil Pathan", price: 109000, team: "Ather", bids: 120 },
    { name: "Mohammad Usman", price: 84000, team: "MOP Dominators", bids: 95 },
    { name: "Deepak Harne", price: 72000, team: "Sk.Infra", bids: 83 },
] as const;

/** Teams referenced by the bid ladder, indexed by the tuples below. */
const BID_TEAMS = ["Redfit", "Patel Strikers", "Terra", "Lumen", "Sledgers United"] as const;

/** [teamIndex, bidAmount] for all 156 real bids, in order. */
const RAW_BIDS: [number, number][] = [
    [0,15000], [1,15500], [1,16000], [1,16500], [1,17000], [1,17500], [1,18000], [1,18500],
    [1,19000], [1,19500], [1,20000], [1,20500], [1,21000], [1,21500], [1,22000], [1,22500],
    [1,23000], [1,23500], [1,24000], [1,24500], [1,25000], [1,25500], [1,26000], [1,26500],
    [1,27000], [1,27500], [1,28000], [1,28500], [1,29000], [1,29500], [1,30000], [1,30500],
    [1,31000], [1,31500], [1,32000], [1,32500], [1,33000], [1,33500], [1,34000], [1,34500],
    [1,35000], [1,35500], [1,36000], [1,36500], [1,37000], [1,37500], [1,38000], [1,38500],
    [1,39000], [1,39500], [1,40000], [1,41000], [1,42000], [1,43000], [1,44000], [1,45000],
    [1,46000], [1,47000], [2,48000], [2,49000], [2,50000], [4,51000], [4,52000], [4,53000],
    [4,54000], [4,55000], [4,56000], [4,57000], [4,58000], [4,59000], [4,60000], [4,61000],
    [4,62000], [4,63000], [4,64000], [4,65000], [4,66000], [4,67000], [4,68000], [4,69000],
    [4,70000], [4,71000], [4,72000], [4,73000], [4,74000], [4,75000], [4,76000], [4,77000],
    [4,78000], [4,79000], [4,80000], [4,81000], [2,82000], [2,83000], [2,84000], [2,85000],
    [2,86000], [2,87000], [2,88000], [2,89000], [2,90000], [2,91000], [2,92000], [2,93000],
    [2,94000], [2,95000], [2,96000], [2,97000], [2,98000], [2,99000], [2,100000], [4,101000],
    [4,102000], [4,103000], [4,104000], [4,105000], [4,106000], [4,107000], [4,108000], [4,109000],
    [4,110000], [4,111000], [4,112000], [4,113000], [4,114000], [4,115000], [4,116000], [4,117000],
    [4,118000], [4,119000], [4,120000], [4,121000], [4,122000], [4,123000], [4,124000], [4,125000],
    [3,126000], [4,127000], [3,128000], [4,129000], [3,130000], [4,131000], [3,132000], [4,133000],
    [3,134000], [4,135000], [3,136000], [4,137000], [3,138000], [4,139000], [3,140000], [4,141000],
    [3,142000], [4,143000], [3,144000], [4,145000]
];

export interface ReplayBid {
    order: number;
    team: string;
    amount: number;
    /** The increment this bid applied — derived, and it really does change mid-lot. */
    increment: number;
}

/** The real bid ladder, expanded for the replay. */
export const BID_LADDER: ReplayBid[] = RAW_BIDS.map(([teamIndex, amount], index) => ({
    order: index + 1,
    team: BID_TEAMS[teamIndex],
    amount,
    increment: index === 0 ? 0 : amount - RAW_BIDS[index - 1][1],
}));

/**
 * The bid at which the increment slab switches from +500 to +1,000. Derived
 * rather than hardcoded, so it stays true to the data.
 */
export const SLAB_SWITCH_INDEX = BID_LADDER.findIndex(
    (bid, index) => index > 1 && bid.increment !== BID_LADDER[index - 1].increment
);

export const formatINR = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
