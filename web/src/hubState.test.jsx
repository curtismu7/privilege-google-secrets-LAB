import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import HubState from "./components/HubState.jsx";
import { setJsonView } from "./components/JsonPane.jsx";

const SNAPSHOT = {
  hub: {
    name: "GCP-hub-secrets", provider: "GCP", displayName: "Privilege Hub Test",
    projectId: "privilege-hub-test-643070", accountType: "project", createdAt: "2026-10-04",
    lastSync: "2026-11-17 05:23 UTC", roles: ["roles/secretmanager.admin", "roles/secretmanager.viewer"],
  },
  secrets: [
    { id: "groq-key", path: "projects/839155367094/secrets/groq-key", provider: "GCP" },
    { id: "privilege-hub-test", path: "projects/839155367094/secrets/privilege-hub-test", provider: "GCP" },
  ],
  grant: {
    name: "YukonRiver-416146713043", permission: "Read + Write", coversSecret: "privilege-hub-test",
    coversPath: "projects/839155367094/secrets/privilege-hub-test",
    grantedTo: ["a@example.com", "b@example.com"], timeBoxed: false, createdAt: "2026-10-04",
  },
  snapshotDate: "2026-11-17",
};

function stubFetch(hubPayload, status = 200) {
  globalThis.fetch = vi.fn(async () => ({ ok: status < 400, status, json: async () => hubPayload }));
}

beforeEach(() => setJsonView("raw"));
afterEach(() => cleanup());

describe("HubState", () => {
  it("in mock mode shows only the one-line switch hint and never fetches the snapshot data onto the page", async () => {
    stubFetch({ source: "mock", snapshot: SNAPSHOT, snapshotDate: "2026-11-17" });
    render(<HubState source="mock" />);
    expect(await screen.findByTestId("hub-state-hint")).toHaveTextContent(/Switch to Real/);
    expect(screen.queryByTestId("hub-state")).toBeNull();
    expect(screen.queryByText("GCP-hub-secrets")).toBeNull();
  });

  it("in real mode renders the hub KvList, the secrets table and the grant with the snapshot date", async () => {
    stubFetch({ source: "real", snapshot: SNAPSHOT, snapshotDate: "2026-11-17" });
    render(<HubState source="real" />);
    const section = await screen.findByTestId("hub-state");
    expect(section).toHaveTextContent(/console export 2026-11-17/);

    const kv = within(screen.getByTestId("hub-kv"));
    expect(kv.getByText("GCP-hub-secrets")).toBeInTheDocument();
    expect(kv.getByText("privilege-hub-test-643070")).toBeInTheDocument();
    expect(kv.getByText("2026-11-17 05:23 UTC")).toBeInTheDocument();
    expect(kv.getByText("roles/secretmanager.admin")).toBeInTheDocument();

    const table = within(screen.getByTestId("secrets-table"));
    expect(table.getByText("groq-key")).toBeInTheDocument();
    expect(table.getByText("projects/839155367094/secrets/privilege-hub-test")).toBeInTheDocument();

    const grantCard = within(screen.getByTestId("grant-card"));
    expect(grantCard.getByText((_, el) => el?.tagName === "H3" && el.textContent === "Grant — YukonRiver-416146713043")).toBeInTheDocument();
    const grant = within(screen.getByTestId("grant-kv"));
    expect(grant.getByText("Read + Write")).toBeInTheDocument();
    expect(grant.getByText("2 users and groups")).toBeInTheDocument();
    expect(screen.getByTestId("grant-timeboxed")).toHaveTextContent(/no — long-lived/);
  });

  it("in real mode a failed hub-state call shows a named error, never a blank pane", async () => {
    stubFetch({ error: "real_only" }, 500);
    render(<HubState source="real" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not load the hub state/);
  });
});
