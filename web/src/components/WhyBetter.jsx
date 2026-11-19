import React from "react";
import Json from "./JsonPane.jsx";

// The third card section: why brokering beats pasting a static Google credential into the agent.
export default function WhyBetter({ why }) {
  return (
    <div data-testid="why-better">
      <div className="card">
        <h3>Why this beats a static key</h3>
        <p className="small muted">The counterfactual: a Google credential pasted into the agent's config file.</p>
        <ol className="facts">
          {why.points.map((p) => (
            <li key={p.id} data-testid={`why-${p.id}`}><strong>{p.title}.</strong> {p.text}</li>
          ))}
        </ol>
        <p className="small muted" data-testid="static-key-risk">{why.staticKeyRisk}</p>
      </div>
      <div className="card">
        <h3>The contrast, as data</h3>
        <Json value={{ brokered: why.points.map((p) => ({ id: p.id, title: p.title })), staticKey: { location: "on the agent host", scope: "every secret the credential can read", audit: "keyed to the credential, exported, not per agent" } }} label="Static key vs brokered" testId="why-json" hot={["location", "scope", "audit"]} />
      </div>
    </div>
  );
}
