import React from "react";

// The rule-19 mock/real banner, the honest "what is simulated" banner, and the intro. Every page shows
// the simulation banner first (rule 2), also in presenter mode.
export default function Banner({ story, mode }) {
  return (
    <div data-testid="banner">
      <p className="banner" data-testid="sim-banner">{story.banner}</p>
      {mode === "real" && <p className="banner banner-real" data-testid="real-banner">{story.realBanner}</p>}
      <p className="intro">{story.intro}</p>
    </div>
  );
}
