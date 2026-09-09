# Traps in this codebase

Every one of these cost real debugging time. They are grouped by what you would
be doing when you hit them.

## Data shapes that are not what they look like

**`player.teamId` is sometimes an object.** `/api/player/all` returns it populated
as `{ _id, name }`; elsewhere it is a plain id string. Code that does
`String(p.teamId)` silently matches nothing — a squad-completion check once counted
every team as empty and reported a finished auction as unfinished. Normalise:

```js
const raw = (typeof p.teamId === 'object' && p.teamId !== null) ? p.teamId._id : p.teamId;
```

**`touranmentId` is misspelled everywhere** — in the schema, the API contract and
the query params. Deliberate; "fixing" it breaks the frontend. `Team.touranmentId`
too. Note `AuctionLiveState`/`PlayerChange` use the correctly-spelled
`tournamentId`, so check which model you are on.

**Mobile numbers are not identity.** 26 players share one number, 22 have `"0"`,
18 share `9999999999`, and 184 have none at all. Matching on mobile alone will
mis-pair people; match on name **and** mobile, and expect duplicates.

**A player can appear twice with the same name.** Five duplicate name pairs exist
in one tournament alone. Neither name nor mobile is unique — only the id is.

## Falsy zero

**Serial number 0 is a real serial.** A player sits at `auctionSerialNumber: 0`.
Every `player.auctionSerialNumber && ...` guard renders a bare `0` instead of the
badge, and every `|| fallback` silently substitutes something else. This bit nine
render sites plus the sheet-append and the CSV export.

Use `!= null` for presence and `??` for defaults on anything numeric here —
serials, ages, amounts.

## Google Sheets

**Headers are hand-edited and drift.** A column headed `Category` will not match a
configured label of `Player Category`; a sheet can carry **two columns headed
`Player ID`** where the first holds upload URLs. `indexOf` picked the wrong one and
matched zero of 275 rows while reporting "no changes".

`backend/utils/sheetColumns.js` is the shared matcher — normalised (trimmed,
case-folded, whitespace-collapsed) with a small alias table, plus
`resolveIdColumn()` which picks the id column by which one actually contains known
player ids. Use it on both directions; the reader and the writer disagreeing is
how values end up under the wrong headings.

**The export owns columns A..N and rewrites them completely**, including rows left
by deleted players. Anything to the right belongs to the host and is never touched.
Header row and data rows are built from one `buildColumnPlan(config)` — keep it
that way, or a disabled field shortens the rows but not the headers and shifts
every later value one column left.

**Sheet → database sync was removed** (September 2026) and should stay removed. It
silently overwrote good data. The player sheet is the editing surface now. Export
in the other direction is fine and still used.

## Uploads and images

**S3 objects are served as `Content-Type: application/octet-stream`.** A direct
link therefore *downloads* rather than displays. An `<img>` tag renders them fine
regardless, so previews work in a dialog — and the download button works precisely
because of the header. `fetch()` to the bucket is **CORS-blocked**, so
fetch-to-blob downloads are not possible.

Files are keyed `photo-<ms>-<rand>` and `cf_<field>-<ms>-<rand>`; the millisecond
timestamps of a photo and its payment proof match within ~1ms when they came from
the same registration, which is how a mis-attributed photo was proven.

## Radix UI

**A dropdown inside a dialog can dismiss the dialog.** Select content renders in a
portal outside the dialog, so the click that closes the dropdown can read as a
click *outside* the dialog. Guarding only on "is the target inside a popper" misses
the rapid-click case, because by the second click the popper is already gone.
`components/form/select.tsx` tracks when a select last opened or closed; dialogs
ignore outside interactions within 500ms of that.

**Closing an open menu is done by the dismissable layer's `document` listener**,
not the trigger's own handler — so suppressing a repeat click needs
`stopPropagation()` as well as `preventDefault()`.

Import Select from `@/components/form/select`. `components/ui/` is generated
shadcn and should stay regenerable.

## PDF export

**html2canvas places text using font metrics that differ between engines.** The
same markup that centres in Chrome rendered ~4.5px lower elsewhere, clipping the
serial badge. Padding cannot fix it — in the drifting engine the text tracks the
box's bottom edge. `exportPlayerCardsPdf.ts` calibrates at export time: it
rasterises one throwaway badge, measures ink against the pill, and applies the
correction. Do not "tidy" that away.

PDFs carry the producing bundle hash and the measured shift in their metadata, so
a "still broken" report can be traced to an exact build instead of guessed at.

## The auction room

**Auto-advance waits 3s for the result animation** (`RESULT_ANIMATION_MS`), and the
client animation runs 4s. The next player is fetched *during* that wait — doing it
after added 0.3–1.3s of visible dead air. Keep the prefetch parallel to the timer.

**Selecting a player does not mark them auctioned.** `nextAuctionPlayer` therefore
needs to be told who is currently on the block, or serial mode returns the same
player forever and "Next" looks dead.

**State is restored at boot** from `auction_live_state`. Sockets are not restored —
`auctioneerUserId` is, and the existing reconnect path re-attaches the host.

## Prisma schema edits

**`auctionRoomSessions` exists on both `User` and `Tournament`.** A naive
find-and-replace hits the wrong model and detaches a relation — it took two
attempts to add one back-relation. Always `npx prisma validate` from `backend/`
after editing the schema, and read the diff before committing.

## Auth

`authMiddleware` accepts an unverified `userId` from the body, query or header, and
`roleMiddleware` trusts a client-supplied `x-user-role`. A hole where
`req.body.userRole` decided authorisation let anyone overwrite any tournament's
payment QR; that one is fixed by resolving the acting user from the database, but
the underlying model stands.

Practical consequences: scope every write by tournament rather than trusting an id,
and treat the `userId` recorded in `user_event` as attributable but spoofable —
useful for "who changed this", not for security.
