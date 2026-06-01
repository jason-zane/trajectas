# Data Access Layer (`src/lib/dal`)

The DAL is where database reads/writes live, instead of being scattered inline
across components, pages, and server actions. It is being introduced
**incrementally** — one domain at a time — so not all queries live here yet.

## Rules

A DAL module:

1. **Runs only on the server.** Start every file with `import "server-only"`.
2. **Is the place a query lives.** It opens the Supabase client (`createAdminClient` /
   the server client) and runs the query. Callers receive data, not query builders.
3. **Returns DTOs, not raw rows.** Map `snake_case` DB rows to the shape the app
   uses, so the persistence schema doesn't leak into the UI.
4. **Owns authorization for the data it returns** where the query isn't already
   gated by RLS + an `require*Access()` check at the call site.

## What this replaces

- **Reusable components must not open a DB client.** A component in
  `src/components/**` must never import `createAdminClient` or
  `@/lib/supabase/server`. It either receives data as props (preferred) or calls
  a DAL function. This is enforced by
  `tests/architecture/no-db-in-components.test.ts`.
- **Pages** (`src/app/**/page.tsx`) are the composition root and may fetch — but
  prefer fetching via a DAL function and passing props down.

## Adding to the DAL

Group by domain: `dal/<domain>.ts` (e.g. `dal/audit.ts`, `dal/workspace.ts`).
Export named functions like `get<Thing>` / `list<Things>` returning DTOs. Keep
them small and composable.
