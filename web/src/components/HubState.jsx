import React, { useEffect, useState } from "react";
import { getJson } from "../api";

// The owner's real Privilege Secrets Hub tenant state (rule 19 Real mode): a redacted console-API
// export snapshot, labelled with its snapshotDate. Rendered on the Gateway tab above the MCP cards
// only when the runtime mode is real; mock shows a one-line switch hint. Theme tokens only.
export default function HubState({ source }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getJson("/api/hub-state").then(setState, (e) => setError(e.message));
  }, [source]);

  if (source !== "real") {
    return (
      <p className="pgs-section-lead" data-testid="hub-state-hint">
        Switch to Real to see the owner's actual tenant state (console export 2026-11-17).
      </p>
    );
  }
  if (error) return <p className="field-error" role="alert">Could not load the hub state ({error}).</p>;
  if (!state) return <p className="muted">Loading…</p>;

  const { snapshot, snapshotDate } = state;
  const { hub, secrets, grant } = snapshot || {};

  return (
    <section className="pgs-section" data-testid="hub-state" aria-labelledby="pgs-h-hub">
      <h2 id="pgs-h-hub"><span className="step-num" aria-hidden="true">0</span>The real tenant state{snapshotDate ? ` — console export ${snapshotDate}` : ""}</h2>
      <p className="pgs-section-lead">
        This section is <strong>measured, not simulated</strong>: the owner's actual Privilege Secrets Hub, exported through the
        console API{snapshotDate ? ` on ${snapshotDate}` : ""}. No credentials are shown. The MCP broker cards below stay a
        simulation in both modes — only this section is real data.
      </p>

      {hub && (
        <div className="card" data-testid="hub-card">
          <h3>Hub — {hub.name}</h3>
          <dl className="kv" data-testid="hub-kv">
            <dt>Name</dt><dd><code>{hub.name}</code></dd>
            <dt>Display name</dt><dd>{hub.displayName}</dd>
            <dt>Provider</dt><dd>{hub.provider}</dd>
            <dt>Project</dt><dd><code>{hub.projectId}</code></dd>
            <dt>Account type</dt><dd>{hub.accountType}</dd>
            <dt>Created</dt><dd>{hub.createdAt}</dd>
            <dt>Last sync</dt><dd>{hub.lastSync}</dd>
            <dt>Service-account roles</dt>
            <dd>
              <ul>{(hub.roles || []).map((r) => <li key={r}><code>{r}</code></li>)}</ul>
            </dd>
          </dl>
        </div>
      )}

      {secrets?.length > 0 && (
        <div className="card" data-testid="secrets-card">
          <h3>Secrets visible in Privilege ({secrets.length})</h3>
          <table className="logtable" data-testid="secrets-table">
            <thead>
              <tr><th scope="col">ID</th><th scope="col">GCP resource path</th></tr>
            </thead>
            <tbody>
              {secrets.map((s) => (
                <tr key={s.id}><td>{s.id}</td><td><code>{s.path}</code></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grant && (
        <div className="card" data-testid="grant-card">
          <h3>Grant — {grant.name}</h3>
          <dl className="kv" data-testid="grant-kv">
            <dt>Permission</dt><dd>{grant.permission}</dd>
            <dt>Covers</dt><dd><code>{grant.coversSecret}</code> (<code>{grant.coversPath}</code>)</dd>
            <dt>Granted to</dt><dd>{(grant.grantedTo || []).length} users and groups</dd>
            <dt>Time-boxed</dt>
            <dd>
              <span className={`tag ${grant.timeBoxed ? "tag--ok" : "tag--warn"}`} data-testid="grant-timeboxed">
                {grant.timeBoxed ? "yes — expires" : "no — long-lived until 2027-06-04"}
              </span>
            </dd>
            <dt>Created</dt><dd>{grant.createdAt}</dd>
          </dl>
        </div>
      )}

      <p className="small muted">Snapshot date: {snapshotDate || "unknown"} · measured via the console API, redacted — no secret values, no credentials.</p>
    </section>
  );
}
