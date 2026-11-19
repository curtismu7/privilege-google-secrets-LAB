import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT, toolsList, getGoogleSecret, getBillingSecret, gatewaySelfTest } from '../src/hubs.js';
import { assertTrace, realDecisions, OUTCOMES, BASES } from '../src/gatewayTrace.js';

const GOOD = `Bearer ${AGENT.accessKey}`;

test('every mock trace passes assertTrace and every decision says checked', () => {
  const out = gatewaySelfTest();
  assert.deepEqual(out.problems, []);
  for (const r of [toolsList({ authorization: GOOD }), toolsList({ authorization: 'Bearer junk' }), getGoogleSecret({ secret: 'projects/demo/secrets/google-agent-credential', authorization: GOOD }), getGoogleSecret({ secret: 'projects/demo/secrets/other', authorization: GOOD }), getBillingSecret({ authorization: GOOD })]) {
    assert.deepEqual(assertTrace(r.trace), []);
    assert.ok(r.trace.decisions.length >= 2);
    assert.ok(r.trace.decisions.every((d) => d.basis === 'checked'), 'the simulated gateway computed these');
  }
});

test('a real-shape trace is honest: no checked decisions, refusals name the layer, an info decision is never a pass', () => {
  const decisions = realDecisions({ credential: 'agent-key', rpc: { method: 'tools/call', params: { name: 'get_google_secret', arguments: {} } }, status: 403, body: { error: 'Gateway Policy Denied: out of scope' } });
  const t = { source: 'real', request: { method: 'POST', url: 'https://gateway.privilege.example/x/mcp' }, response: { status: 403, headers: {}, body: {} }, decisions };
  assert.deepEqual(assertTrace(t), []);
  assert.ok(decisions.every((d) => ['inferred', 'observed'].includes(d.basis)), 'a real trace never says checked');
  assert.ok(decisions.some((d) => d.outcome === 'fail'));
  const held = realDecisions({ credential: 'agent-key', rpc: { method: 'tools/call' }, status: 200, body: { result: {} }, callOk: false });
  assert.ok(held.some((d) => d.outcome === 'info'), 'an unusable reply is info, not passed');
});

test('an allow releases the mock secret; a deny never leaks any secret payload', () => {
  const allow = getGoogleSecret({ secret: 'projects/demo/secrets/google-agent-credential', authorization: GOOD });
  assert.equal(allow.body.result.isError, false);
  const deny = getBillingSecret({ authorization: GOOD });
  assert.ok(!JSON.stringify(deny).includes('mock-gsk-billing'));
  const badKey = getGoogleSecret({ secret: 'projects/demo/secrets/google-agent-credential', authorization: 'Bearer pak-wrong' });
  assert.ok(!JSON.stringify(badKey).includes('pak-wrong'), 'the wrong key value is never echoed');
});

test('the agent key is mock-labelled; no real-looking Google credential exists anywhere', () => {
  assert.match(AGENT.accessKey, /^pak-mock-/);
  const text = JSON.stringify([AGENT, toolsList({ authorization: GOOD }), getGoogleSecret({ secret: 'projects/demo/secrets/google-agent-credential', authorization: GOOD })]);
  assert.doesNotMatch(text, /mock-gsk-billing|mock-gsk-vault/);
});
