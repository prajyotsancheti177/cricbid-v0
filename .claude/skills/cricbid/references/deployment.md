# Deploying CricBid

## Credentials — by path, never copied

Nothing secret is written into this skill, and nothing secret should be. The
files below are gitignored and live only on the developer's machine and the
server; copying their contents into a skill, a commit, a chat message or a
script would spread the key around with no way to pull it back.

| What | Where | Notes |
|---|---|---|
| SSH private key | `.claude/cricBid.pem` | mode `400`, gitignored. Pass with `ssh -i` |
| Deploy config | `.claude/deploy.env` | host, remote dir, branch, PM2 app name. Gitignored |
| Server env | `/home/ubuntu/cricBid/cricbid-v0-sql/backend/.env` | `DATABASE_URL`, Meta/WhatsApp keys, AWS. **Never overwrite** |
| Frontend env | `.../frontend/.env` | server-only, never overwrite |

`ssh -i .claude/cricBid.pem ubuntu@ec2-13-234-118-199.ap-south-1.compute.amazonaws.com`

Two things that will waste time if you don't know them:

- **Run ssh/scp from the repo root.** The key path in `deploy.env` is relative, so
  a command that `cd`s somewhere first fails with "Identity file not accessible".
- **Uploaded scripts must live inside `backend/`** to resolve `require()` and pick
  up `.env`. `/tmp/foo.cjs` cannot find `dotenv`.

## The layout that matters

There are two checkouts on the box and only one is live.

| | **LIVE** | Legacy — do not touch |
|---|---|---|
| Directory | `/home/ubuntu/cricBid/cricbid-v0-sql` | `/home/ubuntu/cricBid/cricbid-v0` |
| PM2 app | `server-sql` | `server` |
| Port | 3002 | 3000 |
| Branch | `sql-migration` | — |
| nginx | serves it | nothing references it |

nginx serves the built assets **straight out of the live repo** — there is no
separate web root, so a rebuild is the deploy:

- `cricbid.online` → `cricbid-v0-sql/frontend/dist`
- `scoring.cricbid.online` → `cricbid-v0-sql/scoring/dist` — **the scoring app is
  deployed too**, is *not* in the npm workspace, and needs its own
  `npm install && npm run build`. Easy to forget.
- `/api` and `/socket.io/` → `localhost:3002`

Never `git clean` on the server — it would delete `backend/uploads/`.

## Deploying

Use the **`cricbid-deploy` skill**; it encodes the full sequence including the
check that you are not rolling production backwards. The essentials:

```bash
git fetch origin
git rev-list --left-right --count origin/sql-migration...HEAD   # left > 0 = STOP
```

Then on the box: `git reset --hard origin/sql-migration`, `npm install` the
workspaces you touched, `npm run build --workspace frontend`, and
`pm2 restart server-sql --update-env && pm2 save`.

**A restart drops nothing now** — live auction state is mirrored to
`auction_live_state` and restored at boot — but it still disconnects viewers, so
prefer not to deploy during an event.

## Migrations

Prisma **fails from the repo root** — `DATABASE_URL` lives in `backend/.env`, and
Prisma only loads `.env` from its working directory:

```bash
cd /home/ubuntu/cricBid/cricbid-v0-sql/backend
npx prisma migrate status --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

Migrations applied in September 2026: `add_player_payment_verified`,
`add_tournament_player_sheet_config`, `add_auction_live_state`,
`add_player_change_history`.

**Data migrations need a pre-flight.** Before shipping one, run a read-only script
that prints exactly what it would touch — counts, the specific rows, and whether
any are in a state that would break a running auction. That check has already
caught a wrong assumption once.

## Read-only probes

The fastest way to answer a question about production. Write the script locally,
scp it into `backend/`, run it, delete it:

```bash
scp -q -i .claude/cricBid.pem probe.cjs \
  ubuntu@ec2-13-234-118-199.ap-south-1.compute.amazonaws.com:/home/ubuntu/cricBid/cricbid-v0-sql/backend/_probe.cjs
ssh -i .claude/cricBid.pem ubuntu@ec2-... \
  "cd /home/ubuntu/cricBid/cricbid-v0-sql/backend && node _probe.cjs 2>&1 | grep -v 'injected env'; rm -f _probe.cjs"
```

The script starts with `require('dotenv').config({ path: __dirname + '/.env' });`
then `require('./db/prisma')`. Filter `injected env` out of the output — dotenvx is
noisy.

## Writes: ship, dry-run, confirm

**Rejecting a Bash tool call does not stop a process already running on the
server.** It kills the local ssh client; the remote `node` carries on and commits.
This has happened — a 279-player transaction landed after the call was rejected,
and a read taken seconds later still showed the old values because the transaction
had not committed yet.

So never put a write in the same command that uploads the script:

1. `scp` the script. Nothing runs.
2. Run it with no flag — it prints the plan and exits without writing.
3. Run it again with `--confirm` — it snapshots to
   `/home/ubuntu/cricBid/backups/` and applies in one `prisma.$transaction`.

Guard the write with a precondition that aborts if the data is not exactly what
the plan was based on. And prove the result afterwards by diffing against a dump
taken beforehand — not by trusting what the script printed.

## Verifying a deploy

Never claim success from an exit code.

- `pm2 list` → `server-sql` online with seconds-old uptime.
- `pm2 logs server-sql --lines 30 --nostream` → "Server listening on port 3002"
  and "DB connected successfully", no boot errors.
- `curl -s -o /dev/null -w '%{http_code}' https://cricbid.online/` → 200.
- **Prove the change is in the served bundle**, since a 200 only means nginx served
  something. Grep the live JS for a string the change added *and* one that should
  still be there, so a truncated build cannot read as success:

```bash
BUNDLE=$(curl -s https://cricbid.online/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://cricbid.online$BUNDLE" | grep -c "some new string"
```

`index.html` is served with **no `Cache-Control`**, so browsers may hold a stale
copy and load an older bundle. If a user says a fix did not land, have them
hard-refresh before assuming the deploy failed.

## Rollback

Snapshots live in `/home/ubuntu/cricBid/backups/` — the pre-change state for every
bulk write done this way. To roll back code:

```bash
cd /home/ubuntu/cricBid/cricbid-v0-sql && git reset --hard <previous-sha> \
  && npm run build --workspace frontend && pm2 restart server-sql
```

Rolling back data means replaying the snapshot: restore only the fields that
changed, scoped by id, so anything edited since is left alone.

## Never

- Touch `cricbid-v0` or PM2 app `server` (legacy Mongo deployment).
- `pm2 delete`, `prisma migrate reset`, or drop tables.
- `git clean` on the server, or overwrite `backend/.env`, `frontend/.env`, `backend/uploads/`.
- Force-push `sql-migration`.
