/**
 * Maily's locked Tiptap 2.27.3 includes the GHSA-cp6q-959q-f8rh fix;
 * tests/unit/maily-tiptap-security.test.ts verifies the nested compiled package.
 * Keep stripping prototype-control keys as defense in depth before stored or
 * pasted JSON reaches the editor or renderer. See the dated advisory review in
 * docs/audit/2026-09-06-maily-tiptap-advisory.md.
 */
export function sanitizeEditorJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, entry) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype'
      ? undefined : entry,
  ) as T
}
