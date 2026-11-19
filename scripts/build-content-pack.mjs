// Builds content-pack.json for the Learning Hub from the story data, so the pack cannot drift from the lab.
//   node scripts/build-content-pack.mjs        (writes content-pack.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CAST } from '../server/src/cast.js';
import { buildStory } from '../server/src/story.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

export function buildPack() {
  const story = buildStory(DEFAULT_CAST);
  const sid = (n) => `S${String(n).padStart(2, '0')}`;
  const terms = {
    'allow-in-scope': ['agent-key', 'custodian'], 'deny-out-of-scope': ['secret-policy'], 'deny-unknown-secret': ['secret-policy'],
    'deny-bad-key': ['agent-key'], 'static-key-contrast': ['static-key'],
  };
  return {
    schema: 'demo-content-pack/1',
    id: 'privilege-google-secrets',
    title: 'Privilege Google Secrets Lab',
    version,
    demo: { id: 'privilege-google-secrets', name: 'Privilege Google Secrets Lab', catalog: 'D0', baseUrl: 'http://localhost:7826', doctor: '/api/health', tags: ['pingone-privilege', 'ai-agent-security', 'agent-identity', 'secrets', 'mock-only'] },
    glossary: [
      { id: 'agent-key', term: 'Agent access key', definition: 'The one credential an AI agent holds in the Privilege model: it identifies the agent to the Hubs gateway and carries its per-secret grant. It is not a Google credential and opens nothing by itself.', aliases: ['agent access key'] },
      { id: 'secret-policy', term: 'Secret policy', definition: 'The Hubs gateway policy that decides, per secret, whether the presenting agent\'s key may read it. An out-of-scope ask is refused with Gateway Policy Denied — the refusal is the product.', aliases: ['policy'] },
      { id: 'custodian', term: 'Custodian', definition: 'The Hubs component that holds the secret and releases it into the agent session only on an ALLOW. A refused call never reaches it.', aliases: [] },
      { id: 'static-key', term: 'Static key', definition: 'The counterfactual: a Google credential pasted into the agent\'s config. It sits on the agent host, reads every secret it can name, and is audited per credential rather than per agent.', aliases: [] },
    ],
    sources: [
      { id: 'family-gateway', title: 'The family\'s measured Privilege MCP gateway wire (shared/gateway-real, privilege-demo, privilege-map)', url: 'https://gateway.privilege.example', kind: 'measured-elsewhere', use: 'The MCP tools/list + tools/call wire and the agent-key concept this lab simulates; measured live by other labs in 2026-11, re-simulated here in-process.', status: 'read', checked: '2026-11-19' },
      { id: 'google-secret-manager', title: 'Google Secret Manager resource naming', url: 'https://cloud.google.com/secret-manager', kind: 'standard', use: 'The secret resource-name shape (projects/*/secrets/*) in the mock store. No Google API is called.', status: 'not-read', checked: '2026-11-19' },
    ],
    cards: [
      ...story.scenarios.map((sc, i) => ({ id: `try-${sc.id}`, label: `Scenario ${i + 1}: ${sc.title}`, description: sc.lesson, group: 'try-it', action: { type: 'route', href: `/#${sc.id === 'static-key-contrast' ? 'why' : 'gateway'}` }, terms: terms[sc.id], story: sid(i + 1) })),
      { id: 'concept-gateway', label: 'Call the gateway', description: 'tools/call with the agent key: trace, decisions, release or refusal.', group: 'concept', action: { type: 'route', href: '/#gateway' }, terms: ['agent-key', 'secret-policy'] },
      { id: 'concept-why', label: 'Why not a static key', description: 'The three lines the broker beats the pasted credential on.', group: 'concept', action: { type: 'route', href: '/#why' }, terms: ['static-key'] },
      { id: 'ref-doctor', label: 'Doctor and health', description: 'Preflight checks and the demo-health/1 endpoint.', group: 'setup', action: { type: 'route', href: '/api/health' } },
    ],
    stories: story.scenarios.map((sc, i) => ({ id: sid(i + 1), title: sc.title, say: sc.lesson })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(ROOT, 'content-pack.json'), `${JSON.stringify(buildPack(), null, 2)}\n`);
}
