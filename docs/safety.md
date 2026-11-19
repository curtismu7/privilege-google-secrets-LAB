# Safety

- Loopback bind only (`PGS_BIND` is the explicit opt-in the container uses); the compose file publishes `127.0.0.1` only (a test pins it).
- Host header must be a loopback name (or one in `LAB_ALLOWED_HOSTS`); writes must be same-origin.
- Netguard blocks every non-loopback outbound connection (fetch, socket, DNS, UDP) with a self-test, and a test asserts zero attempts. This lab has NO live mode: it contacts no Hubs gateway and no Google API in any mode. `PGS_MODE_REAL=1` only enables the rule-19 Real switch, and the page keeps its simulation banner.
- Input is bounded and validated on every route: secret names `^projects/[a-z0-9-]{1,40}/secrets/[a-z0-9-]{1,60}$` (an invalid name falls back to the default, never echoed), keys `^[\w.-]{8,120}$`, JSON body cap (64 kb). No `eval`, `Function` or `vm` anywhere.
- Everything is rendered as React text through the lab's `visible()` guard (control and bidirectional characters shown as escapes); never `dangerouslySetInnerHTML`.
- Workspaces (rule 13) are capped in count and age; per workspace at most 20 recorded runs.
- Everything in mock mode is synthetic: hosts are `.example`/`.invalid` (`gateway.privilege.example`), the agent key is `pak-mock-…`, the released credential is `mock-gsk-…` and labelled MOCK (rule 4 exception: a mock-issued credential may be shown so the flow is legible; it is never a real credential). No real credential, key or token exists anywhere. `customer.config.json` only sets four display strings and is git-ignored.
- Traces (rule 25) never carry a raw agent key on a refusal; the wrong-key control's value is never echoed into any response.
- No tenant, credential or customer identifier ships. No real Google API, no real gateway host.
