/**
 * Google sign-in / session / role test harness.
 *
 * Runs the API-level cases from docs/GOOGLE_AUTH_TEST_PLAN_AND_ROLE_VISIBILITY.md
 * against an isolated server on a LOCAL database. It wipes and reseeds that
 * database, so it must never point anywhere else — preload.js enforces it.
 *
 *   cd backend
 *   createdb -h localhost cricbid_auth_test
 *   DATABASE_URL=postgresql://<you>@localhost:5432/cricbid_auth_test npx prisma migrate deploy
 *   DATABASE_URL=postgresql://<you>@localhost:5432/cricbid_auth_test \
 *     node --require ./scripts/auth-test/preload.js ./scripts/auth-test/run.js
 *
 * GOOGLE_CLIENT_ID is taken from backend/.env (only used as the token audience;
 * fake tokens never reach Google). Everything that could reach a real service —
 * WhatsApp, S3, Sheets, CricHeroes, Mongo — is blanked for the spawned server.
 *
 * Output: a table on stdout and JSON at $AUTH_TEST_OUT (default ./auth-test-results.json).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const BACKEND = path.resolve(__dirname, '../..');
const PORT = Number(process.env.AUTH_TEST_PORT || 3011);
const PORT_NO_GOOGLE = PORT + 1;
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.AUTH_TEST_OUT || path.resolve(process.cwd(), 'auth-test-results.json');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ── server ──────────────────────────────────────────────────────────────── */

const serverEnv = (port, extra = {}) => ({
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    AUTH_TEST_STUB_MONGO: '1',
    AUTH_TEST_FAKE_GOOGLE: '1',
    MONGO_DB_URI: 'mongodb://127.0.0.1:1/none',
    META_API_KEY: '',
    AWS_REGION: '', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '', AWS_BUCKET_NAME: '',
    GOOGLE_SERVICE_EMAIL: '', GOOGLE_PRIVATE_KEY: '',
    CRICHEROES_SYNC_ENABLED: 'false', CRICHEROES_SYNC_TOURNAMENT_IDS: '',
    AGENT_RUNNER_TOKEN: '',
    APP_URL: 'http://localhost:8080',
    GOOGLE_REDIRECT_MODE: 'false',
    ...extra,
});

const logs = [];
const startServer = (port, extra) => new Promise((resolve, reject) => {
    const child = spawn('node', ['--require', './scripts/auth-test/preload.js', './server/index.js'], {
        cwd: BACKEND, env: serverEnv(port, extra), stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error(`server :${port} did not start`)), 30000);
    const onData = (d) => {
        const s = d.toString();
        logs.push(`[:${port}] ${s}`);
        if (s.includes('Server listening')) { clearTimeout(timer); setTimeout(() => resolve(child), 1500); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => { clearTimeout(timer); if (code) reject(new Error(`server :${port} exited ${code}`)); });
});

/* ── http ────────────────────────────────────────────────────────────────── */

const api = async (method, p, { token, playerToken, body, headers = {}, form, base = BASE } = {}) => {
    const h = { ...headers };
    if (token) h['x-session-token'] = token;
    if (playerToken) h['x-player-token'] = playerToken;
    let b;
    if (form) { h['content-type'] = 'application/x-www-form-urlencoded'; b = new URLSearchParams(form).toString(); }
    else if (body !== undefined) { h['content-type'] = 'application/json'; b = JSON.stringify(body); }
    const res = await fetch(base + p, { method, headers: h, body: method === 'GET' ? undefined : b, redirect: 'manual' });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, location: res.headers.get('location') };
};

let AUD = null;
let subSeq = 0;
const fakeToken = (over = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: 'https://accounts.google.com', aud: AUD, sub: `sub-${Date.now()}-${++subSeq}`,
        // Every real Google ID token has a unique jti; without one, two sign-ins
        // in the same second are byte-identical and the replay guard refuses the second.
        jti: require('crypto').randomUUID(),
        email_verified: true, iat: now, exp: now + 3600, ...over,
    };
    for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
    return 'fake.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
};
const googleLogin = (over, endpoint = '/api/user/google-login') => api('POST', endpoint, { body: { credential: fakeToken(over) } });
const pwLogin = (email, password = PASSWORD) => api('POST', '/api/user/login', { body: { email, password } });
const userBy = async (email) => (await q('SELECT * FROM "user" WHERE email = $1', [email]))[0];
const sessionsOf = async (id) => (await q('SELECT count(*)::int AS n FROM user_session WHERE "userId" = $1', [id]))[0].n;

/* ── results ─────────────────────────────────────────────────────────────── */

const results = [];
/**
 * @param id     plan case id
 * @param pass   observed behaviour matches the DESIRED behaviour in the plan
 * @param observed short factual description
 */
const record = (id, title, pass, observed, expected) => {
    results.push({ id, title, pass, observed, expected });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(5)} ${title} — ${observed}`);
};
const step = async (id, title, expected, fn) => {
    try {
        const { pass, observed } = await fn();
        record(id, title, pass, observed, expected);
    } catch (e) {
        record(id, title, false, `harness error: ${e.message}`, expected);
    }
};

/* ── seed ────────────────────────────────────────────────────────────────── */

const PASSWORD = 'Passw0rd!';
const seed = async () => {
    await q('TRUNCATE "user", tournament, role_visibility RESTART IDENTITY CASCADE');
    const hash = bcrypt.hashSync(PASSWORD, 10);
    const users = [
        ['u_boss', 'Boss', 'boss@test.local', 'boss', true, null],
        ['u_super', 'Super', 'super@test.local', 'super_user', true, null],
        ['u_super2', 'Super Two', 'super2@test.local', 'super_user', true, null],
        ['u_host', 'Host Gmail', 'hostgmail@gmail.com', 'tournament_host', true, null],
        ['u_host_corp', 'Host Corp', 'host@corp-example.in', 'tournament_host', true, null],
        ['u_host2', 'Host Two', 'host2@test.local', 'tournament_host', true, null],
        ['u_alias_dot', 'John Doe', 'johndoe@gmail.com', 'tournament_host', true, null],
        ['u_alias_plus', 'Jane', 'jane+cricbid@gmail.com', 'tournament_host', true, null],
        ['u_gm', 'Mike', 'mike@gmail.com', 'tournament_host', true, null],
        ['u_susp', 'Suspended', 'suspended@gmail.com', 'tournament_host', false, null],
        ['u_conflict', 'Conflict', 'conflict@gmail.com', 'tournament_host', true, 'sub-old-account'],
        ['u_removable', 'Removable', 'removable@gmail.com', 'tournament_host', true, null],
        ['u_demote', 'Demote', 'demote@gmail.com', 'tournament_host', true, null],
    ];
    for (const [id, name, email, role, active, sub] of users) {
        await q(`INSERT INTO "user" (id, name, email, password, role, "isActive", "googleSub", "updatedAt")
                 VALUES ($1,$2,$3,$4,$5,$6,$7,now())`, [id, name, email, hash, role, active, sub]);
    }
    const tournaments = [
        ['T1', 'Host Cup', 'u_host', false],
        ['T2', 'Host2 Cup', 'u_host2', false],
        ['T3', 'Demote Cup', 'u_demote', false],
        ['TP', 'Private Cup', 'u_host2', true],
    ];
    for (const [id, name, hostId, priv] of tournaments) {
        await q(`INSERT INTO tournament (id, name, "tournamentHostId", "isPrivate", "updatedAt") VALUES ($1,$2,$3,$4,now())`, [id, name, hostId, priv]);
    }
    await q(`INSERT INTO team (id, name, "touranmentId", "updatedAt") VALUES ('TM1','Team One','T1',now()), ('TM2','Team Two','T2',now()), ('TM2B','Team Two B','T2',now())`);
    await q(`INSERT INTO team (id, name, "touranmentId", "updatedAt") VALUES ('TM1B','Team One B','T1',now())`);
    await q(`INSERT INTO match (id, "tournamentId", "teamAId", "teamBId", "updatedAt") VALUES ('M2','T2','TM2','TM2B',now()), ('M1','T1','TM1','TM1B',now())`);
};

/* ── route inventory (for G1) ────────────────────────────────────────────── */

const routeInventory = () => {
    const idx = fs.readFileSync(path.join(BACKEND, 'routes/index.js'), 'utf8');
    const varToFile = {}; const varToMount = {};
    for (const m of idx.matchAll(/const\s+(\w+)\s*=\s*require\(['"]\.\/(\w+)['"]\)/g)) varToFile[m[1]] = m[2];
    for (const m of idx.matchAll(/router\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g)) varToMount[m[2]] = m[1];
    const out = [];
    for (const [v, file] of Object.entries(varToFile)) {
        const mount = varToMount[v];
        if (!mount) continue;
        const src = fs.readFileSync(path.join(BACKEND, 'routes', `${file}.js`), 'utf8');
        for (const line of src.split('\n')) {
            const m = line.match(/^\s*\w+\.(get|post|put|patch|delete)\(\s*["'](\/[^"']*)["']/);
            if (!m) continue;
            const gated = /roleMiddleware|adminOnly|requireTournamentAccess/.test(line);
            const authed = /authMiddleware|playerProfileAuthMiddleware/.test(line);
            out.push({ method: m[1].toUpperCase(), path: `/api${mount}${m[2]}`.replace(/:(\w+)/g, 'T1'), gated, authed, file });
        }
    }
    return out;
};

/* ── tests ───────────────────────────────────────────────────────────────── */

const main = async () => {
    await seed();
    const server = await startServer(PORT);
    let serverNoGoogle = null;
    try {
        const cfg = await api('GET', '/api/player-profile/auth-config');
        AUD = cfg.json?.data?.googleClientId;
        if (!AUD) throw new Error('GOOGLE_CLIENT_ID not configured in backend/.env; cannot build tokens');

        /* A — configuration */
        serverNoGoogle = await startServer(PORT_NO_GOOGLE, { GOOGLE_CLIENT_ID: '' });
        await step('A1', 'GOOGLE_CLIENT_ID unset', 'auth-config googleEnabled:false; google-login 401 "not configured"; password login works', async () => {
            const base = `http://localhost:${PORT_NO_GOOGLE}`;
            const c = await api('GET', '/api/player-profile/auth-config', { base });
            const g = await api('POST', '/api/user/google-login', { base, body: { credential: 'x' } });
            const p = await api('POST', '/api/user/login', { base, body: { email: 'boss@test.local', password: PASSWORD } });
            const pass = c.json?.data?.googleEnabled === false && g.status === 401 && /not configured/i.test(g.json?.message || '') && p.status === 200;
            return { pass, observed: `googleEnabled=${c.json?.data?.googleEnabled}, google-login ${g.status} "${g.json?.message}", password ${p.status}` };
        });

        /* B — first sign-in */
        let playerToken, playerId;
        await step('B1', 'New Gmail via /user/google-login', 'row role=player, password NULL, googleSub set, emailVerified, 1 session', async () => {
            const r = await googleLogin({ email: 'newplayer@gmail.com', name: 'New Player', sub: 'sub-newplayer' });
            const u = await userBy('newplayer@gmail.com');
            playerToken = r.json?.data?.sessionToken; playerId = u?.id;
            const n = u ? await sessionsOf(u.id) : 0;
            const pass = r.status === 200 && u?.role === 'player' && u.password === null && u.googleSub === 'sub-newplayer' && u.emailVerified === true && n === 1 && !!playerToken;
            return { pass, observed: `${r.status}; role=${u?.role}, password=${u?.password === null ? 'NULL' : 'set'}, googleSub=${u?.googleSub}, emailVerified=${u?.emailVerified}, sessions=${n}` };
        });

        let modalToken;
        await step('B2', 'New Gmail via /player-profile/google', '{token, account{profiles:[]}}, role=player', async () => {
            const r = await googleLogin({ email: 'modalplayer@gmail.com', name: 'Modal Player' }, '/api/player-profile/google');
            const u = await userBy('modalplayer@gmail.com');
            modalToken = r.json?.data?.token;
            const pass = r.status === 200 && !!modalToken && Array.isArray(r.json?.data?.account?.profiles) && u?.role === 'player';
            return { pass, observed: `${r.status}; token=${!!modalToken}, profiles=${JSON.stringify(r.json?.data?.account?.profiles)}, role=${u?.role}` };
        });

        await step('B4', 'Google profile with no name', 'row created with name NULL, no error', async () => {
            const r = await googleLogin({ email: 'noname@gmail.com', name: undefined });
            const u = await userBy('noname@gmail.com');
            return { pass: r.status === 200 && u && u.name === null, observed: `${r.status}; name=${u?.name} (UI toast would read "Welcome back, ${r.json?.data?.name}!")` };
        });

        await step('B5', 'Parallel first sign-in, same credential', 'one row; one session; the duplicates get a clear REPLAYED answer', async () => {
            const cred = fakeToken({ email: 'race@gmail.com', sub: 'sub-race', name: 'Race' });
            const rs = await Promise.all([1, 2, 3].map(() => api('POST', '/api/user/google-login', { body: { credential: cred } })));
            const n = (await q('SELECT count(*)::int AS n FROM "user" WHERE email=$1', ['race@gmail.com']))[0].n;
            const statuses = rs.map(r => r.status);
            const codes = rs.filter(r => r.status !== 200).map(r => r.json?.code);
            const pass = n === 1 && statuses.filter(s => s === 200).length === 1 && codes.every(c => c === 'REPLAYED');
            return { pass, observed: `rows=${n}, statuses=${statuses.join(',')}${codes.length ? `, codes=${codes.join(',')}` : ''}` };
        });
        await step('B5b', 'Parallel first sign-in, two different credentials (two tabs)', 'one row, both succeed', async () => {
            const rs = await Promise.all([1, 2].map(() => googleLogin({ email: 'twotabs@gmail.com', sub: 'sub-twotabs' })));
            const n = (await q('SELECT count(*)::int AS n FROM "user" WHERE email=$1', ['twotabs@gmail.com']))[0].n;
            return { pass: n === 1 && rs.every(r => r.status === 200), observed: `rows=${n}, statuses=${rs.map(r => r.status).join(',')}` };
        });

        /* C — linking */
        await step('C1', 'Link Google to admin-made Gmail host', 'googleSub set, role stays tournament_host, password still works', async () => {
            const r = await googleLogin({ email: 'hostgmail@gmail.com', sub: 'sub-host', name: 'Host G' });
            const u = await userBy('hostgmail@gmail.com');
            const p = await pwLogin('hostgmail@gmail.com');
            const pass = r.status === 200 && u.googleSub === 'sub-host' && u.role === 'tournament_host' && p.status === 200 && r.json?.data?._id === 'u_host';
            return { pass, observed: `${r.status}; id=${r.json?.data?._id}, role=${u.role}, googleSub=${u.googleSub}, password login ${p.status}` };
        });

        await step('C2', 'Both methods give the same user, separate sessions', 'same id, 2+ sessions', async () => {
            const n = await sessionsOf('u_host');
            return { pass: n >= 2, observed: `u_host sessions=${n}` };
        });

        await step('C3', 'Google-only account tries password', '401 "This account signs in with Google"', async () => {
            const r = await pwLogin('newplayer@gmail.com', 'anything');
            return { pass: r.status === 401 && /signs in with Google/i.test(`${r.json?.message} ${r.json?.error}`), observed: `${r.status} "${r.json?.message}" ${r.json?.error ? `(${JSON.stringify(r.json.error)})` : ''}` };
        });

        const corpCred = fakeToken({ email: 'host@corp-example.in', sub: 'sub-corp-personal' });
        await step('C5', 'Non-Gmail, non-Workspace host email (no hd)', 'not auto-linked: 401 LINK_REQUIRES_PASSWORD', async () => {
            const r = await api('POST', '/api/user/google-login', { body: { credential: corpCred } });
            const u = await userBy('host@corp-example.in');
            const linked = u.googleSub === 'sub-corp-personal';
            return { pass: !linked && r.status === 401 && r.json?.code === 'LINK_REQUIRES_PASSWORD', observed: `${r.status} ${r.json?.code}; linked=${linked}` };
        });
        await step('C5b', 'Same credential linked after the password sign-in', 'link-google 200; googleSub set; Google sign-in then works', async () => {
            const tok = (await pwLogin('host@corp-example.in')).json?.data?.sessionToken;
            const l = await api('POST', '/api/user/link-google', { token: tok, body: { credential: corpCred } });
            const u = await userBy('host@corp-example.in');
            const g = await googleLogin({ email: 'host@corp-example.in', sub: 'sub-corp-personal' });
            return { pass: l.status === 200 && u.googleSub === 'sub-corp-personal' && g.status === 200 && g.json?.data?._id === 'u_host_corp', observed: `link ${l.status} ${l.json?.code || ''}; googleSub=${u.googleSub}; later Google sign-in ${g.status} as ${g.json?.data?._id}` };
        });
        await step('C5c', 'Workspace account (hd present) on a non-Gmail host email', 'auto-linked', async () => {
            await q(`INSERT INTO "user" (id, name, email, role, "updatedAt") VALUES ('u_ws','WS','host@workspace-example.in','tournament_host',now())`);
            const r = await googleLogin({ email: 'host@workspace-example.in', sub: 'sub-ws', hd: 'workspace-example.in' });
            return { pass: r.status === 200 && r.json?.data?._id === 'u_ws', observed: `${r.status}; signed in as ${r.json?.data?._id}` };
        });
        await step('C5d', 'link-google with a different email than the account', 'refused EMAIL_MISMATCH', async () => {
            const tok = (await pwLogin('host2@test.local')).json?.data?.sessionToken;
            const l = await api('POST', '/api/user/link-google', { token: tok, body: { credential: fakeToken({ email: 'someoneelse@gmail.com' }) } });
            const u = await userBy('host2@test.local');
            return { pass: l.status === 400 && l.json?.code === 'EMAIL_MISMATCH' && !u.googleSub, observed: `${l.status} ${l.json?.code}; googleSub=${u.googleSub}` };
        });

        await step('C7', 'Link attempt on a suspended row', 'refused AND no googleSub written', async () => {
            const r = await googleLogin({ email: 'suspended@gmail.com', sub: 'sub-susp' });
            const u = await userBy('suspended@gmail.com');
            return { pass: r.status === 401 && !u.googleSub, observed: `${r.status} "${r.json?.message}"; googleSub after=${u.googleSub}` };
        });

        /* D — email normalisation */
        await step('D1', 'Email case', 'mixed-case Google email matches the lowercase row', async () => {
            const r = await googleLogin({ email: 'Demote@Gmail.com', sub: 'sub-demote' });
            return { pass: r.status === 200 && r.json?.data?._id === 'u_demote', observed: `${r.status}; matched ${r.json?.data?._id}` };
        });

        await step('D2', 'Whitespace around email at password login', 'login succeeds (trimmed)', async () => {
            const r = await pwLogin('  boss@test.local ');
            return { pass: r.status === 200, observed: `${r.status} "${r.json?.message}"` };
        });

        const aliasCase = (id, title, rowEmail, googleEmail, rowId) => step(id, title, `matches ${rowId}, or at least flags a duplicate; no silent second account`, async () => {
            const r = await googleLogin({ email: googleEmail, sub: `sub-${id}` });
            const dup = await userBy(googleEmail);
            const matched = r.json?.data?._id === rowId;
            return { pass: matched, observed: `${r.status}; signed in as ${r.json?.data?._id} role=${r.json?.data?.role}; new row for ${googleEmail}: ${dup ? `yes (${dup.role})` : 'no'}` };
        });
        await aliasCase('D3', 'Gmail dots: row johndoe@, Google john.doe@', 'johndoe@gmail.com', 'john.doe@gmail.com', 'u_alias_dot');
        await aliasCase('D4', 'Gmail plus: row jane+cricbid@, Google jane@', 'jane+cricbid@gmail.com', 'jane@gmail.com', 'u_alias_plus');
        await aliasCase('D5', 'googlemail.com vs gmail.com', 'mike@gmail.com', 'mike@googlemail.com', 'u_gm');

        /* E — unverified */
        await step('E1', 'email_verified=false', '401 no verified email; no row', async () => {
            const r = await googleLogin({ email: 'unverified@gmail.com', email_verified: false });
            const u = await userBy('unverified@gmail.com');
            return { pass: r.status === 401 && !u, observed: `${r.status} "${r.json?.message}"; row=${!!u}` };
        });
        await step('E2', 'Payload without email', '401; no row', async () => {
            const r = await googleLogin({ email: undefined });
            return { pass: r.status === 401, observed: `${r.status} "${r.json?.message}"` };
        });

        /* F — deactivation */
        await step('F1', 'Suspended: password and Google sign-in', 'both refused "deactivated"', async () => {
            const p = await pwLogin('suspended@gmail.com');
            const g = await googleLogin({ email: 'suspended@gmail.com', sub: 'sub-susp-2' });
            return { pass: p.status === 401 && g.status === 401 && /deactivated/i.test(`${p.json?.message}${JSON.stringify(p.json?.error)}`) && /deactivated|already linked/i.test(g.json?.message || ''), observed: `password ${p.status} ${JSON.stringify(p.json?.error || p.json?.message)}, google ${g.status} "${g.json?.message}"` };
        });

        // Make a live session, then suspend.
        const fUser = await googleLogin({ email: 'tobesuspended@gmail.com', sub: 'sub-tbs' });
        const fToken = fUser.json?.data?.sessionToken;
        await q('UPDATE "user" SET "isActive"=false WHERE email=$1', ['tobesuspended@gmail.com']);
        await step('F2', 'Suspended with live session: REST route', '403 DEACTIVATED', async () => {
            const r = await api('POST', '/api/user/detail', { token: fToken, body: {} });
            return { pass: r.status === 403 && r.json?.code === 'DEACTIVATED', observed: `${r.status} ${r.json?.code}` };
        });
        await step('F3', 'Suspended with live session: player-profile routes', '401/403 on /me and POST /profiles', async () => {
            const me = await api('GET', '/api/player-profile/me', { playerToken: fToken });
            const add = await api('POST', '/api/player-profile/profiles', { playerToken: fToken, body: { name: 'Kid' } });
            return { pass: me.status >= 400 && add.status >= 400, observed: `/me ${me.status}, POST /profiles ${add.status}${add.status < 300 ? ' (profile created)' : ''}` };
        });

        await step('F5', 'Remove access (soft delete)', 'role→player, grants+sessions gone, can sign in again as player', async () => {
            const bossTok = (await pwLogin('boss@test.local')).json?.data?.sessionToken;
            const remTok = (await pwLogin('removable@gmail.com')).json?.data?.sessionToken;
            const d = await api('POST', '/api/user/delete', { token: bossTok, body: { targetUserId: 'u_removable' } });
            const u = await userBy('removable@gmail.com');
            const n = await sessionsOf('u_removable');
            const old = await api('POST', '/api/user/detail', { token: remTok, body: {} });
            const again = await googleLogin({ email: 'removable@gmail.com', sub: 'sub-rem' });
            const pass = d.status === 200 && u.role === 'player' && n === 0 && old.status === 401 && again.status === 200 && again.json?.data?.role === 'player';
            return { pass, observed: `delete ${d.status}; role=${u.role}, sessions after=${n}, old token ${old.status}, re-sign-in ${again.status} as ${again.json?.data?.role}` };
        });

        await step('F6', 'Demoted while signed in', 'tournament update 200 before, 403 after', async () => {
            const bossTok = (await pwLogin('boss@test.local')).json?.data?.sessionToken;
            const hostTok = (await pwLogin('demote@gmail.com')).json?.data?.sessionToken;
            const before = await api('POST', '/api/tournament/update', { token: hostTok, body: { tournamentId: 'T3', name: 'Demote Cup 2' } });
            await api('POST', '/api/user/set-access', { token: bossTok, body: { targetUserId: 'u_demote', role: 'player' } });
            const after = await api('POST', '/api/tournament/update', { token: hostTok, body: { tournamentId: 'T3', name: 'Demote Cup 3' } });
            return { pass: before.status === 200 && after.status === 403, observed: `before ${before.status}, after ${after.status}` };
        });

        await step('F7', 'Promoted while signed in', '/user/detail returns the new role on the same token', async () => {
            const bossTok = (await pwLogin('boss@test.local')).json?.data?.sessionToken;
            await api('POST', '/api/user/set-access', { token: bossTok, body: { targetUserId: playerId, role: 'tournament_host' } });
            const d = await api('POST', '/api/user/detail', { token: playerToken, body: {} });
            await api('POST', '/api/user/set-access', { token: bossTok, body: { targetUserId: playerId, role: 'player' } });
            return { pass: d.json?.data?.role === 'tournament_host', observed: `role seen=${d.json?.data?.role}` };
        });

        /* G — role escalation */
        const inv = routeInventory();
        const gated = inv.filter(r => r.gated);
        await step('G1', `Player token vs every role-gated route (${gated.length})`, 'every one 401/403', async () => {
            const leaks = [];
            for (const r of gated) {
                const res = await api(r.method, r.path, { token: playerToken, body: { tournamentId: 'T1', teamId: 'TM1', playerId: 'x', targetUserId: 'u_boss' } });
                if (res.status !== 403 && res.status !== 401) leaks.push(`${r.method} ${r.path} → ${res.status}`);
            }
            return { pass: leaks.length === 0, observed: leaks.length ? `not refused: ${leaks.join('; ')}` : `all ${gated.length} refused` };
        });
        const authOnly = inv.filter(r => r.authed && !r.gated);
        results.push({ id: 'G1b', title: 'Routes behind auth only (any signed-in user, incl. player) — review list', pass: null, observed: authOnly.map(r => `${r.method} ${r.path}`).join(', '), expected: 'each should be safe for a player' });

        await step('G2', 'Player with spoofed role/user headers and body', '403', async () => {
            const r = await api('POST', '/api/tournament/update', {
                token: playerToken,
                headers: { 'x-user-id': 'u_boss', 'x-user-role': 'boss' },
                body: { tournamentId: 'T1', name: 'pwned', userId: 'u_boss', userRole: 'boss' },
            });
            const t = (await q('SELECT name FROM tournament WHERE id=$1', ['T1']))[0];
            return { pass: r.status === 403 && t.name === 'Host Cup', observed: `${r.status}; T1 name=${t.name}` };
        });

        await step('G3', 'Player tries to take the auction seat over the socket', 'auction:error UNAUTHORIZED; seat not taken; audit row written', async () => {
            const { io } = require(path.resolve(BACKEND, '../node_modules/socket.io-client'));
            const s = io(`${BASE}/auction`, { transports: ['websocket'], auth: { token: playerToken }, forceNew: true });
            await new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); setTimeout(() => rej(new Error('socket connect timeout')), 5000); });
            const errs = [];
            s.on('auction:error', (e) => errs.push(e));
            s.emit('auction:start', { tournamentId: 'T1', sessionToken: playerToken });
            s.emit('auction:start', { tournamentId: 'T1', userId: 'u_host' }); // forged id, no token in payload (handshake token still player)
            await sleep(1200);
            s.emit('auction:bid', { tournamentId: 'T1', teamId: 'TM1' });
            s.emit('auction:sold', { tournamentId: 'T1' });
            await sleep(1200);
            s.close();
            const audits = await q(`SELECT "eventType" FROM user_event WHERE "userId"=$1 AND "eventType" LIKE 'auction_host%'`, [playerId]);
            const claimed = await q(`SELECT count(*)::int AS n FROM user_event WHERE "eventType"='auction_host_claimed'`);
            const unauthorized = errs.filter(e => (typeof e === 'string' ? /unauthor/i.test(e) : e?.code === 'UNAUTHORIZED')).length;
            const pass = unauthorized >= 4 && claimed[0].n === 0 && audits.length >= 2;
            return { pass, observed: `errors=${JSON.stringify(errs)}; refusal audit rows=${audits.length}; any seat claimed=${claimed[0].n}` };
        });

        await step('G4', 'Player reads another user', '403', async () => {
            const r = await api('POST', '/api/user/detail', { token: playerToken, body: { targetUserId: 'u_boss' } });
            return { pass: r.status === 403, observed: `${r.status}` };
        });
        await step('G5', 'Player self-promotes via set-access', '403; role unchanged', async () => {
            const r = await api('POST', '/api/user/set-access', { token: playerToken, body: { targetUserId: playerId, role: 'boss' } });
            const u = await q('SELECT role FROM "user" WHERE id=$1', [playerId]);
            return { pass: r.status === 403 && u[0].role === 'player', observed: `${r.status}; role=${u[0].role}` };
        });

        const superTok = (await pwLogin('super@test.local')).json?.data?.sessionToken;
        await step('G6', 'super_user creates a boss (no createdBy)', 'refused', async () => {
            const r = await api('POST', '/api/user/create', { token: superTok, body: { name: 'Evil Boss', email: 'evilboss@test.local', password: 'Passw0rd!', role: 'boss' } });
            const u = await userBy('evilboss@test.local');
            return { pass: !u || u.role !== 'boss', observed: `${r.status}; created=${!!u}${u ? ` role=${u.role}` : ''}` };
        });
        await step('G6b', 'super_user creates a super_user (no createdBy)', 'refused (super_user has canCreateSuperUser=false)', async () => {
            const r = await api('POST', '/api/user/create', { token: superTok, body: { name: 'Another Super', email: 'super3@test.local', password: 'Passw0rd!', role: 'super_user' } });
            const u = await userBy('super3@test.local');
            return { pass: !u, observed: `${r.status}; created=${!!u}` };
        });
        await step('G7', 'super_user suspends a boss via /user/update', 'refused', async () => {
            const r = await api('POST', '/api/user/update', { token: superTok, body: { targetUserId: 'u_boss', isActive: false } });
            const u = await userBy('boss@test.local');
            await q('UPDATE "user" SET "isActive"=true WHERE id=$1', ['u_boss']);
            return { pass: u.isActive === true, observed: `${r.status}; boss isActive after=${u.isActive} (restored)` };
        });
        await step('G8', 'super_user hard-deletes another super_user', 'refused (boss-only)', async () => {
            const r = await api('POST', '/api/user/delete', { token: superTok, body: { targetUserId: 'u_super2', hardDelete: true } });
            const u = await userBy('super2@test.local');
            return { pass: !!u, observed: `${r.status} "${r.json?.message}"; row exists after=${!!u}` };
        });
        await step('G9', 'Player opens a private tournament', '404', async () => {
            const r = await api('POST', '/api/tournament/detail', { token: playerToken, body: { tournamentId: 'TP' } });
            const anon = await api('POST', '/api/tournament/detail', { body: { tournamentId: 'TP' } });
            return { pass: r.status === 404 && anon.status === 404, observed: `player ${r.status}, signed-out ${anon.status}` };
        });

        const hostTok = (await pwLogin('hostgmail@gmail.com')).json?.data?.sessionToken;
        await step('G11', 'Host resets another tournament\'s planner link', '403', async () => {
            const r = await api('POST', '/api/planner/link-reset', { token: hostTok, body: { teamId: 'TM2' } });
            return { pass: r.status === 403, observed: `${r.status} ${r.json?.message}${r.json?.data?.token ? ' (new token issued)' : ''}` };
        });
        await step('G12', 'Host tops up another tournament\'s team budget, forging createdBy', '403; no top-up row', async () => {
            const r = await api('POST', '/api/team/topup-budget', { token: hostTok, body: { teamId: 'TM2', amount: 100000, note: 'x', userId: 'u_boss' } });
            const rows = await q('SELECT "createdById" FROM team_budget_topup WHERE "teamId"=$1', ['TM2']);
            return { pass: r.status === 403 && rows.length === 0, observed: `${r.status}; top-ups on TM2=${rows.length}${rows[0] ? `, recorded createdById=${rows[0].createdById}` : ''}` };
        });
        await step('G13', 'Host scores a match in another tournament', '403 on start-innings / ball / undo / match update', async () => {
            const calls = [
                ['/api/scoring/start-innings', { matchId: 'M2', inningsNumber: 1, battingTeamId: 'TM2' }],
                ['/api/scoring/ball', { matchId: 'M2', inningsNumber: 1 }],
                ['/api/scoring/undo', { matchId: 'M2', inningsNumber: 1 }],
                ['/api/match/update', { matchId: 'M2', venue: 'Hijacked' }],
                ['/api/match/create', { tournamentId: 'T1', teamAId: 'TM1', teamBId: 'TM2' }],
            ];
            const out = [];
            for (const [p, body] of calls) out.push(`${p.split('/').slice(-1)[0]} ${(await api('POST', p, { token: hostTok, body })).status}`);
            return { pass: out.every(s => s.endsWith(' 403')), observed: out.join(', ') };
        });
        await step('G14', 'Host drives another tournament\'s auction over REST', '403 on next-player / categories / reset-unsold / history', async () => {
            const calls = [
                ['/api/auction/next-player', { touranmentId: 'T2' }],
                ['/api/auction/player-categories', { touranmentId: 'T2' }],
                ['/api/player/reset-unsold', { touranmentId: 'T2' }],
                ['/api/player/history', { touranmentId: 'T2' }],
            ];
            const out = [];
            for (const [p, body] of calls) out.push(`${p.split('/').slice(-1)[0]} ${(await api('POST', p, { token: hostTok, body })).status}`);
            return { pass: out.every(s => s.endsWith(' 403')), observed: out.join(', ') };
        });
        await step('G15', 'Positive controls: own tournament still works', 'host edits own team and tops it up; admin creates a host; boss edits a super_user', async () => {
            const own = await api('POST', '/api/team/update', { token: hostTok, body: { teamId: 'TM1', name: 'Team One Renamed' } });
            const top = await api('POST', '/api/team/topup-budget', { token: hostTok, body: { teamId: 'TM1', amount: 500 } });
            const topRow = (await q('SELECT "createdById" FROM team_budget_topup WHERE "teamId"=$1', ['TM1']))[0];
            const mk = await api('POST', '/api/user/create', { token: superTok, body: { name: 'New Host', email: 'newhost@test.local', password: 'Passw0rd!', role: 'tournament_host' } });
            const bossTok = (await pwLogin('boss@test.local')).json?.data?.sessionToken;
            const ed = await api('POST', '/api/user/update', { token: bossTok, body: { targetUserId: 'u_super', name: 'Super Renamed' } });
            const pass = own.status === 200 && top.status === 201 && topRow?.createdById === 'u_host' && mk.status === 201 && ed.status === 200;
            return { pass, observed: `own team update ${own.status}, own top-up ${top.status} (createdBy=${topRow?.createdById}), super creates host ${mk.status}, boss edits super ${ed.status}` };
        });
        await step('G16', 'super_user promotes someone to super_user via set-access', 'refused', async () => {
            const r = await api('POST', '/api/user/set-access', { token: superTok, body: { targetUserId: 'u_host2', role: 'super_user' } });
            const u = await userBy('host2@test.local');
            return { pass: u.role === 'tournament_host', observed: `${r.status} "${r.json?.error || r.json?.message}"; role=${u.role}` };
        });
        await step('G10', 'Host edits another tournament\'s team, claiming own tournamentId', '403; team unchanged', async () => {
            const u = await api('POST', '/api/team/update', { token: hostTok, body: { teamId: 'TM2', tournamentId: 'T1', name: 'Hijacked' } });
            const t = (await q('SELECT name, "touranmentId" FROM team WHERE id=$1', ['TM2']))[0];
            const del = await api('POST', '/api/team/delete', { token: hostTok, body: { teamId: 'TM2', tournamentId: 'T1' } });
            const still = (await q('SELECT count(*)::int AS n FROM team WHERE id=$1', ['TM2']))[0].n;
            return { pass: t.name === 'Team Two' && still === 1, observed: `update ${u.status} (name now "${t.name}"), delete ${del.status} (team exists=${still === 1})` };
        });
        /* H — sessions */
        await step('H1/H2', 'Two devices, logout one', 'both valid; after logout of A, B still valid and A refused', async () => {
            const a = (await googleLogin({ email: 'twodev@gmail.com', sub: 'sub-twodev' })).json?.data?.sessionToken;
            const b = (await googleLogin({ email: 'twodev@gmail.com', sub: 'sub-twodev' })).json?.data?.sessionToken;
            const lo = await api('POST', '/api/user/logout', { token: a, body: {} });
            const ra = await api('POST', '/api/user/detail', { token: a, body: {} });
            const rb = await api('POST', '/api/user/detail', { token: b, body: {} });
            return { pass: a !== b && lo.status === 200 && ra.status === 401 && rb.status === 200, observed: `logout ${lo.status}; A after ${ra.status} ${ra.json?.code}; B ${rb.status}` };
        });
        await step('H4', 'Sign out everywhere', 'GET /user/sessions lists both devices; POST /user/logout-all ends both', async () => {
            const a = (await googleLogin({ email: 'everywhere@gmail.com', sub: 'sub-everywhere' })).json?.data?.sessionToken;
            const b = (await googleLogin({ email: 'everywhere@gmail.com', sub: 'sub-everywhere' })).json?.data?.sessionToken;
            const list = await api('GET', '/api/user/sessions', { token: a });
            const out = await api('POST', '/api/user/logout-all', { token: a, body: {} });
            const ra = await api('POST', '/api/user/detail', { token: a, body: {} });
            const rb = await api('POST', '/api/user/detail', { token: b, body: {} });
            const n = list.json?.data?.length;
            return { pass: n === 2 && out.status === 200 && ra.status === 401 && rb.status === 401, observed: `sessions listed=${n}; logout-all ${out.status}; A ${ra.status}, B ${rb.status}` };
        });
        await step('H-ua', 'Session records the device', 'user_session.userAgent set from the request', async () => {
            const r = await api('POST', '/api/user/google-login', { headers: { 'user-agent': 'AuthTest/1.0 (iPhone)' }, body: { credential: fakeToken({ email: 'ua@gmail.com', sub: 'sub-ua' }) } });
            const row = (await q('SELECT "userAgent" FROM user_session WHERE token=$1', [r.json?.data?.sessionToken]))[0];
            return { pass: row?.userAgent === 'AuthTest/1.0 (iPhone)', observed: `userAgent=${row?.userAgent}` };
        });

        /* K — expiry */
        await step('K1', 'Expired session', '401 SESSION_EXPIRED and row deleted', async () => {
            const t = (await googleLogin({ email: 'expire@gmail.com', sub: 'sub-exp' })).json?.data?.sessionToken;
            await q(`UPDATE user_session SET "expiresAt"=(now() at time zone 'utc') - interval '1 minute' WHERE token=$1`, [t]);
            const r = await api('POST', '/api/user/detail', { token: t, body: {} });
            const left = (await q('SELECT count(*)::int AS n FROM user_session WHERE token=$1', [t]))[0].n;
            return { pass: r.status === 401 && r.json?.code === 'SESSION_EXPIRED' && left === 0, observed: `${r.status} ${r.json?.code}; row left=${left}` };
        });
        await step('K2', 'Session row deleted server-side', '401 SESSION_INVALID', async () => {
            const t = (await googleLogin({ email: 'expire@gmail.com', sub: 'sub-exp' })).json?.data?.sessionToken;
            await q('DELETE FROM user_session WHERE token=$1', [t]);
            const r = await api('POST', '/api/user/detail', { token: t, body: {} });
            return { pass: r.status === 401 && r.json?.code === 'SESSION_INVALID', observed: `${r.status} ${r.json?.code}` };
        });
        await step('K3', 'Expired token on player-profile /me', '401', async () => {
            const t = (await googleLogin({ email: 'expire@gmail.com', sub: 'sub-exp' })).json?.data?.sessionToken;
            await q(`UPDATE user_session SET "expiresAt"=(now() at time zone 'utc') - interval '1 minute' WHERE token=$1`, [t]);
            const r = await api('GET', '/api/player-profile/me', { playerToken: t });
            return { pass: r.status === 401, observed: `${r.status}` };
        });
        await step('K5', 'Session lifetime', '90 days, fixed', async () => {
            const t = (await googleLogin({ email: 'expire@gmail.com', sub: 'sub-exp' })).json?.data?.sessionToken;
            const row = (await q(`SELECT extract(epoch from ("expiresAt" - "createdAt"))/86400 AS days FROM user_session WHERE token=$1`, [t]))[0];
            return { pass: Math.round(row.days) === 90, observed: `${Number(row.days).toFixed(2)} days (no sliding renewal)` };
        });
        await step('K6', 'Google ID token expired', 'refused', async () => {
            const now = Math.floor(Date.now() / 1000);
            const r = await googleLogin({ email: 'expire@gmail.com', sub: 'sub-exp', iat: now - 7200, exp: now - 3600 });
            return { pass: r.status === 401, observed: `${r.status} "${r.json?.message}"` };
        });
        await step('K7', 'Same credential replayed 3 times', 'only the first creates a session', async () => {
            const cred = fakeToken({ email: 'replay@gmail.com', sub: 'sub-replay' });
            const rs = [];
            for (let i = 0; i < 3; i++) rs.push(await api('POST', '/api/user/google-login', { body: { credential: cred } }));
            const u = await userBy('replay@gmail.com');
            const n = await sessionsOf(u.id);
            return { pass: n === 1, observed: `statuses=${rs.map(r => r.status).join(',')}; sessions=${n}` };
        });

        /* L — clock skew (simulated: the harness verifier applies the library's ±300 s rule) */
        await step('L1', 'ID token iat 10 min in the future (server clock behind)', 'refused, with a cause that ops can see in logs', async () => {
            const now = Math.floor(Date.now() / 1000);
            const r = await googleLogin({ email: 'skew@gmail.com', iat: now + 600, exp: now + 4200 });
            await sleep(200);
            const logged = logs.some(l => /token verification failed: Token used too early/.test(l));
            return { pass: r.status === 401 && logged, observed: `${r.status} "${r.json?.message}"; cause in server log=${logged}` };
        });

        /* M — changed email / sub conflicts */
        await step('M1', 'Google account email changes (same sub)', 'same user; stored email refreshed', async () => {
            await googleLogin({ email: 'oldaddr@gmail.com', sub: 'sub-change' });
            const r = await googleLogin({ email: 'newaddr@gmail.com', sub: 'sub-change' });
            const u = (await q('SELECT email FROM "user" WHERE "googleSub"=$1', ['sub-change']))[0];
            return { pass: r.status === 200 && u.email === 'newaddr@gmail.com', observed: `${r.status}; same user, stored email=${u.email}` };
        });
        await step('M3', 'Row linked to an old sub; same email, new sub', 'refused SUB_CONFLICT; after a boss unlinks, the new account links', async () => {
            const r = await googleLogin({ email: 'conflict@gmail.com', sub: 'sub-new-account' });
            const bossTok = (await pwLogin('boss@test.local')).json?.data?.sessionToken;
            const un = await api('POST', '/api/user/unlink-google', { token: bossTok, body: { targetUserId: 'u_conflict' } });
            const again = await googleLogin({ email: 'conflict@gmail.com', sub: 'sub-new-account' });
            const u = await userBy('conflict@gmail.com');
            const pass = r.status === 401 && r.json?.code === 'SUB_CONFLICT' && un.status === 200 && again.status === 200 && u.googleSub === 'sub-new-account';
            return { pass, observed: `first ${r.status} ${r.json?.code}; unlink ${un.status}; retry ${again.status}; googleSub=${u.googleSub}` };
        });
        await step('M3b', 'Player cannot unlink anyone', '403', async () => {
            const r = await api('POST', '/api/user/unlink-google', { token: playerToken, body: { targetUserId: 'u_host' } });
            return { pass: r.status === 403, observed: `${r.status}` };
        });

        /* N — redirect callback */
        await step('N1', 'Callback: cookie ≠ body g_csrf_token', 'redirect ?error=csrf', async () => {
            const r = await api('POST', '/api/user/google-callback', { headers: { cookie: 'g_csrf_token=aaa' }, form: { g_csrf_token: 'bbb', credential: fakeToken({ email: 'csrf@gmail.com' }) } });
            return { pass: r.status === 302 && /error=CSRF$/.test(r.location || ''), observed: `${r.status} → ${r.location}` };
        });
        const codeFrom = (loc) => (String(loc || '').match(/#code=([0-9a-f]+)/) || [])[1];
        await step('N2', 'Callback: no cookie, attacker\'s valid credential (login CSRF)', 'no session in the URL; the victim\'s exchange (own or no nonce) is refused', async () => {
            const r = await api('POST', '/api/user/google-callback', { form: { credential: fakeToken({ email: 'attacker@gmail.com', sub: 'sub-attacker', nonce: 'attackers-nonce' }) } });
            const tokenInUrl = /token=/.test(r.location || '');
            const code = codeFrom(r.location);
            const ex = await api('POST', '/api/user/google-exchange', { body: { code, nonce: 'victims-own-nonce' } });
            const session = !!ex.json?.data?.sessionToken;
            return { pass: !tokenInUrl && !session && ex.json?.code === 'CSRF', observed: `${r.status} → /login#code=<one-time>; victim exchange ${ex.status} ${ex.json?.code}; session issued=${session}` };
        });
        await step('N2b', 'Legitimate redirect sign-in: callback → code → exchange with own nonce', '200 with a session; the code works once', async () => {
            const r = await api('POST', '/api/user/google-callback', { form: { credential: fakeToken({ email: 'redirect@gmail.com', sub: 'sub-redirect', nonce: 'tab-nonce-123' }) } });
            const code = codeFrom(r.location);
            const ex = await api('POST', '/api/user/google-exchange', { body: { code, nonce: 'tab-nonce-123' } });
            const again = await api('POST', '/api/user/google-exchange', { body: { code, nonce: 'tab-nonce-123' } });
            return { pass: !!ex.json?.data?.sessionToken && ex.json?.data?.role === 'player' && again.status === 401 && again.json?.code === 'EXPIRED_CODE', observed: `exchange ${ex.status} role=${ex.json?.data?.role}; reuse ${again.status} ${again.json?.code}` };
        });
        await step('N3', 'Callback: garbage credential', 'redirect with a fixed error code, no free text', async () => {
            const r = await api('POST', '/api/user/google-callback', { form: { credential: 'abc' } });
            return { pass: r.status === 302 && /\/login\?error=INVALID_TOKEN$/.test(r.location || ''), observed: `${r.status} → ${r.location}` };
        });
        await step('N3b', 'Callback: suspended account', 'code issued, exchange refused DEACTIVATED', async () => {
            const r = await api('POST', '/api/user/google-callback', { form: { credential: fakeToken({ email: 'suspended@gmail.com', sub: 'sub-susp-cb', nonce: 'n1' }) } });
            const ex = await api('POST', '/api/user/google-exchange', { body: { code: codeFrom(r.location), nonce: 'n1' } });
            return { pass: ex.status === 401 && ex.json?.code === 'DEACTIVATED', observed: `exchange ${ex.status} ${ex.json?.code}` };
        });
        await step('N4', 'Credential for another client id', 'refused', async () => {
            const r = await googleLogin({ email: 'otheraud@gmail.com', aud: 'someone-else.apps.googleusercontent.com' });
            return { pass: r.status === 401, observed: `${r.status} "${r.json?.message}"` };
        });
        await step('N6', 'Session token in query string', 'rejected (headers only)', async () => {
            const r = await api('POST', `/api/user/detail?sessionToken=${encodeURIComponent(playerToken)}`, { body: {} });
            return { pass: r.status === 401, observed: `${r.status}` };
        });
        await step('N7', '30 rapid failed password logins on one email', 'rate-limited (429) after 10 attempts per 15 min', async () => {
            const st = [];
            for (let i = 0; i < 30; i++) st.push((await pwLogin('ratelimit@test.local', `wrong${i}`)).status);
            const first429 = st.indexOf(429);
            return { pass: first429 === 10, observed: `first 429 at attempt ${first429 + 1}; statuses: ${[...new Set(st)].join(',')}` };
        });

        /* O — player-profile interplay */
        await step('O1', 'Token interchangeable between headers', 'admin-login token works on /player-profile/me; modal token works on /user/detail', async () => {
            const a = await api('GET', '/api/player-profile/me', { playerToken: playerToken });
            const b = await api('POST', '/api/user/detail', { token: modalToken, body: {} });
            const c = await api('GET', '/api/player-profile/me', { token: playerToken });
            return { pass: a.status === 200 && b.status === 200 && c.status === 200, observed: `x-player-token on /me ${a.status}; x-session-token on /me ${c.status}; modal token on /user/detail ${b.status}` };
        });
        await step('O3', 'Account A edits account B\'s player profile', '"Player not found"', async () => {
            const created = await api('POST', '/api/player-profile/profiles', { playerToken: modalToken, body: { name: 'Child B' } });
            const pid = created.json?.data?.id;
            const r = await api('PUT', `/api/player-profile/profiles/${pid}`, { playerToken: playerToken, body: { name: 'Stolen' } });
            const row = (await q('SELECT name FROM player_profile WHERE id=$1', [pid]))[0];
            return { pass: r.status >= 400 && row?.name === 'Child B', observed: `${r.status} "${r.json?.message}"; name=${row?.name}` };
        });

        /* V — role visibility */
        const vBoss = (await pwLogin('boss@test.local')).json?.data?.sessionToken;
        const vSuper = (await pwLogin('super@test.local')).json?.data?.sessionToken;
        const vHost = (await googleLogin({ email: 'hostgmail@gmail.com', sub: 'sub-host' })).json?.data?.sessionToken;
        const mine = async (token) => (await api('GET', '/api/visibility/me', { token })).json?.data;
        const putVis = (token, changes) => api('PUT', '/api/visibility', { token, body: { changes } });

        await step('V1', 'Default answer per role', 'boss/super see admin pages; host sees workspace not admin; player and signed-out see nothing', async () => {
            const [b, s, h, p, anon] = [await mine(vBoss), await mine(vSuper), await mine(vHost), await mine(playerToken), await mine(null)];
            const pass = b.visible.includes('page.visibility') && s.visible.includes('page.users') && h.visible.includes('page.workspace.whatsapp')
                && !h.visible.includes('page.users') && p.visible.length === 0 && anon.visible.length === 0 && anon.role === null;
            return { pass, observed: `boss ${b.visible.length}, super ${s.visible.length}, host ${h.visible.length} (users=${h.visible.includes('page.users')}), player ${p.visible.length}, signed-out ${anon.visible.length}` };
        });
        await step('V2', 'Who can read the matrix', 'boss 200, super_user 200, host 403, player 403', async () => {
            const st = [];
            for (const t of [vBoss, vSuper, vHost, playerToken]) st.push((await api('GET', '/api/visibility/matrix', { token: t })).status);
            return { pass: st.join(',') === '200,200,403,403', observed: st.join(',') };
        });
        await step('V3', 'Only a boss can change it', 'super_user, host, player PUT → 403', async () => {
            const st = [];
            for (const t of [vSuper, vHost, playerToken]) st.push((await putVis(t, [{ role: 'tournament_host', key: 'page.workspace.whatsapp', visible: false }])).status);
            const rows = (await q('SELECT count(*)::int AS n FROM role_visibility'))[0].n;
            return { pass: st.every(s => s === 403) && rows === 0, observed: `${st.join(',')}; rows=${rows}` };
        });
        await step('V4', 'Ceiling, lock and unknown keys are refused', 'player→Users, boss off Role visibility, unknown key: all 400, nothing written', async () => {
            const a = await putVis(vBoss, [{ role: 'player', key: 'page.users', visible: true }]);
            const b = await putVis(vBoss, [{ role: 'boss', key: 'page.visibility', visible: false }]);
            const c = await putVis(vBoss, [{ role: 'tournament_host', key: 'page.nope', visible: false }]);
            const d = await putVis(vBoss, [{ role: 'tournament_host', key: 'page.users', visible: true }]);
            const rows = (await q('SELECT count(*)::int AS n FROM role_visibility'))[0].n;
            return { pass: [a, b, c, d].every(r => r.status === 400) && rows === 0, observed: `${a.status} "${a.json?.error}" | ${b.status} "${b.json?.error}" | ${c.status} | host→Users ${d.status}; rows=${rows}` };
        });
        await step('V5', 'Boss turns WhatsApp off for hosts', 'host loses it in /me and gets 403 FEATURE_HIDDEN from the API; super_user unaffected', async () => {
            const r = await putVis(vBoss, [{ role: 'tournament_host', key: 'page.workspace.whatsapp', visible: false }]);
            const h = await mine(vHost);
            const hostApi = await api('POST', '/api/whatsapp/config/get', { token: vHost, body: { tournamentId: 'T1' } });
            const superApi = await api('POST', '/api/whatsapp/config/get', { token: vSuper, body: { tournamentId: 'T1' } });
            const pass = r.status === 200 && !h.visible.includes('page.workspace.whatsapp') && hostApi.status === 403 && hostApi.json?.code === 'FEATURE_HIDDEN' && superApi.json?.code !== 'FEATURE_HIDDEN';
            return { pass, observed: `put ${r.status}; host sees whatsapp=${h.visible.includes('page.workspace.whatsapp')}; host API ${hostApi.status} ${hostApi.json?.code}; super API ${superApi.status}` };
        });
        await step('V6', 'Boss turns "Create tournament" off for hosts', 'host /tournament/register 403 FEATURE_HIDDEN; super_user can still create', async () => {
            await putVis(vBoss, [{ role: 'tournament_host', key: 'action.createTournament', visible: false }]);
            const h = await api('POST', '/api/tournament/register', { token: vHost, body: { name: 'Host New Cup' } });
            const s = await api('POST', '/api/tournament/register', { token: vSuper, body: { name: 'Super New Cup' } });
            return { pass: h.status === 403 && h.json?.code === 'FEATURE_HIDDEN' && s.json?.code !== 'FEATURE_HIDDEN', observed: `host ${h.status} ${h.json?.code}; super ${s.status}` };
        });
        await step('V7', 'Schedule & Scores off for hosts blocks scoring on their OWN match', '403 FEATURE_HIDDEN on scoring/ball for M1 (T1, host\'s own)', async () => {
            const before = await api('POST', '/api/scoring/ball', { token: vHost, body: { matchId: 'M1', inningsNumber: 1 } });
            await putVis(vBoss, [{ role: 'tournament_host', key: 'page.workspace.schedule', visible: false }]);
            const after = await api('POST', '/api/scoring/ball', { token: vHost, body: { matchId: 'M1', inningsNumber: 1 } });
            return { pass: before.json?.code !== 'FEATURE_HIDDEN' && before.status !== 403 && after.status === 403 && after.json?.code === 'FEATURE_HIDDEN', observed: `before ${before.status} (not a permission refusal), after ${after.status} ${after.json?.code}` };
        });
        await step('V8', 'Reset and set-to-default both remove the stored row', 'rows go to 0; host gets everything back', async () => {
            const before = (await q('SELECT count(*)::int AS n FROM role_visibility'))[0].n;
            await putVis(vBoss, [
                { role: 'tournament_host', key: 'page.workspace.whatsapp', visible: null },
                { role: 'tournament_host', key: 'action.createTournament', visible: true },
                { role: 'tournament_host', key: 'page.workspace.schedule', visible: null },
            ]);
            const after = (await q('SELECT count(*)::int AS n FROM role_visibility'))[0].n;
            const h = await mine(vHost);
            const api2 = await api('POST', '/api/whatsapp/config/get', { token: vHost, body: { tournamentId: 'T1' } });
            return { pass: before === 3 && after === 0 && h.visible.includes('page.workspace.whatsapp') && api2.json?.code !== 'FEATURE_HIDDEN', observed: `rows ${before} → ${after}; host whatsapp back=${h.visible.includes('page.workspace.whatsapp')}; API ${api2.status}` };
        });
        await step('V9', 'Changes are audited with who made them', 'history lists the changes newest first, by Boss', async () => {
            const r = await api('GET', '/api/visibility/history', { token: vSuper });
            const top = r.json?.data?.[0];
            return { pass: r.status === 200 && r.json?.data?.length >= 4 && top?.by === 'Boss' && top.changes.length === 3, observed: `${r.status}; entries=${r.json?.data?.length}; latest by ${top?.by} with ${top?.changes?.length} changes` };
        });
        await step('V10', 'Boss hides the Role visibility page from super users', 'super_user loses /me entry and matrix access; boss keeps it', async () => {
            await putVis(vBoss, [{ role: 'super_user', key: 'page.visibility', visible: false }]);
            const s = await api('GET', '/api/visibility/matrix', { token: vSuper });
            const b = await api('GET', '/api/visibility/matrix', { token: vBoss });
            await putVis(vBoss, [{ role: 'super_user', key: 'page.visibility', visible: null }]);
            return { pass: s.status === 403 && b.status === 200, observed: `super ${s.status} ${s.json?.code}; boss ${b.status}` };
        });
        await step('V11', 'Open browsers are told about a change', 'socket event visibility:changed reaches a connected client', async () => {
            const { io } = require(path.resolve(BACKEND, '../node_modules/socket.io-client'));
            const s = io(`${BASE}/auction`, { transports: ['websocket'], forceNew: true });
            await new Promise((res, rej) => { s.on('connect', res); setTimeout(() => rej(new Error('socket timeout')), 5000); });
            let got = null;
            s.on('visibility:changed', (e) => { got = e; });
            await putVis(vBoss, [{ role: 'super_user', key: 'page.assistant', visible: false }]);
            await sleep(800);
            s.close();
            await putVis(vBoss, [{ role: 'super_user', key: 'page.assistant', visible: null }]);
            return { pass: !!got && typeof got.version === 'string', observed: `event=${JSON.stringify(got)}` };
        });
    } finally {
        server.kill();
        if (serverNoGoogle) serverNoGoogle.kill();
        await pool.end();
    }

    fs.writeFileSync(OUT, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
    fs.writeFileSync(OUT.replace(/\.json$/, '.server.log'), logs.join(''));
    const scored = results.filter(r => r.pass !== null);
    console.log(`\n${scored.filter(r => r.pass).length}/${scored.length} match the desired behaviour. Results: ${OUT}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
