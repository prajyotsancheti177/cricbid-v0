---
name: cricbid
description: Working context for the CricBid cricket auction platform (this repo) — the codebase map, what the live production system looks like, how to deploy safely, and the traps that have already bitten. Use this whenever working in the cricbid repo or on cricbid.online: any change to players, teams, tournaments, the live auction room, the player sheet, registration forms, Google Sheets export, analytics or the OBS overlays; any deploy, migration or production database question; and any time you are about to explore the codebase or query the production database to orient yourself — read this first instead, it is cheaper and already correct.
---

# CricBid

Cricket tournament + player-auction platform. Organisers create a tournament, take
player registrations, run a **live socket-driven auction** with OBS overlays, then
schedule matches and score them ball by ball.

`CLAUDE.md` in the repo root is the canonical architecture doc — read it for layout
and conventions. This skill carries what is *not* in the code: what production
actually looks like, how to change it without breaking a live event, and the
specific ways this codebase has surprised people.

## Orient in 30 seconds

| | |
|---|---|
| Repo | `/Users/prajyot/rebirth-cricbid`, branch **`sql-migration`** (not `main` — main is far behind) |
| Backend | `backend/` — Node CJS, Express 5, Prisma/Postgres, Socket.io. Port 3002 in prod |
| Frontend | `frontend/` — React 18 + Vite + TS, shadcn/ui + Tailwind |
| Live site | **cricbid.online**, nginx serves `frontend/dist` straight out of the deployed repo |
| Scale | ~15 tournaments, ~2,500 players, real auctions running on it |

Backend layering is strict: `routes/ → controller/ → services/ → db/prisma.js`.
Responses always go through `sendSuccess` / `sendError` from `backend/utils/index.js`.

## Rules that keep this safe

**Production is live and events happen on it.** People are mid-auction on this
system. A bad deploy is not an inconvenience, it loses money in the room.

1. **Check claims against the live database before acting on them.** Almost every
   assumption in this codebase has turned out subtly wrong — duplicate sheet
   headers, populated-vs-string ids, players sharing a phone number. Read-only
   probes are cheap: see `references/production.md` for how to run one on the box.

2. **Never put a database write in the same command that ships the script.**
   Interrupting a Bash tool call kills the local ssh client, *not* the remote
   process — a rejected call has still committed a transaction here before. Ship
   the script, run it once as a dry run, then run it again with `--confirm`.
   Details and the exact pattern: `references/production.md`.

3. **Snapshot before any bulk write**, to `/home/ubuntu/cricBid/backups/`. There
   are **no `TournamentBackup` rows in production** — the in-app backup feature has
   never produced one, so those hand-written snapshots are the only safety net.

4. **Verify by reading the data back, not by trusting the script's own output.**
   Diff against a dump taken before the change. A script reporting success while a
   transaction was still open has misled us before.

5. **Deploy with the `cricbid-deploy` skill.** It is the single runbook for a
   deploy — branch check, build, restart, verification, rollback. Do not restate
   its steps elsewhere; `references/production.md` covers only what surrounds a
   deploy.

## Where things live

Frequently touched, easy to lose:

- **Live auction** — `backend/sockets/auctionSocket.js` (namespace `/auction`),
  `backend/services/auctionStateManager.js` (in-memory state, mirrored to
  `auction_live_state` and restored at boot), `backend/services/auctionService.js`
  (`nextAuctionPlayer` — the gate deciding who can be called).
- **Player sheet** (the spreadsheet view hosts live in) —
  `frontend/src/pages/workspace/TournamentPlayerSheetSection.tsx`.
- **Registration form editor** — `frontend/src/components/auction/RegistrationConfigDialog.tsx`;
  the public form is `frontend/src/pages/PublicPlayerRegistration.tsx`.
- **Sheets export** — `backend/utils/googleService.js` +
  `backend/utils/sheetColumns.js` (one column plan drives headers and rows).
- **Card/report PDFs** — `frontend/src/lib/exportPlayerCardsPdf.ts`.
- **Select wrapper** — `frontend/src/components/form/select.tsx`. Import Select from
  here, never from `components/ui/select`; `components/ui/` is generated shadcn and
  is meant to stay regenerable.

## Domain rules worth knowing

- **A registered player is not in the auction.** `paymentVerified` gates entry.
  Public self-registrations start `false`; players the host adds (form or CSV) are
  `true`. Verification happens in the player sheet.
- **Auction results are derived state.** `sold`, `amtSold` and `teamId` drive team
  budgets, so they are read-only in the player sheet and should only change through
  the auction flow or the player dialog.
- **Serial numbers are printed and handed to team owners**, so they are editable and
  changing them is a real-world action, not just a data edit.
- **Auth is deliberately weak.** `authMiddleware` accepts an unverified `userId`;
  knowing an id is equivalent to being that user. Never present it as secure, and
  scope every write by tournament rather than trusting a client-supplied id.

## Reference files

Read the one you need — they are detailed and not worth loading up front.

- **`references/production.md`** — reaching the server, read-only probes, the
  ship → dry-run → `--confirm` rule for database writes, snapshots and data
  rollback, writing a data migration, and where the SSH key and config live. Read
  before touching production data. *The deploy sequence itself lives in the
  `cricbid-deploy` skill — use that to deploy.*
- **`references/gotchas.md`** — the specific traps: falsy-zero serials, `teamId`
  arriving as an object, S3 uploads served as `octet-stream`, hand-edited sheet
  headers, Radix dropdowns dismissing dialogs, html2canvas text drift. Read before
  debugging anything that "should work".
- **`references/changelog-2026-09.md`** — what shipped in the September 2026 push,
  with commit SHAs and why each change was made. Read when picking up unfamiliar
  recent work or wondering why something is the way it is.
