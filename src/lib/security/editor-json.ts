/**
 * Maily still embeds Tiptap 2, with no compatible upstream fix for
 * GHSA-cp6q-959q-f8rh. Strip prototype-control keys before JSON reaches the
 * editor or renderer. The same boundary covers stored and pasted JSON.
 */
export function sanitizeEditorJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, entry) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype'
      ? undefined : entry,
  ) as T
}
