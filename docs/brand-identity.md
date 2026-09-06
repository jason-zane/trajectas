# Trajectas identity

Approved September 2026: **trajectas**, lowercase, without terminal punctuation,
paired with the original four rising Span pills. The wordmark is Plus Jakarta
Sans at weight 800, with tracking of −1/21 em. The dot above the `j` remains
part of the letter.

Use `TrajectasLogo` for platform signatures and `BrandLogo` for configurable
brand slots. Use the combined horizontal logo in navigation, sign-in screens
and report covers; wordmark alone in small running headers and footers; Span
alone for app icons and compact navigation. Normal prose, metadata, accessible
names and company names remain `Trajectas`.

The normal treatment is emerald `#2d6a5a`, gold `#c9a962` and ink `#1a1a1a`.
The inverse treatment uses white with the gold accent. Assessment screens use
the runner's dedicated logo tokens so light and dark themes retain contrast.
Client and partner logos, report co-brand slots, custom footer copy and logo
visibility controls are independent of the platform signature.

## Artwork and exports

`src/lib/brand/wordmark-path.ts` contains the outlined wordmark from the bundled
`src/app/fonts/plus-jakarta-sans-latin-variable.woff2`. The inline React logo and
the standalone SVG generator use these outlines; browser and PDF renderers
therefore need no font to draw the logo.

`public/brand/span-*.svg` are the matching SVG exports. Existing asset paths
are retained, including the 5Brains report copies, so existing templates and
snapshots keep working. The horizontal and wordmark PNGs are 3× exports for
email clients that cannot display SVG. If the artwork changes, update both the
outlines and all matching exports together.

`src/lib/brand/svg.ts` supplies the same identity to the standalone Business
Outcomes PDF and social image renderer. The 5Brains custom template uses the
shared components while preserving its own framework identity.

## Stored reports

HTML reports and template previews pick up the current artwork at render time.
Previously cached PDFs need a fresh render after deployment. Refresh their PDF
objects from the existing snapshot data, preserving scores, release state and
notification timestamps. Do not re-run report generation or send notifications
as part of an artwork refresh. Previously downloaded or emailed copies remain
as they were.
