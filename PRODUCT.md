# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two buying audiences, confirmed 2026-09-17:

- **HR and talent leaders inside organisations** who own selection, promotion,
  succession and development decisions and would become clients.
- **Consultancies and search firms** that run Trajectas for their own clients
  (the partner tier).

**Hiring managers are the triers.** Any hiring manager who lands on the public
site should be able to build an assessment from a position description without
an account (the public Role Builder). They are the site's action-takers even
when they are not the eventual buyer.

Participants (candidates and employees) take assessments by link on any device.
They are users of the assessment runner, not the site's audience.

## Product Purpose

Trajectas is a psychometric assessment platform. It builds instruments around
the capabilities an organisation's roles actually turn on, ties measurement to
the outcomes the organisation is trying to move, and tracks growth over time.

Success for the product: people decisions made with a precise understanding of
the person, without flattening them into a score. Success for the public site:
a first-time visitor understands the mechanism within seconds and either tries
the Role Builder or gets in touch.

## Positioning

Capability-contextualised measurement. An assessment is assembled per role from
a curated capability library, by matching a position description against that
library, rather than handed over as a fixed off-the-shelf battery. Results are
linked to business outcomes; trajectory reports show change over time.

Standing lines: "Capabilities, contextualised." and "Understanding people is
the real work."

## Operating Context

- The buyer has a position description or job ad in hand; that document is the
  input to the mechanism.
- Assessments are short: the platform's canonical estimate is 12 seconds per
  item, so a 36-item assessment is about seven minutes.
- Participants receive a link by email and take the assessment in a browser.
  Reports are HTML pages and PDFs.
- Sign-in is passwordless (email one-time code). No password flows exist.
- Australian company; copy is en-AU.
- Partners administer client workspaces; clients administer their own.

## Capabilities and Constraints

**Library, live in production on 2026-09-17:** 29 active capabilities, of
which 25 are eligible for role matching; 360 active items; 6 dimensions.
These numbers change and must be queried at render time whenever shown; never
hard-code them in copy.

**Item formats:** Likert and situational-judgement items are live. A cognitive
bank exists but has no active items in production, and cognitive items are
excluded from the public tool regardless.

**Public Role Builder** (spec:
`docs/superpowers/specs/2026-09-17-public-role-builder-design.md`): single
taker (the builder takes it), email plus six-digit code before any AI runs,
three tiers of 4 / 6 / 8 capabilities at a fixed 6 items each (~5 / 7 / 10
min), "Recommended for this role" from the matcher, swap-in/out of close
alternatives, one click creates assessment + campaign + link, PDF report
emailed at completion. Closed (invite code) and open modes. No payments.

**Terminology:** public copy says *capability*; the schema says *factor*;
internal UI also says *competency*. Customers are *clients* (never
organisations); survey takers are *participants* (never candidates, except in
the ordinary hiring sense).

**Undecided:** the public tool's name and route ("Role Builder", `/build` are
placeholders); which report template the demo uses; retention period for
pasted position descriptions. No public pricing exists.

## Brand Commitments

- Wordmark: lowercase `trajectas`, no terminal punctuation, paired with the
  four rising Span pills (`docs/brand-identity.md`,
  `src/components/brand/trajectas-logo.tsx`). In prose the name is
  `Trajectas`.
- Identity colours: emerald `#2d6a5a`, gold `#c9a962`, ink `#1a1a1a`; inverse
  treatment is white with the gold accent. These stay.
- The current home page's dark-green, serif, film-grain world is **not** a
  commitment (confirmed 2026-09-17). It is evidence of the last attempt and
  may be replaced.
- Brief for the redesign: cleaner, more sophisticated, more editorial; not
  more content.
- Voice: a point of view, willing to challenge the status quo, no hype and no
  gamification. Precise about people.

## Evidence on Hand

- **Library numbers** (above), live from the database. May be shown.
- **The method**: capability library, matching from a role description,
  calibration and quality machinery, outcomes linkage, trajectory over time.
  Documented in code and in `docs/superpowers/specs/`. May be shown.
- **Real product screens**: the assessment runner, the participant report,
  the trajectory canvas, the report builder. May be shown as demonstrations.
- **Founder background**: exists, deliberately **not** featured on the site
  (unticked 2026-09-17).
- **Absent, and must not be fabricated:** named clients, testimonials, case
  studies, benchmarks, validity statistics for public use, pricing, press.

Assets: logo component and SVG/PNG exports under `public/brand/`; vendored
fonts under `src/app/fonts/` (Plus Jakarta Sans, Source Serif 4, Geist Mono,
JetBrains Mono).

## Product Principles

1. **Prove by doing.** The public tool is the pitch; the page's job is to get
   a position description pasted, not to describe psychometrics.
2. **Small and relevant beats broad and generic.** A few capabilities that
   matter for this role, measured well, over a battery that measures
   everything.
3. **Precise, never flattening.** A person is more than a percentile; every
   output keeps the person legible.
4. **Only what is true.** Live numbers and real screens over adjectives;
   absence is stated, not filled.
5. **Respect the ten minutes.** A participant's time is a cost the product
   pays back with clarity.

## Accessibility & Inclusion

Participants take assessments on any device, including phones, so the runner
and any public surface must work at phone width. Existing surfaces respect
`prefers-reduced-motion`; new ones must. No further product-specific standard
has been established.
