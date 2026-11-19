import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_CAST, VERTICALS, unfilled } from '../src/cast.js';
import { buildStory, rawStory, renderTalkTrackMarkdown, FACTS, SCENARIOS, PRODUCTS } from '../src/story.js';

test('every {{token}} in the story is defined in every vertical pack', () => {
  const text = JSON.stringify(rawStory());
  for (const [name, cast] of Object.entries(VERTICALS)) assert.deepEqual(unfilled(text, cast), [], name);
  assert.ok(!JSON.stringify(buildStory(DEFAULT_CAST)).includes('{{'));
});

test('docs/talk-track.md is exactly what the data generates (no drift)', () => {
  const doc = fs.readFileSync(new URL('../../docs/talk-track.md', import.meta.url), 'utf8');
  assert.equal(doc, renderTalkTrackMarkdown(DEFAULT_CAST));
});

test('every fact carries a status label; product claims are marked', () => {
  assert.ok(FACTS.length >= 6);
  for (const f of FACTS) assert.ok(['measured', 'inferred', 'UNVERIFIED'].includes(f.status), f.id);
  const unverified = FACTS.filter((f) => f.status === 'UNVERIFIED');
  assert.ok(unverified.some((f) => /UNVERIFIED|product/.test(f.text)), 'the product behaviour mapping is UNVERIFIED, not passed off as measured');
});

test('every scenario names a runnable call with an expect the harness can check', () => {
  for (const sc of SCENARIOS) {
    assert.ok(sc.run && typeof sc.run.tool === 'string' && typeof sc.run.secret === 'string', sc.id);
    assert.ok(sc.expect && typeof sc.expect.decision === 'string' && typeof sc.expect.released === 'boolean', sc.id);
    assert.ok(sc.lesson && sc.title, sc.id);
  }
});

test('the banner and intro say what is simulated, including the mock-issued secret', () => {
  const s = buildStory(DEFAULT_CAST);
  assert.match(s.banner, /SIMULATION/);
  assert.match(s.banner, /no outbound network/i);
  assert.match(s.banner, /MOCK-issued/);
  assert.match(s.tokenLabel, /MOCK/);
  assert.ok(PRODUCTS.length >= 4);
  assert.ok(PRODUCTS.some((p) => /custodian/i.test(p.name)), 'the custodian is one of the shown products');
});
