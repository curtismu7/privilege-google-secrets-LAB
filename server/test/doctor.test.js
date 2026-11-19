import test from 'node:test';
import assert from 'node:assert/strict';
import { runChecks, allPassed, checkScenario } from '../src/doctor.js';
import { rawStory, SCENARIOS } from '../src/story.js';
import { AGENT, TOOLS } from '../src/hubs.js';

test('every doctor check passes in a clean checkout (mock)', async () => {
  const checks = await runChecks({ env: {} });
  const failed = checks.filter((c) => c.level === 'fail');
  assert.deepEqual(failed.map((c) => `${c.id}: ${c.detail}`), []);
  assert.ok(allPassed(checks));
});

test('every scenario behaves as its lesson says, via the doctor harness itself', () => {
  assert.ok(SCENARIOS.length >= 5);
  for (const sc of rawStory().scenarios) {
    const problems = checkScenario(sc);
    assert.deepEqual(problems, [], sc.id);
  }
});

test('the agent holds only an access key, never a Google credential', () => {
  assert.equal(Object.keys(AGENT.grant).sort().join(','), 'app,secrets,tools');
  assert.match(AGENT.accessKey, /^pak-mock-/);
  for (const s of AGENT.grant.secrets) assert.doesNotMatch(s, /billing|vault/, 'the grant lists only the in-scope secret');
  assert.equal(TOOLS.length, 2);
});
