# Quick Reference Guide - Max Biddable Amount Feature

## 🎯 What Does This Feature Do?

Prevents teams from overbidding on a player if doing so would leave them unable to complete their minimum roster requirement.

## 📐 The Formula

```
maxBiddableAmount = remainingBudget - (minBasePrice × (minPlayersPerTeam - playersAlreadyBought - 1))
```

**Note**: The `-1` accounts for the current player being purchased. We assume winning this bid.

### Variables:
- **remainingBudget**: Team's current remaining budget
- **minBasePrice**: Lowest base price among all player categories in the tournament
- **minPlayersPerTeam**: Minimum roster size required (from tournament settings)
- **playersAlreadyBought**: Number of players team has already purchased

## 🔧 Where the Logic Lives

### Backend
**File**: `/auctioner/services/teamService.js`
**Function**: `getTournamentTeamsReport()`
**Lines**: 104-141

Key code:
```javascript
const minBasePrice = Math.min(...tournamentData.categoryBasePrices.values());
const slotsToFill = Math.max(0, minPlayersPerTeam - playersAlreadyBought - 1); // -1 for current player
const reservedAmount = minBasePrice * slotsToFill;
const maxBiddableAmount = Math.max(0, remainingBudget - reservedAmount);
```

### Frontend
**File**: `/Auctioner-Frontend/src/pages/Auction.tsx`

**1. Data Extraction** (Line ~215):
```typescript
maxBiddableAmount: team.maxBiddableAmount || 0
```

**2. Validation Check** (Line ~379):
```typescript
if ((team.maxBiddableAmount ?? 0) < newBid) {
  window.alert(`Cannot bid - must reserve budget for minimum roster`);
  return;
}
```

**3. UI Disable Logic** (Line ~851):
```typescript
const exceedsMaxBiddable = (team.maxBiddableAmount ?? 0) < nextBidAmount;
const isDisabled = noSlots || insufficientBudget || exceedsMaxBiddable;
```

## 📊 Data Flow

```
1. Tournament Setup
   ├─ minPlayersPerTeam: 15
   ├─ categoryBasePrices: { Icon: 1000, Regular: 500, Rookie: 700 }
   └─ totalBudget: 15000

2. During Auction
   ├─ GET /api/team/all
   └─ Backend calculates maxBiddableAmount for each team

3. Team Data Response
   ├─ remainingBudget: 7000
   ├─ playersCount: 10
   └─ maxBiddableAmount: 4500  ← Calculated

4. Frontend Validation
   ├─ User clicks to bid
   ├─ Check maxBiddableAmount
   └─ Allow/Deny bid
```

## 🧪 Testing Checklist

- [ ] Team with 0 players bought (should reserve for all min slots)
- [ ] Team with exactly minimum players (maxBiddable = remaining budget)
- [ ] Team with more than minimum players (maxBiddable = remaining budget)
- [ ] Team with insufficient budget (maxBiddable = 0)
- [ ] Multiple teams bidding (each has different maxBiddable)
- [ ] Error messages display correctly
- [ ] UI shows disabled state correctly
- [ ] Calculations update after each player sold

## 🚨 Common Issues & Solutions

### Issue: maxBiddableAmount is 0 for all teams
**Solution**: Check that tournament has `categoryBasePrices` configured

### Issue: Teams can still overbid
**Solution**: Verify frontend is fetching and using `maxBiddableAmount` from API

### Issue: Calculation seems wrong
**Solution**: Check that `minPlayersPerTeam` is set in tournament settings

### Issue: Frontend not showing the field
**Solution**: Clear browser cache and ensure API response includes the field

## 📝 API Changes

### Endpoint: `/api/team/all`

**Request**:
```json
{
  "touranmentId": "tournament_id_here"
}
```

**Response** (NEW FIELD):
```json
{
  "data": [{
    "teams": [{
      "_id": "team_id",
      "name": "Team Name",
      "remainingBudget": 7000,
      "playersCount": 10,
      "maxBiddableAmount": 4500  ← NEW
    }]
  }]
}
```

## 🎨 UI Changes

### Before
```
Team Button: Disabled if (no slots OR insufficient budget)
Error Message: "Team does not have enough budget"
```

### After
```
Team Button: Disabled if (no slots OR insufficient budget OR exceeds max biddable)
Error Message: "Team must reserve budget for minimum roster. Max bid: X Pts."
```

## 🔐 Validation Layers

1. **Backend Calculation**: Ensures correct maxBiddableAmount
2. **Frontend Check (handleTeamBid)**: Validates before bid is placed
3. **Frontend UI (button disable)**: Visual feedback before click
4. **Frontend Error**: Clear message if validation fails

## 📈 Monitoring

Check these metrics post-deployment:
- Number of "max biddable exceeded" errors
- Teams unable to complete minimum roster (should decrease)
- User feedback on error message clarity
- Auction completion success rate

## 🔄 Update Frequency

`maxBiddableAmount` is recalculated:
- After each player is sold (via `fetchTeams()`)
- When page is refreshed
- When team data is updated

## 🎓 For New Developers

**Start Here**:
1. Read `/MAX_BIDDABLE_AMOUNT_IMPLEMENTATION.md`
2. Review `/auctioner/examples/maxBiddableAmountExample.js`
3. Check backend implementation in `teamService.js`
4. Check frontend implementation in `Auction.tsx`
5. Run tests and verify behavior

**Key Concepts**:
- This is a **business logic** constraint, not a technical limitation
- Calculation happens **server-side** for security
- Frontend uses the value for **validation and UX**
- Formula ensures **fair play** and prevents invalid states

---

Last Updated: 2025-11-21
Version: 1.0.0
