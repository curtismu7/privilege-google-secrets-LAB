// All page text in one place. Facts carry a status: measured (we did it on a real system), inferred
// (the doc says it, we saw consistent evidence) or UNVERIFIED (we never tested it). A doctor check fails
// on any fact with no status, and on any scenario that does not teach what it says it teaches.
export const TITLE = 'Privilege Google Secrets Lab';
export const INTRO = 'An AI agent needs a Google Secret Manager credential. It does not get one: it holds only a Privilege agent access key, and asks the Hubs gateway over MCP for the secret. The gateway\'s policy decides — an in-scope secret is released by the Hubs custodian, an out-of-scope ask is refused with Gateway Policy Denied. This lab simulates the whole broker chain in-process.';
export const BANNER = 'SIMULATION: mock Privilege Hubs gateway, mock custodian and mock Google Secret Manager, all in-process — no tenant, no outbound network. The one released secret is MOCK-issued and labelled (rule 4 exception, shown so the flow is legible). For education.';
export const REAL_BANNER = 'REAL MODE: the hub-state section shows the owner\'s actual Privilege Secrets Hub tenant state (a redacted console-API export snapshot). The MCP broker cards below stay a simulation in both modes — no live Hubs gateway, custodian or Google Secret Manager is contacted.';

export const PRODUCTS = [
  { id: 'agent-key', name: 'Agent access key', blurb: 'The only credential the agent holds' },
  { id: 'gateway', name: 'Hubs gateway (MCP)', blurb: 'tools/list + tools/call, policy in between' },
  { id: 'policy', name: 'Secret policy', blurb: 'Per-secret grant on the key' },
  { id: 'custodian', name: 'Custodian', blurb: 'Releases the secret on an ALLOW only' },
  { id: 'gsm', name: 'Google Secret Manager', blurb: 'Mock store of three secrets' },
];

export const FACTS = [
  { id: 'concept', status: 'measured', text: 'The Privilege agent-key model (agent access key in the Agent Registry, per-agent grants, gateway refusals) is the family concept shown in the privilege-demo and privilege-map labs; this lab rebuilds the shape as a mock gateway.' },
  { id: 'mcp-wire', status: 'measured', text: 'The gateway speaks MCP JSON-RPC 2.0 (initialize, tools/list, tools/call) — the wire the family\'s real-gateway hop (shared/gateway-real) measured live against Privilege MCP doors, 2026-11.' },
  { id: 'mock-gsm', status: 'measured', text: 'The Google Secret Manager here is a mock: three in-process secrets with resource names like projects/demo/secrets/google-agent-credential. No Google API is called; the released credential is MOCK-issued and labelled.' },
  { id: 'trace-honesty', status: 'measured', text: 'Every trace labels its decisions checked (the lab\'s simulated gateway computed them) — a real Privilege gateway reports no per-check detail, so a real trace may only say observed or inferred (shared/gateway-trace rule 25).' },
  { id: 'no-redaction-need', status: 'measured', text: 'No trace ever carries the raw agent key on a refusal path; the mock agent key is shown on the happy path only because it is mock-issued and labelled (rule 4).' },
  { id: 'hubs-behaviour', status: 'UNVERIFIED', text: 'What the real Hubs gateway says when policy refuses, how the custodian orders the release, and how the policy authorizes per secret in the product are UNVERIFIED. The lab states its own reading on every trace step.' },
  { id: 'masked-display', status: 'UNVERIFIED', text: 'How the product masks a released secret in its own UI is UNVERIFIED; this lab masks to a prefix and always shows the full payload in the JSON pane so the mock is legible.' },
];

export const SCENARIOS = [
  {
    id: 'allow-in-scope',
    title: 'An in-scope secret is released',
    lesson: 'The agent presents its key and asks for projects/demo/secrets/google-agent-credential. Policy: the secret is on the key\'s grant. Custodian: releases version 3 into the session. The payload is MOCK-issued and labelled.',
    steps: ['Press Call gateway on the get_google_secret card.', 'Read the trace: key recognised → policy pass → custodian release.', 'The released payload shows in the JSON pane, labelled MOCK.'],
    run: { tool: 'get_google_secret', secret: 'projects/demo/secrets/google-agent-credential' },
    expect: { status: 200, decision: 'allow', released: true },
  },
  {
    id: 'deny-out-of-scope',
    title: 'An out-of-scope secret is refused — the refusal is the product',
    lesson: 'The same key asks for the billing secret. Policy: not on the grant list. Gateway Policy Denied, custodian never reached, and the refusal is recorded with the agent\'s identity.',
    steps: ['Press Call gateway on the get_google_billing_secret card.', 'Read the trace: policy FAIL — the secret is outside the grant.', 'The refusal names the reason; the secret never left the custodian.'],
    run: { tool: 'get_google_billing_secret', secret: 'projects/demo/secrets/google-billing-credential' },
    expect: { status: 200, decision: 'deny', released: false },
  },
  {
    id: 'deny-unknown-secret',
    title: 'An unknown secret is refused too',
    lesson: 'A secret that does not exist in the mock store is refused as "no such secret" — and the refusal shape is the same as the out-of-scope one: the agent learns nothing about what does exist.',
    steps: ['Pick get_google_secret with a made-up secret name.', 'Policy FAIL: no such secret in the mock store.', 'Same refusal surface, same audit line.'],
    run: { tool: 'get_google_secret', secret: 'projects/demo/secrets/does-not-exist' },
    expect: { status: 200, decision: 'deny', released: false },
  },
  {
    id: 'deny-bad-key',
    title: 'A wrong key gets nothing at all',
    lesson: 'Present a key that is not the registered agent key and the gateway refuses at the identity step: 401, policy not reached, no information about the policy beyond the fact of the refusal.',
    steps: ['Switch the caller to the "wrong key" control.', 'Call either tool.', '401 at the key step; policy shows NOT REACHED.'],
    run: { tool: 'get_google_secret', secret: 'projects/demo/secrets/google-agent-credential', key: 'wrong' },
    expect: { status: 401, decision: 'deny', released: false },
  },
  {
    id: 'static-key-contrast',
    title: 'Why this beats a static key',
    lesson: 'Three lines: no secret in the agent (nothing to steal from the agent host), policy per secret (the same key cannot read everything it can name), and an audit trail keyed to the agent rather than to a shared credential.',
    steps: ['Read the "why this beats a static key" section.', 'Compare with the static-key counterfactual.', 'Every refused call above is a line the static key would never have produced.'],
    run: { tool: 'get_google_secret', secret: 'projects/demo/secrets/google-agent-credential' },
    expect: { status: 200, decision: 'allow', released: true },
  },
];

export const TALK_TRACK = [
  { title: 'The story in one line', say: 'An AI agent that needs a Google credential should never hold one. It holds a Privilege agent access key and asks the Hubs gateway; policy decides per secret whether the ask is allowed.' },
  { title: 'The key is an identity, not a key ring', say: 'The agent access key identifies the agent to the gateway. It opens nothing by itself: every ask goes through policy, and the policy lists which secrets this agent may read.' },
  { title: 'The refusal is the product', say: 'The demo\'s key beat is the second card: the same key asking for a billing secret is refused with Gateway Policy Denied. Show the trace — the custodian step reads NOT REACHED, the secret never moved.' },
  { title: 'What the trace proves', say: 'Every call shows the request, the response, and the decisions in between: key recognised, policy evaluated, decision, custodian release on an allow. Nothing secret goes in the trace; the one shown payload is a mock credential, labelled.' },
  { title: 'Why this beats a static key', say: 'No secret on the agent host to steal. Policy per secret instead of all-or-nothing. An audit trail keyed to the agent. With a static credential pasted in a config file, all three lines are worse.' },
  { title: 'Honesty', say: 'Everything here is a simulation: mock gateway, mock custodian, mock Google Secret Manager, mock-issued secret labelled MOCK. What the real product does with these shapes is labelled UNVERIFIED on the Facts tab.' },
];

export const rawStory = () => ({ title: TITLE, intro: INTRO, banner: BANNER, realBanner: REAL_BANNER, products: PRODUCTS, facts: FACTS, scenarios: SCENARIOS, talkTrack: TALK_TRACK });

// The story with the cast filled in. {{cast}} tokens still work (rule 10) even though the text
// currently uses none; a doctor check fails on any unfilled token if text gains one.
import { fillDeep } from './cast.js';
export function buildStory(cast) {
  const s = rawStory();
  return { ...fillDeep(s, cast), tokenLabel: 'MOCK secrets and MOCK identifiers: for education, never real product output', cast };
}

// docs/talk-track.md is generated from the same data the UI reads (`npm run talk-track`); a test fails if they drift.
export function renderTalkTrackMarkdown(cast) {
  const s = buildStory(cast);
  const parts = ['# Talk track', '', '<!-- Generated from server/src/story.js by `npm run talk-track`. Do not edit by hand. -->', ''];
  for (const t of s.talkTrack) parts.push(`## ${t.title}`, '', t.say, '');
  parts.push('## The scenarios', '');
  s.scenarios.forEach((sc, i) => parts.push(`${i + 1}. **${sc.title}.** ${sc.lesson}`));
  return `${parts.join('\n')}\n`;
}
export { SCENARIOS as RAW_SCENARIOS };
