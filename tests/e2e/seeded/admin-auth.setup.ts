import { test as setup } from "@playwright/test";
import { mintAdminStorageState } from "./auth";

// Runs as the "seeded-setup" project, a dependency of the "seeded" project, so
// it executes before the seeded specs but never for the (Supabase-less) smoke
// suite. Mints the seeded admin session and writes it to storageState.
setup("mint seeded admin session", async () => {
  await mintAdminStorageState();
});
