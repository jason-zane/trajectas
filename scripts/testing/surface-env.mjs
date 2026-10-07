/** Single-host tests use the existing local pathname routing. Explicit host
 * mappings remain authoritative; do not manufacture five identical hosts. */
export function testSurfaceEnv(environment, fileEnvironment) {
  return Object.fromEntries([
    "PUBLIC_APP_URL", "ADMIN_APP_URL", "ASSESS_APP_URL",
    "PARTNER_APP_URL", "CLIENT_APP_URL",
  ].map(key => [key, environment[key] ?? fileEnvironment[key] ?? ""]));
}
