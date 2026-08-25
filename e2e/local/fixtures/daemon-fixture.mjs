#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Stub HTTP server that mimics the OSS daemon's REST surface for the
 * Playwright local-mode E2E suite. Listens on 127.0.0.1:$FIXTURE_PORT
 * (default 7610) and serves deterministic fixture data for the routes used
 * by this application.
 *
 * The Playwright config starts this as a webServer before the dev
 * server; the dev server proxies /api/* to it.
 *
 * Bootstrap path: any non-empty token POSTed to /api/auth/bootstrap
 * succeeds; the response sets __aplexica_session + __aplexica_csrf
 * cookies that subsequent requests carry.
 */

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

const PORT = Number(process.env.FIXTURE_PORT ?? 7610);
const DEV_PORT = Number(process.env.DEV_PORT ?? 5173);
const HOST = '127.0.0.1';
const VERSION = 'v0.0.0-fixture';
const SECURITY_HEADERS = JSON.parse(
  fs.readFileSync(new URL('../../../public/daemon-http-headers.json', import.meta.url), 'utf8'),
).headers;

const sessions = new Map(); // sessionId -> { user, csrf }
let nextSeq = 1;

const startedAt = new Date().toISOString();

const fixtureAgents = [
  { name: 'claude-code', version: '0.81.0', syncState: 'enabled', lastActivity: new Date(Date.now() - 60_000).toISOString() },
  { name: 'codex', version: '0.42.1', syncState: 'enabled', lastActivity: new Date(Date.now() - 240_000).toISOString() },
];

const fixtureRules = [
  { Name: 'default-skills', Match: { kind: 'skill' }, Route: { agents: ['claude-code', 'codex'] }, Mode: 'default' },
  // example-rule is the fixture target the e2e suite navigates to
  // for the RuleDetail accessibility + routing checks.
  { Name: 'example-rule', Match: { kind: 'memory' }, Route: { agents: ['claude-code'] }, Mode: 'default' },
];

// GET /api/rules/presets fixture catalog.
// buildPresetCatalog(): the classic defaults individually plus the
// recommended starter-set group.
const fixturePresets = [
  {
    id: 'default-all-to-all',
    title: 'Sync everything everywhere',
    description: 'Fan every artifact out to all installed agents.',
    group: false,
    rules: [{ Name: 'default-all-to-all', Match: { kind: 'any' }, Route: {}, Mode: 'live' }],
  },
  {
    id: 'private-stays-local',
    title: 'Private artifacts never leave this device',
    description: 'Anything tagged private or secret is excluded from any remote transport.',
    group: false,
    rules: [
      { Name: 'private-stays-local', Match: { tag: ['private', 'secret'] }, Route: { remote: 'exclude' } },
    ],
  },
  {
    id: 'recommended-starter-set',
    title: 'Recommended starter set',
    description: 'Sync everything everywhere plus the safety guards.',
    group: true,
    rules: [
      { Name: 'starter-all-to-all', Match: { kind: 'any' }, Route: {}, Mode: 'live' },
      { Name: 'starter-private-local', Match: { tag: ['private'] }, Route: { remote: 'exclude' } },
    ],
  },
];

const fixtureConflicts = [
  {
    artifactId: 'memory-team-onboarding',
    kind: 'memory',
    heads: [
      {
        sourceAgent: 'claude-code',
        eventId: 'evt-a',
        contentSha256: 'a'.repeat(64),
        absTimestamp: Date.now() / 1000,
        payloadPreview: '# Onboarding (version A)',
      },
      {
        sourceAgent: 'codex',
        eventId: 'evt-b',
        contentSha256: 'b'.repeat(64),
        absTimestamp: Date.now() / 1000 + 5,
        payloadPreview: '# Onboarding (version B)',
      },
    ],
  },
  // fixture-conflict-1 is the artifact id the e2e suite navigates
  // to for the ConflictDetail accessibility + routing checks.
  {
    artifactId: 'fixture-conflict-1',
    kind: 'memory',
    heads: [
      {
        sourceAgent: 'claude-code',
        eventId: 'evt-1a',
        contentSha256: 'c'.repeat(64),
        absTimestamp: Date.now() / 1000,
        payloadPreview: '# Fixture conflict (version A)',
      },
      {
        sourceAgent: 'codex',
        eventId: 'evt-1b',
        contentSha256: 'd'.repeat(64),
        absTimestamp: Date.now() / 1000 + 5,
        payloadPreview: '# Fixture conflict (version B)',
      },
    ],
  },
];

const fixturePending = [
  { id: 'github.com/aplexica/sample', artifactCount: 3, samplePath: '/home/dev/code/sample/CLAUDE.md' },
];

// GET /api/native-backups fixture catalog.
// (nativebackup.BackupInfo). The pre-sync snapshot is the first-run
// capture the Backups view lets the user restore; the pre-restore entry
// is the reversible undo trail shown informationally.
const fixtureNativeBackups = [
  {
    id: 'manual-claude-code-2026-06-06T10:00:00Z',
    path: '/home/dev/.aplexica/backups/manual-claude-code-2026-06-06T10:00:00Z',
    kind: 'manual',
    createdAt: new Date(Date.now() - 1_200_000).toISOString(),
    agents: ['claude-code'],
    totalBytes: 2_097_152,
    fileCount: 16,
  },
  {
    id: 'pre-sync-2026-05-29T10:00:00Z',
    path: '/home/dev/.aplexica/backups/pre-sync-2026-05-29T10:00:00Z',
    kind: 'pre-sync',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    agents: ['claude-code', 'codex'],
    totalBytes: 5_242_880,
    fileCount: 42,
  },
  {
    id: 'pre-restore-2026-05-29T11:00:00Z',
    path: '/home/dev/.aplexica/backups/pre-restore-2026-05-29T11:00:00Z',
    kind: 'pre-restore',
    createdAt: new Date(Date.now() - 1_800_000).toISOString(),
    agents: ['claude-code'],
    totalBytes: 1_048_576,
    fileCount: 8,
  },
];

let fixtureBackupSchedule = {
  enabled: false,
  intervalMinutes: 1440,
  agents: [],
  lastRunAt: '',
  nextRunAt: '',
};

let fixtureBackupRetention = {
  perAgent: {
    'claude-code': 3,
    codex: 5,
  },
};

let fixtureBackupSafety = [
  {
    agent: 'claude-code',
    state: 'protected',
    roots: ['/home/dev/.claude'],
    rootSignature: 'sig-claude',
    backupId: 'pre-sync-2026-05-29T10:00:00Z',
    lastBackupAt: new Date(Date.now() - 3_600_000).toISOString(),
    override: false,
    blocked: false,
  },
  {
    agent: 'codex',
    state: 'protected',
    roots: ['/home/dev/.codex'],
    rootSignature: 'sig-codex',
    backupId: 'pre-sync-2026-05-29T10:00:00Z',
    lastBackupAt: new Date(Date.now() - 3_600_000).toISOString(),
    override: false,
    blocked: false,
  },
];

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendError(res, status, msg, code) {
  sendJson(res, status, { error: msg, code });
}

function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  const out = {};
  header.split(';').forEach((p) => {
    const idx = p.indexOf('=');
    if (idx === -1) return;
    out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1));
  });
  return out;
}

function sessionFromReq(req) {
  const c = parseCookies(req);
  const sid = c['__Host-aplexica_session'];
  if (!sid) return null;
  return sessions.get(sid) ?? null;
}

function requireSession(req, res) {
  const sess = sessionFromReq(req);
  if (!sess) {
    sendError(res, 401, 'unauthorized', 'auth');
    return null;
  }
  // CSRF check for mutating verbs.
  const method = req.method ?? 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfHeader = req.headers['x-csrf-token'];
    if (csrfHeader !== sess.csrf) {
      sendError(res, 403, 'csrf mismatch', 'csrf');
      return null;
    }
  }
  return sess;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

async function jsonBody(req) {
  const text = await readBody(req);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Host-header allowlist matching the daemon's request validation. Vite's dev
 * proxy forwards Host verbatim when `changeOrigin: false`, so this
 * matches the production listener behaviour and lets the DNS
 * rebinding e2e suite exercise the defense end-to-end.
 *
 * Accept: 127.0.0.1[:port], localhost[:port], and the actual fixture
 * port the dev server may have surfaced as. Anything else gets a 421
 * Misdirected Request.
 */
const ALLOWED_HOSTS = new Set([
  `127.0.0.1:${PORT}`,
  '127.0.0.1',
  `localhost:${PORT}`,
  'localhost',
  // Vite forwards Host verbatim. DEV_PORT is explicit so isolated test runs
  // retain the same host validation without being coupled to port 5173.
  `127.0.0.1:${DEV_PORT}`,
  `localhost:${DEV_PORT}`,
]);

const server = http.createServer(async (req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  const { method, url } = req;
  const hostHeader = (req.headers.host ?? '').toLowerCase();
  if (!ALLOWED_HOSTS.has(hostHeader)) {
    res.writeHead(421, { 'Content-Type': 'text/plain' });
    return res.end('misdirected request');
  }
  const u = new URL(url ?? '/', `http://${HOST}:${PORT}`);
  const path = u.pathname;

  // Unauthenticated liveness probe — Playwright's webServer waits on
  // a 2xx before starting tests.
  if (method === 'GET' && path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // Auth routes that mint cookies — handled BEFORE the requireSession
  // gate.
  if (method === 'POST' && path === '/api/auth/bootstrap') {
    const body = await jsonBody(req);
    if (!body || !body.token) return sendError(res, 400, 'token required', 'validation');
    const sid = randomUUID();
    const csrf = randomUUID();
    sessions.set(sid, { user: 'local', csrf });
    res.setHeader('Set-Cookie', [
      `__Host-aplexica_session=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
      `__Host-aplexica_csrf=${csrf}; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
    ]);
    return sendJson(res, 200, { user: 'local', daemon: { version: VERSION }, mode: 'local' });
  }

  if (method === 'GET' && path === '/api/auth/session') {
    const sess = sessionFromReq(req);
    if (!sess) return sendError(res, 401, 'unauthorized', 'auth');
    return sendJson(res, 200, { user: sess.user, daemon: { version: VERSION }, mode: 'local' });
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const c = parseCookies(req);
    if (c['__Host-aplexica_session']) sessions.delete(c['__Host-aplexica_session']);
    res.setHeader('Set-Cookie', [
      '__Host-aplexica_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      '__Host-aplexica_csrf=; Secure; SameSite=Strict; Path=/; Max-Age=0',
    ]);
    res.writeHead(204);
    return res.end();
  }

  // SSE — open-ended; ping a few events then keepalive.
  if (method === 'GET' && path === '/api/events/stream') {
    if (!sessionFromReq(req)) return sendError(res, 401, 'unauthorized', 'auth');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(`id: ${nextSeq++}\nevent: daemon.state\ndata: {"state":"active"}\n\n`);
    res.write(`id: ${nextSeq++}\nevent: artifact.synced\ndata: {"artifactId":"memory/x.md"}\n\n`);
    const t = setInterval(() => res.write(': keepalive\n\n'), 5000);
    req.on('close', () => clearInterval(t));
    return;
  }

  // From here on, require a session.
  if (path.startsWith('/api/')) {
    const sess = requireSession(req, res);
    if (!sess) return;
  }

  if (method === 'GET' && path === '/api/daemon') {
    const uptime = (Date.now() - new Date(startedAt).getTime()) / 1000;
    return sendJson(res, 200, {
      version: VERSION,
      pid: 9999,
      watchedDir: '/home/dev/.aplexica',
      paused: false,
      uptime,
      state: 'active',
      pendingImports: 0,
    });
  }
  if (method === 'POST' && path === '/api/daemon/pause') return sendJson(res, 200, { paused: true });
  if (method === 'POST' && path === '/api/daemon/resume') return sendJson(res, 200, { paused: false });

  if (method === 'GET' && path === '/api/agents') return sendJson(res, 200, fixtureAgents);
  if (method === 'GET' && path.startsWith('/api/agents/')) {
    const name = decodeURIComponent(path.slice('/api/agents/'.length));
    const summary = fixtureAgents.find((a) => a.name === name);
    if (!summary) return sendError(res, 404, 'agent not found: ' + name, 'not_found');
    return sendJson(res, 200, {
      ...summary,
      namespaces: ['core', 'team'],
      recentEvents: [
        { timestamp: new Date(Date.now() - 60_000).toISOString(), type: 'sync', detail: 'pulled 12 artifacts' },
      ],
    });
  }

  if (method === 'GET' && path === '/api/events') {
    const limit = Math.min(1000, Number(u.searchParams.get('limit') ?? 100));
    const events = Array.from({ length: Math.min(5, limit) }, (_, i) => ({
      seq: i + 1,
      type: 'artifact.synced',
      timestamp: new Date(Date.now() - i * 10_000).toISOString(),
      artifactId: `memory/x${i}.md`,
      kind: 'memory',
    }));
    return sendJson(res, 200, { events, nextSince: 5 });
  }

  if (method === 'GET' && path === '/api/rules') return sendJson(res, 200, fixtureRules);
  if (method === 'POST' && path === '/api/rules') {
    const body = await jsonBody(req);
    if (!body || !body.Name) return sendError(res, 400, 'rule name is required', 'validation');
    fixtureRules.push(body);
    return sendJson(res, 201, body);
  }
  // GET /api/rules/presets — the opt-in preset catalog. Registered
  // BEFORE the {id} match so the literal "presets" path wins.
  if (method === 'GET' && path === '/api/rules/presets') {
    return sendJson(res, 200, fixturePresets);
  }
  const ruleDetailMatch = path.match(/^\/api\/rules\/(.+)$/);
  if (ruleDetailMatch) {
    const id = decodeURIComponent(ruleDetailMatch[1]);
    const idx = fixtureRules.findIndex((r) => r.Name === id);
    if (method === 'GET') {
      if (idx === -1) return sendError(res, 404, 'rule not found: ' + id, 'not_found');
      return sendJson(res, 200, fixtureRules[idx]);
    }
    if (method === 'PATCH') {
      if (idx === -1) return sendError(res, 404, 'rule not found: ' + id, 'not_found');
      const body = await jsonBody(req);
      fixtureRules[idx] = { ...fixtureRules[idx], ...body, Name: id };
      return sendJson(res, 200, fixtureRules[idx]);
    }
    if (method === 'DELETE') {
      if (idx !== -1) fixtureRules.splice(idx, 1);
      res.writeHead(204);
      return res.end();
    }
  }

  if (method === 'GET' && path === '/api/conflicts') return sendJson(res, 200, fixtureConflicts);
  const conflictMatch = path.match(/^\/api\/conflicts\/([^/]+)(\/resolve)?$/);
  if (conflictMatch) {
    const id = decodeURIComponent(conflictMatch[1]);
    const c = fixtureConflicts.find((x) => x.artifactId === id);
    if (!c) return sendError(res, 404, 'conflict not found: ' + id, 'not_found');
    if (method === 'GET' && !conflictMatch[2]) return sendJson(res, 200, c);
    if (method === 'POST' && conflictMatch[2] === '/resolve') {
      const body = await jsonBody(req);
      if (!body || !['accept-a', 'accept-b', 'manual'].includes(body.action)) {
        return sendError(res, 400, 'action must be one of accept-a, accept-b, manual', 'validation');
      }
      if (body.action === 'manual' && !body.manualBody) {
        return sendError(res, 400, 'manualBody is required when action=manual', 'validation');
      }
      const idx = fixtureConflicts.findIndex((x) => x.artifactId === id);
      if (idx !== -1) fixtureConflicts.splice(idx, 1);
      return sendJson(res, 200, { resolved: id, action: body.action });
    }
  }

  if (method === 'GET' && path === '/api/pending') return sendJson(res, 200, fixturePending);
  const pendingLinkMatch = path.match(/^\/api\/pending\/([^/]+)\/link$/);
  if (method === 'POST' && pendingLinkMatch) {
    const id = decodeURIComponent(pendingLinkMatch[1]);
    const body = await jsonBody(req);
    if (!body || !body.localPath) return sendError(res, 400, 'localPath is required', 'validation');
    const idx = fixturePending.findIndex((p) => p.id === id);
    if (idx === -1) return sendError(res, 404, 'pending project not found: ' + id, 'not_found');
    fixturePending.splice(idx, 1);
    return sendJson(res, 200, { linked: id, localPath: body.localPath });
  }

  // Optional hosted-service plugin. The standard public fixture models a
  // daemon with no plugin installed, which is the safe first-run state.
  if (method === 'GET' && path === '/api/remote/status') {
    return sendJson(res, 200, {
      configured: false,
      enabled: false,
      paired: false,
      device_id: '',
      account_id: '',
      conn_state: 'disconnected',
      restart_count: 0,
    });
  }

  // Native backups — catalog, status, manual create, override, schedule, and
  // destructive restore.
  if (method === 'GET' && path === '/api/native-backups') {
    return sendJson(res, 200, fixtureNativeBackups);
  }
  if (method === 'GET' && path === '/api/native-backups/status') {
    return sendJson(res, 200, {
      safety: fixtureBackupSafety,
      schedule: fixtureBackupSchedule,
      retention: fixtureBackupRetention,
    });
  }
  if (method === 'POST' && path === '/api/native-backups') {
    const body = await jsonBody(req);
    const agents = body?.agents?.length ? body.agents : fixtureBackupSafety.map((s) => s.agent);
    const snap = {
      id: 'manual-' + new Date().toISOString().replaceAll(':', '-'),
      path: '/home/dev/.aplexica/backups/manual-fixture',
      kind: 'manual',
      createdAt: new Date().toISOString(),
      agents,
      totalBytes: 4096,
      fileCount: 4,
    };
    fixtureNativeBackups.unshift(snap);
    fixtureBackupSafety = fixtureBackupSafety.map((s) =>
      agents.includes(s.agent)
        ? { ...s, state: 'protected', backupId: snap.id, lastBackupAt: snap.createdAt, blocked: false, override: false }
        : s,
    );
    return sendJson(res, 201, snap);
  }
  if (method === 'POST' && path === '/api/native-backups/override') {
    const body = await jsonBody(req);
    if (!body || !body.agent) return sendError(res, 400, 'agent is required', 'validation');
    const found = fixtureBackupSafety.find((s) => s.agent === body.agent);
    if (!found) return sendError(res, 400, 'agent not found: ' + body.agent, 'validation');
    Object.assign(found, { state: 'overridden', override: true, blocked: false, overrideAt: new Date().toISOString() });
    return sendJson(res, 200, found);
  }
  if (method === 'PUT' && path === '/api/native-backups/schedule') {
    const body = await jsonBody(req);
    fixtureBackupSchedule = {
      enabled: Boolean(body?.enabled),
      intervalMinutes: Number(body?.intervalMinutes || 1440),
      agents: Array.isArray(body?.agents) ? body.agents : [],
      lastRunAt: body?.lastRunAt || '',
      nextRunAt: body?.enabled ? new Date(Date.now() + Number(body?.intervalMinutes || 1440) * 60_000).toISOString() : '',
    };
    return sendJson(res, 200, fixtureBackupSchedule);
  }
  if (method === 'PUT' && path === '/api/native-backups/retention') {
    const body = await jsonBody(req);
    fixtureBackupRetention = {
      perAgent: body?.perAgent && typeof body.perAgent === 'object' ? body.perAgent : {},
    };
    return sendJson(res, 200, fixtureBackupRetention);
  }
  if (method === 'POST' && path === '/api/native-backups/restore') {
    const body = await jsonBody(req);
    if (!body || !body.backupId) return sendError(res, 400, 'backupId is required', 'validation');
    const snap = fixtureNativeBackups.find((b) => b.id === body.backupId);
    if (!snap) return sendError(res, 400, 'backup not found: ' + body.backupId, 'validation');
    return sendJson(res, 200, {
      preRestoreDir: '/home/dev/.aplexica/backups/pre-restore-' + new Date().toISOString(),
      files: [
        { path: '/home/dev/.claude/CLAUDE.md', bytes: 1234, ok: true },
        { path: '/home/dev/.codex/config.toml', bytes: 567, ok: true },
      ],
    });
  }

  if (method === 'GET' && path === '/api/config') {
    return sendJson(res, 200, {
      logLevel: 'info',
      hermesWatchInterval: '5s',
      tray: { enabled: true },
      web: { enabled: true, port: 0, bind: '127.0.0.1' },
    });
  }
  if (method === 'PATCH' && path === '/api/config') {
    const body = await jsonBody(req);
    if (!body || Object.keys(body).length === 0) {
      return sendError(res, 400, 'patch body must contain at least one key', 'validation');
    }
    return sendJson(res, 200, { updated: body });
  }
  if (method === 'GET' && path === '/api/config/raw-path') {
    return sendJson(res, 200, { path: '/home/dev/.aplexica/config.toml' });
  }

  if (method === 'GET' && path === '/api/transport') {
    return sendJson(res, 200, { mode: 'local', available: ['local'], byo: null });
  }
  if (method === 'PUT' && path === '/api/transport') {
    const body = await jsonBody(req);
    if (!body || !['local', 'local-only', 'byo-relay'].includes(body.mode)) {
      return sendError(res, 400, 'mode must be one of local, local-only, byo-relay', 'validation');
    }
    if (body.mode === 'byo-relay') {
      return sendError(res, 501, 'BYO relay is not available', 'not_yet_implemented');
    }
    return sendJson(res, 200, { mode: 'local', available: ['local'], byo: null });
  }
  if (method === 'POST' && path === '/api/transport/byo') {
    const body = await jsonBody(req);
    if (!body || !body.url) return sendError(res, 400, 'url is required', 'validation');
    return sendError(res, 501, 'BYO relay setup is not available', 'not_yet_implemented');
  }

  if (method === 'GET' && path === '/api/onboarding/state') {
    return sendJson(res, 200, {
      steps: [
        { id: 'install-daemon', complete: true, completedAt: startedAt },
        { id: 'detect-agents', complete: true, completedAt: startedAt },
        { id: 'first-sync', complete: false },
      ],
    });
  }

  // Unknown path: return 404 with the local error envelope so the
  // SPA's error surface gets exercised in tests too.
  sendError(res, 404, 'no route: ' + path, 'not_found');
});

server.listen(PORT, HOST, () => {
  console.log(`fixture daemon listening at http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
