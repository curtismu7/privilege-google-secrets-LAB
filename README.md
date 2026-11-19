# Privilege Google Secrets LAB

Tier: Demo.
Repo: https://github.com/curtismu7/privilege-google-secrets-LAB

An AI agent needs a Google Secret Manager credential. It does not get one. It holds **only a Privilege agent access key** and asks the Hubs gateway over MCP (`tools/call`) for the secret. The gateway's policy decides: the in-scope secret is released by the Hubs custodian, the out-of-scope ask is refused with **Gateway Policy Denied — the refusal is the product**. Every call is shown per hop in the shared GatewayTrace.

Catalog id: to be assigned by the owner.

## What is simulated and what is measured

- **Measured (by other labs in the family, 2026-11):** the MCP JSON-RPC 2.0 wire (`initialize`, `tools/list`, `tools/call`) that real Privilege MCP doors speak, and the agent-key model (agent access key in the registry, per-agent grants, gateway refusals). This lab re-simulates that wire in-process.
- **Mock:** the Hubs gateway, the custodian and the Google Secret Manager are all in-process mocks. No Google API is called; the one released credential is **MOCK-issued and labelled** (rule 4 exception: shown so the flow is legible, never a real credential).
- **UNVERIFIED:** what the real Hubs gateway says when policy refuses, how the custodian orders a release, and how the product authorizes per secret. Every such claim is labelled UNVERIFIED on the Facts tab.

## What it teaches

1. **The key is an identity, not a key ring.** The agent access key identifies the agent to the gateway; it opens nothing by itself.
2. **In scope: allow, release.** `get_google_secret` on `projects/demo/secrets/google-agent-credential` passes policy and the custodian releases version 3 — masked, labelled MOCK.
3. **Out of scope: the refusal is the product.** The same key asking for `get_google_billing_secret` is refused at the policy step; the custodian step reads NOT REACHED and the secret never moved.
4. **The trace proves it.** Each call shows the request, the response and the decisions in between (key → policy → decision → custodian), each marked checked. Nothing secret goes in a trace; a wrong key is never echoed.
5. **Why this beats a static key.** No secret on the agent host to steal; policy per secret instead of all-or-nothing; an audit trail keyed to the agent.

## Run it

- Host: `./scripts/run.sh` (Node 26+), then open http://localhost:7827/.
- Docker (OrbStack): `HOST_PORT=7827 docker compose up --build -d`, published on `127.0.0.1` only.
- Through the shared lab-proxy: `https://local.ping-devops.com:8443/privilege-google-secrets/` once the route is registered.
- Tests: `npm ci && npm test` (server, web and packaging). Preflight: `npm run doctor`. Reset: `npm run reset`.
- **No live mode.** This lab contacts no gateway and no Google API in any mode (the netguard refuses every non-loopback socket). `PGS_MODE_REAL=1` in the lab's own `.env` only enables the rule-19 Real switch, and the page keeps its simulation banner. Real mode against the owner's existing Privilege gateway is owner-configured via `.env`, not shipped. `MODE` in `.env` forces the start mode; the header toggle (`POST /api/mode`, exactly `{source:"mock"|"real"}`, 409 with the reason) switches at runtime.

## Run from a clone

Prerequisites: Node 26 or newer. Docker (OrbStack) only for the Docker form. Mock needs no tenant and no credentials.

```
git clone https://github.com/curtismu7/privilege-google-secrets-LAB.git
cd privilege-google-secrets-LAB
npm ci
npm run build
npm run doctor
npm start
```

Open http://127.0.0.1:7827/. `GET /api/health` answers `demo-health/1`.

## What to do if the port is taken

```
Ports: privilege-google-secrets listens on 7827 only.
Docker publishes it on 127.0.0.1:7827 only.

If the port is taken:
1. Find what is using it:
   lsof -iTCP:7827 -sTCP:LISTEN -n -P
2. If it is an old copy of this lab (npm start), stop that process: kill <PID>.
   If it is this lab's container: docker compose down (from this folder).
3. If it is something else, stop it. The lab refuses any other port on purpose
   (one port per app; npm run doctor says so), so free 7827 rather than moving the lab.
4. Then start again: npm start, or docker compose up -d.
```

## Tabs

**Gateway** (the agent card with its MOCK-labelled key and the wrong-key control; the in-scope card, the out-of-scope card and the tools/list card; the released secret through the shared JsonPane; every call in the shared GatewayTrace), **Why not a static key** (the three beats plus the static-key counterfactual, as prose and as JSON), **Diagram** (ReactFlow, movable boxes, Simulate, Reset, speed control: one ask from agent to custodian), **Facts & Talk** (every claim with its measured/UNVERIFIED status, the five scenarios, the talk track). Presenter mode (key `P`) keeps the banner.

## Surface

`GET /api/catalog` (agent, key, tools, known secrets), `POST /api/gateway/tools-list`, `POST /api/gateway/get-google-secret` (`{secret?, key?}`), `POST /api/gateway/get-billing-secret` (`{key?}`), `GET /api/why-better`, `GET /api/scenarios`, `GET /api/diagram`, `GET /api/info`, `POST /api/mode`, `GET /api/runs`, `POST /api/reset`, `GET /api/health` (`demo-health/1`). Every visitor carries an `X-Workspace` id; runs are per workspace, and Reset clears them.

Safety: loopback bind only (plus `LAB_ALLOWED_HOSTS`), same-origin writes, bounded input, `nosniff`, read-only container filesystem, non-root, a network guard that refuses every non-loopback connection. See `docs/safety.md` and `docs/talk-track.md` (generated from the same data the UI reads).

## Attribution

The scaffold (server shell, safety, workspaces, diagram viewer, packaging) was copied from `intent-console-lab-LAB`; the Hubs-broker domain — mock gateway, policy, custodian, mock Google Secret Manager, UI — is this lab's own. Shared components (`top-menu`, `json/JsonPane`, `gateway-trace`) are vendored byte-for-byte from `AI-DEMO-Standalone/shared/` with sha256 pins. No code or identifier was imported from any other repo.
