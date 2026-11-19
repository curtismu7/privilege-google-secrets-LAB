import test from 'node:test';
import assert from 'node:assert/strict';
import { modeFrom, realAvailableFrom, realProblemFrom } from '../src/config.js';

test('MODE defaults to Mock (this lab has no live mode); only mock/real accepted; real needs PGS_MODE_REAL=1', () => {
  assert.equal(modeFrom({}), 'mock');
  assert.equal(modeFrom({ MODE: 'mock' }), 'mock');
  assert.throws(() => modeFrom({ MODE: 'real' }), /PGS_MODE_REAL/, 'Real requested without the opt-in is refused, never a silent fallback');
  assert.equal(modeFrom({ PGS_MODE_REAL: '1' }), 'real');
  assert.equal(modeFrom({ PGS_MODE_REAL: '1', MODE: 'mock' }), 'mock');
  assert.equal(modeFrom({ PGS_MODE_REAL: '1', MODE: 'real' }), 'real');
  for (const MODE of ['live', 'prod', 'Mock', 'x']) assert.throws(() => modeFrom({ PGS_MODE_REAL: '1', MODE }), /not available/, MODE);
});

test('realAvailable reflects only the opt-in; the hint names the real tenant contents and the snapshot', () => {
  assert.equal(realAvailableFrom({}), false);
  assert.equal(realAvailableFrom({ PGS_MODE_REAL: '1' }), true);
  assert.match(realProblemFrom({}), /PGS_MODE_REAL/);
  assert.match(realProblemFrom({}), /GCP-hub-secrets/);
  assert.match(realProblemFrom({}), /privilege-hub-test-643070/);
  assert.match(realProblemFrom({}), /2026-11-19/);
  assert.match(realProblemFrom({}), /simulation in both modes/);
});
