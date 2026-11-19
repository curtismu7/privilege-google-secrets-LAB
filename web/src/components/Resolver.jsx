import React from "react";
import Json from "./Json.jsx";

// The resolution probe: action text in, the decision trail out. Shows the app's config (IntentIDs +
// encoder), the per-intent scores, and the hops with the lab's own reading of each step.
export default function Resolver({ intents, config, onConfigChange }) {
  const [action, setAction] = React.useState("move 200 dollars from checking to savings");
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const selected = config.IntentIDs ?? [];
  const toggle = (name) => {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
    onConfigChange({ ...config, IntentIDs: next });
  };
  const setFailClosed = (v) => onConfigChange({ ...config, Encoder: { ...config.Encoder, FailClosed: v } });

  const run = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!r.ok) setError(j.detail || j.error || `HTTP ${r.status}`);
      else setResult(j);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="resolver">
      <div className="card">
        <h3>The application's intent policy (modelAIIntentConfig)</h3>
        <p className="small muted">Which intents this app selects, and the encoder sidecar settings. Empty selection = no intent resolution: fail-closed denies everything (no "empty means all").</p>
        <div className="config-row">
          <fieldset className="config-intents" data-testid="config-intents">
            <legend>IntentIDs</legend>
            {(intents ?? []).map((i) => {
              const name = i.ObjectMeta.Name;
              return (
                <label key={name} className="check">
                  <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} data-testid={`config-intent-${name}`} />
                  {name}
                </label>
              );
            })}
          </fieldset>
          <div className="config-encoder" data-testid="config-encoder">
            <p>Encoder: <code>{config.Encoder?.URL}</code></p>
            <p>Timeout: {config.Encoder?.TimeoutMS} ms</p>
            <label className="check">
              <input type="checkbox" checked={config.Encoder?.FailClosed !== false} onChange={(e) => setFailClosed(e.target.checked)} data-testid="config-failclosed" />
              FailClosed — deny when nothing matches (off = fail-open)
            </label>
          </div>
        </div>
      </div>

      <form className="card" onSubmit={run}>
        <h3>Resolve one agent action</h3>
        <label>Action text
          <textarea value={action} onChange={(e) => setAction(e.target.value)} rows={2} maxLength={2000} data-testid="action-input" />
        </label>
        <p className="actions"><button type="submit" disabled={busy} data-testid="resolve-run">Resolve</button></p>
      </form>

      {error && <p className="error" data-testid="resolve-error">{error}</p>}
      {result && (
        <div className="card" data-testid="resolve-result">
          <p className={`decision decision-${result.decision}`} data-testid="resolve-decision">
            {result.decision.toUpperCase()}
            {result.matched && <> — intent <strong>{result.matched}</strong></>}
            {" "}({result.reason})
          </p>
          {result.scores && (
            <table className="score-table" data-testid="resolve-scores">
              <thead><tr><th>Intent</th><th>Score</th><th>Floor</th><th>Over?</th></tr></thead>
              <tbody>
                {result.scores.map((s) => (
                  <tr key={s.name} className={s.score >= s.floor ? "over" : "under"}>
                    <td>{s.name}</td><td>{s.score.toFixed(3)}</td><td>{s.floor}</td><td>{s.score >= s.floor ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ol className="hop-list" data-testid="resolve-hops">
            {result.hops.map((h) => (
              <li key={h.n}>
                <strong>{h.from} → {h.to}</strong>: {h.label}
                {h.decision && h.decision !== "-" && <span className={`chip ${h.decision.startsWith("deny") ? "chip-deny" : "chip-ok"}`}>{h.decision}</span>}
              </li>
            ))}
          </ol>
          <details>
            <summary>Raw result (JSON)</summary>
            <Json value={result} hot={["decision", "matched", "reason"]} />
          </details>
          <p className="small muted">Every step's reading is this lab's own: how the product weighs Floors, Twins, Acts and FailClosed is UNVERIFIED. The trail states what the lab did, not what the product does.</p>
        </div>
      )}
    </div>
  );
}
