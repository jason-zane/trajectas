# Trajectas Personality Profile - Standard report

The approved nine-page results design is registered as
`trajectas-personality-standard-v1`. It includes a cover, five-dimension overview,
the complete 35-result profile, five pages with six traits each, and assessment
information. It contains no AI calls or personalised narrative. Cover numbering
is hidden; body pages run 02-09. The cover date is the frozen report creation
date, labelled **Report date**.

Design reference: [approved standard report in Figma](https://www.figma.com/design/mVmHNelmirU3XzDM9xUVcx?node-id=69-9).
Presentation definitions and synthetic preview values come from the retained
30 October 2026 v4 design sources. They are separate files: presentation data
contains no scores; preview values never enter the live data builder.

## Installed records

Jason requested both environments on 30 October 2026 after being told that
the assessment exists only in development and normative scoring is pending.
The following record was inserted once in each environment and read back:

| Setting | Value |
| --- | --- |
| Template ID | `238694bb-3e60-5fee-a558-2cdde1464bb5` |
| Name | Trajectas Personality Profile - Standard report |
| Slug | `trajectas-personality-standard-v1` |
| Development | `bgrvqvtlhmfmvcytncgw` |
| Production | `rwpfwfcaxoevnvtkdmkx` |
| Active / default / automatic release | All false |
| Owner / blocks | Platform-owned; empty block array, dispatched by custom slug |

Development creation: `2026-10-30T00:26:03.741924Z`.
Production creation: `2026-10-30T00:26:20.651037Z`.
No campaign assignments, defaults, participant records, snapshots, scoring,
forms, entitlements or database schema were changed. These are library data
writes, not migration execution or proof of an application deployment.

The records alone do not install the renderer. Its application code and preview
support require the reviewed code deployment. Until then, existing application
builds do not recognise the slug. Keep both records inactive.

## Connected norm boundary and authoring

The integrated report consumes the immutable native instrument result and the
snapshot's separate frozen reference interpretation. It validates all 35 native
scale/rank identities and display directions, then supplies explicit percentiles
to the presentation builder. Native POMP is not relabelled. Campaign launch,
automatic reports and manual editions use the same explicit supported-template
allowlist; the standard report refuses a missing reference.

The builder edits cover wording, display names, definitions and endpoints. Source
items, score direction and measurement codes stay fixed. Writes require existing
template write access and a matching update timestamp. Presentation settings are
frozen with each report's template and payload; editing the library cannot change
an existing report. Exported reports show their actual reference and version.

The source norm groups remain inactive pending their separate review. Synthetic
software references are clearly labelled and never presented as source approval.
The renderer supports older payloads through optional-field fallbacks. See
[the integrated Preview record](../assessments/ipip-neo-120/preview-readiness.md)
for the private-source boundary, ordered schema rollout and final evidence.

## Verification and release

The actual React component was rendered with the isolated preview fixture:
nine A4 pages, all 30 trait strips and all 35 full-profile results, no layout or
footer collisions. Every PDF page was rendered and visually reviewed. Unit and
rendering tests cover metric/provenance refusal, incomplete profiles, bounds,
N4/N6 direction, retained dimension ranks, escaped names, fixed report dates and
preview/live separation. The existing cognitive claims guard retains every raw
column check; only its ambiguous-word allowance is extended to the pure IPIP
adapter and its typed renderer.

The first local validation stopped at that guard because it also matched
personality explanatory copy. Its narrow, documented allowance and the IPIP
metric/provenance tests resolve that scope conflict. Record the final validation
and exact-commit CI outcomes in the PR. No live report generation or participant
acceptance was run. No application merge, deployment or norm activation is
authorized by these library registrations; follow `docs/runbook.md`.
