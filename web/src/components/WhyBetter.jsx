import React from "react";
import Json from "./JsonPane.jsx";

// The third card section: why brokering beats pasting a static Google credential into the agent.
export default function WhyBetter({ why }) {
  return (
    <div data-testid="why-better">
      <section className="pgs-section" aria-labelledby="pgs-h-why">
        <h2 id="pgs-h-why">The counterfactual: what teams do today</h2>
        <p className="pgs-section-lead">
          Most agents that need Google access get a service-account key pasted into a config file or an env var.
          Whoever holds that file holds everything it can read, for as long as it exists, with no per-agent trail.
          The three points below are what brokering changes — each one maps to something you saw on the Gateway tab.
        </p>
        <div className="card">
          <h3>Why this beats a static key</h3>
          <ol className="facts">
            {why.points.map((p) => (
              <li key={p.id} data-testid={`why-${p.id}`}><strong>{p.title}.</strong> {p.text}</li>
            ))}
          </ol>
          <p className="small muted" data-testid="static-key-risk">{why.staticKeyRisk}</p>
        </div>
      </section>
      <section className="pgs-section" aria-labelledby="pgs-h-contrast">
        <h2 id="pgs-h-contrast">Side by side</h2>
        <p className="pgs-section-lead">
          The same access, modeled as data: where the credential lives, how much it can read, and what the audit trail is keyed to.
        </p>
        <div className="card">
          <h3>The contrast, as data</h3>
          <Json value={{ brokered: why.points.map((p) => ({ id: p.id, title: p.title })), staticKey: { location: "on the agent host", scope: "every secret the credential can read", audit: "keyed to the credential, exported, not per agent" } }} label="Static key vs brokered" testId="why-json" hot={["location", "scope", "audit"]} />
        </div>
      </section>
    </div>
  );
}
