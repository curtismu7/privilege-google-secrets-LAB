// The lab's own mock Privilege Hubs gateway + custodian + mock Google Secret Manager.
// Fully in-process, no network. The gateway speaks MCP JSON-RPC 2.0 (tools/list, tools/call) on
// `https://gateway.privilege.example/<app>/mcp`, and its policy decides which secrets a caller's
// grant allows. The custodian releases a secret only on an ALLOW, and the secret it releases is a
// MOCK-issued credential (rule 4 exception: shown, labelled mock, so the flow is legible).

import { mockTrace, assertTrace } from './gatewayTrace.js';

export const APP_ID = 'google-secrets-door';
export const GATEWAY_HOST = 'https://gateway.privilege.example';
export const GATEWAY_URL = `${GATEWAY_HOST}/${APP_ID}/mcp`;

// The mock Google Secret Manager: three secrets, only one in the agent's grant.
// The released credential is mock-issued and labelled as such (rule 4 exception).
const IN_SCOPE_SECRET = 'projects/demo/secrets/google-agent-credential';
const OUT_OF_SCOPE_SECRET = 'projects/demo/secrets/google-billing-credential';

const SECRETS = {
  [IN_SCOPE_SECRET]: {
    name: IN_SCOPE_SECRET,
    version: '3',
    payload: 'mock-gsk-google-credential-do-not-use-in-production',
    labels: { source: 'mock-google-secret-manager' },
  },
  [OUT_OF_SCOPE_SECRET]: {
    name: OUT_OF_SCOPE_SECRET,
    version: '1',
    payload: 'mock-gsk-billing-secret-outside-the-agents-grant',
    labels: { source: 'mock-google-secret-manager' },
  },
  'projects/demo/secrets/google-vault-root': {
    name: 'projects/demo/secrets/google-vault-root',
    version: '2',
    payload: 'mock-gsk-vault-root-never-granted-to-an-agent',
    labels: { source: 'mock-google-secret-manager' },
  },
};

// The one registered agent. Its access key is the only credential it holds (never a Google one).
export const AGENT = {
  id: 'research-agent',
  label: 'Research agent',
  accessKey: 'pak-mock-research-agent-key-000000000000',
  grant: {
    app: APP_ID,
    tools: ['get_google_secret'],
    secrets: [IN_SCOPE_SECRET],
  },
};

export const TOOLS = [
  {
    name: 'get_google_secret',
    description: 'Read one Google Secret Manager secret through the Hubs custodian.',
    inputSchema: { type: 'object', properties: { secret: { type: 'string', description: 'the full secret resource name' } }, required: ['secret'] },
  },
  {
    name: 'get_google_billing_secret',
    description: 'Read a billing secret. NOT in this agent\'s grant: the gateway refuses it.',
    inputSchema: { type: 'object', properties: { secret: { type: 'string' } }, required: ['secret'] },
  },
];

const nowIso = (now = Date.now) => new Date(now()).toISOString();

// The agent access key for display: the mock key is shown (rule 4: mock-issued, labelled), the wire
// never carries more than the length when a real key would be there.
export const agentKeyForDisplay = (key) => (key === AGENT.accessKey ? key : 'Bearer <agent key, kept on the server>');

// One tools/list. decisions: what the simulated gateway computed (basis "checked").
export function toolsList({ authorization, key = AGENT.accessKey, now } = {}) {
  const authOk = typeof authorization === 'string' && authorization === `Bearer ${AGENT.accessKey}`;
  const status = authOk ? 200 : 401;
  const body = authOk
    ? { jsonrpc: '2.0', id: 1, result: { tools: TOOLS } }
    : { jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'invalid agent access key' } };
  const decisions = authOk
    ? [
        { id: 'authenticated', label: 'Agent access key', outcome: 'pass', evidence: `the gateway recognised agent "${AGENT.id}" by its key (no Google credential is involved at any point)` },
        { id: 'grant', label: 'Grant', outcome: 'pass', evidence: `the key's grant lists ${TOOLS.length} tool: ${TOOLS.map((t) => t.name).join(', ')}` },
      ]
    : [
        { id: 'authenticated', label: 'Agent access key', outcome: 'fail', evidence: 'the key is not the registered agent key' },
        { id: 'grant', label: 'Grant', outcome: 'skipped', evidence: 'not reached: the caller was not accepted' },
      ];
  const t = mockTrace({ url: GATEWAY_URL, authorization: authOk ? agentKeyForDisplay(authorization) : authorization, rpc: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, status, body, decisions, record: authOk ? `mock-gateway: tools/list allowed for ${AGENT.id}` : `mock-gateway: tools/list rejected (bad key)`, });
  return { status, body, trace: t, at: nowIso(now) };
}

// One tools/call of get_google_secret. Policy: key -> tool grant -> secret scope -> custodian release.
// keyForDisplay lets a caller show a placeholder for the agent key it really holds; the trace never
// carries the raw key (rule 25).
export function getGoogleSecret({ secret, authorization, key = AGENT.accessKey, keyForDisplay = (k) => `Bearer <agent key, ${String(k ?? '').length} characters, kept on the server>`, now } = {}) {
  const rpc = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_google_secret', arguments: { secret: String(secret ?? '') } } };
  const recordBase = `mock-gateway: tools/call get_google_secret`;
  let status = 200;
  let body;
  const decisions = [];
  const add = (id, label, outcome, evidence) => decisions.push({ id, label, outcome, evidence });

  const authOk = typeof authorization === 'string' && authorization === `Bearer ${AGENT.accessKey}`;
  if (!authOk) {
    status = 401;
    body = { jsonrpc: '2.0', id: 2, error: { code: -32001, message: 'invalid agent access key' } };
    add('authenticated', 'Agent access key', 'fail', 'the key is not the registered agent key');
    add('policy', 'Secret policy', 'skipped', 'not reached: the caller was not accepted');
  } else {
    add('authenticated', 'Agent access key', 'pass', `the gateway recognised agent "${AGENT.id}" by its key`);
    const grantOk = TOOLS.some((t) => t.name === 'get_google_secret') && AGENT.grant.tools.includes('get_google_secret');
    const scopeOk = AGENT.grant.secrets.includes(String(secret ?? ''));
    if (!scopeOk) {
      const known = Object.hasOwn(SECRETS, String(secret ?? ''));
      body = { jsonrpc: '2.0', id: 2, result: { isError: true, content: [{ type: 'text', text: `Gateway Policy Denied: ${known ? `secret "${secret}" is outside agent "${AGENT.id}"'s grant` : `secret "${secret}" does not exist`}` }] } };
      add('policy', 'Secret policy', 'fail', known
        ? `the key's grant lists only ${AGENT.grant.secrets.join(', ')}; this secret is not on the list — the refusal is the product`
        : `no such secret in the mock Google Secret Manager`);
      add('custodian', 'Custodian release', 'skipped', 'not reached: the policy refused the call');
    } else {
      const s = SECRETS[String(secret)];
      body = { jsonrpc: '2.0', id: 2, result: { isError: false, content: [{ type: 'text', text: JSON.stringify({ name: s.name, version: s.version, payload: s.payload, labels: { ...s.labels, mock: true } }) }] } };
      add('policy', 'Secret policy', 'pass', `"${s.name}" is on the key's grant list (in scope)`);
      add('custodian', 'Custodian release', 'pass', `the Hubs custodian released ${s.name} version ${s.version} to the agent session (MOCK secret, labelled)`);
    }
  }
  const t = mockTrace({ url: GATEWAY_URL, authorization: authOk ? agentKeyForDisplay(authorization) : keyForDisplay(authorization), rpc, status, body, decisions, record: status === 401 ? `${recordBase} rejected (bad key)` : decisions.find((d) => d.id === 'policy').outcome === 'pass' ? `${recordBase} allowed — custodian released the secret` : `${recordBase} denied by policy` });
  return { status, body, trace: t, at: nowIso(now) };
}

// One tools/call of the out-of-scope billing tool: the story's key beat. Same chain, policy refuses.
export function getBillingSecret({ authorization, key = AGENT.accessKey, keyForDisplay = (k) => `Bearer <agent key, ${String(k ?? '').length} characters, kept on the server>`, now } = {}) {
  const rpc = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_google_billing_secret', arguments: { secret: OUT_OF_SCOPE_SECRET } } };
  const decisions = [];
  const authOk = typeof authorization === 'string' && authorization === `Bearer ${AGENT.accessKey}`;
  let status = 200;
  let body;
  if (!authOk) {
    status = 401;
    body = { jsonrpc: '2.0', id: 3, error: { code: -32001, message: 'invalid agent access key' } };
    decisions.push({ id: 'authenticated', label: 'Agent access key', outcome: 'fail', evidence: 'the key is not the registered agent key' });
    decisions.push({ id: 'policy', label: 'Secret policy', outcome: 'skipped', evidence: 'not reached: the caller was not accepted' });
  } else {
    decisions.push({ id: 'authenticated', label: 'Agent access key', outcome: 'pass', evidence: `the gateway recognised agent "${AGENT.id}" by its key` });
    decisions.push({ id: 'policy', label: 'Secret policy', outcome: 'fail', evidence: `"${OUT_OF_SCOPE_SECRET}" is outside agent "${AGENT.id}"'s grant — the agent asked for a billing secret it was never granted; the refusal is the product` });
    decisions.push({ id: 'custodian', label: 'Custodian release', outcome: 'skipped', evidence: 'not reached: the policy refused the call — the secret never left the custodian' });
    body = { jsonrpc: '2.0', id: 3, result: { isError: true, content: [{ type: 'text', text: `Gateway Policy Denied: ${OUT_OF_SCOPE_SECRET} is outside agent "${AGENT.id}"'s grant` }] } };
  }
  const t = mockTrace({ url: GATEWAY_URL, authorization: authOk ? agentKeyForDisplay(authorization) : keyForDisplay(authorization), rpc, status, body, decisions, record: status === 401 ? `mock-gateway: tools/call get_google_billing_secret rejected (bad key)` : `mock-gateway: tools/call get_google_billing_secret denied by policy — ${OUT_OF_SCOPE_SECRET} never released` });
  return { status, body, trace: t, at: nowIso(now) };
}

// The static-key comparison, third card section: what changes when the agent holds no secret.
export const WHY_BETTER = [
  { id: 'no-secret-in-agent', title: 'No secret in the agent', text: 'The agent holds only a Privilege agent access key. If the agent or its host is compromised, there is no Google credential to steal — the key opens nothing by itself.' },
  { id: 'policy-per-secret', title: 'Policy per secret', text: 'The gateway\'s policy decides per secret which agent may read it. A billing secret is out of scope for this agent even though the same key is presented; rotating or revoking one grant never touches the secret itself.' },
  { id: 'audit-trail', title: 'Audit trail', text: 'Every ask — allowed or refused — is a recorded gateway call with the agent identity, the secret, and the decision. With a static key in a config file, nobody sees who read what.' },
];

// A static-key control: the counterfactual the third section contrasts with.
export const STATIC_KEY_RISK = 'With a static Google credential pasted into the agent, every one of these three lines is worse: the secret sits on the agent host, every secret the key can read is readable, and the access log lives only in Google\'s own audit export, keyed to the credential rather than to the agent.';

// Self-test the doctor runs: every trace the mock gateway produces passes assertTrace.
export function gatewaySelfTest() {
  const bad = [];
  for (const r of [toolsList({ authorization: `Bearer ${AGENT.accessKey}` }), toolsList({ authorization: 'Bearer wrong' }), getGoogleSecret({ secret: IN_SCOPE_SECRET, authorization: `Bearer ${AGENT.accessKey}` }), getGoogleSecret({ secret: OUT_OF_SCOPE_SECRET, authorization: `Bearer ${AGENT.accessKey}` }), getGoogleSecret({ secret: IN_SCOPE_SECRET, authorization: 'Bearer wrong' }), getBillingSecret({ authorization: `Bearer ${AGENT.accessKey}` })]) {
    bad.push(...assertTrace(r.trace));
  }
  return { ok: bad.length === 0, problems: bad };
}
