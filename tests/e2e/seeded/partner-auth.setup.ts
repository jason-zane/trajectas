import { test as setup } from "@playwright/test";
import { mintPartnerStorageState } from "./auth";

setup("mint seeded partner session", async () => {
  await mintPartnerStorageState();
});
