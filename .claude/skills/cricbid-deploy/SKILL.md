---
name: cricbid-deploy
description: Push local CricBid commits to GitHub, then sync them to the production EC2 server and restart PM2 so changes are live on cricbid.online. Use when the user says "deploy", "cricbid deploy", "push and deploy", "ship this", "update the server", or "make it live".
---

# CricBid deploy

Push work to GitHub, pull it on the EC2 box, rebuild, restart PM2, verify.

## Config

Load `.claude/deploy.env` (gitignored). Values were verified on the server on
2026-08-02:

| Var | Value |
|---|---|
| `SSH_KEY` | `.claude/cricBid.pem` (mode 400, gitignored) |
| `SSH_HOST` | `ubuntu@ec2-13-234-118-199.ap-south-1.compute.amazonaws.com` |
| `REMOTE_DIR` | `/home/ubuntu/cricBid/cricbid-v0-sql` |
| `DEPLOY_BRANCH` | `sql-migration` |
| `PM2_APP` | `server-sql` (port 3002) |

Every ssh call: `ssh -i "$SSH_KEY" "$SSH_HOST"`.

## Server layout — read before acting

- **The live site is `cricbid-v0-sql` on branch `sql-migration`.** Not `main`.
- nginx serves the built assets straight from the repo — no separate web root:
  - `cricbid.online` → `$REMOTE_DIR/frontend/dist`
  - `scoring.cricbid.online` → `$REMOTE_DIR/scoring/dist` — **the scoring app is
    deployed**, so it must be rebuilt when `scoring/` changes.
- `/api` and `/socket.io/` proxy to `localhost:3002`.
- **`~/cricBid/cricbid-v0` + pm2 app `server` are the legacy Mongo deployment.**
  Still running, not served by nginx. Never restart, reset, or build it.
- `backend/ecosystem.config.js` now correctly names `server-sql`, but the live
  process was started manually and is not managed from that file. Restart the
  running app with `pm2 restart server-sql` — never `pm2 start ecosystem.config.js`,
  which would spawn a duplicate second process.
- `backend/.env`, `frontend/.env`, and `backend/uploads/` live only on the server.
  Never overwrite or clean them.

## Steps

1. **Local state.** `git status --porcelain`, `git branch --show-current`.
   Uncommitted changes → show them, ask whether to commit (conventional message)
   or abort. Never commit silently. Never deploy from detached HEAD.

2. **Branch check — this is the step that prevents a regression.**
   Compare what you're about to deploy against what's live:

   ```bash
   git fetch origin
   git rev-list --left-right --count origin/sql-migration...HEAD
   ```

   Left = commits live on the server that your branch lacks. **If left > 0, stop
   and tell the user the exact number** — deploying would roll production
   backwards. Do not proceed until they explicitly choose to merge
   `origin/sql-migration` into their work first, or confirm the loss knowingly.

3. **Confirm.** Show branch, `git log origin/sql-migration..HEAD --oneline`, and
   the target host. Wait for an explicit yes — this is public and hard to reverse.

4. **Push** to `sql-migration` (merge the work in first if you're on another
   branch; the server only ever pulls `sql-migration`).

5. **Sync on the server**, one ssh call, `set -euo pipefail`:

   ```bash
   cd /home/ubuntu/cricBid/cricbid-v0-sql
   git fetch origin
   git reset --hard origin/sql-migration
   npm install --workspace backend
   npx prisma migrate deploy --schema backend/prisma/schema.prisma   # only if migrations changed
   npm install --workspace frontend && npm run build --workspace frontend
   # scoring is NOT in the npm workspace — separate install, only if scoring/ changed:
   cd scoring && npm install && npm run build && cd ..
   pm2 restart server-sql --update-env && pm2 save
   ```

   - `git reset --hard` discards server-side drift. There is currently one stray
     untracked file (`frontend/._dist`); untracked files survive a reset, which is
     fine — don't add `git clean`, it would delete `backend/uploads/`.
   - Skip the prisma and scoring steps when nothing in those paths changed, and
     say in the report that you skipped them and why.
   - Node on the box is v20.19.6, npm 10.8.2.

6. **Verify** — never claim success from an exit code alone:
   - `pm2 list` → `server-sql` is `online` with a fresh (seconds-old) uptime.
   - `pm2 logs server-sql --lines 30 --nostream` → no boot errors.
   - `curl -s -o /dev/null -w '%{http_code}' https://cricbid.online/` → 200.
   - If `scoring/` was rebuilt, also curl `https://scoring.cricbid.online/`.

7. **Report** the deployed SHA, what was rebuilt, what was skipped, and the
   verification output. If anything failed, say so plainly with the output.

## Rollback

```bash
cd /home/ubuntu/cricBid/cricbid-v0-sql && git reset --hard <previous-sha> \
  && npm run build --workspace frontend && pm2 restart server-sql
```

Capture the pre-deploy SHA in step 5 so this is always available. Ask before running.

## Never

- Never touch `cricbid-v0` or pm2 app `server` (legacy Mongo deployment).
- Never `pm2 delete`, `prisma migrate reset`, or drop tables.
- Never `git clean` on the server — it would wipe `backend/uploads/`.
- Never force-push `sql-migration`, and never edit files directly on the server.
