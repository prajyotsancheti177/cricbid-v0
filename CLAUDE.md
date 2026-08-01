# CricBid

Cricket tournament + player-auction platform. Organizers create a tournament, collect
player/team registrations, run a **live real-time auction** (socket-driven, with OBS
broadcast overlays), then schedule matches and do **ball-by-ball scoring**.

Read this file before exploring. Only open the repo when you need detail it doesn't cover.

## Layout

| Dir | What | Stack | Dev port |
|---|---|---|---|
| `backend/` | REST API + Socket.io auction server | Node CJS, Express 5, Prisma/Postgres | 3001 |
| `frontend/` | Main app: tournaments, auction room, overlays, admin | React 18 + Vite + TS, shadcn/ui + Tailwind | 8080 |
| `scoring/` | Separate scorer app: match list, scorer panel, scorecard | React 19 + Vite + TS, Tailwind | 5173 |
| `mobile/` | Expo shell — **stub, essentially empty** | React Native / Expo | 8081 |
| `docs/` | Feature write-ups (max-biddable-amount, WhatsApp templates, security fixes) | | |

Root is an npm workspace (`backend`, `frontend`, `mobile` — note `scoring` is **not** in it).
`.claude/launch.json` defines all four launch configs; prefer `preview_start` over raw `npm`.

## Backend architecture

Strict layering — follow it:

```
routes/*Routes.js  →  controller/*Controller.js  →  services/*Service.js  →  db/prisma.js
```

- Entry: `backend/server/index.js` — mounts `/api` (all routers), serves `/uploads`, boots
  Socket.io, starts the `jobs/geoCleanup` cron.
- Router index: `backend/routes/index.js`. Mount paths:
  `/api/{user,tournament,team,player,player-profile,auction,whatsapp,event,auction-log,backup,match,scoring}`
- **Responses**: always via `backend/utils/index.js` → `sendSuccess(res, code, msg, data)` /
  `sendError(...)`. Shape is `{ success, message, data }`. Don't hand-roll `res.json`.
- Config: `backend/config/index.js` reads `backend/.env` (`PORT`, `MONGO_DB_URI`, `META_API_KEY`,
  plus `DATABASE_URL` used directly by Prisma).

### Data layer — mid-migration, this matters

Mongo → Postgres migration is **essentially done**. `backend/prisma/schema.prisma` is the source
of truth; `db/prisma.js` is the shared singleton (uses `@prisma/adapter-pg` + `pg.Pool`, WASM
driver-adapter mode — no native engine binary).

- **Write new code against Prisma.** All services use it.
- Legacy Mongoose (`backend/models/*.js`, `db/index.js`) is still connected at boot and is the
  one exception: `services/auctionRoomSessionService.js` still touches it. Treat `models/` as
  dead weight otherwise; don't add to it.
- IDs are `String` — old Mongo ObjectId hex values were carried over, new rows get `cuid()`.
- Migrations in `backend/prisma/migrations/`. ETL script: `backend/scripts/etl-mongo-to-postgres.cjs`.

Key models: `User`, `Tournament`, `Team`, `Player`, `PlayerProfile`, `AuctionLog` +
`AuctionLogBid`, `AuctionRoomSession`, `Match` / `Innings` / `BallEvent` / `BatsmanInnings` /
`BowlerInnings` / `Partnership` / `FallOfWicket`, `TournamentBackup`, `UserEvent`,
`WhatsappLog`, `IpGeoCache`.

**Known wart:** `Team.touranmentId` is misspelled in the DB and API contract. Deliberate — do not
"fix" it casually; it would break the frontend.

`Tournament` carries several JSON blobs: `categoryBasePrices`, `bidIncrementSlabs`,
`registrationFormConfig`, `features` (per-tournament flags: whatsappNotifications, obsOverlays,
publicPlayerRegistration, publicTeamRegistration, googleSheetsSync, dataExport), `whatsappConfig`.

### Live auction (the core feature)

- `backend/sockets/auctionSocket.js` (~720 lines) — namespace **`/auction`**, all handlers.
- `backend/services/auctionStateManager.js` — **in-memory** `Map` of active auctions keyed by
  `tournamentId`, one live session per tournament. State is not durable across restarts;
  `AuctionLog` / `AuctionRoomSession` are the persisted record.
- Events (`auction:` prefix): inbound `join`, `start`, `bid`, `undoBid`, `selectPlayer`,
  `updateSlabs`, `resetMode`, `delete`, `list`, `role`; outbound `state`, `bidPlaced`,
  `playerSelected`, `sold`, `unsold`, `ended`, `viewerCount`, `info`, `error`. Plus
  `overlay:layout_change` for OBS.
- Two modes: `category` and `manual`. Bid increments come from `bidIncrementSlabs`
  (`{ minBid, maxBid, increment }`).
- "Max biddable amount" is a real formula with history — see `docs/MAX_BIDDABLE_AMOUNT_IMPLEMENTATION.md`
  and `docs/FORMULA_CORRECTION.md` before touching bid-cap logic.

### Integrations

WhatsApp via Meta Business API (`services/whatsappService.js`, templates in
`docs/whatsapp-meta-templates.md`), Google Sheets sync (`utils/googleService.js`), S3 uploads
(`utils/uploadMiddleware.js`, multer-s3, local fallback to `backend/uploads/`), IP geolocation
with a TTL cache + daily cleanup cron.

## Frontend (`frontend/`)

- `src/App.tsx` is the route map — read it first for any UI question.
- Alias `@/` → `frontend/src`.
- API base: `src/config/apiConfig.ts` → `VITE_API_URL`, defaulting to `https://cricbid.online`.
- Socket: `src/lib/socket.ts` singleton connecting to `${baseUrl}/auction`.
  Hooks: `useAuctionSocket.ts`, `useOverlaySocket.ts`.
- Route groups: public landing/registration (`/`, `/register/:tournamentId`,
  `/team-register/:tournamentId`), **OBS overlays** (`/overlay/:tournamentId/{camera-hud,
  fullscreen,split-screen}` — standalone, no navbar, meant as browser sources), the auction room
  (`/auction`, `/auction/room/:tournamentId`), and the **tournament workspace**
  (`/tournament/:tournamentId/manage/*` — overview, players, teams, registration, whatsapp,
  schedule, auction, data, backups, settings) under `src/pages/workspace/`.
- `src/components/ui/` is generated shadcn/ui — don't hand-edit; regenerate.
- Scaffolded by Lovable (`lovable-tagger` in dev mode).

## Scoring app (`scoring/`)

Independent from `frontend/` — React 19, Vite 8, **oxlint** (not eslint), plain `fetch` in
`src/lib/api.ts` against a relative `/api`, proxied to `localhost:3001` by `vite.config.ts`.
Routes: `/` match list, `/scorecard/:matchId` (public), `/login`, `/schedule-builder` and
`/score/:matchId` (protected). Backs onto `/api/match` and `/api/scoring`.

## Auth — read before touching anything security-adjacent

Auth is **deliberately weak / placeholder**, and it's known:

- `backend/utils/authMiddleware.js` does not verify tokens. It accepts a `userId` from body,
  query, or `x-user-id` header. `roleMiddleware` likewise trusts a client-supplied `x-user-role`.
  Both are trivially spoofable. The file says JWT is the intended replacement.
- Frontends gate on `localStorage`: `isAuthenticated === "true"` (frontend),
  `scoring_auth === "true"` (scoring).
- Roles: `boss`, `super_user`, `tournament_host` (`Role` enum). Bootstrap: `scripts/createBossUser.js`.
- `PlayerProfile` has its own separate mobile-based auth path (`playerProfileAuthMiddleware.js`).

Don't present these as secure, and don't assume a fix is out of scope — but do flag the blast
radius before rewriting the auth model.

## Conventions

- Backend is **CommonJS** (`require`), frontends are **ESM + TypeScript**.
- Backend has **no test suite** (`npm test` exits 1). Verify by running the server.
- `git log` uses conventional commits (`feat:`, `fix:`, `chore:`, with scopes).
- Secrets live in `.env` files, gitignored. Never commit `backend/.env` or `backups/`.

## Running

```bash
npm run backend    # or: cd backend && node ./server/index.js
```
```bash
npm run frontend
```
```bash
cd scoring && npm run dev
```

Production runs the backend under PM2 (`backend/ecosystem.config.js`, app name `auction-app`).
