import React, { useEffect, useState } from "react";
import GatewayTrace from "../gateway-trace/GatewayTrace.jsx";
import Json from "../components/JsonPane.jsx";
import { getJson, postJson } from "../api";

// The three gateway cards: in-scope secret, out-of-scope secret, and the tools/list control.
// Every call renders through the shared GatewayTrace (rule 25); the released payload goes through
// the shared JsonPane (rule 24). No agent key is sent to a trace: the mock key is shown because it
// is mock-issued and labelled (rule 4 exception).
export default function GatewayCards({ resetSignal }) {
  const [catalog, setCatalog] = useState(null);
  const [secret, setSecret] = useState("projects/demo/secrets/google-agent-credential");
  const [useWrongKey, setUseWrongKey] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const [released, setReleased] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => { getJson("/api/catalog").then(setCatalog, (e) => setError(e.message)); }, []);

  useEffect(() => { if (resetSignal) { setExchanges([]); setReleased(null); setStep(0); } }, [resetSignal]);

  if (error) return <p className="field-error" role="alert">Could not load the gateway catalog ({error}).</p>;
  if (!catalog) return <p className="muted">Loading…</p>;

  const key = useWrongKey ? "pak-not-the-registered-agent-key" : catalog.agent.accessKey;

  const call = async (path, payload, title) => {
    setBusy(true);
    setError(null);
    try {
      const { ok, status, body } = await postJson(path, payload);
      if (!ok) { setError(body.detail || body.message || body.error || `HTTP ${status}`); return; }
      setStep((n) => n + 1);
      setExchanges((xs) => [...xs, { step: xs.length + 1, title, status: body.status, trace: simplifyTrace(body.trace) }]);
      if (path !== "/api/gateway/tools-list") {
        const denied = body.trace.decisions.some((d) => d.id === "policy" && d.outcome === "fail");
        setReleased(denied ? null : parseReleased(body));
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const parseReleased = (body) => {
    const text = body?.body?.result?.content?.[0]?.text;
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { raw: text }; }
  };

  // The MCP envelope (jsonrpc/id/headers) is noise for this story: the trace's response pane shows
  // just what the tools/call answered — result.content[0] (type + text) on success, error.message on refusal.
  const simplifyTrace = (trace) => {
    if (!trace?.response) return trace;
    const body = trace.response.body;
    const simple = body?.error
      ? { error: body.error.message ?? body.error }
      : { content: (body?.result?.content ?? []).map((c) => ({ type: c?.type, text: c?.text })) };
    return { ...trace, response: { ...trace.response, body: simple } };
  };

  return (
    <div data-testid="gateway-cards">
      <div className="card" data-testid="agent-card">
        <h3>The agent</h3>
        <p>
          <strong>{catalog.agent.label}</strong> (<code>{catalog.agent.id}</code>) holds exactly one credential:{" "}
          <code data-testid="agent-key">{catalog.agent.accessKey}</code>
        </p>
        <p className="small muted">{catalog.agent.keyLabel}</p>
        <label className="check">
          <input type="checkbox" checked={useWrongKey} onChange={(e) => setUseWrongKey(e.target.checked)} data-testid="wrong-key" />
          Present a wrong key instead (the 401 control)
        </label>
      </div>

      <div className="card">
        <h3>Card 1 — get_google_secret (in scope)</h3>
        <p className="small muted">MCP tools/call against <code>{catalog.gatewayUrl}</code>. The default secret is on the agent key's grant: policy passes, the custodian releases it.</p>
        <label>Secret name
          <input value={secret} onChange={(e) => setSecret(e.target.value)} data-testid="secret-input" maxLength={120} list="known-secrets" />
        </label>
        <datalist id="known-secrets">{catalog.knownSecrets.map((s) => <option key={s} value={s} />)}</datalist>
        <p className="actions">
          <button type="button" disabled={busy} data-testid="call-in-scope" onClick={() => call("/api/gateway/get-google-secret", { secret, key }, "Gateway check: tools/call get_google_secret")}>Call gateway</button>
        </p>
      </div>

      <div className="card">
        <h3>Card 2 — get_google_billing_secret (out of scope)</h3>
        <p className="small muted">The same key asks for the billing secret. Policy refuses: <strong>the refusal is the product</strong>. Read the policy reason in the trace.</p>
        <p className="actions">
          <button type="button" disabled={busy} data-testid="call-out-of-scope" onClick={() => call("/api/gateway/get-billing-secret", { key }, "Gateway check: tools/call get_google_billing_secret (refused)")}>Call gateway (expect DENY)</button>
        </p>
      </div>

      <div className="card">
        <h3>tools/list (the grant, as the gateway reports it)</h3>
        <p className="small muted">What this key's grant exposes on this door — the two secret tools. No Google credential is involved at any point.</p>
        <p className="actions">
          <button type="button" disabled={busy} data-testid="call-tools-list" onClick={() => call("/api/gateway/tools-list", { key }, "Gateway check: tools/list")}>Call tools/list</button>
        </p>
      </div>

      {released && (
        <div className="card" data-testid="released">
          <h3>Released secret (MOCK, rule 4 exception)</h3>
          <p className="small muted">The custodian released this into the agent session. It is <strong>MOCK-issued and labelled</strong> — shown so the flow is legible, never a real credential.</p>
          <Json value={released} label="Released secret" testId="released-secret" hot={["name", "payload", "mock"]} />
        </div>
      )}

      {error && <p className="error" data-testid="gateway-error" role="alert">{error}</p>}

      <GatewayTrace exchanges={exchanges} source="mock" hot={[]} basisNote="Simulated: this lab's in-process gateway runs the checks in the same order, so these decisions are what it computed (checked). A real Privilege gateway reports no per-check detail — its trace may only say observed or inferred." />
    </div>
  );
}
