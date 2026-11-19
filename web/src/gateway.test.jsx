import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GatewayCards from "./components/GatewayCards.jsx";
import WhyBetter from "./components/WhyBetter.jsx";
import { setJsonView } from "./components/JsonPane.jsx";

const ALLOW = {
  status: 200,
  body: { jsonrpc: "2.0", id: 2, result: { isError: false, content: [{ type: "text", text: JSON.stringify({ name: "projects/demo/secrets/google-agent-credential", version: "3", payload: "mock-gsk-google-credential-do-not-use-in-production", labels: { mock: true } }) }] } },
  trace: { source: "mock", request: { method: "POST", url: "https://gateway.privilege.example/google-secrets-door/mcp", headers: { authorization: "Bearer <agent key>" }, body: { jsonrpc: "2.0", id: 2, method: "tools/call" } }, response: { status: 200, headers: {}, body: { jsonrpc: "2.0", id: 2 } }, decisions: [
    { id: "authenticated", label: "Agent access key", outcome: "pass", basis: "checked", evidence: "recognised" },
    { id: "policy", label: "Secret policy", outcome: "pass", basis: "checked", evidence: "in scope" },
    { id: "custodian", label: "Custodian release", outcome: "pass", basis: "checked", evidence: "released" },
  ], record: "allowed" },
  at: "2026-11-19T00:00:00Z",
};
const DENY = {
  status: 200,
  body: { jsonrpc: "2.0", id: 3, result: { isError: true, content: [{ type: "text", text: "Gateway Policy Denied: out of scope" }] } },
  trace: { source: "mock", request: { method: "POST", url: "https://gateway.privilege.example/google-secrets-door/mcp", headers: { authorization: "Bearer <agent key>" }, body: { jsonrpc: "2.0", id: 3, method: "tools/call" } }, response: { status: 200, headers: {}, body: { jsonrpc: "2.0", id: 3 } }, decisions: [
    { id: "authenticated", label: "Agent access key", outcome: "pass", basis: "checked", evidence: "recognised" },
    { id: "policy", label: "Secret policy", outcome: "fail", basis: "checked", evidence: "outside the grant" },
    { id: "custodian", label: "Custodian release", outcome: "skipped", basis: "checked", evidence: "not reached" },
  ], record: "denied by policy" },
  at: "2026-11-19T00:00:00Z",
};

const CATALOG = {
  gatewayUrl: "https://gateway.privilege.example/google-secrets-door/mcp",
  agent: { id: "research-agent", label: "Research agent", accessKey: "pak-mock-research-agent-key-000000000000", keyLabel: "MOCK agent access key" },
  tools: [{ name: "get_google_secret" }, { name: "get_google_billing_secret" }],
  knownSecrets: ["projects/demo/secrets/google-agent-credential", "projects/demo/secrets/google-billing-credential"],
};

function stubFetch(routes) {
  globalThis.fetch = vi.fn(async (url, init) => {
    const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    for (const [path, body] of Object.entries(routes)) if (url === path && (init?.method ?? "GET") === "POST") return json(body);
    if (url === "/api/catalog") return json(CATALOG);
    return json({}, 404);
  });
}

beforeEach(() => setJsonView("raw"));
afterEach(() => cleanup());

describe("GatewayCards", () => {
  it("the in-scope call releases the labelled MOCK secret and shows the trace", async () => {
    stubFetch({ "/api/gateway/get-google-secret": ALLOW });
    const user = userEvent.setup();
    render(<GatewayCards />);
    await user.click(await screen.findByTestId("call-in-scope"));
    const released = await screen.findByTestId("released-secret");
    expect(released).toHaveTextContent("mock-gsk-google-credential");
    const trace = screen.getByTestId("gateway-trace");
    expect(trace).toHaveTextContent("Custodian release");
    expect(trace).toHaveTextContent("all 3 decisions passed");
  });

  it("the out-of-scope call shows the policy refusal and no released secret", async () => {
    stubFetch({ "/api/gateway/get-billing-secret": DENY });
    const user = userEvent.setup();
    render(<GatewayCards />);
    await user.click(await screen.findByTestId("call-out-of-scope"));
    expect(await screen.findByTestId("gateway-trace")).toHaveTextContent("refused at: Secret policy");
    expect(screen.queryByTestId("released")).toBeNull();
    const decisions = screen.getByTestId("trace-1-decisions");
    expect(within(decisions).getByText("NOT REACHED")).toBeInTheDocument();
  });

  it("the agent card shows the mock-labelled key and the wrong-key control", async () => {
    stubFetch({});
    render(<GatewayCards />);
    const key = await screen.findByTestId("agent-key");
    expect(key).toHaveTextContent("pak-mock-research-agent-key-000000000000");
    expect(screen.getByTestId("wrong-key")).not.toBeChecked();
  });
});

describe("WhyBetter", () => {
  it("names the three beats and the static-key risk", async () => {
    render(<WhyBetter why={{ points: [
      { id: "no-secret-in-agent", title: "No secret in the agent", text: "nothing to steal" },
      { id: "policy-per-secret", title: "Policy per secret", text: "per-secret grant" },
      { id: "audit-trail", title: "Audit trail", text: "keyed to the agent" },
    ], staticKeyRisk: "With a static Google credential pasted into the agent, every one of these three lines is worse." }} />);
    for (const id of ["why-no-secret-in-agent", "why-policy-per-secret", "why-audit-trail"]) expect(screen.getByTestId(id)).toBeInTheDocument();
    expect(screen.getByTestId("static-key-risk")).toHaveTextContent(/static Google credential/);
  });
});
