import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    // Public Role Builder's email-verification-code request — see
    // docs/superpowers/specs/2026-09-17-public-role-builder-design.md.
    { path: "/build", method: "POST" },
  ],
});
