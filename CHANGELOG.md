# Changelog

## 0.1.0 (2026-11-19)

- New lab: Privilege Hubs brokering a Google Secret Manager credential to an AI agent. The agent holds only a Privilege agent access key; the mock Hubs gateway speaks MCP JSON-RPC 2.0 (`tools/list`, `tools/call`), its policy allows the in-scope secret and refuses the out-of-scope ask with Gateway Policy Denied — the refusal is the product.
- Mock gateway + custodian + mock Google Secret Manager, all in-process (zero outbound network, netguard-enforced). The one released credential is MOCK-issued and labelled (rule 4 exception, shown so the flow is legible).
- Three gateway cards: in-scope `get_google_secret` (allow + custodian release), out-of-scope `get_google_billing_secret` (deny, custodian NOT REACHED), and `tools/list` (the grant as the gateway reports it). A wrong-key control drives the 401 beat.
- Every call renders in the shared GatewayTrace (rule 25, vendored with a sha256 pin); every decision says `checked`; `assertTrace` gates every trace in tests.
- "Why this beats a static key" tab: no secret in the agent, policy per secret, audit trail — plus the static-key counterfactual.
- Five doctor-checked scenarios; the diagram is diagram-studio/1 data (rule 17) with Simulate, Reset and speed control.
- No live mode by design: the lab contacts no gateway and no Google API in any mode; `PGS_MODE_REAL=1` only enables the rule-19 Real switch, and the page keeps its simulation banner.
- Port 7827 (one port, from the shelf allocator, 2026-11-19). Catalog id to be assigned by the owner.
