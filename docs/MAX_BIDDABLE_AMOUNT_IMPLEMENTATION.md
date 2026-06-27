# Max Biddable Amount Feature Implementation

## Overview
This document describes the implementation of the maximum biddable amount feature for the Auctioner application. This feature ensures that teams cannot overbid on a player if doing so would prevent them from filling the minimum required roster slots.

## Business Logic

### Formula
```
Max Biddable Amount = Amount Left - (Min Base Price × (Min Players Per Team - Players Already Bought - 1))
```

**Note**: The `-1` accounts for the current player being purchased. We assume the team will win this bid, so they'll need one less slot after this purchase.

### Components
- **Amount Left**: Team's remaining budget
- **Min Base Price**: The minimum base price across all player categories in the tournament
- **Min Players Per Team**: Minimum number of players required per team (from tournament settings)
- **Players Already Bought**: Number of players the team has already purchased

### Example
If a team has:
- Remaining Budget: 10,000 Pts
- Min Players Per Team: 15
- Players Already Bought: 10
- Min Base Price: 500 Pts

Then:
```
Slots to Fill = 15 - 10 - 1 = 4  (the -1 is for the current player)
Reserved Amount = 500 × 4 = 2,000 Pts
Max Biddable Amount = 10,000 - 2,000 = 8,000 Pts
```

The team can bid up to 8,000 Pts on the current player. After winning this player:
- They'll have 11 players (10 + 1)
- They'll have 2,000 Pts remaining (10,000 - 8,000)
- They need 4 more players to reach minimum (15 - 11)
- Cost for 4 players at minimum: 4 × 500 = 2,000 Pts ✓

## Implementation Details

### Backend Changes

#### 1. Updated Tournament Aggregation Pipeline
**File**: `/auctioner/services/teamService.js`

- Modified the `getTournamentTeamsReport` function to include:
  - `minPlayersPerTeam` in the aggregation pipeline
  - `categoryBasePrices` in the project stage
  
#### 2. Added Max Biddable Amount Calculation
**File**: `/auctioner/services/teamService.js`

Added post-aggregation logic to calculate `maxBiddableAmount` for each team:

```javascript
// Calculate minimum base price across all categories
let minBasePrice = 0;
if (tournamentData && tournamentData.categoryBasePrices) {
    const basePrices = Array.from(tournamentData.categoryBasePrices.values());
    minBasePrice = basePrices.length > 0 ? Math.min(...basePrices) : 0;
}

const minPlayersPerTeam = report[0].minPlayersPerTeam || 0;

// For each team, calculate max biddable amount
const playersAlreadyBought = team.players ? team.players.length : 0;
const slotsToFill = Math.max(0, minPlayersPerTeam - playersAlreadyBought - 1); // -1 for current player
const reservedAmount = minBasePrice * slotsToFill;
const maxBiddableAmount = Math.max(0, (team.remainingBudget || 0) - reservedAmount);

team.maxBiddableAmount = maxBiddableAmount;
```

### Frontend Changes

#### 1. Updated Team Type Definition
**File**: `/Auctioner-Frontend/src/types/auction.ts`

Added `maxBiddableAmount?: number` to the `Team` interface.

#### 2. Updated Team Data Fetching
**File**: `/Auctioner-Frontend/src/pages/Auction.tsx`

- Modified `fetchTeams` function to extract `maxBiddableAmount` from API response
- Added it to the extracted team data

#### 3. Enhanced Bidding Validation
**File**: `/Auctioner-Frontend/src/pages/Auction.tsx`

Updated `handleTeamBid` function to check against `maxBiddableAmount`:

```typescript
// Check if team has enough maxBiddableAmount
if ((team.maxBiddableAmount ?? 0) < newBid) {
  window.alert(`${team.name} cannot bid this amount. They need to reserve budget for minimum roster requirements. Max biddable: ${team.maxBiddableAmount} Pts.`);
  return;
}
```

#### 4. Updated UI Disable Logic
**File**: `/Auctioner-Frontend/src/pages/Auction.tsx`

Enhanced the team button disable state to consider `maxBiddableAmount`:

```typescript
const nextBidAmount = leadingTeam === null ? currentBid : currentBid + bidPrice;
const exceedsMaxBiddable = (team.maxBiddableAmount ?? 0) < nextBidAmount;
const isDisabled = noSlots || insufficientBudget || exceedsMaxBiddable;
```

Added appropriate error messaging when a team cannot bid due to max biddable amount constraints.

## User Experience

### Visual Feedback
1. **Team Button States**:
   - Teams that exceed max biddable amount are shown with red border and reduced opacity
   - Disabled state is applied automatically based on calculations

2. **Error Messages**:
   - Clear messages explain why a team cannot bid
   - Shows the maximum amount the team can bid
   - Example: "Team A must reserve budget for minimum roster. Max bid: 7,500 Pts."

### Validation Flow
1. User clicks on a team to bid
2. System calculates the next bid amount
3. System checks:
   - Does team have remaining slots?
   - Does team have sufficient remaining budget?
   - Does bid exceed team's max biddable amount?
4. If any check fails, show appropriate error message
5. If all checks pass, proceed with bid

## Benefits

1. **Prevents Invalid Team States**: Teams cannot end up in a situation where they can't complete their minimum roster
2. **Fair Competition**: All teams are subject to the same constraints
3. **Transparent**: Clear communication about why bids are restricted
4. **Automated**: No manual calculation required by auction managers

## Testing Recommendations

1. Test with teams that have bought different numbers of players
2. Test with different tournament configurations (varying min players per team)
3. Test with different category base prices
4. Verify calculations are accurate across different scenarios
5. Test edge cases (teams with exactly minimum players, teams near budget limit)

## Future Enhancements

Potential improvements:
1. Show max biddable amount directly on team cards
2. Add a tooltip explaining the calculation
3. Provide a preview/calculator mode for auction managers
4. Add configuration option to enable/disable this feature per tournament
