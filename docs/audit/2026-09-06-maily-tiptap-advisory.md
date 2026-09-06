# Maily / Tiptap advisory assessment — 2026-09-06

The 35 moderate npm audit entries remaining at release `476f8c4` originate from one advisory, [GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh), propagated through Maily's Tiptap dependencies. The advisory marks all versions below 3.30.4 as affected, but the exact locked Tiptap 2.27.3 distribution already contains the prototype-handling fix. This is a version-range false positive for the tested package and defect; it is not a blanket exemption for Tiptap or Maily.

## Exact dependency and evidence

`@maily-to/core@0.3.7` resolves its own `@tiptap/core@2.27.3`. The app's separate top-level Tiptap core is 3.31.3. The nested lock entry has this npm tarball integrity:

```
sha512-a5LfRbLpfaGI3hbL/LPHUYHI0I+FQHdSHsy8L4YnVIuu3hXcm3QZgkWbpEGf8hCz8krk6zEiu0+iFOjTySU2FA==
```

The downloaded 2.27.3 tarball matched that integrity. Its TypeScript source and compiled ESM, CommonJS and UMD builds special-case `__proto__` with `Object.defineProperty`, matching the mechanism in the [upstream security fix](https://github.com/ueberdosis/tiptap/commit/01d7af8c983ee5954c63734f4fa46cb23ae3246d). Ordinary assignment to that key would instead invoke the prototype setter.

`tests/unit/maily-tiptap-security.test.ts` resolves Tiptap relative to Maily's installed entry, verifies its version against the lockfile, and loads the actual nested ESM and CommonJS builds. It passes JSON-origin prototype attributes directly into `mergeAttributes` and the actual ProseMirror DOM serializer, without the application sanitizer masking the result. It checks that inherited event handlers and image sources do not become DOM attributes, and that ordinary class/style/image merging still works.

## Maintenance decision

Keep the stable locked dependencies and the existing `sanitizeEditorJson` boundary for stored/pasted editor content and server email rendering. No dependency upgrade, override, audit suppression or CI threshold change is needed for this advisory. Reassess this record when the nested dependency changes; preserve the behavioral regression even after the advisory metadata is corrected.

Current registry tags expose Maily 2.0.0-beta.7 with Tiptap 3, but that is a prerelease migration and requires React `^19.2.5` while the app pins 19.2.4. Forcing Tiptap 3 into Maily's v2 graph would bypass [documented major-version API changes](https://tiptap.dev/docs/guides/upgrade-tiptap-v2). Neither is warranted to address the already-fixed defect.

## Reproduce locally

After `npm ci`, run:

```sh
npx vitest run tests/unit/maily-tiptap-security.test.ts tests/unit/editor-json.test.ts tests/unit/email-render.test.ts
```

These tests make no database or external service calls. The assessment covers the reported prototype-to-DOM path, not every editor feature or future advisory.
