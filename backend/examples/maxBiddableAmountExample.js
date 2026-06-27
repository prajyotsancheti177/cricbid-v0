/**
 * MAX BIDDABLE AMOUNT CALCULATION EXAMPLE
 * ==========================================
 * 
 * This example demonstrates how the maxBiddableAmount is calculated for each team
 * during the auction to prevent teams from overbidding and being unable to complete
 * their minimum roster requirements.
 * 
 * SCENARIO:
 * ---------
 * Tournament Configuration:
 *   - Min Players Per Team: 15
 *   - Max Players Per Team: 20
 *   - Total Budget Per Team: 15,000 Pts
 *   - Player Categories:
 *     - Icon: 1,000 Pts (base price)
 *     - Regular: 500 Pts (base price) ← MINIMUM
 *     - Rookie: 700 Pts (base price)
 * 
 * Team A Current State:
 *   - Players Bought: 10
 *   - Total Spent: 8,000 Pts
 *   - Remaining Budget: 7,000 Pts
 * 
 * CALCULATION STEPS:
 * ------------------
 * 
 * Step 1: Find minimum base price across all categories
 *   minBasePrice = Math.min(1000, 500, 700) = 500 Pts
 * 
 * Step 2: Calculate how many more players needed to reach minimum
 *   playersAlreadyBought = 10
 *   minPlayersPerTeam = 15
 *   slotsToFill = 15 - 10 - 1 = 4 players
 *   NOTE: We subtract 1 because we're assuming this team WILL WIN the current player
 * 
 * Step 3: Calculate amount to reserve for future minimum purchases
 *   reservedAmount = minBasePrice × slotsToFill
 *   reservedAmount = 500 × 4 = 2,000 Pts
 * 
 * Step 4: Calculate maximum amount team can bid on current player
 *   maxBiddableAmount = remainingBudget - reservedAmount
 *   maxBiddableAmount = 7,000 - 2,000 = 5,000 Pts
 * 
 * RESULT:
 * -------
 * Team A can bid up to 5,000 Pts on the current player.
 * 
 * WHY THIS WORKS:
 * ---------------
 * If Team A bids and wins at 5,000 Pts:
 *   - New players bought: 11 (10 + 1 current player)
 *   - New total spent: 8,000 + 5,000 = 13,000 Pts
 *   - New remaining budget: 15,000 - 13,000 = 2,000 Pts
 *   - Players still needed: 15 - 11 = 4
 *   - Minimum cost to buy 4 players: 4 × 500 = 2,000 Pts
 *   - Budget remaining after minimum purchases: 2,000 - 2,000 = 0 Pts ✓
 * 
 * Team A will have EXACTLY enough budget to complete their roster!
 * 
 * EDGE CASES:
 * -----------
 * 
 * 1. Team has exactly minimum players:
 *    slotsToFill = 0
 *    reservedAmount = 0
 *    maxBiddableAmount = remainingBudget
 *    (Can bid their entire remaining budget)
 * 
 * 2. Team has more than minimum but less than maximum:
 *    Still reserves budget for difference to minimum (0 in this case)
 *    maxBiddableAmount = remainingBudget
 * 
 * 3. Team's remaining budget is less than reserved amount:
 *    maxBiddableAmount = max(0, negativeNumber) = 0
 *    (Team cannot bid at all until they're closer to minimum)
 * 
 * CODE IMPLEMENTATION:
 * --------------------
 * See: /auctioner/services/teamService.js:130-137
 * 
 * const playersAlreadyBought = team.players ? team.players.length : 0;
 * const slotsToFill = Math.max(0, minPlayersPerTeam - playersAlreadyBought - 1); // -1 for current player
 * const reservedAmount = minBasePrice * slotsToFill;
 * const maxBiddableAmount = Math.max(0, (team.remainingBudget || 0) - reservedAmount);
 * team.maxBiddableAmount = maxBiddableAmount;
 */

// This file is for documentation purposes only
// The actual implementation is in teamService.js
