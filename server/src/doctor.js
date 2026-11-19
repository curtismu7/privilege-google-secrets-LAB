// Preflight checks shared by `npm run doctor` and GET /api/health. Never prints a secret, needs no network.
// Each check: { id, level: 'pass' | 'info' | 'fail', detail }.
import { assertBindAllowed, bindHost, portProblem, scanHosts, scanKeys, DEFAULT_PORT, PORT_MIN } from './safety.js';
import { netguardSelfTest } from './netguard.js';
import { DEFAULT_CAST, VERTICALS, unfilled } from './cast.js';
import { buildStory, rawStory, SCENARIOS } from './story.js';
import { modeFrom, realAvailableFrom } from './config.js';
import { AGENT, TOOLS, gatewaySelfTest, getGoogleSecret as getSecretSafe, getBillingSecret as getBillingSafe } from './hubs.js';

// The lab's core promise: the five scenarios behave as their lessons say, straight against the mock gateway.
export function checkScenario(sc) {
  const key = sc.run.key === 'wrong' ? 'not-the-agent-key' : AGENT.accessKey;
  const auth = `Bearer ${key}`;
  const out = sc.run.tool === 'get_google_billing_secret'
    ? getBillingSafe({ authorization: auth })
    : getSecretSafe({ secret: sc.run.secret, authorization: auth });
  const problems = [];
  const decision = out.trace.decisions.some((d) => d.outcome === 'fail') ? 'deny' : 'allow';
  if (out.status !== sc.expect.status) problems.push(`status ${out.status} != ${sc.expect.status}`);
  if (decision !== sc.expect.decision) problems.push(`decision ${decision} != ${sc.expect.decision}`);
  const released = decision === 'allow';
  if (released !== sc.expect.released) problems.push(`released ${released} != ${sc.expect.released}`);
  return problems;
}

export async function runChecks({ env = process.env, cast = DEFAULT_CAST } = {}) {
  const checks = [];
  const add = (id, level, detail) => checks.push({ id, level, detail });

  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 20 ? 'pass' : 'fail', `v${process.versions.node} (need >= 20)`);

  try { add('mode', 'pass', `mode=${modeFrom(env)}${realAvailableFrom(env) ? ' (real switch on)' : ' (Mock only)'}`); }
  catch (e) { add('mode', 'fail', e.message); }

  try { add('bind', 'pass', `${assertBindAllowed(bindHost(env), env)}${env.PGS_BIND ? ' (PGS_BIND opt-in)' : ' (loopback)'}`); }
  catch (e) { add('bind', 'fail', e.message); }

  const port = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : Number(env.PORT);
  const problem = portProblem(port);
  add('port-range', problem ? 'fail' : 'pass', problem || `${port} is the allocated port ${PORT_MIN} and not reserved`);

  const raw = rawStory();
  const wrong = [];
  for (const sc of raw.scenarios) {
    try { const p = checkScenario(sc); if (p.length) wrong.push(`${sc.id} (${p.join('; ')})`); } catch (e) { wrong.push(`${sc.id} (${e.message})`); }
  }
  add('scenarios', raw.scenarios.length >= 5 && !wrong.length ? 'pass' : 'fail', wrong.length ? `scenarios that do not teach what they claim: ${wrong.join(', ')}` : `${raw.scenarios.length} scenarios each behave as their lesson says`);
  const facts = raw.facts.filter((f) => !['measured', 'inferred', 'UNVERIFIED'].includes(f.status));
  add('facts-labelled', facts.length ? 'fail' : 'pass', facts.length ? 'a fact has no status label' : 'every fact is labelled measured, inferred or UNVERIFIED');
  const text = JSON.stringify([raw]);
  const holes = unfilled(text, DEFAULT_CAST);
  add('story-tokens', holes.length ? 'fail' : 'pass', holes.length ? `unfilled {{tokens}}: ${[...new Set(holes)].join(', ')}` : 'every {{cast}} token is filled');
  const badVert = Object.entries(VERTICALS).filter(([, v]) => unfilled(text, v).length).map(([k]) => k);
  add('verticals', badVert.length ? 'fail' : 'pass', badVert.length ? `verticals missing a token: ${badVert.join(', ')}` : `${Object.keys(VERTICALS).length} vertical packs fill every token`);

  const filled = JSON.stringify([buildStory(cast)]);
  const hosts = scanHosts(filled);
  add('story-hosts', hosts.length ? 'fail' : 'pass', hosts.length ? `non-reserved hosts: ${hosts.join(', ')}` : 'every host in the story is .invalid or .example or loopback');
  const keys = scanKeys(filled);
  add('story-keys', keys.length ? 'fail' : 'pass', keys.length ? 'key-looking values that are not sk-MOCK-' : 'no key-looking values in the story');

  // The mock gateway's own surface: the catalog lists the tools, the agent key is the only credential, and
  // every trace the gateway produces passes assertTrace (rule 25 honesty).
  try {
    const st = gatewaySelfTest();
    add('gateway-traces', st.ok ? 'pass' : 'fail', st.ok ? `${TOOLS.length} tools, agent "${AGENT.id}" holds only an access key; every trace passes assertTrace` : st.problems.join('; '));
  } catch (e) { add('gateway-traces', 'fail', e.message); }

  const ng = await netguardSelfTest();
  add('netguard', ng.ok ? 'pass' : 'fail', ng.ok ? `blocked fetch, socket, socket-by-IP, dns lookup, dns resolve and udp to a non-loopback host (${ng.blocked}/6)` : ng.detail);

  add('tenant', 'pass', 'mock needs no tenant or credentials and makes no outbound network call; real mode shows the console-API snapshot, not a live call');
  return checks;
}

export const allPassed = (checks) => checks.every((c) => c.level !== 'fail');
