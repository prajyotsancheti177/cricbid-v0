// PM2 config for the LIVE cricbid.online deployment.
//
// Production reality (verified on the EC2 box 2026-08-02):
//   dir    /home/ubuntu/cricBid/cricbid-v0-sql   <- the live site
//   app    server-sql
//   port   3002 (from backend/.env on the server; nginx proxies /api + /socket.io here)
//   branch sql-migration
//
// The running process was started manually, not from this file — so the name here
// must match `server-sql`, otherwise `pm2 start ecosystem.config.js` would spawn a
// SECOND duplicate process instead of adopting the existing one.
//
// Do not confuse with /home/ubuntu/cricBid/cricbid-v0 (pm2 app `server`, port 3000):
// that is the legacy Mongo deployment, still running but NOT served by nginx.
//
// Deploys go through the `cricbid-deploy` skill — see .claude/skills/cricbid-deploy/.
module.exports = {
    apps: [
        {
            name: "server-sql",          // must match the live pm2 process name
            script: "./server/index.js", // relative to backend/
            instances: 1,
            autorestart: true,
            watch: false,                // never enable: uploads/ churn would thrash restarts
        }
    ]
};
