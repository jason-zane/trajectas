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
  `portalAccents`) are **atomic**: override the whole group or none of it.
  This matches how the editors edit them and means there is never a
  half-merged nested object.
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
| Semantic | `--brand-surface`, `--brand-text`, `--brand-border`, … | primary scale |
| Status | `--brand-error`, `--brand-success`, `--brand-warning` | `semanticColors` |
| Shape | `--brand-radius`, `--brand-radius-sm…2xl` | `borderRadius` |
| Spacing | `--brand-space-3xs…3xl` | `spacingDensity` |
| Fonts | `--brand-font-heading/body/mono` | font fields |
| Type scale | `--brand-text-<level>-{size,weight,line-height,tracking}` for display/h1/h2/h3/body/label/caption | `typography` |
| Buttons | `--brand-button-{radius,weight,transform,pad-x,pad-y}` | `buttonStyle`, `spacingDensity` |
| Gradient | `--brand-gradient` (only when enabled) | `gradientAccent` |

Consumers reference tokens with a dashboard-token fallback:
`style={{ color: 'var(--brand-primary, hsl(var(--primary)))' }}`.
