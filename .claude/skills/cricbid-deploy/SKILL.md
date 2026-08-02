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

## Autonomy

**Run start to finish without asking for approval.** No "shall I proceed?", no
confirmation before pushing, no PR. Invoking this skill IS the authorization —
commit, merge, push, deploy, verify, then report what changed.

This applies to the happy path only. Two situations still stop and hand the
decision back, because both destroy work rather than ship it (steps 2 and 3):

- the branch is **behind** production — deploying would roll the live site back
- the merge **conflicts**

These are not approval gates; they are "the automation cannot know what you
intended here" gates. Everything else proceeds unattended.

## Steps

1. **Local state.** `git status --porcelain`, `git branch --show-current`.
   Uncommitted changes → commit them with a conventional-commit message that
   describes what actually changed; include them in the deploy and say so in the
   report. Never deploy from detached HEAD.

2. **Branch check — this is the step that prevents a regression.**
   Compare what you're about to deploy against what's live:

   ```bash
   git fetch origin
   git rev-list --left-right --count origin/sql-migration...HEAD
   ```

   Left = commits live on the server that your branch lacks. **If left > 0, STOP
   and report to the user** — deploying would roll production backwards. Tell them:
   the count, a `git log HEAD..origin/sql-migration --oneline` summary of what
   would be lost, and whether any Prisma migrations are among them (those are
   already applied to the live DB, so rewinding the code strands the schema).
   **The user decides what happens next. Do not merge, reset, or deploy on your
   own initiative.**

3. **Conflicts are always the user's call — never resolve them silently.**
   Before any merge, dry-run it:

   ```bash
   git merge-tree --write-tree origin/sql-migration HEAD
   ```

   (Use this form. The legacy 3-argument `git merge-tree` reports no conflicts
   even when conflicts exist — it has given a false clean result on this repo.)

   If it reports conflicts, **stop and hand the decision to the user**: list the
   conflicted files, and for each one explain what their side changed versus what
   production changed. Never pick a side yourself.

   **Never run `git reset --hard`, `git checkout --ours/--theirs`, `git push
   --force`, or any other history-discarding command as a way to get past a
   conflict.** Note the deploy's own `git reset --hard` on the *server* (step 6)
   is different and fine — it only ever fast-forwards the server to an already
   pushed commit. What is forbidden is discarding *local work* to dodge a merge.

   Watch for a stale refactor: a commit that deletes a large block from a file
   production has since evolved. Replaying it can silently drop live features even
   when git reports no textual conflict. Flag it rather than assuming.

4. **Capture the rollback point** before changing anything on the server:

   ```bash
   ssh -i "$SSH_KEY" "$SSH_HOST" "cd $REMOTE_DIR && git rev-parse HEAD"
   ```

   Keep this SHA for the report and for the Rollback section below.

5. **Merge and push** — no confirmation step. If on a feature branch, check out
   `sql-migration`, `git pull --ff-only`, merge the feature branch in, and push.
   The server only ever pulls `sql-migration`.

   If a live auction is in progress the restart in step 6 will drop its in-memory
   state (see `auctionStateManager`). Don't block on this, but check
   `pm2 logs server-sql --lines 20 --nostream` for active socket traffic and
   **say so in the report** if the deploy likely interrupted a running auction.

6. **Sync on the server**, one ssh call, `set -euo pipefail`:

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

7. **Verify** — never claim success from an exit code alone:
   - `pm2 list` → `server-sql` is `online` with a fresh (seconds-old) uptime.
   - `pm2 logs server-sql --lines 30 --nostream` → no boot errors; expect
     "Server listening on port 3002" and "DB connected successfully."
   - `curl -s -o /dev/null -w '%{http_code}' https://cricbid.online/` → 200.
   - If `scoring/` was rebuilt, also curl `https://scoring.cricbid.online/`.
   - **Prove the change is actually in the served bundle** — a 200 only means
     nginx is serving *something*. Pick a string the change added or removed,
     then grep the live JS for it:

     ```bash
     BUNDLE=$(curl -s https://cricbid.online/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
     curl -s "https://cricbid.online$BUNDLE" | grep -c "<string you expect gone/present>"
     ```

     Also grep a string that should still be there, so a failed build that served
     a truncated bundle can't read as success.

8. **Report** — this is the deliverable, since nothing else was surfaced along
   the way. Include: the deployed SHA and the rollback SHA from step 4, a plain
   summary of what changed and what users will notice, what was rebuilt, what was
   skipped and why, and the verification results. If anything failed, say so
   plainly with the output rather than reporting partial success.

## Rollback

```bash
cd /home/ubuntu/cricBid/cricbid-v0-sql && git reset --hard <previous-sha> \
  && npm run build --workspace frontend && pm2 restart server-sql
```

The pre-deploy SHA comes from step 4, so this is always available. Rolling back
is itself a deploy — run it unattended and report, same as everything else.

## Never

- Never touch `cricbid-v0` or pm2 app `server` (legacy Mongo deployment).
- Never `pm2 delete`, `prisma migrate reset`, or drop tables.
- Never `git clean` on the server — it would wipe `backend/uploads/`.
- Never force-push `sql-migration`, and never edit files directly on the server.
