import test from 'node:test';
import assert from 'node:assert/strict';
import { post, withServer } from './helpers.js';
import { assertTrace } from '../src/gatewayTrace.js';
import { AGENT, GATEWAY_URL } from '../src/hubs.js';

const J = (r) => r.json();

test('GET /api/health is demo-health/1, GET only, and names this lab', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/health`)).json();
    assert.equal(j.schema, 'demo-health/1');
    assert.equal(j.state, 'ready');
    assert.equal(j.demo.id, 'privilege-google-secrets');
    const bad = await fetch(`${url}/api/health`, { method: 'POST', headers: { origin: url } });
    assert.equal(bad.status, 405);
  });
});

test('GET /api/info: mock by default, simulated always true, real disabled with the honest reason; it names the gateway URL and the agent', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/info`)).json();
    assert.equal(j.source, 'mock');
    assert.equal(j.simulated, true);
    assert.equal(j.realAvailable, false);
    assert.match(j.realHint, /GCP-hub-secrets/);
    assert.match(j.realHint, /2026-11-17/);
    assert.equal(j.gatewayUrl, GATEWAY_URL);
    assert.equal(j.agent.id, AGENT.id);
  });
});

test('POST /api/mode: exact body only, 409 with the reason when real is not enabled, both directions when it is', async () => {
  await withServer(async (url) => {
    const bad = await post(url, '/api/mode', { source: 'live' });
    assert.equal(bad.status, 400);
    const real = await post(url, '/api/mode', { source: 'real' });
    assert.equal(real.status, 409);
    assert.match((await real.json()).detail, /GCP-hub-secrets/);
    const ok = await post(url, '/api/mode', { source: 'mock' });
    assert.equal(ok.status, 200);
  });
  await withServer(async (url) => {
    const on = await post(url, '/api/mode', { source: 'real' });
    assert.equal(on.status, 200);
    const info = await (await fetch(`${url}/api/info`)).json();
    assert.equal(info.source, 'real');
    assert.equal(info.simulated, true, 'real mode in this lab is still a simulation — the page keeps its banner');
    const back = await post(url, '/api/mode', { source: 'mock' });
    assert.equal((await back.json()).source, 'mock');
  }, { env: { PGS_MODE_REAL: '1' } });
});

test('GET /api/hub-state: same snapshot shape in both modes with source naming the mode; workspace-scoped and no-store', async () => {
  await withServer(async (url) => {
    const noWs = await fetch(`${url}/api/hub-state`, { headers: { 'x-workspace': 'not a workspace' } });
    assert.equal(noWs.status, 400);
    const mock = await (await fetch(`${url}/api/hub-state`, { headers: { 'x-workspace': 'default' } })).json();
    assert.equal(mock.source, 'mock');
    assert.equal(mock.snapshotDate, '2026-11-17');
    assert.equal(mock.snapshot.hub.name, 'GCP-hub-secrets');
    assert.equal(mock.snapshot.secrets.length, 2);
    assert.equal(mock.snapshot.grant.name, 'YukonRiver-416146713043');
    assert.equal(mock.snapshot.grant.timeBoxed, false);
  });
  await withServer(async (url) => {
    await post(url, '/api/mode', { source: 'real' });
    const j = await (await fetch(`${url}/api/hub-state`)).json();
    assert.equal(j.source, 'real');
    assert.equal(j.snapshot.hub.projectId, 'privilege-hub-test-643070');
    assert.deepEqual(j.snapshot.secrets.map((s) => s.id), ['groq-key', 'privilege-hub-test']);
  }, { env: { PGS_MODE_REAL: '1' } });
  await withServer(async (url) => {
    const r = await fetch(`${url}/api/hub-state`);
    assert.match(r.headers.get('cache-control'), /no-store/);
  });
});

test('GET /api/catalog: the agent, its MOCK-labelled key, the two tools and the known secrets', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/catalog`)).json();
    assert.equal(j.agent.id, AGENT.id);
    assert.equal(j.agent.accessKey, AGENT.accessKey);
    assert.match(j.agent.keyLabel, /MOCK/);
    assert.deepEqual(j.tools.map((t) => t.name).sort(), ['get_google_billing_secret', 'get_google_secret']);
    assert.ok(j.knownSecrets.includes('projects/demo/secrets/google-agent-credential'));
  });
});

test('the marquee beat: an in-scope secret is ALLOWED and released by the custodian', async () => {
  await withServer(async (url) => {
    const r = await post(url, '/api/gateway/get-google-secret', { secret: 'projects/demo/secrets/google-agent-credential' });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.status, 200);
    assert.equal(j.body.result.isError, false);
    const payload = JSON.parse(j.body.result.content[0].text);
    assert.match(payload.payload, /^mock-gsk-/);
    assert.equal(payload.labels.mock, true, 'the released secret is labelled mock (rule 4 exception)');
    const outcomes = Object.fromEntries(j.trace.decisions.map((d) => [d.id, d.outcome]));
    assert.equal(outcomes.authenticated, 'pass');
    assert.equal(outcomes.policy, 'pass');
    assert.equal(outcomes.custodian, 'pass');
    assert.match(j.trace.record, /released/);
    assert.deepEqual(assertTrace(j.trace), []);
    assert.ok(j.trace.decisions.every((d) => d.basis === 'checked'), 'a mock trace says checked');
  });
});

test('the key beat: the out-of-scope billing secret is DENIED and never released', async () => {
  await withServer(async (url) => {
    const r = await post(url, '/api/gateway/get-billing-secret', {});
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.status, 200);
    assert.equal(j.body.result.isError, true);
    assert.match(j.body.result.content[0].text, /Gateway Policy Denied/);
    assert.match(j.body.result.content[0].text, /outside agent/);
    const outcomes = Object.fromEntries(j.trace.decisions.map((d) => [d.id, d.outcome]));
    assert.equal(outcomes.authenticated, 'pass');
    assert.equal(outcomes.policy, 'fail');
    assert.equal(outcomes.custodian, 'skipped');
    assert.match(j.trace.record, /denied by policy/);
    assert.ok(!JSON.stringify(j).includes('mock-gsk-billing'), 'the out-of-scope secret payload never appears anywhere');
    assert.deepEqual(assertTrace(j.trace), []);
  });
});

test('an unknown secret and a wrong key are refused; the wrong key never reaches policy', async () => {
  await withServer(async (url) => {
    const unknown = await (await post(url, '/api/gateway/get-google-secret', { secret: 'projects/demo/secrets/does-not-exist' })).json();
    assert.equal(unknown.body.result.isError, true);
    assert.match(unknown.body.result.content[0].text, /does not exist/);

    const bad = await (await post(url, '/api/gateway/get-google-secret', { key: 'pak-not-the-agent-key' })).json();
    assert.equal(bad.status, 401, 'the gateway status (401) is echoed in the body');
    assert.equal(bad.body.error.code, -32001);
    assert.equal(bad.body.error.code, -32001);
    const outcomes = Object.fromEntries(bad.trace.decisions.map((d) => [d.id, d.outcome]));
    assert.equal(outcomes.authenticated, 'fail');
    assert.equal(outcomes.policy, 'skipped');

    const bl = await (await post(url, '/api/gateway/tools-list', { key: 'pak-not-the-agent-key' })).json();
    assert.equal(bl.status, 401);
  });
});

test('tools/list on the good key: exactly the two secret tools, decisions say checked', async () => {
  await withServer(async (url) => {
    const j = await (await post(url, '/api/gateway/tools-list', {})).json();
    assert.equal(j.status, 200);
    assert.deepEqual(j.body.result.tools.map((t) => t.name).sort(), ['get_google_billing_secret', 'get_google_secret']);
    assert.ok(j.trace.decisions.every((d) => d.basis === 'checked'));
    assert.deepEqual(assertTrace(j.trace), []);
  });
});

test('the trace never carries a raw agent key on a refusal; inputs are bounded', async () => {
  await withServer(async (url) => {
    const long = 'x'.repeat(300);
    const bad = await post(url, '/api/gateway/get-google-secret', { secret: long });
    assert.equal(bad.status, 200); // falls back to the default secret: input is validated, not echoed
    const refused = await (await post(url, '/api/gateway/get-google-secret', { key: 'pak-not-the-agent-key' })).json();
    assert.ok(!JSON.stringify(refused).includes('pak-not-the-agent-key'), 'the wrong key value is not echoed into the trace');
  });
});

test('runs are recorded per workspace and reset clears them', async () => {
  await withServer(async (url) => {
    await post(url, '/api/gateway/tools-list', {});
    const ws = { 'x-workspace': 'w-test-1' };
    const runs = await (await fetch(`${url}/api/runs`, { headers: ws })).json();
    assert.equal(runs.workspace, 'w-test-1');
    assert.equal(runs.runs.length, 0, 'the call above went to the default workspace, not this one');
    await post(url, '/api/gateway/tools-list', {}, ws);
    const mine = await (await fetch(`${url}/api/runs`, { headers: ws })).json();
    assert.equal(mine.runs.length, 1);
    assert.equal(mine.runs[0].action, 'gateway-call');
    const reset = await post(url, '/api/reset', {}, ws);
    assert.equal(reset.status, 200);
    const after = await (await fetch(`${url}/api/runs`, { headers: ws })).json();
    assert.equal(after.runs.length, 0);
  });
});

test('GET /api/why-better: three points and the static-key counterfactual', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/why-better`)).json();
    assert.equal(j.points.length, 3);
    for (const id of ['no-secret-in-agent', 'policy-per-secret', 'audit-trail']) assert.ok(j.points.some((p) => p.id === id), id);
    assert.match(j.staticKeyRisk, /static/);
  });
});

test('GET /api/diagram loads the studio diagram by name', async () => {
  await withServer(async (url) => {
    const j = await (await fetch(`${url}/api/diagram?name=google-secret-broker`)).json();
    assert.match(j.title, /Google secret/);
    assert.ok(j.nodes.length >= 6 && j.steps.length >= 4);
  });
});

test('rule 23: unknown API routes answer JSON, never HTML', async () => {
  await withServer(async (url) => {
    const r = await fetch(`${url}/api/nope`);
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type') || '', /application\/json/);
    assert.deepEqual(await r.json(), { error: 'not_found' });
  });
});
