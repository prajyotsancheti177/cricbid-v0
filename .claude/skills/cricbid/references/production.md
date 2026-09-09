# Working against CricBid production

The **deploy runbook lives in the `cricbid-deploy` skill** — server layout, the
branch-behind check, the build and restart sequence, deploy verification and code
rollback are all there and are not repeated here. Use it for any deploy.

This file covers what surrounds a deploy: reaching the box, asking production
questions safely, changing data, and getting data back.

## Credentials — by path, never copied

Nothing secret belongs in a skill. `.claude/skills/` is tracked in git; the files
below are gitignored and live only on the developer's machine and the server.
Copying their contents anywhere spreads a production key with no way to pull it
back.

| What | Where | Notes |
|---|---|---|
| SSH private key | `.claude/cricBid.pem` | mode `400`, gitignored. Pass with `ssh -i` |
| Deploy config | `.claude/deploy.env` | host, remote dir, branch, PM2 app |
| Server env | `<remote>/backend/.env` | `DATABASE_URL`, Meta/WhatsApp keys, AWS. **Never overwrite** |
| Frontend env | `<remote>/frontend/.env` | server-only, never overwrite |

```
ssh -i .claude/cricBid.pem ubuntu@ec2-13-234-118-199.ap-south-1.compute.amazonaws.com
```

Two path traps that waste time:

- **Run ssh/scp from the repo root.** The key path is relative, so a command that
  `cd`s first fails with "Identity file not accessible".
- **Uploaded scripts must sit inside `backend/`** to resolve `require()` and load
  `.env`. A script in `/tmp` cannot find `dotenv`.

## Read-only probes

The cheapest way to answer a question about production — and the way to check an
assumption before acting on it, which in this codebase is usually worth doing.

```bash
scp -q -i .claude/cricBid.pem probe.cjs \
  ubuntu@ec2-...:/home/ubuntu/cricBid/cricbid-v0-sql/backend/_probe.cjs
ssh -i .claude/cricBid.pem ubuntu@ec2-... \
  "cd /home/ubuntu/cricBid/cricbid-v0-sql/backend && node _probe.cjs 2>&1 | grep -v 'injected env'; rm -f _probe.cjs"
```

The script opens with:

```js
require('dotenv').config({ path: __dirname + '/.env' });
const prisma = require('./db/prisma');
```

Filter `injected env` from the output — dotenvx is noisy. Delete the script in the
same command so nothing is left behind.

## Changing data: ship, dry-run, confirm

**Rejecting a Bash tool call does not stop a process already running on the
server.** It kills the local ssh client; the remote `node` carries on and commits.
This has happened here — a 279-player transaction landed after the call was
rejected, and a read taken seconds later still showed old values because the
transaction had not yet committed. A rejected call is not proof that nothing ran,
and a spot-check during an open transaction is not proof either.

So never put a write in the same command that uploads the script:

1. **`scp` the script.** Nothing runs.
2. **Run it with no flag.** It prints the plan — how many rows, which ones, what
   changes — and exits without writing.
3. **Run it again with `--confirm`.** It snapshots first, then applies in one
   `prisma.$transaction`.

Guard the write with a precondition that aborts unless the data is still exactly
what the plan was based on. Afterwards, prove the result by diffing against a dump
taken beforehand rather than trusting what the script printed.

```js
const CONFIRMED = process.argv.includes('--confirm');
// ... compute the plan, print it ...
if (!CONFIRMED) { console.log('DRY RUN — nothing written. Re-run with --confirm.'); process.exit(0); }
fs.writeFileSync(`/home/ubuntu/cricBid/backups/<what>_${stamp}.json`, JSON.stringify(before, null, 2));
await prisma.$transaction(updates);
```

## Snapshots and data rollback

Snapshots go to **`/home/ubuntu/cricBid/backups/`** and are the only real safety
net — `TournamentBackup` has **zero rows across every tournament**, so the in-app
backup feature has never produced one.

Rolling data back means replaying a snapshot: restore only the fields that
changed, scoped by id, so anything edited since is left alone. Restoring whole
rows blindly would discard later legitimate edits.

Since September 2026 the `player_change` table records player edits field by field,
grouped by the action that caused them, with undo built into the player sheet —
for player data that is usually faster than a snapshot. It does **not** cover
deletions.

## Writing a data migration

A migration that only adds a column is routine. One that **rewrites existing rows**
needs more:

1. Write a read-only pre-flight that prints exactly what it would touch — counts,
   the specific tournaments or players, and whether any are in a state that would
   break a running auction. This has already caught a wrong assumption.
2. Snapshot the affected table first.
3. Apply, then verify by reading the data back and checking the invariant that
   matters — not the row count the migration reported.

Applied in September 2026: `add_player_payment_verified` (backfilled 2,507 players
verified, 19 left pending), `add_tournament_player_sheet_config`,
`add_auction_live_state`, `add_player_change_history`.

## After a deploy, if a user says the fix did not land

`index.html` is served with **no `Cache-Control`**, so a browser can hold a stale
copy and keep loading an older bundle. Have them hard-refresh before assuming the
deploy failed — and check the live bundle for a string the change added, which is
the quickest way to tell a caching problem from a broken build.
