# Trajectas public experience

Replacement direction confirmed 21 September 2026: modern, precise and product-led.
Applies to the public website and Role Builder. PRODUCT.md remains the product-truth authority.

## Visual system
Cool white and pale mineral-grey surfaces, charcoal text, emerald #2d6a5a primary actions and small gold #c9a962 brand accents. Retain the lowercase Trajectas wordmark and four ascending Span bars. Use a crisp sans-serif hierarchy, generous space and strong alignment. No felt, pinned paper, typewriter styling, film grain or decorative particle fields. Interface content is the visual evidence; no invented testimonials, validation statistics or client logos.

## Composition
The homepage introduces the broader capability-assessment platform. The dedicated `/role-builder` page explains position description → relevant capabilities → real assessment and report. The builder shares its header, typography, action hierarchy and controls. Use the selected mechanism-led homepage and a guided builder workspace. Use illustrative examples clearly labelled as examples.

## Interaction
Access is open: anyone with a verified email can build (the invitation gate was removed 2026-09-23). Let visitors understand the task and expected output before verification; keep email verification before AI work. Use a legible step sequence, persistent role context, clear selection feedback, visible time/item estimates and recoverable errors. Preserve server authorization and quotas.

## Responsive and accessibility
Stack document and capability views on narrow screens. All controls remain touch-friendly and keyboard operable. Focus indicators, labels, contrast and reduced-motion support are mandatory. Core controls and text remain semantic HTML. Implemented tokens are recorded below.

## Implemented decisions

The user selected the first generated concept, preserved at `docs/design/2026-09-21-public-experience/approved-direction.png`. This is visual direction, not authority for the generated image's invented copy or unsupported sharing flow.

- White base, `#f4f7f5` working surface, `#192522` primary text, `#586560` secondary text, `#dce3df` rules. Primary action `#2d6a5a`, hover `#214e42`, gold `#c9a962` used only as a short rule/accent.
- Use the already-vendored Plus Jakarta Sans to preserve the approved first concept's geometric sans voice and continuity with Trajectas. 400–700 text, 650–700 headings, display 38–66px with -0.035em tracking. Sans body, no decorative mono.
- Content maximum 1280px. 24–72px responsive gutters. Primary controls 50px high, 6px corners. Working containers 12px corners; separators rather than nested cards.
- Use the real TrajectasLogo and existing Lucide outline icons. No new raster assets are needed: the central evidence is semantic, interactive role/capability content.
- Homepage demonstration is explicitly illustrative. No proof claims, fake confidence percentages, invented clients or unsubstantiated norms.
- Production sequence: verify email, describe role, actual extraction and matching, review capabilities and length, confirm creation, open assessment. Verification stays first because uploaded document extraction and AI are gated. Length is chosen once, in context, on review.
- Animation reflects actual requests. Reading completes only when extraction returns. Matching starts then, with extracted responsibilities visible. Creation has its own pending state. No synthetic percentages, timed card reveal or extra summary-generation call.
- Reduced motion disables movement while retaining clear stage text. New-screen focus is managed without browser-induced scroll jumps. Inline details preserve context and keyboard affordances.
- Cookie-gated recovery retrieves only the verified email's builds. Role drafts and adjustments are optionally retained in that browser tab, scoped to email/build, never used as authorization.
- Public surfaces deliberately keep this light system even if an admin previously selected dark mode. It is independent of portal theme settings.

- Mobile review retains a sticky count/time summary link. Length controls preserve manual choices; shortening keeps the earliest selections. Recovery restores the owned position description, with a newer tab draft taking precedence.

## Homepage refinement after user review

The user liked the restrained structure but found the homepage too uniform and plain. Keep the builder unchanged. The homepage now uses a warm paper base (#faf9f5), green emphasis in the headline, pale sage capability destinations, a deep-green assessment summary, and a forest-green process section with warm gold sequence numbers. A muted gold closing panel creates a final point of emphasis. These are semantic section and outcome distinctions, not decorative effects. Existing copy, interactions, branding and gate remain intact.

## Complete public site and capability depth

Public navigation now connects Home, How it works, For teams and Contact. Older topic pages and /classic redirect to the corresponding current pages and are removed from the sitemap, while remaining allowed on the public host. Contact uses the existing submitContact action, preserving the enquiry storage/notification behaviour. No invented calendar booking or response-time guarantee.

The homepage example uses a native selector with three illustrative roles and six responsibility/capability connections each. The public builder distinguishes role interpretation, the initially recommended set and other ranked capabilities. Reasons are visible in context; expandable detail shows existing library definitions and low/mid/high behavioural indicators, with honest absence states. Same-category/dimension links help comparison without claiming semantic equivalence. Selection counts, preserved manual choices, limits, search and the final selected-name summary support deliberate assessment design. No new AI call or fabricated role-specific rationale is introduced.

## Whole-role matching and model exploration

Follow-up direction: replace one-to-one homepage responsibility/capability arrows with a whole-role narrative leading to a set. Align builder cream/sage/forest colour hierarchy with the homepage. Keep selection rows compact and use a native modal dialog for the full definition, role reasoning and available behavioural indicators; retain add/remove action within the dialog. The dialog traps Tab, supports Escape, restores trigger focus, locks background scrolling and resets reading position when exploring related content. Role interpretation exposes function, seniority, responsibilities, context signals and technical requirements, without inventing missing evidence.

New /capability-model reads active non-deleted platform reference content dynamically through a narrow DAL projection. No question bank, answer keys, tenant records or hardcoded capability inventory is exposed. Categories, names and descriptions come from the library so future revisions flow through. Search/group filtering and the same shared detail dialog support exploration. The local model demonstration uses a labelled read-only library snapshot; it is not a shipped fallback.

## Platform homepage expansion — 21 September 2026

The user approved the public visual system and asked for a conventional platform homepage with a strong route into the existing role-focused page. Keep the approved palette, logo, fonts and restrained product-led treatment. The new `/` introduces the wider assessment platform: selection, development and growth, with organisations and partners represented. `/role-builder` preserves the previous homepage as the dedicated experience landing page; `/build` remains the gated workflow. `/how-it-works` now explains the broader context → capability → assessment → interpretation approach. Shared navigation and footers link to the dedicated Role Builder destination.

The homepage uses a split introduction with an illustrative, user-controlled decision example. No score data, testimonials or performance claims are invented. The supporting sequence is a sage audience strip, open three-column method, a substantial forest-green Role Builder invitation, two audience passages and a contact close. The mode is Persuade; the primary action is Explore Role Builder, with Talk to us secondary. The existing image direction remains the visual authority; this is an extension of that world, not a new identity proposal.
