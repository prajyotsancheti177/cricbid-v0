# What shipped, September 2026

Branch `sql-migration`, from `511f3d2` to `20ea14a`. Grouped by area, newest last
within each group. Read this when a piece of recent work looks unfamiliar or you
are wondering why something is shaped the way it is.

## Security

- **`8c40aa6`** — `updateRegistrationConfig` trusted `req.body.userRole` and only
  enforced ownership when that role happened to be `tournament_host`. Since
  authMiddleware never verifies the caller, any unauthenticated request sending
  `userRole: 'boss'` could overwrite any tournament's `registrationFormConfig`,
  including the payment QR that collects fees. The acting user is now resolved
  from the database; `applySync` also stopped trusting client-supplied ids.
  *The underlying "knowing a user id is being that user" model is unchanged.*

## Registration

- **`f1e5f03`** — UPI deep links alongside the QR (`frontend/src/lib/upi.ts`).
  Every parameter is URI-encoded so a payee name containing `&pa=` cannot inject a
  second payee; `frontend/scripts/test-upi.mjs` covers that.
- **`fc9fbb2`, `9bab0ba`** — built-in payment-screenshot upload, on by default,
  implemented as a reserved custom field (`cf_payment_screenshot`) because that is
  the path that actually delivers the image to the host — file custom fields upload
  under their `cf_` id and become a Sheets column. Not seeded when the host already
  has their own file field, or players get asked twice.
- **`e13a2a2`** — the screenshot is **compulsory by default**
  (`paymentProofRequired`, absent means required). A host's own upload field is
  never touched.

## Payment gating — the big behavioural change

- **`93d9b4d`** — **registering no longer puts a player in the auction.**
  `paymentVerified` gates `nextAuctionPlayer` (both branches), the socket's manual
  player selection, and the WhatsApp category notification. Public registrations
  start pending; host-entered players (form, CSV) are verified on arrival.
  Backfill: of 2,526 players, 2,507 became verified; the 19 then in Jain Unity Cup
  stayed pending by request. Sheet → DB sync removed in the same commit.

## The player sheet (replaces Google Sheets editing)

- **`4145ada`** — `TournamentPlayerSheetSection.tsx`: dense editable grid at
  Manage Tournament → Player sheet. Optimistic saves with rollback, column picker
  persisted per tournament in `Tournament.playerSheetConfig`, three host-owned note
  columns stored in `customFields` via `customFieldPatch` (merges, so saving a note
  cannot wipe a payment proof). Auction fields are read-only because team budgets
  are computed from sold amounts.
- **`670a277`** — serial number editable (it gets printed and handed to team
  owners), with a non-blocking warning when one collides.
- **`086428e`** — keyboard navigation: arrows, Tab/Shift+Tab with wrap, Enter/F2 to
  edit, Enter commits and drops down, Escape abandons, typing replaces. Read-only
  columns are skipped when moving.
- **`c799a6f`** — screenshots open in a dialog instead of downloading, with a
  separate Download button; **Fix serial numbers** renumbers 1..N to close gaps left
  by deleted players, previewing every move before it writes.
- **`20ea14a`** — **change history with undo.** Every change is recorded field by
  field in `player_change`, grouped by the action that caused it. The History panel
  offers "undo this action" and "roll back to just before this". Undo replays
  newest-first so a field touched twice lands on its oldest value, and is itself
  recorded so the trail reads forwards.

## The auction room

- **`6bd0637`** — "Next player" in serial mode returned the same player forever,
  because selecting does not mark anyone auctioned. It now advances past whoever is
  on the block and wraps to reach skipped players.
- **`6e96863`** — closed the gap between players: the next player is fetched
  *during* the 3s result animation instead of after it (measured 4337ms → 3002ms).
  Sound and animation toggles persist in `localStorage`.
- **`d15b2fa`** — **a restart no longer loses the lot.** State mirrors to
  `auction_live_state` after every change (debounced 250ms, fire-and-forget) and is
  restored at boot. Rows older than 12h are dropped rather than resurrected.

## Exports

- **`527b412`, `391de7a`** — the Sheets integration rebuilt around one shared
  column plan (`sheetColumns.js`); normalised header matching with aliases; the id
  column chosen by which one actually holds player ids.
- **`fbe7297`** — player cards include unsold players ("Available Players"), so the
  export is useful *before* an auction; three tournaments that previously produced
  nothing now export.
- **`8c54a1d`, `b366392`, `9e838fc`** — serial badge clipping, fixed properly on the
  third attempt by calibrating against the renderer at export time.
- **`a13acdf`, `4a3431d`, `309ba7c`** — grouping choice (team / category top-N /
  overall top-N), configurable players-per-page, team sections ordered by sold
  price, and "Available Players" dropped once every squad is full.
- **`206d7cb`** — the teams-roster PDF card is commented out, not deleted.

## Analytics

- **`5061bc8`, `224aae0`** — page paths showed raw ids (186 of 205 distinct pages).
  `backend/utils/pageLabel.js` resolves tournament and team ids to names for display
  only — events are still *stored* by id, which is correct. Applied to the traffic
  chart and the live "where they are" board.

## UI fixes

- **`59aa00f`** — serial `0` rendered as a bare `0` instead of a badge (falsy-zero).
- **`fbda0ad`** — number-input spinners hidden app-wide; the arrows covered the
  value in narrow grid cells.
- **`0f800e0`, `3b3c3c9`** — rapid clicks on a dropdown dismissed the whole dialog.
- **`ebe8f88`** — photo management (upload / change / remove) in the player edit
  dialog. Removal sends `""` not `null`, because `buildPlayerData` drops null keys.

## Known-open, deliberately not done

- **Auth rewrite.** Real sessions/JWT. Big job; nothing actively broken since the
  payment-config hole closed.
- **In-app backups.** `TournamentBackup` has zero rows across all tournaments —
  the feature exists but has never produced one. Every safety net so far has been a
  hand-written snapshot.
- **Mobile data quality.** Validation at registration, duplicate warnings.
- **Deletion undo.** History records field changes, not whole-row removal, so a
  deleted player cannot be restored from it.
- **`index.html` has no `Cache-Control`**, so a stale bundle can be served after a
  deploy until the user hard-refreshes.
