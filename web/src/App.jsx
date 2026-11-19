import React, { useCallback, useEffect, useState } from "react";
import TopMenu from "./top-menu/TopMenu.jsx";
import Banner from "./components/Banner.jsx";
import GatewayCards from "./components/GatewayCards.jsx";
import WhyBetter from "./components/WhyBetter.jsx";
import DiagramTab from "./components/DiagramTab.jsx";
import TalkTrack from "./components/TalkTrack.jsx";
import VerifyMark from "./components/VerifyMark.jsx";
import { workspaceId } from "./workspace";

const TABS = [
  { id: "gateway", label: "Gateway" },
  { id: "why", label: "Why not a static key" },
  { id: "diagram", label: "Diagram" },
  { id: "facts", label: "Facts & Talk" },
];

export default function App() {
  const [tab, setTab] = useState("gateway");
  const [story, setStory] = useState(null);
  const [info, setInfo] = useState(null);
  const [why, setWhy] = useState(null);
  const [error, setError] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [present, setPresent] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [theme, setTheme] = useState(() => (localStorage.getItem("theme") || "auto"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const loadAll = useCallback(async () => {
    try {
      const [s, i, w] = await Promise.all([
        fetch("/api/scenarios").then((r) => r.json()),
        fetch("/api/info").then((r) => r.json()),
        fetch("/api/why-better").then((r) => r.json()),
      ]);
      setStory(s); setInfo(i); setWhy(w);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Presenter mode exits on Escape (the key hint says so).
  useEffect(() => {
    if (!present) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setPresent(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [present]);

  const reset = async () => {
    await fetch("/api/reset", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setResetSignal((n) => n + 1);
    await loadAll();
  };

  const setMode = async (source) => {
    const r = await fetch("/api/mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source }) });
    if (r.ok) setInfo((i) => ({ ...i, mode: source, source }));
    return r.ok;
  };

  if (error && !story) return <p className="app-error">The lab could not start: {error}</p>;
  if (!story || !why) return <p className="muted">Loading…</p>;

  return (
    <div className={present ? "app app--presenter" : "app"}>
      <header className="shell-bar">
        <span className="shell-brand">
          <span className="shell-logo">AI</span>
          Privilege Google Secrets Lab
          <span className={`shell-badge ${info?.mode === "real" ? "shell-badge--real" : ""}`} data-testid="mode-badge">{info?.mode ?? "…"}</span>
        </span>
        <nav className="shell-nav" aria-label="Tabs">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} aria-current={tab === t.id ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(t.id); }}>{t.label}</a>
          ))}
        </nav>
        <TopMenu
          mode={{ value: info?.mode ?? "mock", onChange: setMode, realAvailable: info?.realAvailable, realHint: info?.realHint }}
          theme={{ value: theme, onChange: setTheme }}
          present={{ active: present, onToggle: () => setPresent((p) => !p) }}
          talkTrack={{ active: talkOpen, onToggle: () => setTalkOpen((t) => !t) }}
          onReset={reset}
          version={info?.version ? `v${info.version}` : undefined}
        >
          <VerifyMark id="privilege-google-secrets" />
        </TopMenu>
      </header>
      <main className="page">
        <Banner story={story} mode={info?.mode} />
        <p className="keys">Workspace {workspaceId()} · everything simulated · no tenant, no outbound network</p>
        {tab === "gateway" && <section data-testid="tab-gateway"><GatewayCards resetSignal={resetSignal} /></section>}
        {tab === "why" && <section data-testid="tab-why"><WhyBetter why={why} /></section>}
        {tab === "diagram" && <DiagramTab vertical="retail" resetSignal={resetSignal} />}
        {tab === "facts" && (
          <section data-testid="tab-facts">
            <div className="panel">
              <h2>Facts — what is measured, what is not</h2>
              <ul className="facts">
                {story.facts.map((f) => (
                  <li key={f.id}>
                    <span className={`tag ${f.status === "measured" ? "tag--ok" : f.status === "UNVERIFIED" ? "tag--warn" : ""}`}>{f.status}</span> {f.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h2>Scenarios</h2>
              <ol className="facts">
                {story.scenarios.map((sc) => <li key={sc.id}><strong>{sc.title}.</strong> {sc.lesson}</li>)}
              </ol>
            </div>
            {talkOpen && <div className="panel"><h2>Talk track</h2><TalkTrack talk={story.talkTrack.map((t, i) => ({ ...t, id: i }))} /></div>}
          </section>
        )}
      </main>
    </div>
  );
}
