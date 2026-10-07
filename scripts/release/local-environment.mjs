// Keep the familiar fail-fast warning for known application/provider inputs.
// This inventory is diagnostic, not the isolation boundary: unknown variables
// are also excluded from children by the system allowlist below.
export function applicationVariableNames(source) {
  return Object.keys(source).filter((name) =>
    /^(NEXT_PUBLIC_|SUPABASE_|DATABASE_URL$|PLAYWRIGHT_|PUBLIC_|ADMIN_APP_URL$|ASSESS_APP_URL$|PARTNER_APP_URL$|CLIENT_APP_URL$|COOKIE_DOMAIN$|SERVER_ACTION_|TRAJECTAS_|INTERNAL_|INTEGRATIONS_|REPORT_|RESEND_|EMAIL_FROM$|OPS_ALERT_|CRON_|STRIPE_|OpenRouter_|OPENROUTER_|ANTHROPIC_|OPENAI_|KV_REST_|UPSTASH_|OUTCOMES_|VERCEL(?:_|$)|CSP_|STUDIO_URL$|CHROME_PATH$|CHROMIUM_MIN_PACK_URL$|LIKERT_|REAL_PD_FILE$)/.test(name));
}

export function localCheckEnvironment(source) {
  // Executable lookup, home/temp directories and locale only. Do not inherit
  // app toggles, endpoints, provider tokens, NODE_OPTIONS or npm config/hooks.
  const allowed = new Set([
    "PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "TZ",
    "LC_ALL", "LC_COLLATE", "LC_CTYPE", "LC_MESSAGES", "LC_MONETARY",
    "LC_NUMERIC", "LC_TIME", "LC_ADDRESS", "LC_IDENTIFICATION",
    "LC_MEASUREMENT", "LC_NAME", "LC_PAPER", "LC_TELEPHONE",
    "SystemRoot", "WINDIR", "COMSPEC", "ComSpec", "PATHEXT",
    "USERPROFILE", "APPDATA", "LOCALAPPDATA",
  ]);
  const env = Object.fromEntries(Object.entries(source).filter(([name]) => allowed.has(name)));
  return { ...env, CI: "true", NEXT_TELEMETRY_DISABLED: "1" };
}
