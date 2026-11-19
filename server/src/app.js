// One Express app. /api = health, info, the Mock/Real toggle, the Hubs gateway calls (tools/list,
// tools/call), the why-this-beats-a-static-key data and reset. State is per workspace id (X-Workspace)
// so one visitor's runs never touch another's. Loopback Host check and same-origin writes on everything.
// Serves web/dist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { hostCheck, sameOriginWrites } from './safety.js';
import { createHealth } from './health.js';
import { mountShelfRoute } from './shelfLink.js';
import { loadCast, verticalFrom, VERTICALS } from './cast.js';
import { modeFrom, realAvailableFrom, realProblemFrom } from './config.js';
import { buildStory, TITLE } from './story.js';
import { DIAGRAM_NAMES, buildDiagram } from './diagramData.js';
import { AGENT, GATEWAY_URL, TOOLS, WHY_BETTER, STATIC_KEY_RISK, toolsList, getGoogleSecret, getBillingSecret, gatewaySelfTest } from './hubs.js';
import { createWorkspaces, workspaceFrom } from './workspaces.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = process.env.WEB_DIST || path.resolve(HERE, '../../web/dist');
const CONFIG = process.env.CUSTOMER_CONFIG || path.resolve(HERE, '../../customer.config.json');

const SECRETS_DEFAULT = 'projects/demo/secrets/google-agent-credential';
const SECRETS_KNOWN = [
  'projects/demo/secrets/google-agent-credential',
  'projects/demo/secrets/google-billing-credential',
  'projects/demo/secrets/google-vault-root',
];
const SECRET_RE = /^projects\/[a-z0-9-]{1,40}\/secrets\/[a-z0-9-]{1,60}$/i;
const KEY_RE = /^[\w.-]{8,120}$/;

export function createApp({
  health = createHealth(), configFile = CONFIG, env = process.env, now = Date.now,
  workspaces = createWorkspaces({ now }),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(hostCheck);
  app.use(sameOriginWrites);
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });

  // The runtime mode (rule 19): starts from the launch mode, switches without a restart.
  let mode = modeFrom(env);

  const api = express.Router();
  api.use(express.json({ limit: '64kb' }));
  api.use('/health', health.router);
  mountShelfRoute(api, { env }); // GET /api/shelf for the header "Shelf" button
  const castFor = (req) => loadCast(configFile, verticalFrom(req.query.vertical));

  api.get('/scenarios', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(buildStory(castFor(req))); });
  api.get('/diagram', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(buildDiagram(castFor(req), DIAGRAM_NAMES.includes(req.query.name) ? req.query.name : DIAGRAM_NAMES[0])); });
  api.get('/info', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      mode, source: mode, simulated: true, realAvailable: realAvailableFrom(env), realHint: realProblemFrom(env),
      title: TITLE, gatewayUrl: GATEWAY_URL, agent: { id: AGENT.id, label: AGENT.label },
      version: (() => { try { return JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version || null; } catch { return null; } })(),
    });
  });
  // Rule 19: exactly { source: "mock"|"real" }; 409 when Real is not enabled.
  api.post('/mode', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !['mock', 'real'].includes(body.source)) {
      return res.status(400).json({ error: 'bad_source', detail: 'body must be exactly { source: "mock" | "real" }' });
    }
    if (body.source === 'real' && !realAvailableFrom(env)) return res.status(409).json({ error: 'real_not_configured', detail: realProblemFrom(env) });
    mode = body.source;
    return res.json({ source: mode });
  });

  const withWorkspace = (handler) => (req, res) => {
    const ws = workspaceFrom(req);
    if (!ws) return res.status(400).json({ error: 'bad_workspace' });
    res.set('Cache-Control', 'no-store');
    return handler(ws, req, res);
  };

  api.get('/catalog', withWorkspace((ws, _req, res) => res.json({
    gatewayUrl: GATEWAY_URL, agent: { id: AGENT.id, label: AGENT.label, accessKey: AGENT.accessKey, keyLabel: 'MOCK agent access key (mock-issued, rule 4 exception — never a real credential)' },
    tools: TOOLS, knownSecrets: SECRETS_KNOWN, workspace: ws,
  })));

  // The rule-23 shape helper: any gateway call's downstream failure (cannot happen in the mock, but the
  // mapping is tested so a real hop dropped in later answers JSON, never an HTML page or a hang).
  const callGateway = (ws, fn, args) => {
    let out;
    try { out = fn(args); } catch (e) {
      const message = /network blocked|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(String(e?.message || e)) ? 'the gateway is unreachable' : 'the gateway call failed';
      return { status: 502, body: { error: 'gateway_unreachable', message } };
    }
    workspaces.record(ws, { action: 'gateway-call', tool: args.rpcMethod, decision: out.trace.decisions.find((d) => d.outcome === 'fail') ? 'deny' : 'allow' });
    return { status: 200, body: out };
  };

  // tools/list: what this key's grant exposes on this door.
  api.post('/gateway/tools-list', withWorkspace((ws, req, res) => {
    const key = typeof req.body?.key === 'string' && KEY_RE.test(req.body.key) ? req.body.key : AGENT.accessKey;
    const r = callGateway(ws, (a) => toolsList({ ...a, now }), { authorization: `Bearer ${key}`, key });
    res.status(r.status).json(r.body);
  }));

  // tools/call get_google_secret: the in-scope / unknown-secret / bad-key beats.
  api.post('/gateway/get-google-secret', withWorkspace((ws, req, res) => {
    const secret = typeof req.body?.secret === 'string' && SECRET_RE.test(req.body.secret) ? req.body.secret : SECRETS_DEFAULT;
    const key = typeof req.body?.key === 'string' && KEY_RE.test(req.body.key) ? req.body.key : AGENT.accessKey;
    const r = callGateway(ws, (a) => getGoogleSecret({ ...a, now }), { secret, authorization: `Bearer ${key}`, key });
    res.status(r.status).json(r.body);
  }));

  // tools/call get_google_billing_secret: the story's key beat — the out-of-scope refusal.
  api.post('/gateway/get-billing-secret', withWorkspace((ws, req, res) => {
    const key = typeof req.body?.key === 'string' && KEY_RE.test(req.body.key) ? req.body.key : AGENT.accessKey;
    const r = callGateway(ws, (a) => getBillingSecret({ ...a, now }), { authorization: `Bearer ${key}`, key });
    res.status(r.status).json(r.body);
  }));

  api.get('/why-better', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ points: WHY_BETTER, staticKeyRisk: STATIC_KEY_RISK }); });

  api.get('/runs', withWorkspace((ws, _req, res) => res.json(workspaces.runs(ws))));
  // Reset restores this workspace to empty runs (the mode stays).
  api.post('/reset', withWorkspace((ws, _req, res) => {
    workspaces.resetWorkspace(ws);
    res.json({ reset: 'ok', workspace: ws });
  }));
  api.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use('/api', api);
  // Errors become short JSON. Express's default handler would send an HTML stack trace with absolute file paths.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = Number(err?.status || err?.statusCode);
    if (status === 413) return res.status(413).json({ error: 'payload_too_large' });
    if (status >= 400 && status < 500) return res.status(status).json({ error: 'bad_request' });
    return res.status(500).json({ error: 'internal_error' });
  });

  if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    app.use(express.static(WEB_DIST));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
  }
  return app;
}

export function startHttpServer({ port, host, app = createApp() } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}/` }));
    server.once('error', reject);
  });
}

export { gatewaySelfTest };
