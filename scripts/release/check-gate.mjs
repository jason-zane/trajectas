import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function gateFailures(needs) {
  const failures = [];
  for (const name of ["change-scope", "security", "quality", "integration", "e2e-smoke"]) {
    if (needs?.[name]?.result !== "success") {
      failures.push(`${name}: ${needs?.[name]?.result ?? "missing"}`);
    }
  }
  const scope = needs?.["change-scope"]?.outputs?.seeded;
  if (!["true", "false"].includes(scope)) failures.push("change-scope: missing/invalid seeded decision");
  const seeded = needs?.["seeded-e2e"]?.result;
  if (seeded !== "success" && !(scope === "false" && seeded === "skipped")) {
    failures.push(`seeded-e2e: ${seeded ?? "missing"} (required=${scope ?? "unknown"})`);
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const failures = gateFailures(JSON.parse(readFileSync(0, "utf8")));
    if (failures.length) {
      console.error(`Release gate failed:\n${failures.join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log("Required CI jobs passed; seeded E2E passed or was intentionally out of scope.");
    }
  } catch {
    console.error("Release gate failed: missing or malformed job evidence");
    process.exitCode = 1;
  }
}
