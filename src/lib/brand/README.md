# Brand system

Per-tenant theming for every surface: dashboard portals, the assessment
runner, emails, PDF reports, and web report views.

## Architecture

```
brand_configs (JSONB)          resolution                consumption
─────────────────────          ──────────────────        ─────────────────────
platform   (complete)   ──┐
partner    (overrides)  ──┤    mergeBrandLayers()        generateCSSTokens()      → runner + previews
client     (overrides)  ──┼──► getEffectiveBrand()  ──►  generateDashboardCSS()   → workspace shell
campaign   (overrides)  ──┘    (always complete)         generateEmailStyles()    → email frame
                                                         generatePDFStyles()      → PDF renderer
                                                         generateReportCSSTokens()→ report renderer
```

### Merge semantics (`merge.ts`)

Layers are merged in ascending specificity — `TRAJECTAS_DEFAULTS` → platform
→ partner → client → campaign — with **shallow, top-level-field granularity**:

- A layer only affects fields it defines. A campaign that overrides
  `primaryColor` inherits everything else live from its parent chain.
- Nested groups (`semanticColors`, `taxonomyColors`, `emailStyles`,
  `reportTheme`, `typography`, `buttonStyle`, `gradientAccent`,
  `portalAccents`, `surfaceColors`, `runnerAnchors`) are **atomic**: override
  the whole group or none of it. This matches how the editors edit them and
  means there is never a half-merged nested object.
- Within `surfaceColors` / `runnerAnchors` an unset member still falls back to
  its *derived* value, so a layer can pin one role and leave the rest tracking
  the brand colours — granularity without breaking the atomic-group rule.
- `undefined`/`null` field values mean "not overridden". Empty string is a
  real value (`logoUrl: ''` = "remove the inherited logo").

The platform row must always store a **complete** config (`brandConfigSchema`);
partner/client/campaign rows store partial overrides (`brandOverridesSchema`).
Historic rows that stored complete configs for non-platform owners remain
valid — they are overrides that happen to define every field. Saving an empty
override set soft-deletes the row (equivalent to "reset to inherited").

### Storage & schema evolution

`brand_configs.config` is JSONB — adding a field never needs a migration:

1. Add the field to `BrandConfig` in `types.ts` (optional, with a doc comment).
2. Add a default to `TRAJECTAS_DEFAULTS` in `defaults.ts` (or leave undefined
   for opt-in features like `gradientAccent`).
3. Add validation in `src/lib/validations/brand.ts` (`brandConfigSchema` —
   the partial schema derives automatically).
4. Emit tokens in `tokens.ts` (`generateCSSTokens` and/or the other
   generators).
5. Add an editor control in `src/components/brand-editor/` and wire it into
   the brand workbench.
6. Consume the token in components via `var(--brand-*, fallback)`.

Old rows simply lack the field; merge fills it from defaults.

### Contrast auditing (`contrast.ts`)

`auditBrandContrast(config)` checks the WCAG ratios of the color pairs the
token pipeline actually produces (button text on primary, body text on
surface, email text, …). Pure math — the editors run it client-side for live
warnings. Advisory only: saves are never blocked.

### Caching

Reads are wrapped in `unstable_cache` with tag `'brand'` (5 min TTL);
`upsertBrandConfig` / `resetBrandToDefault` call `revalidateTag('brand')`.
`unstable_cache` includes function arguments in the cache key automatically —
the `['effective-brand']` keyPart is a prefix, not the whole key.

## Token families emitted by `generateCSSTokens`

| Family | Tokens | Driven by |
| --- | --- | --- |
| Primary scale | `--brand-50…900`, `--brand-primary` | `primaryColor` |
| Accent scale | `--brand-accent-50…900` | `accentColor` |
| Secondary scale | `--brand-secondary-50…900` (only when set) | `secondaryColor` |
| Neutrals | `--brand-neutral-50…900` | `neutralTemperature` |
| Neutral roles | `--brand-surface`, `--brand-surface-raised`, `--brand-text`, `--brand-text-muted`, `--brand-border` | `neutralTemperature`, `surfaceColors` |
| Focus ring | `--brand-ring` | primary scale |
| Status | `--brand-error`, `--brand-success`, `--brand-warning` | `semanticColors` |
| Shape | `--brand-radius`, `--brand-radius-sm…2xl` | `borderRadius` |
| Spacing | `--brand-space-3xs…3xl` | `spacingDensity` |
| Fonts | `--brand-font-heading/body/mono` | font fields |
| Type scale | `--brand-text-<level>-{size,weight,line-height,tracking}` for display/h1/h2/h3/body/label/caption | `typography` |
| Buttons | `--brand-button-{radius,weight,transform,pad-x,pad-y}` | `buttonStyle`, `spacingDensity` |
| Gradient | `--brand-gradient` (only when enabled) | `gradientAccent` |

Consumers reference tokens with a dashboard-token fallback:
`style={{ color: 'var(--brand-primary, hsl(var(--primary)))' }}`.

### Derived vs pinned colours

Two token groups are **derived by default and pinnable per-role**:

| Group | Derived from | Pin with |
| --- | --- | --- |
| Neutral roles (`resolveSurfaceRoles`) | `neutralTemperature` | `surfaceColors` |
| Runner anchors (`deriveRunnerAnchors`) | `primaryColor`, `accentColor` | `runnerAnchors` |

Neutral roles are deliberately **not** derived from `primaryColor`. They used
to be — steps 50/100/200/600/900 of the primary scale — which meant a
saturated primary produced saturated "neutrals": an orange brand got `#490000`
body text and `#ffc9a0` borders, i.e. browns everywhere. Hue and chroma now
come from the neutral ramp (chroma ≤ 0.01), at the same role lightnesses as
before, so WCAG ratios are unchanged and no brand colour can push these to mud.

The runner ink applies a **hue-aware chroma ceiling**: hues near amber (≈62°)
read as mud at ink lightness, where the same chroma on a green or navy reads as
a handsome dark brand surface. The ceiling tapers on a cosine ramp through that
band only, so non-amber brands derive exactly what they did before.

Pinned values are taken verbatim — including bad ones. `auditRunnerContrast`
runs in the editors' warning panel precisely to catch that; saves are never
blocked.
