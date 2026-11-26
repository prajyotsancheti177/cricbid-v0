# Google sign-in test plan, users-table evaluation, and role-based visibility

*Written 2026-11-25 against `sql-migration` @ `3dc9999`. Read-only analysis: no code was
changed, nothing was run against production, no database was queried.*

> **Status 2026-11-26:** tested (§9), then fixed (§10). R2, R4–R10 and the confirmed gaps
> are fixed in the working tree. R3 (webviews) is mitigated with an open-in-browser escape.
> The harness passes 67/67 on a local database. **Not committed, not deployed.**
> Sections 0–8 below are the original analysis and describe the code *before* the fixes.

---

## 0. Summary for the decision-maker

### What Google sign-in is today

It is fully built and, from reading the code, mostly sound. There is **one identity table**
(`user`). Anyone may sign in with Google. A first sign-in creates a `player`, and a boss
promotes them later. A Google account whose verified email matches an existing row is
**auto-linked** to that row by recording `googleSub`. Sessions are 32-byte random tokens in
`user_session`: one row per device, 90-day fixed expiry. There are two UI modes. **Popup**
is used on desktop. **Redirect** is used on mobile by default: Google POSTs to
`/api/user/google-callback`, which redirects to `/login#token=…`.

### Top risks found while mapping it (ranked)

| # | Risk | Severity | Where |
|---|---|---|---|
| R1 | **Testing "locally" means testing production.** `backend/.env` points `DATABASE_URL` at the production Supabase DB, and `frontend/.env` points `VITE_API_URL` at `https://cricbid.online`. A local Google sign-in test creates real rows in production. | Blocker for testing | `backend/.env`, `frontend/.env` |
| R2 | **Mobile player sign-in from the registration form is very likely broken.** On phones the button uses redirect mode. Redirect mode always returns to `/login`, never to `/register/:id`, and stores only `cricbid_session_token`. `PlayerProfileModal` reads only `cricbid_player_token`, so the player is sent to `/tournaments`. When they go back, they are asked to sign in again: a loop. | High (most users are players on phones) | `GoogleSignInButton.tsx:132-153`, `Login.tsx:93`, `PlayerProfileModal.tsx:46` |
| R3 | **In-app browsers (WhatsApp / Instagram / Facebook) are not handled.** Google refuses OAuth in embedded webviews (`403 disallowed_useragent`), and registration links are shared on WhatsApp. Today the user just gets a Google error page. | High (real-world) | `GoogleSignInButton.tsx` |
| R4 | **super_user can create a `boss`.** `POST /api/user/create` passes `req.body` straight to `createUser`. The permission check runs only `if (createdBy)`, so if `createdBy` is omitted there is no check, and `role: 'boss'` is accepted. | High (privilege escalation, not reachable by `player`) | `userController.js:7`, `userService.js:65-87` |
| R5 | **Login CSRF on the redirect callback.** A missing `g_csrf_token` cookie is tolerated. An attacker page can POST its *own* fresh Google credential to the callback and sign the victim into the attacker's account. The victim might then enter a child's details or a payment proof into it. | Medium | `userController.js:88` |
| R6 | **Auto-linking trusts `email_verified` for every domain.** For non-Gmail, non-Workspace addresses (e.g. `host@somecompany.in`), Google's verification proves only that someone could read that inbox *at some point*. An ex-employee who once made a Google account with that address can take over the CricBid host account it links to. | Medium | `userService.js:237-251` |
| R7 | **Deactivation is incomplete.** `authMiddleware` checks `isActive`, but `getUserBySessionToken` does not. Because `playerProfileAuthMiddleware` uses it, a suspended user's live sessions keep working on `/api/player-profile/*`. A suspended user's `googleSub` also gets linked before the `isActive` refusal. | Medium | `userService.js:282`, `userService.js:250-267` |
| R8 | **Gmail aliases make duplicate accounts.** Google returns the account's canonical address. An admin-made `john+cricbid@gmail.com` or `johndoe@gmail.com` row never matches a sign-in as `john.doe@gmail.com`, so a second, `player`-role account is silently created. The host then "has no access". | Medium (support load) | `userService.js:233-262` |
| R9 | **No rate limiting anywhere**, and session tokens are accepted from `?sessionToken=` (query strings end up in nginx logs). | Low-Med | `authMiddleware.js:28-32`, `server/index.js` |
| R10 | **Any tournament host can change other tournaments' teams** (confirmed by the 2026-11-26 test run, §9):<br>• `/team/update` has no tournament check at all, so a host can rename another tournament's team.<br>• `/team/delete` trusts a claimed `tournamentId`, so a host can delete another tournament's team.<br>• `/team/topup-budget` lets a host change another team's **live auction budget**, recorded under any user id sent in the body.<br>• `/planner/link-reset` lets a host break another team owner's planner link. | High (host-level; player still blocked) | `teamRoutes.js:22,28,34`, `tournamentAccess.js:187`, `teamService.js:337-352`, `plannerRoutes.js:18` |

### Recommendations

1. **Before any testing**, stand up an isolated test stack: local Postgres plus a separate
   Google OAuth client. Override env vars on the command line; don't edit `.env` (§2).
   Production checks only with dedicated throwaway Google accounts.
2. **Fix R2 and R3 before announcing Google sign-in.** They are the two things real players
   will hit first. Fix R4 at the same time; it is a one-line authorisation fix.
3. **Don't replace the `user` table. Evolve it.** Add an `auth_identity` table (one row per
   login method), hash session tokens at rest, add a canonical-email column, and drop the
   five vestigial `can*` permission columns. A full replacement means re-pointing about 15
   user-id columns, several of them plain strings with no foreign key, plus in-memory
   auction state and `localStorage` comparisons. It buys nothing that the additive
   approach doesn't (§5).
4. **Role visibility page:** keep a **manifest in code** (keys, defaults, and a *ceiling*
   of roles the server permits) and store only **boss overrides** in the DB. The page may
   only *restrict* within the ceiling, never grant beyond it. `player` has a hard floor of
   "manages nothing" that no toggle can change. Phase 2 makes the backend enforce the same
   restrictions through `requireCapability` (§6).

---

## 1. How Google sign-in works today

### 1.1 Components

| Piece | File | Notes |
|---|---|---|
| Config | `backend/config/index.js` | `GOOGLE_CLIENT_ID` (sign-in off when unset), `APP_URL` (default `https://cricbid.online`), `GOOGLE_REDIRECT_MODE` = `mobile` (default) / `true` / `false` |
| Public config endpoint | `GET /api/player-profile/auth-config` → `playerProfileController.authConfig` | Returns `googleClientId`, `googleEnabled`, `googleRedirectUri` (`${APP_URL}/api/user/google-callback`, or null when mode is `false`), `googleRedirectOn` |
| Core verify + find/link/create | `userService.loginWithGoogle` (`userService.js:213`) | `OAuth2Client.verifyIdToken` (signature, `aud`, `iss`, `exp`, ±300 s skew), requires `email_verified === true`, looks up by `googleSub`, then by lowercased email, then creates |
| Popup endpoint (admin login page) | `POST /api/user/google-login` | Returns serialized user + `sessionToken` |
| Popup endpoint (player modal) | `POST /api/player-profile/google` | Same `loginWithGoogle`, returns `{ token, account }` |
| Redirect callback | `POST /api/user/google-callback` (`userController.js:78`) | Form POST from Google with `credential` + `g_csrf_token`; redirects to `/login#token=…` or `/login?error=…` |
| Sessions | `user_session` table; `createSession` / `logout` | 90-day fixed TTL, no sliding renewal; `lastSeenAt` updated per request |
| REST auth | `utils/authMiddleware.js` | Token from `x-session-token` / `x-player-token` / body / query; checks expiry + `isActive`; sets `req.userId`, `req.userRole` from DB |
| Player auth | `utils/playerProfileAuthMiddleware.js` → `getAccountByToken` → `getUserBySessionToken` | **No `isActive` check** |
| Public-route identity | `tournamentAccess.resolveOptionalUser` | Checks expiry + `isActive` |
| Socket identity | `auctionSocket.js` `resolveActor` / `mayManage` | Re-resolves the token on every action through `resolveOptionalUser` |
| Button | `frontend/src/components/auth/GoogleSignInButton.tsx` | Loads GIS script, `initialize` (`ux_mode: "redirect"` when mobile-like and redirect URI present), `renderButton` |
| Admin login page | `frontend/src/pages/Login.tsx` | Popup → `completeLogin`; redirect → reads `#token`, stores it, calls `/api/user/detail`, `completeLogin` |
| Player sign-in | `frontend/src/components/PlayerProfileModal.tsx` | Popup → stores token under **both** `cricbid_player_token` and `cricbid_session_token` |
| Client session | `frontend/src/lib/auth.ts` | `localStorage`: `cricbid_session_token`, `user`, `isAuthenticated`; role re-fetched from `/api/user/detail` once per page load; global `fetch` hook signs out on `SESSION_*` 401s |

### 1.2 Flows

**Popup (desktop default):**

```
GIS button ─popup→ accounts.google.com ─postMessage→ callback({credential})
  → fetch POST {endpoint} {credential}
  → loginWithGoogle → createSession → token returned in JSON
  → Login: storeSession(user)          → /users (boss/super_user) or /tournaments
  → Modal: localStorage both keys      → pick/add player
```

**Redirect (phones and tablets by default):**

```
GIS button (ux_mode=redirect, login_uri=${APP_URL}/api/user/google-callback)
  → full-page nav to Google → Google auto-submits form POST to login_uri
      body: credential, g_csrf_token   cookie: g_csrf_token (often absent cross-site)
  → googleCallback: cookie≠body? → /login?error=csrf
                    loginWithGoogle → 302 ${APP_URL}/login#token=<90-day token>
  → Login.tsx: replaceState('/login'); store token; POST /api/user/detail; completeLogin
```

Whichever button started it (admin login *or* the player registration modal), redirect
mode always ends on `/login`. That is the root of R2.

### 1.3 `loginWithGoogle` decision table

| State in DB | Google payload | Result today |
|---|---|---|
| Row with `googleSub = sub` | any | That row; email **not** refreshed from Google |
| No sub match; row with `email = lower(payload.email)`, `googleSub` null | verified | Row is **linked** (`googleSub` set, `emailVerified = true`), keeps its role |
| No sub match; email row has a different `googleSub` | verified | Error "Another Google account is already linked" (no self-service fix) |
| No row | verified | New row: `role = player`, `password = null` |
| any | `email_verified` false / missing email | Error "no verified email" |
| Row found but `isActive = false` | verified | Link/create **happens first**, then error "deactivated" |
| `GOOGLE_CLIENT_ID` unset | — | Error "not configured"; button hidden through auth-config |

---

## 2. Test environment: do this first

### 2.1 Why "local" is not safe as configured

- `backend/.env` → `DATABASE_URL` = production Supabase pooler. Every local sign-in writes to prod.
- `frontend/.env` → `VITE_API_URL=https://cricbid.online`. The local UI talks to the **prod API**.
- `backend/.env` has no `APP_URL`, so redirect mode defaults to the **production** callback URL.
- `MONGO_DB_URI` is also connected at boot (`db/index.js`), probably production Mongo too.

### 2.2 Isolated local stack (no file edits needed)

`dotenv` and Vite both let shell variables override `.env` files, so override per command:

```bash
docker run -d --name cricbid-test-pg -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16
```
```bash
cd backend && DATABASE_URL=postgresql://postgres:test@localhost:5433/postgres npx prisma migrate deploy
```
```bash
cd backend && PORT=3001 DATABASE_URL=postgresql://postgres:test@localhost:5433/postgres MONGO_DB_URI=mongodb://localhost:27017/cricbid_test GOOGLE_CLIENT_ID=<dev-client-id> APP_URL=http://localhost:3001 GOOGLE_REDIRECT_MODE=false node ./server/index.js
```
```bash
cd frontend && VITE_API_URL=http://localhost:3001 npm run dev
```

Then seed a boss with `backend/scripts/createBossUser.js` (with the same `DATABASE_URL`
override), plus one host and one super_user via the API.

**Separate Google OAuth client ("CricBid Dev")** in Google Cloud Console:
- Authorised JavaScript origins: `http://localhost`, `http://localhost:8080`.
- Authorised redirect URIs: `http://localhost:3001/api/user/google-callback`.
- Consent screen: "Testing" is fine for dev. Add the test Gmail accounts as test users.

**Limit:** `APP_URL` is used both to build the callback URL (backend, :3001) and as the
post-login destination (frontend, :8080). Locally those are different origins, so
**redirect mode cannot be tested end-to-end locally** without a Vite `/api` proxy or a
reverse proxy that puts both on one origin. Popup mode can be. Phones need HTTPS for any
non-localhost origin, so mobile tests need a tunnel (cloudflared/ngrok), with that HTTPS
origin added to the dev client, or a staging host.

### 2.3 Production verification rules

- Use **dedicated throwaway Google accounts**: one Gmail, one Gmail with dots in the
  name, one Workspace account if available, and one non-Gmail Google account. Never use
  real users.
- Only read-only probes on prod (see the `cricbid` skill's `references/production.md`).
  Clean up test rows with the ship → dry-run → `--confirm` pattern, after a snapshot.
- Production Google client checklist (Cloud Console, verify by eye):
  - JS origins include `https://cricbid.online` (and `https://www.cricbid.online` if served).
  - Redirect URIs include `https://cricbid.online/api/user/google-callback`.
  - Consent screen is **In production**, not Testing. In Testing, only listed test users can sign in.
- `timedatectl` on the EC2 box should show `System clock synchronized: yes` (case L1).

Useful read-only probes (prod or local):

```sql
-- who is this email, how did they sign in, what can they do
SELECT id, email, role, "isActive", "emailVerified", ("googleSub" IS NOT NULL) AS google_linked,
       (password IS NOT NULL) AS has_password, "createdAt"
FROM "user" WHERE email = lower('test.account@gmail.com');

-- their live sessions
SELECT id, "userAgent", "createdAt", "lastSeenAt", "expiresAt"
FROM user_session WHERE "userId" = '<id>' ORDER BY "createdAt" DESC;

-- socket seat attempts (auditSeat) and client login events
SELECT "eventType", "tournamentId", "createdAt", "eventData"
FROM user_event WHERE "userId" = '<id>' ORDER BY "createdAt" DESC LIMIT 30;

-- possible Gmail-alias duplicates
SELECT lower(regexp_replace(split_part(email,'@',1), '(\+.*)|\.', '', 'g')) AS canon, count(*), array_agg(email)
FROM "user" WHERE email LIKE '%@gmail.com' GROUP BY 1 HAVING count(*) > 1;
```

---

## 3. Test cases

**Legend.** *Verify:* **L** = isolated local stack, **P** = production with throwaway
accounts, **L+T** = local through an HTTPS tunnel on a real phone. *Today* is the result
predicted from reading the code: ✅ should pass · ❌ known gap/bug · ⚠️ depends on
config or browser, so must be observed.

### A. Configuration

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| A1 | `GOOGLE_CLIENT_ID` unset | Start backend without it; open `/login` and `/register/:id` | Button absent, password login works; `auth-config` → `googleEnabled:false`; `POST /api/user/google-login` → 401 "not configured" | L | ✅ |
| A2 | Player modal with Google off | A1, then open the registration modal | A usable alternative or a clear message (player routes have no password login) | L | ⚠️ check what the modal shows |
| A3 | Wrong client ID (another project's) | Set a valid-looking but different ID | GIS error `invalid_client` / origin mismatch; `error_callback` message shown | L | ⚠️ |
| A4 | Origin not registered | Serve frontend on an unlisted port | Google shows "origin not allowed"; app shows the generic error | L | ⚠️ |
| A5 | Redirect URI not registered | `GOOGLE_REDIRECT_MODE=true`, URI absent from the client | Google `redirect_uri_mismatch` page; user stuck on Google | L/P | ⚠️ this is why `mobile` must not be on without registration |
| A6 | `APP_URL` wrong / trailing slash | Set `APP_URL=https://cricbid.online/` | Trailing slash stripped; callback URL correct | L | ✅ |
| A7 | Consent screen in "Testing" | Sign in with an account not on the test-user list | "Access blocked" from Google | P (console) | ⚠️ must be "In production" |
| A8 | GIS script blocked (ad-blocker, network) | Block `accounts.google.com/gsi/client` | `error` "Could not load Google sign-in"; password form still usable | L | ✅ |

### B. First-time sign-in (account creation)

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| B1 | Brand-new Gmail, admin login page, popup | `/login` → Continue with Google | Row created: `role=player`, `password NULL`, `googleSub` set, `emailVerified=true`; one `user_session`; navigates to `/tournaments` | L, P | ✅ |
| B2 | Brand-new Gmail, player modal, popup | `/register/:id` → sign in in modal | Same row shape; modal moves to "Add a player"; token under both storage keys | L, P | ✅ |
| B3 | Brand-new Gmail, player modal, **redirect (phone)** | Phone → registration link → sign in | Return to the **same registration page**, signed in, modal on "Add a player" | L+T, P | ❌ **R2**: lands on `/login` → `/tournaments`; `cricbid_player_token` not set; modal asks again |
| B4 | Name missing on the Google profile | Account with no display name | Row created with `name NULL`; UI never shows "Welcome back, undefined!" | L | ❌ `Login.tsx` toast uses `user.name` directly |
| B5 | Two first sign-ins racing (double-tap, two tabs) | Fire two `google-login` calls with the same credential in parallel | One user row (unique `email`/`googleSub`); the second call gets a friendly error or the same user | L (curl) | ⚠️ the loser of the race throws a Prisma P2002 → "Google sign-in failed"-style 401 |
| B6 | New player sees nothing admin | After B1, check the navbar menu and visit `/tournaments/manage`, `/users`, `/analytics`, `/tournament/:id/manage/*` | No admin links; every admin route redirects to `/tournaments` | L, P | ❌ navbar shows "Manage Tournaments" and "Add Player" to every signed-in user (`Navbar.tsx:38-39`); routes do redirect ✅ |
| B7 | Server-side audit of account creation | After B1 | Some durable record that the account was created via Google | L | ❌ only the client-sent `trackEvent("login")`, which is spoofable and blockable |

### C. Linking Google to an existing account

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| C1 | Admin-made host (password), same Gmail | Boss creates host `x@gmail.com`; host signs in with Google `x@gmail.com` | Linked: `googleSub` set, role stays `tournament_host`, password still works | L, P | ✅ |
| C2 | Both methods afterwards | After C1, log in with password on device 1 and Google on device 2 | Two sessions, same user id | L | ✅ |
| C3 | Google-only user tries password | B1 user enters email + any password | "This account signs in with Google" | L | ✅ (note: this reveals that the email exists, see R9) |
| C4 | Boss account linked by Google | Boss email is a Gmail; sign in with Google | Linked, role `boss`. **Decide** whether this is wanted: it adds a second way into the most powerful account | L | ⚠️ policy decision |
| C5 | Non-Gmail, non-Workspace email (R6) | Host row `host@company.in`; create a personal Google account using that address; sign in | **Should** require a password confirmation (or a boss approval) before linking an existing privileged account | L | ❌ auto-links |
| C6 | Workspace account (`hd` claim present) | Host on a Google Workspace domain signs in | Linked (Google is authoritative for `hd` domains) | P (if available) | ✅ |
| C7 | Link when the row is suspended | Row `isActive=false`, sign in with Google | Refused, **and no link written** | L | ❌ link is written before the refusal (`userService.js:250` vs `:267`) |

### D. Email case and Gmail aliases

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| D1 | Case | Boss creates `John@Gmail.com`; sign in as `john@gmail.com` | Same account | L | ✅ both sides lowercase |
| D2 | Whitespace in admin-entered email | Create `" x@gmail.com "` | Trimmed at create | L | ✅ create trims; **login does not trim** (`userService.js:133`) |
| D3 | Dots | Boss creates `johndoe@gmail.com`; Google account is `john.doe@gmail.com` | Ideally: matched, or at least flagged to the boss as a likely duplicate | L | ❌ a second `player` account is created (R8) |
| D4 | Plus alias | Boss creates `john+cricbid@gmail.com` | Same as D3 | L | ❌ R8 |
| D5 | `googlemail.com` | Account address `x@googlemail.com` vs row `x@gmail.com` | Treated as the same mailbox | L | ❌ |
| D6 | Non-Gmail dots | `first.last@company.in` vs `firstlast@company.in` | **Not** merged: dots matter outside Gmail | L | ✅ (no normalisation at all) |

### E. Unverified email

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| E1 | `email_verified=false` | Use a Google account created with an external address that was never verified (hard to obtain; else unit-test with a stubbed `verifyIdToken`) | 401 "no verified email"; no row created | L (stub) | ✅ |
| E2 | Payload missing `email` (scope trimmed) | Stubbed payload | Same refusal | L (stub) | ✅ |

### F. Deactivated / demoted accounts

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| F1 | Suspended, new sign-in | Set `isActive=false` (API `/user/update`, local only); sign in by password and by Google | Both refused with the "deactivated" message | L | ✅ (but see C7) |
| F2 | Suspended, existing REST session | Sign in first, then suspend; call an `authMiddleware` route | 403 `DEACTIVATED` | L | ✅ |
| F3 | Suspended, existing **player** session | As F2, but call `GET /api/player-profile/me`, `POST /profiles` | 401/403 | L | ❌ **R7**: still works (`getUserBySessionToken` has no `isActive` check) |
| F4 | Suspended, socket | Open the auction room as an active host, suspend, then emit `auction:bid` | Refused on the next action | L | ✅ `resolveOptionalUser` checks `isActive` |
| F5 | "Remove access" (`/user/delete` soft) | Boss removes a host | Role → `player`, grants deleted, all sessions deleted; the user can sign in again as `player` | L | ✅ |
| F6 | Demoted while signed in | Host has the workspace open; boss sets their role to `player` | Next API call is refused (role read from DB); next page load bounces them from admin routes | L | ✅ (UI only refreshes the role once per page load) |
| F7 | Promoted while signed in | Player promoted to host | Admin routes open after a reload without re-login | L | ✅ `refreshCurrentUser` |

### G. Role escalation (player must manage nothing)

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| G1 | Player calls every managing REST route | With a B1 token, script a call to each route behind `roleMiddleware` / `requireTournamentAccess` (tournament update/delete, player register/update, team, whatsapp, backup, match, scoring, planner links, site settings, user/*) | 403 on every one | L | ✅ by route inventory; run it as a script |
| G2 | Player sends a spoofed role/user in the body | Add `userRole:'boss'`, `userId:<boss id>`, `x-user-id`, `x-user-role` headers | Ignored; still 403 | L | ✅ |
| G3 | Player claims the auction seat | Socket `auction:start` / `auction:role` / `selectPlayer` / `bid` as auctioneer with the player token; also with a forged payload `userId` | Refused, seat not taken, nothing cleared, `user_event` audit row written | L | ✅ by design; must be observed |
| G4 | Player reads another user | `POST /api/user/detail {targetUserId}` | 403 | L | ✅ |
| G5 | Player self-promotes | `POST /api/user/set-access` with own id | 403 (route role gate) | L | ✅ |
| G6 | **super_user creates a boss** | As super_user: `POST /api/user/create {name,email,password,role:'boss'}` with **no** `createdBy` | 403 | L | ❌ **R4**: succeeds |
| G7 | super_user suspends/edits a boss | `POST /api/user/update {targetUserId:<boss>, isActive:false}` | Refused | L | ❌ `updateUser` has no actor or target checks |
| G8 | super_user hard-deletes another admin | `POST /api/user/delete {targetUserId:<super_user>, hardDelete:true}` | Refused or boss-only | L | ❌ allowed for any non-boss target |
| G9 | Player on a private tournament | Player opens a private tournament's detail/players/auction room | 404 "not found" | L | ✅ `requireTournamentVisible` |
| G10 | Host edits a team in someone else's tournament | Host sends `{teamId:<other's team>, tournamentId:<own>}` to a team route | 403 | L | ❌ likely: `requireTournamentAccess` only derives the tournament from `teamId` when **no** `tournamentId` is claimed (`tournamentAccess.js:187`) |
| G11 | Host resets another tournament's planner link | `POST /api/planner/link-reset {teamId:<other's team>}` | 403 | L | ❌ no `requireTournamentAccess` on that route |

### H. Sessions and multiple devices

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| H1 | Two devices | Sign in on laptop (popup) and phone (redirect) | Both work independently; two `user_session` rows | L+T, P | ✅ (phone part blocked by R2 for players) |
| H2 | Logout on one device | Logout on laptop | Laptop token deleted; phone still works | L | ✅ |
| H3 | Logout from the player modal vs the admin navbar | Sign in through the modal, sign out from the navbar (and vice versa) | Both storage keys cleared; server session deleted | L | ⚠️ `clearSession` clears both keys; check the player logout path |
| H4 | "Sign out everywhere" | — | Available to the user | — | ❌ `logoutEverywhere` / `listSessions` exist but no route |
| H5 | Session list hygiene | Sign in 20 times | 20 rows; expired rows only removed when touched | L | ⚠️ no cleanup job for `user_session` |
| H6 | Same browser, different Google accounts | Sign in as A, then without logout use the redirect flow as B | Ends as B with B's role; A's stale `user` object not shown | L | ⚠️ the `Login.tsx` "already authenticated" effect may navigate with A's stored role before B's detail call resolves |
| H7 | Shared/family phone | Parent signs in, child's registration done, next family member uses the same phone | Clear "signed in as …" indicator and a switch-account option in the modal | P | ⚠️ UX check |

### I. Popup vs redirect

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| I1 | Desktop Chrome popup | Default config | Works | L, P | ✅ |
| I2 | Desktop Safari (ITP) / Firefox strict | Popup | Works (`itp_support`) or shows the guidance message | L, P | ⚠️ |
| I3 | Popup blocked | Block popups | Message "Your browser blocked…" | L | ✅ |
| I4 | Popup closed by user | Close it | "Sign-in was cancelled." | L | ✅ |
| I5 | Android Chrome redirect | `mobile` mode on a phone, from `/login` | Returns to `/login`, then `/tournaments` (player) or `/users` (admin) | L+T, P | ✅ admin path |
| I6 | iOS Safari redirect | Same | Same | L+T, P | ⚠️ `g_csrf_token` cookie likely absent; tolerated |
| I7 | iPadOS (reports as Mac) | Same | Treated as mobile (touch heuristic) | P | ✅ |
| I8 | Redirect from the player modal | See B3 | Return to the registration page | L+T, P | ❌ R2 |
| I9 | Redirect error path | Force `loginWithGoogle` to throw (suspended user) | `/login?error=…` shows the message; URL cleaned | L+T | ✅ |
| I10 | Token left in URL if JS fails | Disable JS after the redirect / slow network | Token should not persist in the URL bar/history | L+T | ⚠️ the fragment stays until `Login.tsx` runs |
| I11 | Desktop with redirect forced | `GOOGLE_REDIRECT_MODE=true` | Works if the URI is registered | P (staging) | ⚠️ A5 |

### J. In-app browsers (webviews)

Expect Google to refuse in every embedded webview: "Error 403: disallowed_useragent".
Behaviour differs by app version and OS, so these have to be observed.

| ID | Case | Steps | Expected (desired) | Verify | Today |
|---|---|---|---|---|---|
| J1 | WhatsApp in-app browser (Android) | Send `/register/:id` in a chat, tap it | Detect the webview → banner "Open in Chrome" with an `intent://` link / copy-link button; Google button hidden or explained | P | ❌ no detection; user sees Google's 403 |
| J2 | WhatsApp (iOS) | Same | Same (iOS: "open in Safari" instructions) | P | ❌ / ⚠️ |
| J3 | Instagram / Facebook (`Instagram`, `FBAN`, `FBAV`, `FB_IAB` in UA) | Link in bio / DM | Same | P | ❌ |
| J4 | Telegram, LinkedIn, Gmail app in-app | Same | Same | P | ⚠️ |
| J5 | Fallback path exists | In any webview | Player can still register without Google (today: anonymous public registration) | P | ⚠️ confirm the public form works signed-out |

### K. Token expiry and logout

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| K1 | Session expired | Locally set `expiresAt` to the past | First API call → 401 `SESSION_EXPIRED`, row deleted, global hook signs out → `/login` | L | ✅ |
| K2 | Session token deleted server-side | Delete the row | 401 `SESSION_INVALID` → signed out | L | ✅ |
| K3 | Expired on a player screen | As K1 on `/register/:id` with the modal | Modal falls back to sign-in, no loop | L | ✅ (`fetchAccountWithToken` → null → clear) |
| K4 | 403 must not sign out | Player hits a managing route | Error shown, **not** signed out | L | ✅ |
| K5 | 90-day fixed expiry | Active daily user on day 90 | Signed out mid-use (no sliding renewal) | L (time travel) | ⚠️ decide: sliding window? |
| K6 | Google ID token expired before POST | Hold a credential for more than 1 h + 5 min, then POST | "Could not verify that Google sign-in" | L (curl) | ✅ |
| K7 | Credential replay | POST the same credential 3 times within its hour | Ideally only the first creates a session | L (curl) | ❌ each creates a new 90-day session (no `nonce`/`jti` check) |

### L. Clock skew

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| L1 | Server clock drift more than 5 min | Locally fake the clock (e.g. libfaketime) ±10 min | Every Google sign-in fails "Token used too early/late"; log it distinctly | L | ⚠️ generic message hides the cause |
| L2 | Client clock wrong | Phone clock set 1 day off | No effect (server verifies; GIS handles its own) | L+T | ✅ |
| L3 | Prod clock synced | `timedatectl` on EC2 | Synchronized | P (read-only) | ⚠️ check |

### M. Changed Google email and `googleSub` conflicts

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| M1 | Google account's address changes | Link, then change the primary email on a non-Gmail Google account | Same CricBid user (matched by `sub`); stored email ideally updated (or flagged) | L | ⚠️ matched ✅, but `email` is never refreshed, so WhatsApp/registration lookups by email go stale |
| M2 | New email collides with another row | After M1, a separate row already has the new address | Stay on the `sub` match; boss alerted to a duplicate | L | ⚠️ silent |
| M3 | Workspace user deleted and recreated (same email, new `sub`) | Simulate by setting a different `googleSub` on the row | Clear recovery path (boss "unlink Google" action) | L | ❌ permanent "Another Google account is already linked" with no UI to fix |
| M4 | Gmail account deleted, address later recycled | Same as M3 | Must **not** auto-link the new owner to the old row | L | ✅ refused (good), but no recovery path |

### N. CSRF, state, replay on the redirect callback

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| N1 | Cookie ≠ body `g_csrf_token` | curl POST with mismatched values | `/login?error=csrf` | L | ✅ |
| N2 | Missing cookie, valid credential (login CSRF) | Attacker page auto-submits a form with the attacker's own fresh credential to `/api/user/google-callback` | Refused | L | ❌ **R5**: accepted; victim signed in as attacker |
| N3 | Garbage credential | POST `credential=abc` | `/login?error=Could not verify…` | L | ✅ |
| N4 | Credential for another client id | Token minted for a different `aud` | Refused | L | ✅ `audience` check |
| N5 | Reflected error text | Visit `/login?error=Call%20+91…%20for%20support` | Only known error codes are rendered | L | ❌ arbitrary text rendered (escaped, so no XSS, but usable for phishing) |
| N6 | Token in query string | Call any route with `?sessionToken=` | Rejected (headers only) | L | ❌ accepted (`authMiddleware.js:31`); ends up in access logs |
| N7 | Brute force / spam | 1000 POSTs to `/user/login` and `/google-login` | Rate-limited | L | ❌ no limiter |

### O. Player-profile auth interplay

| ID | Case | Steps | Expected | Verify | Today |
|---|---|---|---|---|---|
| O1 | Token interchangeability | Token from `/login` used with `x-player-token` on `/player-profile/me`, and vice versa | Works both ways | L | ✅ |
| O2 | Admin registers own child | Host signs in, opens a registration link | Modal reuses the session, shows the account's profiles | L | ⚠️ modal reads only `cricbid_player_token`; a host who signed in on `/login` has only `cricbid_session_token` → asked to sign in again |
| O3 | Ownership | Account A tries `PUT /profiles/<B's profile>` | "Player not found" | L | ✅ |
| O4 | Unowned legacy shells | Sign in with an email/mobile matching one of the 568 ownerless `player_profile` rows | **Not** auto-claimed | L | ✅ by design |
| O5 | Profile deletion cascade | Hard-delete a user (G8 path) | Their `player_profile` rows cascade-delete. **Confirm this is wanted**: profiles may be referenced by tournament `player` rows | L | ⚠️ |
| O6 | Account deletion request | `/delete-account` | A real self-service path, or a documented manual process (Google's OAuth policy expects one) | P | ⚠️ page is static text |

### P. Cross-cutting checks after every test run

- `SELECT role, count(*) FROM "user" GROUP BY role;`: no unexpected admins.
- No `user_session` rows belonging to suspended users that were used after the suspension (`lastSeenAt`).
- `pm2 logs server-sql --lines 200` (prod, read-only): no stack traces from `loginWithGoogle`.

---

## 4. What can go wrong in real-world use

1. **WhatsApp is the distribution channel, and Google blocks its webview.** Most
   registrations arrive by tapping a link in a WhatsApp group. Without detection and an
   "open in browser" escape, Google sign-in will look broken to a large share of players.
2. **Phones take the redirect path, and the redirect path forgets where the user was.**
   Anything started on `/register/:id` loses its context (R2). A generic `returnTo` must be
   carried through, ideally in GIS `state`, or in `sessionStorage` before navigating away.
3. **Duplicate accounts from Gmail aliases** (R8). Hosts made by hand with a
   slightly different address end up with a second account that is a `player`, then report
   "Google login doesn't work for me". A boss has no merge tool.
4. **OAuth console drift.** Origins, the redirect URI and the consent-screen publishing
   status live outside the repo. A domain change (`www.`, a new subdomain), a new staging
   host, or the consent screen dropping back to Testing silently breaks sign-in for everyone.
   Keep a checklist in `cricbid-deploy`.
5. **Third-party-cookie / FedCM changes in Chrome.** GIS is migrating the button and
   One Tap to FedCM. Popup behaviour can change under you with a Chrome release. Watch
   GIS deprecation notices and keep redirect mode working as the fallback.
6. **Shared and family phones.** One parent's phone registers several children. Sessions
   last 90 days, so the next person to use the phone is signed in as the parent. Show
   "Signed in as …" and a "Not you?" switch in the modal.
7. **Support can't fix linking problems.** M3 and D3/D4 need an admin "unlink Google" /
   "merge accounts" action. Today the only fix is SQL on production.
8. **A suspended person keeps partial access** through player-profile routes (R7).
9. **Token theft.** The token is a 90-day bearer value in `localStorage`, so any XSS
   (e.g. through a rich-text field or a compromised CDN script) yields long-lived
   sessions. Tokens are stored raw in the DB, so a DB read leak (backups, Supabase
   dashboard access) yields live sessions too.
10. **Volume.** Every Google signer-in is a `user` row. Admin screens such as
    `getUsersInHierarchy` and `getAllUsers` load *all users* for a boss without
    pagination, which will get slow at thousands of players.
11. **Clock or cert fetch failures** on the EC2 box make every Google login fail with the
    same generic message. Log the underlying error server-side.

---

## 5. Users table: redesign vs harden

### 5.1 What `user` carries today

```
id, name?, email @unique, password? (bcrypt), role (boss|super_user|tournament_host|player),
emailVerified, googleSub? @unique, isActive, logo?,
canCreateSuperUser, canCreateTournamentHost, canManageTournaments, canManageTeams, canManagePlayers,
createdById? (self-relation), createdAt, updatedAt
```

It mixes three concerns: **identity** (who), **credentials** (`password`, `googleSub`),
and **authorisation** (`role` plus the five `can*` flags).

### 5.2 Everything that points at a user id

| Column | FK? | Notes |
|---|---|---|
| `tournament.tournamentHostId` | **No** (plain string) | Ownership; compared to `user._id` in the frontend (`Tournaments.tsx:317`, `TournamentWorkspace.tsx:139`) |
| `user.createdById` | Yes | Hierarchy screens |
| `team_budget_topup.createdById` | Yes | |
| `player_profile.userId` | Yes, cascade | |
| `auction_log.conductedById` | Yes | |
| `player_change.actorUserId` | **No** | History screens look names up via `prisma.user.findMany` |
| `auction_room_session.hostUserId` | Yes | |
| `user_event.userId` | Yes | Analytics |
| `venue.ownerId`, `booking.userId` | Yes | |
| `tournament_access.userId`, `grantedById` | Yes | |
| `user_session.userId` | Yes, cascade | |
| `agent_request.createdByUserId`, `approvedByUserId` | **No** | |
| `cric_heroes_*.confirmedByUserId` | **No** | |
| In-memory / `auction_live_state` `auctioneerUserId` | **No** (JSON/state) | Restored at boot |
| Frontend `localStorage.user._id` | n/a | Compared against host ids |

Readers of `prisma.user`: `userService` (29 calls), `tournamentService`, `teamService`,
`siteSettingsService`, `playerHistoryService`, `agentRequestService`, `auctionSocket`,
`authMiddleware`, `tournamentAccess`. The `can*` columns are read only by `userService` and
`UserManagement.tsx:223-224`. **`setUserAccess` ignores them entirely**, so they no longer
mean anything.

### 5.3 Problems worth fixing (whichever option)

1. Credentials on the identity row: one password, one Google link. There's no room for
   WhatsApp OTP (already planned in `auth-config.otpEnabled`), and no record of *how* someone
   signed in.
2. No email canonicalisation, so the alias duplicates of R8.
3. Session tokens stored raw.
4. Vestigial `can*` columns that look authoritative but aren't.
5. `isActive` vs "remove access" semantics are documented only in a code comment.
6. No server-side audit of sign-ins and role changes (`tournament_access.grantedById` is the only trail).
7. No `lastLoginAt` / `avatarUrl`, so a boss can't tell real users from one-off sign-ins.

### 5.4 Option A: brand-new identity model (replace `user`)

```prisma
model Account {                       // replaces User
  id             String   @id @default(cuid())
  primaryEmail   String   @unique     // as last reported by the provider, lowercased
  emailCanonical String               // gmail: dots/+tag stripped, googlemail→gmail
  displayName    String?
  avatarUrl      String?
  role           Role     @default(player)
  status         AccountStatus @default(active)   // active | suspended
  lastLoginAt    DateTime?
  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  identities     AuthIdentity[]
  sessions       Session[]
  @@index([emailCanonical])
}
```

**Migration path if chosen:**
1. Create the new tables. Copy every `user` row **with the same `id`** (that is the only
   way to avoid rewriting the ~15 referencing columns, four of which have no FK to catch
   mistakes).
2. Re-point every Prisma relation to `Account`. Rename back-relations throughout the services.
3. Copy sessions (or force everyone to sign in again).
4. Ship backend and frontend together, because `serializeUser`'s `_id`/`permissions`
   shape is the API contract.
5. Drop `user` after a soak period.

**Risks:** if the IDs are kept, it is a **rename with extra steps**: the same rows, a new
name, and a large diff through every service. If the IDs are not kept, it means a
multi-table rewrite of unconstrained string columns, the in-memory auction state, and every
browser's `localStorage.user._id`, on a system with live auctions. Either way it needs a
maintenance window and a full regression pass, and there is no test suite.

### 5.5 Option B: harden and split in place (recommended)

Keep `user` as the **identity** table and its ids. Move credentials out and add what's
missing:

```prisma
model User {
  id             String   @id @default(cuid())
  name           String?
  email          String   @unique            // lowercased; refreshed from Google on sign-in
  emailCanonical String?                     // NEW: for duplicate detection
  avatarUrl      String?                     // NEW
  role           Role     @default(player)
  isActive       Boolean  @default(true)     // documented: true = not suspended
  logo           String?
  lastLoginAt    DateTime?                   // NEW
  createdById    String?
  // password, googleSub, emailVerified → moved to AuthIdentity (dropped in phase 3)
  // canCreateSuperUser … canManagePlayers → dropped (vestigial)
  identities     AuthIdentity[]
  ...existing relations unchanged...
  @@index([emailCanonical])
}

model AuthIdentity {                         // NEW: one row per way in
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider        AuthProvider               // password | google | whatsapp_otp
  providerSubject String                     // google: sub; password: lower(email); otp: E.164 phone
  email           String?                    // as the provider reported it at last use
  emailVerified   Boolean  @default(false)
  hostedDomain    String?                    // Google `hd`, for the linking policy
  passwordHash    String?                    // provider = password only
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  @@unique([provider, providerSubject])
  @@index([userId])
  @@map("auth_identity")
}

model UserSession {
  ...
  tokenHash   String  @unique                // NEW: sha256(token); raw `token` dropped in phase 3
  identityId  String?                        // NEW: which method opened it
  ip          String?
  revokedAt   DateTime?
}

model AuthAudit {                            // NEW: sign-ins, links, role changes, suspensions
  id String @id @default(cuid())
  userId String?  actorUserId String?
  action String   // login_google, login_password, link_google, unlink_google, role_change, suspend, …
  detail Json?    ip String?  userAgent String?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@map("auth_audit")
}
```

**Linking policy (encoded in `loginWithGoogle`):**
- Match `auth_identity(google, sub)` first.
- Otherwise auto-link to an existing user by email **only if** the Google email is
  authoritative (`@gmail.com`/`@googlemail.com`, or an `hd` claim is present) **and** the
  target is a `player`.
- To link onto a managing role (host, super_user, boss) from a non-authoritative email,
  require proof: the account's password once, or a boss approval.
- On an `emailCanonical` collision with a *different* user, still create or sign in, but
  record a "possible duplicate" for the boss's Users screen (with a merge action later).
- Check `isActive` **before** writing anything.

**Migration path (no downtime, no forced logout):**

| Phase | Change | Rollback |
|---|---|---|
| 1 (additive) | Create `auth_identity`, `auth_audit`; add `emailCanonical`, `avatarUrl`, `lastLoginAt`, `user_session.tokenHash`. Backfill: a `password` identity for each row with a password; a `google` identity for each row with `googleSub`; `tokenHash = sha256(token)` for live sessions; `emailCanonical` from `email`. Snapshot first (`backups/`). | Drop new tables/columns |
| 2 (dual-read) | Code reads identities first and falls back to the old columns; writes go to both. Session lookup by `tokenHash`, falling back to `token`. Ship R2/R4/R5/R7 fixes here. | Revert deploy; old columns still authoritative |
| 3 (cut over) | Stop writing `user.password` / `googleSub` / raw `token`. Run the duplicate report and resolve with the boss. | Re-enable dual-write |
| 4 (cleanup) | Drop `password`, `googleSub`, `emailVerified`, the five `can*` columns, `user_session.token`. Update `serializeUser` (keep `permissions` derived from role for API compatibility, or remove it together with `UserManagement.tsx:223-224`). | Restore from the phase-1 snapshot |

**Risks:** small. Every step is additive until phase 4, ids never change, and
`Team.touranmentId`-style API contracts are untouched. The main risk is the backfill on
production, which needs the ship → dry-run → `--confirm` pattern and a snapshot.

### 5.6 Comparison and recommendation

| | A: replace | B: harden + split |
|---|---|---|
| Google-first identity | ✅ | ✅ (via `auth_identity`) |
| Room for WhatsApp OTP | ✅ | ✅ |
| Touches referencing columns | All ~15 (or rename everything) | None |
| Downtime / forced re-login | Likely | None |
| Diff size | Very large | Moderate, incremental |
| Rollback | Hard | Per phase |
| Fixes R2–R9 | Only if also done | Same fixes, sooner |

**Recommendation: Option B.** The current table is already Google-first in behaviour:
default role `player`, nullable password, `googleSub`, and a single identity. What it lacks
is separation of credentials, canonical email, hashed tokens and an audit trail, and all of
those can be added without disturbing ids. The fixes that matter to users (R2, R3, R4, R5,
R7) don't depend on the schema at all and should ship first.

---

## 6. Role-based visibility control page

### 6.1 Goals and non-goals

- **Goal:** a boss decides which roles see which pages and which components within a page
  (nav links, workspace tabs, buttons, panels), without a deploy.
- **Non-goal:** using this page as the security boundary. Hiding UI is cosmetic.
  `roleMiddleware`, `requireTournamentAccess`, `canManageTournament` (including the
  private-tournament rule) and the socket `mayManage` stay authoritative.

### 6.2 The key design rule: ceiling, floor, and overrides

Each controllable thing (a **resource**) has:

- a **ceiling**, defined in code: the roles the *server* actually permits. Toggling a role
  above its ceiling would just produce a page that 403s, so the UI greys those cells out.
- a **default**, defined in code: what applies until a boss overrides it. This is how new
  pages get sane behaviour with no DB row.
- an optional **override**, stored in the DB and set by the boss. It can only **remove**
  roles from the default/ceiling set, or re-add roles up to the ceiling.

Hard rules that no override can break:
- `player` can never see a resource whose ceiling excludes `player` (that is, anything that
  manages something).
- `boss` always sees the visibility page itself and the Users page (no lock-out).
- Tournament-level access is **AND-ed** on top: visible = role policy ∧ tournament access ∧
  tournament `features` flag (e.g. `whatsappNotifications`).

### 6.3 Data model

**Registry in code** (`frontend/src/lib/visibility/manifest.ts`, mirrored as JSON for the
backend, or generated from one shared file):

```ts
export const RESOURCES = {
  "page.users":                     { kind: "page", label: "Users",            ceiling: ["boss","super_user"],                    default: ["boss","super_user"] },
  "page.analytics":                 { kind: "page", label: "Analytics",        ceiling: ["boss","super_user"],                    default: ["boss","super_user"] },
  "page.workspace.whatsapp":        { kind: "page", label: "Workspace › WhatsApp", ceiling: ["boss","super_user","tournament_host"], default: ["boss","super_user","tournament_host"], capability: "tournament.whatsapp" },
  "page.workspace.backups":         { kind: "page", label: "Workspace › Backups",  ceiling: ["boss","super_user","tournament_host"], default: ["boss","super_user","tournament_host"], capability: "tournament.backups" },
  "component.navbar.addPlayer":     { kind: "component", parent: "nav",  ceiling: ["boss","super_user","tournament_host"], default: ["boss","super_user","tournament_host"] },
  "component.auction.undoBid":      { kind: "component", parent: "page.auction.room", ceiling: ["boss","super_user","tournament_host"], default: [...] },
  "component.playerSheet.phoneCol": { kind: "component", parent: "page.workspace.sheet", ceiling: [...], default: [...], dataField: "mobile" },
  // …
} as const;
export type ResourceKey = keyof typeof RESOURCES;   // typos become compile errors
```

**Overrides in the DB:**

```prisma
model RoleVisibility {
  role        Role
  resourceKey String
  visible     Boolean
  updatedById String?
  updatedAt   DateTime @updatedAt
  @@id([role, resourceKey])
  @@map("role_visibility")
}

model RoleVisibilityVersion {      // single row; bumped on every change, used for cache busting
  id      Int @id @default(1)
  version Int @default(0)
  @@map("role_visibility_version")
}
```

Changes are written to `auth_audit` (or `user_event`), with before/after values.

Why a table and not a JSON blob in `site_settings`: per-row audit, no lost-update race when
two admins edit, and unknown keys (a resource deleted from the manifest) can be ignored or
garbage-collected safely.

### 6.4 API

| Route | Who | Returns |
|---|---|---|
| `GET /api/visibility/me` | anyone (optional session) | The **resolved** set of visible keys for the caller's role, plus `version`. Never the whole matrix: no need to tell a player what hosts can see. |
| `GET /api/visibility/matrix` | boss (super_user read-only, if wanted) | Manifest + overrides + ceilings |
| `PUT /api/visibility` | boss | Batch of `{role, key, visible}`; server **re-validates against the ceiling and hard rules**; bumps `version`; emits `visibility:changed` on the socket |

Follow the layering: `routes/visibilityRoutes.js → controller → services/visibilityService.js
→ prisma`, responses through `sendSuccess`/`sendError`.

### 6.5 Frontend gating

- `useVisibility()`: React Query `['visibility', role]`, `staleTime` 5 min, refetched on
  window focus, on the `visibility:changed` socket event, and whenever `refreshCurrentUser`
  sees a role change.
- `useCan(key: ResourceKey): boolean | undefined`: `undefined` while loading.
- `<Gate k="component.auction.undoBid">…</Gate>` for components. Renders nothing while
  loading, for admin-only keys (fail closed). For public keys, it may render optimistically
  from the code default.
- `<GuardedRoute k="page.workspace.whatsapp">` replaces `RoleRoute`/`ManageRoute` in
  `App.tsx`. It waits like `RoleRoute` does today (`ready`), then redirects with a toast
  instead of a silent bounce.
- **Navbar and workspace tabs are built from the manifest** filtered by `useCan`, rather than
  the hand-written `buildAdminLinks`. This also fixes B6 (players seeing "Manage Tournaments").
- First paint: cache the last resolved set in `localStorage` keyed by user id + version,
  wrapped in try/catch. It is only used to *hide* things faster, never to show admin
  things before the server answers.

### 6.6 Backend enforcement (Phase 2)

Visibility-only (Phase 1) is safe because the backend already enforces the ceiling. To make
a boss's **restriction** real (e.g. "tournament hosts may not use WhatsApp"), add:

```js
// utils/capability.js
const requireCapability = (key) => async (req, res, next) => {
  if (!(await visibilityService.roleMay(req.userRole, key))) return sendError(res, 403, "Not available for your role");
  next();
};
```

Mount it **after** `authMiddleware` + `roleMiddleware` and **alongside**
`requireTournamentAccess`, never instead of them. Do the same in socket handlers, after
`mayManage` and before mutating state. Audit the denial via `eventService.trackEvent`, as
CLAUDE.md requires. Server-side the policy is restriction-only: `roleMay` returns
`ceiling.includes(role) && override !== false`. It can never return true for a role outside
the code ceiling.

### 6.7 Caching

- **Backend:** in-process map `{version, resolved per role}`. Every `requireCapability` call
  does a cheap `SELECT version` (or uses a 15–30 s TTL) and reloads when it changes. This
  stays correct if PM2 ever runs more than one process.
- **Frontend:** as in §6.5. Invalidate on `visibility:changed`, focus, and role change.
- **Prerendered/public pages** (`prerender/entry.tsx`, overlays, `/c/:code`) should not
  depend on visibility at all. Keep them out of the manifest.

### 6.8 The admin page

- Route `/site-settings/visibility` (boss only; super_user optional read-only).
- A matrix: rows = resources grouped as a tree (page → its components); columns = `boss`
  (locked on), `super_user`, `tournament_host`, `player`, and optionally `signed_out` as a
  pseudo-role for public pages.
- Cell states: **default** (inherited, outlined), **overridden** (filled, with a reset
  arrow), **not permitted by server** (disabled, tooltip "the server doesn't allow this
  role").
- "Preview as role": renders the navbar and workspace tabs as that role would see them,
  using the resolved set. It does not impersonate a session.
- A change history panel from the audit table.
- "Reset all to defaults".

### 6.9 Defaults for new pages

- A new page or component **must** be added to the manifest to be gated. CI or lint can
  enforce this (`useCan` only accepts `ResourceKey`).
- With no DB row, the code `default` applies. Default to the ceiling for managing pages,
  so nothing disappears unexpectedly on deploy.
- A key in the DB that is no longer in the manifest is ignored, and listed as "orphaned"
  on the admin page.

### 6.10 Pitfalls

1. **Hiding a component doesn't hide its data.** If the player sheet's phone column is
   hidden for hosts, the API still returns `mobile`. Mark such resources with `dataField`
   and strip the field server-side in Phase 2, or say clearly on the admin page that it is
   cosmetic.
2. **Code-split chunks are still downloadable.** Hidden pages' JS is public. Never put
   secrets or privileged logic in the frontend.
3. **Deep links and bookmarks** bypass navigation, so route guards are required, not just
   hidden links.
4. **Socket actions** (undo bid, select player, reset mode) are separate from REST. Gate
   both.
5. **The scoring app** (`scoring/`) is a separate React app on its own subdomain and
   doesn't share `frontend/src`. Either give it its own small `useCan`, or exclude it
   explicitly.
6. **Lock-out.** A boss must never be able to hide the visibility page or Users page
   from `boss`. Enforce it server-side.
7. **Three overlapping switches** (role visibility, tournament `features`, tournament
   access) will confuse hosts ("why can't I see WhatsApp?"). Have the page explain the
   AND-rule, and show the failing reason in the toast.
8. **Stale role in the browser.** The role refreshes once per page load. Pair visibility
   invalidation with `refreshCurrentUser`.
9. **Private tournaments.** The boss/super_user shortcut doesn't apply there. Visibility
   must not reintroduce it ("boss can see Backups" ≠ "boss can open this private
   tournament's Backups").
10. **Granularity creep.** Start with pages, workspace tabs, nav links and roughly 10
    high-value components. Every key added is a test case.

---

## 7. Incidental findings (outside the three asks, worth fixing)

| # | Finding | Where | Severity |
|---|---|---|---|
| X1 | super_user → boss escalation through `/user/create` with no `createdBy` (R4) | `userController.js:7`, `userService.js:65-87` | High |
| X2 | `/user/update` lets any super_user suspend or edit a boss or other super_users; `userId` is taken from the body when `targetUserId` is absent | `userController.js:157-166`, `userService.js:518` | Medium |
| X3 | `/user/delete` with `hardDelete:true` lets super_user permanently delete other admins | `userService.js:548-565` | Medium |
| X4 | `requireTournamentAccess` trusts the claimed `tournamentId` over the team's real tournament when both are sent | `tournamentAccess.js:187` | Medium |
| X5 | `/planner/link-reset` has no `requireTournamentAccess`: any host can reset any team's planner link | `plannerRoutes.js:18` | Low-Med |
| X6 | The `can*` permission columns are ignored by `setUserAccess`, so super_users can mint super_users there | `userService.js` | Low (design) |
| X7 | Sign-in events are only recorded client-side (`trackEvent("login")` through the public `/event/track`) | `Login.tsx:60` | Low |

---

## 8. Suggested order of work

1. Isolated test stack + dev OAuth client (§2).
2. Fix X1/R4, R7 (`isActive` in `getUserBySessionToken`, check before linking), N6
   (drop the query/body token), and add a rate limiter on login routes.
3. Fix R2: carry `returnTo` through redirect mode and unify the two storage keys. Fix R3:
   webview detection with an "open in browser" escape.
4. Fix R5: nonce in GIS bound to a short-lived `SameSite=None; Secure` cookie (or a
   one-time code exchange instead of putting the 90-day token in the URL fragment).
5. Run every table in §3 locally, then the P-marked rows on production with throwaway
   accounts.
6. Users table Option B, phases 1–2 (identities, hashed tokens, canonical email, audit).
7. Visibility page, Phase 1 (manifest + overrides + UI gating), then Phase 2 (`requireCapability`).


---

## 9. Test run results: API level, 2026-11-26

**33 of 55** cases match the desired behaviour. Run on an isolated local database (`cricbid_auth_test` on this Mac's Postgres 16). Nothing touched production.

### How it was run

The harness is `backend/scripts/auth-test/` (not committed). It has two files.

**`preload.js`** does four things:
- refuses to start unless `DATABASE_URL` is local;
- drops the Supabase SSL option;
- stubs the legacy Mongo connection;
- with `AUTH_TEST_FAKE_GOOGLE=1`, accepts `fake.<base64 JSON>` ID tokens. These are checked for `aud`, `exp` and `iat` (±300 s) the way google-auth-library checks them. Real Google tokens still go to the real verifier.

**`run.js`** works in five steps:
1. Wipes and seeds the local database: 13 users across all roles, 4 tournaments (one private) and 2 teams.
2. Starts its own server on :3011, with WhatsApp, S3, Sheets, CricHeroes and Mongo blanked. It starts a second server on :3012 without `GOOGLE_CLIENT_ID`.
3. Reads `routes/*.js` to find every role-gated endpoint.
4. Runs each case.
5. Writes JSON and the server log.

```bash
cd backend && DATABASE_URL=postgresql://<you>@localhost:5432/cricbid_auth_test node --require ./scripts/auth-test/preload.js ./scripts/auth-test/run.js
```

**What it cannot cover:**
- Google's own UI: popup, redirect, webviews and console configuration (§3 groups I and J, A3–A5, A7).
- Real clock skew: L1 is simulated.
- Frontend behaviour: B3, B6, H6, I8, N5, O2.

Those need a browser and real Google accounts.

### Results

| ID | Result | Case | Observed |
|---|---|---|---|
| A1 | ✅ | GOOGLE_CLIENT_ID unset | googleEnabled=false, google-login 401 "Google sign-in is not configured", password 200 |
| B1 | ✅ | New Gmail via /user/google-login | 200; role=player, password=NULL, googleSub=sub-newplayer, emailVerified=true, sessions=1 |
| B2 | ✅ | New Gmail via /player-profile/google | 200; token=true, profiles=[], role=player |
| B4 | ✅ | Google profile with no name | 200; name=null (UI toast would read "Welcome back, null!") |
| B5 | ✅ | Parallel first sign-in, same credential | rows=1, statuses=200,200,200 |
| C1 | ✅ | Link Google to admin-made Gmail host | 200; id=u_host, role=tournament_host, googleSub=sub-host, password login 200 |
| C2 | ✅ | Both methods give the same user, separate sessions | u_host sessions=2 |
| C3 | ✅ | Google-only account tries password | 401 "Login failed" ("This account signs in with Google") |
| C5 | ❌ | Non-Gmail, non-Workspace host email (no hd) | 200; linked=true, signed in as u_host_corp role=tournament_host |
| C7 | ❌ | Link attempt on a suspended row | 401 "Your account has been deactivated. Please contact support."; googleSub after=sub-susp |
| D1 | ✅ | Email case | 200; matched u_demote |
| D2 | ❌ | Whitespace around email at password login | 401 "Login failed" |
| D3 | ❌ | Gmail dots: row johndoe@, Google john.doe@ | 200; signed in as <new id> role=player; new row for john.doe@gmail.com: yes (player) |
| D4 | ❌ | Gmail plus: row jane+cricbid@, Google jane@ | 200; signed in as <new id> role=player; new row for jane@gmail.com: yes (player) |
| D5 | ❌ | googlemail.com vs gmail.com | 200; signed in as <new id> role=player; new row for mike@googlemail.com: yes (player) |
| E1 | ✅ | email_verified=false | 401 "That Google account has no verified email address"; row=false |
| E2 | ✅ | Payload without email | 401 "That Google account has no verified email address" |
| F1 | ✅ | Suspended: password and Google sign-in | password 401 "Your account has been deactivated. Please contact support.", google 401 "Another Google account is already linked to this CricBid user" |
| F2 | ✅ | Suspended with live session: REST route | 403 DEACTIVATED |
| F3 | ❌ | Suspended with live session: player-profile routes | /me 200, POST /profiles 201 (profile created) |
| F5 | ✅ | Remove access (soft delete) | delete 200; role=player, sessions after=0, old token 401, re-sign-in 200 as player |
| F6 | ✅ | Demoted while signed in | before 200, after 403 |
| F7 | ✅ | Promoted while signed in | role seen=tournament_host |
| G1 | ✅ | Player token vs every role-gated route (83) | all 83 refused |
| G2 | ✅ | Player with spoofed role/user headers and body | 403; T1 name=Host Cup |
| G3 | ✅ | Player tries to take the auction seat over the socket | errors=[{"code":"UNAUTHORIZED","message":"You do not have permission to host this auction"},{"code":"UNAUTHORIZED","message":"You do not have permission to host this auction"},"Unauthorized: Only auctioneer can bid","Unauthorized"]; refusal audit rows=2; any seat claimed=0 |
| G4 | ✅ | Player reads another user | 403 |
| G5 | ✅ | Player self-promotes via set-access | 403; role=player |
| G6 | ❌ | super_user creates a boss (no createdBy) | 201; created=true role=boss |
| G6b | ❌ | super_user creates a super_user (no createdBy) | 201; created=true |
| G7 | ❌ | super_user suspends a boss via /user/update | 200; boss isActive after=false (restored) |
| G8 | ❌ | super_user hard-deletes another super_user | 200 "User permanently deleted"; row exists after=false |
| G9 | ✅ | Player opens a private tournament | player 404, signed-out 404 |
| G11 | ❌ | Host resets another tournament's planner link | 200 Planner link reset successfully (new token issued) |
| G12 | ❌ | Host tops up another tournament's team budget, forging createdBy | 201; top-ups on TM2=1, recorded createdById=u_boss |
| G10 | ❌ | Host edits another tournament's team, claiming own tournamentId | update 200 (name now "Hijacked"), delete 400 (team exists=true) |
| H1/H2 | ✅ | Two devices, logout one | logout 200; A after 401 SESSION_INVALID; B 200 |
| H4 | ❌ | "Sign out everywhere" endpoint exists | no route (service function exists, not exposed) |
| K1 | ✅ | Expired session | 401 SESSION_EXPIRED; row left=0 |
| K2 | ✅ | Session row deleted server-side | 401 SESSION_INVALID |
| K3 | ✅ | Expired token on player-profile /me | 401 |
| K5 | ✅ | Session lifetime | 90.00 days (no sliding renewal) |
| K6 | ✅ | Google ID token expired | 401 "Could not verify that Google sign-in" |
| K7 | ❌ | Same credential replayed 3 times | statuses=200,200,200; sessions=3 |
| L1 | ❌ | ID token iat 10 min in the future (server clock behind) | 401 "Could not verify that Google sign-in" (underlying cause hidden from user and logs) |
| M1 | ❌ | Google account email changes (same sub) | 200; same user, stored email=oldaddr@gmail.com |
| M3 | ❌ | Row linked to an old sub; same email, new sub | 401 "Another Google account is already linked to this CricBid user"; admin unlink route=false |
| N1 | ✅ | Callback: cookie ≠ body g_csrf_token | 302 → http://localhost:8080/login?error=csrf |
| N2 | ❌ | Callback: no cookie, no body token, attacker's valid credential (login CSRF) | 302 → http://localhost:8080/login#token=<redacted> |
| N3 | ✅ | Callback: garbage credential | 302 → http://localhost:8080/login?error=Could%20not%20verify%20that%20Google%20sign-in |
| N4 | ✅ | Credential for another client id | 401 "Could not verify that Google sign-in" |
| N6 | ❌ | Session token in query string | 200 |
| N7 | ❌ | 30 rapid failed password logins | statuses: 401 |
| O1 | ✅ | Token interchangeable between headers | x-player-token on /me 200; x-session-token on /me 200; modal token on /user/detail 200 |
| O3 | ✅ | Account A edits account B's player profile | 400 "Player not found"; name=Child B |

**Routes any signed-in user (including a `player`) can call** (G1b): POST /api/user/logout, POST /api/user/detail, GET /api/player-profile/me, POST /api/player-profile/logout, GET /api/player-profile/profiles, POST /api/player-profile/profiles, PUT /api/player-profile/profiles/T1, DELETE /api/player-profile/profiles/T1, GET /api/auction-log/tournament/T1, GET /api/auction-log/player/T1, GET /api/auction-log/stats/T1, GET /api/auction-log/top-teams/T1, POST /api/booking/booking/mine, POST /api/booking/booking/cancel. These are all own-account, own-profile or read-only auction-log routes. Review the auction-log ones for private tournaments.

### What changed versus the predictions in §3

- **New, high:** G11 and G12, plus G10's `/team/update`. Any `tournament_host` can act on other tournaments' teams (R10). G10's delete went through in the first run. It failed in the second only because the G12 top-up row now referenced the team (a foreign-key block, not a permission check).
- **Also confirmed:** G6b. A super_user can create another super_user through `/user/create`, despite `canCreateSuperUser=false`.
- **Confirmed as predicted:**
  - **Google linking and identity:** C5, C7, D3–D5, F3, M1, M3.
  - **Super_user over admins:** G6–G8.
  - **Sessions:** H4, K7.
  - **Callback and limits:** N2, N6, N7.
- **Better than predicted:**
  - B5 (parallel first sign-in) produced one row with all three calls succeeding.
  - F1 correctly refuses a suspended user. Its Google message reads "already linked" only because C7 had already written the link.
- **Harness note:** `user_session.expiresAt` is `timestamp without time zone`, read by Prisma as UTC. Expiry tests must write UTC (`now() at time zone 'utc'`). Supabase defaults to UTC, so it is not expected to be a production bug. Confirm with a read-only `SHOW timezone` on production.
- **The player boundary held everywhere:** all 83 role-gated routes, spoofed headers and body, the auction socket seat (audited, never claimed), private tournaments, and other users' records.

### Browser results: real Google, desktop popup, 2026-11-26

Setup: the `backend-authtest` (:3011) and `frontend-authtest` (:8080) launch configs, on the same local test database, using the real `GOOGLE_CLIENT_ID` from `backend/.env`. The user signed in through the real Google popup with their own Gmail. The account exists only in the local test database.

| ID | Result | Case | Observed |
|---|---|---|---|
| A4 / I1 | ✅ | Real popup sign-in from `http://localhost:8080` | Google accepted the origin. `POST /api/user/google-login` created a `player` row (`googleSub` set, `password` NULL, `emailVerified` true) and one `user_session`; the browser landed on `/tournaments` with `role=player` stored |
| B6 | ❌ | Player sees no admin links | Mobile/account menu shows **Manage Tournaments** and **Add Player** to a `player` (`Navbar.tsx:38-39`) |
| B6b | ⚠️ | Player opens admin routes | `/tournaments/manage`, `/users`, `/tournament/T1/manage/players` all bounce to `/tournaments`, **silently** (no message) |
| O2 | ❌ | Signed in on `/login`, then opens a registration link | `/register/T1` still says "Have a CricBid profile? Login…", and the modal shows "Sign in to CricBid" again. Only `cricbid_session_token` was stored, while the modal reads `cricbid_player_token`. Same root cause as R2. |
| A2 | ⚠️ | Modal with Google unavailable | The modal's only other option reads "Signing in with a mobile number is coming soon." With Google off, or in a webview (J1–J3), a player has no way to sign in from the modal |
| H-ua | ❌ | Sessions identify the device | `user_session.userAgent` is NULL. `createSession` is never passed the user agent (`userService.js:153,271`), so a "signed in on" list could not tell devices apart |

Still untested (needs an HTTPS host and phones): redirect mode (I5–I11, B3), in-app webviews (J1–J5), Safari/ITP (I2), and production console settings (A5, A7).


---

## 10. Fixes applied, 2026-11-26 (working tree; not committed, not deployed)

After the fixes, the harness passes **67 of 67** cases. New cases added: B5b, C5b–C5d, G13–G16, H-ua, M3b, N2b, N3b. The browser checks are listed after the table.

### What changed

| Problem | Fix | Where |
|---|---|---|
| R4/G6/G6b: super_user could create a boss or super_user | Creator is the session user; a boss is never created over the API; only a boss creates super users | `userController.createUser`, `userService.createUser` |
| X6/G16: super_user could promote to super_user via Grant access | Granting or removing `super_user` is boss-only | `userService.setUserAccess` |
| G7/G8/X2/X3: super_user could suspend or edit a boss, or hard-delete admins | `assertMayAdminister`: a super_user acts only on hosts and players; hard delete is boss-only; no self-suspend or self-remove; the target is never taken from a body `userId` | `userService.updateUser/deleteUser`, controller |
| R10/G10–G14: hosts could act on other tournaments (teams, top-ups, planner links, matches, scoring, auction REST, player undo/history) | `requireTournamentAccess` resolves the tournament of **every** record named (claimed id, player, team, `teamAId/teamBId`, top-up, match, `matches[]`) and requires permission on each. Mounted on the 22 host routes that lacked it. Top-ups and team edits record `req.userId`, never a body `userId` | `utils/tournamentAccess.js`, `routes/{team,planner,match,scoring,auction,auctionLog,player}Routes.js`, `teamController` |
| R7/F3, C7: suspended accounts kept player-profile access; links were written before the refusal | `getUserBySessionToken` checks `isActive`; `loginWithGoogle` checks `isActive` before writing anything | `userService` |
| R6/C5: auto-link of admin accounts on non-authoritative emails | Auto-link only when Google is the authority (Gmail, or a Workspace `hd` claim) or the target is a `player`. Otherwise `LINK_REQUIRES_PASSWORD`: sign in with the password, and the login page links the same credential via `POST /api/user/link-google` (email must match) | `userService.loginWithGoogle/linkGoogleToUser`, `Login.tsx` |
| R8/D3–D5: Gmail alias duplicates | A first sign-in also matches the same Gmail mailbox (dots, `+tag`, `googlemail.com`) | `userService.findUserForGoogleEmail` |
| M1: stale email after a Google address change | Refreshed on sign-in unless another account holds the new address (then logged) | `userService.loginWithGoogle` |
| M3: no recovery from a `googleSub` conflict | `POST /api/user/unlink-google` (boss/super_user), plus an **Unlink Google** button on the Users screen (`googleLinked` flag added to the user object) | `userService.unlinkGoogle`, `UserManagement.tsx` |
| R5/N2: login CSRF on the redirect callback; 90-day token in the URL | The callback no longer signs in. It parks the credential under a 2-minute one-time code (`/login#code=`). The login page exchanges it at `POST /api/user/google-exchange` with the nonce this tab gave Google, and the token must carry that nonce. `#token=` links are no longer accepted | `userController.googleCallback/googleExchange`, `GoogleSignInButton`, `lib/auth.ts`, `Login.tsx` |
| N5: free text from `?error=` rendered on the login page | Callback sends fixed codes; the page maps codes to messages | `userController`, `Login.tsx` |
| K7/B5: one credential minted several sessions | Each Google token (`jti`) is accepted once; duplicates get `REPLAYED`. A race between two different tokens for one new person now resolves to the same row | `userService.markGoogleTokenUsed` |
| L1: token failures invisible to ops | The underlying verification error is logged server-side (`[google sign-in] token verification failed: …`) | `userService.verifyGoogleCredential` |
| N6: token accepted from query string and body | Headers only (`x-session-token` / `x-player-token`) | `authMiddleware`, `playerProfileAuthMiddleware` |
| N7: no rate limiting | In-memory limits: 10 password attempts per email per 15 min; loose per-IP limits on password and Google endpoints (tunable by env) | `utils/rateLimit.js`, `userRoutes`, `playerProfileRoutes` |
| D2: trailing space in login email | Trimmed | `userService.loginUser` |
| H4: no "sign out everywhere" | `GET /api/user/sessions`, `POST /api/user/logout-all`, and a **Sign out of all devices** item in the menu | `userController`, `Navbar.tsx` |
| H-ua: sessions had no device | `userAgent` recorded on every sign-in | `userService.createSession` callers |
| R2/B3/O2: phone sign-in loop; registration modal ignored the shared session | One token: the modal reads the shared session and signs the whole app in. Redirect sign-in returns to the page it started on and reopens the player picker | `PlayerProfileModal.tsx`, `PublicPlayerRegistration.tsx`, `lib/auth.ts`, `Login.tsx` |
| R3/J1–J4: Google blocked in WhatsApp/Instagram webviews | Detects in-app browsers and replaces the button with **Open in Chrome** (Android intent link) or Safari instructions, plus **Copy link**. The modal says the form works without signing in | `GoogleSignInButton.tsx`, `PlayerProfileModal.tsx` |
| B6/B6b: admin links shown to players; silent bounce | Management links only for managing roles; blocked routes show "Not available for your account" | `Navbar.tsx`, `App.tsx` |
| B4: nameless Google accounts ("Welcome back, null", navbar showed **Login**) | Falls back to the email | `Login.tsx`, `Navbar.tsx` |
| New finding: the scoring app sent no session token, so every scorer write would 401 | `scoring/src/lib/api.ts` sends `x-session-token` from the stored login | `scoring/src/lib/api.ts` |

### Harness results after the fixes

| ID | Result | Case | Observed |
|---|---|---|---|
| A1 | ✅ | GOOGLE_CLIENT_ID unset | googleEnabled=false, google-login 401 "Google sign-in is not configured", password 200 |
| B1 | ✅ | New Gmail via /user/google-login | 200; role=player, password=NULL, googleSub=sub-newplayer, emailVerified=true, sessions=1 |
| B2 | ✅ | New Gmail via /player-profile/google | 200; token=true, profiles=[], role=player |
| B4 | ✅ | Google profile with no name | 200; name=null (UI toast would read "Welcome back, null!") |
| B5 | ✅ | Parallel first sign-in, same credential | rows=1, statuses=200,401,401, codes=REPLAYED,REPLAYED |
| B5b | ✅ | Parallel first sign-in, two different credentials (two tabs) | rows=1, statuses=200,200 |
| C1 | ✅ | Link Google to admin-made Gmail host | 200; id=u_host, role=tournament_host, googleSub=sub-host, password login 200 |
| C2 | ✅ | Both methods give the same user, separate sessions | u_host sessions=2 |
| C3 | ✅ | Google-only account tries password | 401 "Login failed" ("This account signs in with Google") |
| C5 | ✅ | Non-Gmail, non-Workspace host email (no hd) | 401 LINK_REQUIRES_PASSWORD; linked=false |
| C5b | ✅ | Same credential linked after the password sign-in | link 200 ; googleSub=sub-corp-personal; later Google sign-in 200 as u_host_corp |
| C5c | ✅ | Workspace account (hd present) on a non-Gmail host email | 200; signed in as u_ws |
| C5d | ✅ | link-google with a different email than the account | 400 EMAIL_MISMATCH; googleSub=null |
| C7 | ✅ | Link attempt on a suspended row | 401 "Your account has been deactivated. Please contact support."; googleSub after=null |
| D1 | ✅ | Email case | 200; matched u_demote |
| D2 | ✅ | Whitespace around email at password login | 200 "Login successful" |
| D3 | ✅ | Gmail dots: row johndoe@, Google john.doe@ | 200; signed in as u_alias_dot role=tournament_host; new row for john.doe@gmail.com: no |
| D4 | ✅ | Gmail plus: row jane+cricbid@, Google jane@ | 200; signed in as u_alias_plus role=tournament_host; new row for jane@gmail.com: no |
| D5 | ✅ | googlemail.com vs gmail.com | 200; signed in as u_gm role=tournament_host; new row for mike@googlemail.com: no |
| E1 | ✅ | email_verified=false | 401 "That Google account has no verified email address"; row=false |
| E2 | ✅ | Payload without email | 401 "That Google account has no verified email address" |
| F1 | ✅ | Suspended: password and Google sign-in | password 401 "Your account has been deactivated. Please contact support.", google 401 "Your account has been deactivated. Please contact support." |
| F2 | ✅ | Suspended with live session: REST route | 403 DEACTIVATED |
| F3 | ✅ | Suspended with live session: player-profile routes | /me 401, POST /profiles 401 |
| F5 | ✅ | Remove access (soft delete) | delete 200; role=player, sessions after=0, old token 401, re-sign-in 200 as player |
| F6 | ✅ | Demoted while signed in | before 200, after 403 |
| F7 | ✅ | Promoted while signed in | role seen=tournament_host |
| G1 | ✅ | Player token vs every role-gated route (84) | all 84 refused |
| G2 | ✅ | Player with spoofed role/user headers and body | 403; T1 name=Host Cup |
| G3 | ✅ | Player tries to take the auction seat over the socket | errors=[{"code":"UNAUTHORIZED","message":"You do not have permission to host this auction"},{"code":"UNAUTHORIZED","message":"You do not have permission to host this auction"},"Unauthorized: Only auctioneer can bid","Unauthorized"]; refusal audit rows=2; any seat claimed=0 |
| G4 | ✅ | Player reads another user | 403 |
| G5 | ✅ | Player self-promotes via set-access | 403; role=player |
| G6 | ✅ | super_user creates a boss (no createdBy) | 400; created=false |
| G6b | ✅ | super_user creates a super_user (no createdBy) | 400; created=false |
| G7 | ✅ | super_user suspends a boss via /user/update | 400; boss isActive after=true (restored) |
| G8 | ✅ | super_user hard-deletes another super_user | 400 "Failed to delete user"; row exists after=true |
| G9 | ✅ | Player opens a private tournament | player 404, signed-out 404 |
| G11 | ✅ | Host resets another tournament's planner link | 403 You do not have permission to manage this tournament |
| G12 | ✅ | Host tops up another tournament's team budget, forging createdBy | 403; top-ups on TM2=0 |
| G13 | ✅ | Host scores a match in another tournament | start-innings 403, ball 403, undo 403, update 403, create 403 |
| G14 | ✅ | Host drives another tournament's auction over REST | next-player 403, player-categories 403, reset-unsold 403, history 403 |
| G15 | ✅ | Positive controls: own tournament still works | own team update 200, own top-up 201 (createdBy=u_host), super creates host 201, boss edits super 200 |
| G16 | ✅ | super_user promotes someone to super_user via set-access | 400 "Only a boss can grant or remove super user access"; role=tournament_host |
| G10 | ✅ | Host edits another tournament's team, claiming own tournamentId | update 403 (name now "Team Two"), delete 403 (team exists=true) |
| H1/H2 | ✅ | Two devices, logout one | logout 200; A after 401 SESSION_INVALID; B 200 |
| H4 | ✅ | Sign out everywhere | sessions listed=2; logout-all 200; A 401, B 401 |
| H-ua | ✅ | Session records the device | userAgent=AuthTest/1.0 (iPhone) |
| K1 | ✅ | Expired session | 401 SESSION_EXPIRED; row left=0 |
| K2 | ✅ | Session row deleted server-side | 401 SESSION_INVALID |
| K3 | ✅ | Expired token on player-profile /me | 401 |
| K5 | ✅ | Session lifetime | 90.00 days (no sliding renewal) |
| K6 | ✅ | Google ID token expired | 401 "Could not verify that Google sign-in" |
| K7 | ✅ | Same credential replayed 3 times | statuses=200,401,401; sessions=1 |
| L1 | ✅ | ID token iat 10 min in the future (server clock behind) | 401 "Could not verify that Google sign-in"; cause in server log=true |
| M1 | ✅ | Google account email changes (same sub) | 200; same user, stored email=newaddr@gmail.com |
| M3 | ✅ | Row linked to an old sub; same email, new sub | first 401 SUB_CONFLICT; unlink 200; retry 200; googleSub=sub-new-account |
| M3b | ✅ | Player cannot unlink anyone | 403 |
| N1 | ✅ | Callback: cookie ≠ body g_csrf_token | 302 → http://localhost:8080/login?error=CSRF |
| N2 | ✅ | Callback: no cookie, attacker's valid credential (login CSRF) | 302 → /login#code=<one-time>; victim exchange 401 CSRF; session issued=false |
| N2b | ✅ | Legitimate redirect sign-in: callback → code → exchange with own nonce | exchange 200 role=player; reuse 401 EXPIRED_CODE |
| N3 | ✅ | Callback: garbage credential | 302 → http://localhost:8080/login?error=INVALID_TOKEN |
| N3b | ✅ | Callback: suspended account | exchange 401 DEACTIVATED |
| N4 | ✅ | Credential for another client id | 401 "Could not verify that Google sign-in" |
| N6 | ✅ | Session token in query string | 401 |
| N7 | ✅ | 30 rapid failed password logins on one email | first 429 at attempt 11; statuses: 401,429 |
| O1 | ✅ | Token interchangeable between headers | x-player-token on /me 200; x-session-token on /me 200; modal token on /user/detail 200 |
| O3 | ✅ | Account A edits account B's player profile | 400 "Player not found"; name=Child B |

### Browser checks after the fixes

Run on the local test stack (`backend-authtest` + `frontend-authtest`).

| Check | Result |
|---|---|
| `/login?error=<arbitrary text>` | Shows only "Google sign-in failed. Please try again."; URL cleaned |
| `/login#token=<anything>` | Nothing stored; not signed in |
| Simulated phone redirect sign-in from `/register/T1`: nonce in `sessionStorage`, fake credential POSTed to the callback | Returned to `/register/T1` signed in as `player`; toast "Welcome back, Phone Player!"; picker reopened at "Add a player" |
| Player menu | Home, Tournaments, Live Auction, Logout, **Sign out of all devices**; no admin links |
| Player opens `/users` | Redirected with "Not available for your account" toast |
| Instagram Android webview user agent | Google button replaced by the open-in-browser panel; the intent URL points back at the same page with a fallback |
| Real Google popup | Re-checked: the button renders and Google's script loads. The real popup sign-in itself was verified before the fixes; it needs the user's click to re-run |

### Still not covered

- **Real-world flows** need an HTTPS staging host and phones:
  - real redirect mode with Google (I5–I11);
  - real WhatsApp, Instagram and Facebook webviews (J1–J5);
  - Safari/ITP (I2);
  - the production Google console (A5, A7).
- **Deploy order:** backend first, frontend in the same deploy. A frontend built before this change still expects `#token=` and won't understand `#code=`. Cached copies of the old bundle will show a sign-in error until reloaded.
- **Not changed:** `trust proxy` is still `true`, so per-IP limits are spoofable through `X-Forwarded-For`. The per-email password limit doesn't depend on IP.
