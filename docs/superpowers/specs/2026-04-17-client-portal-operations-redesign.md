# Client Portal Operations-First Redesign

**Date:** 2026-04-17
**Status:** Draft

---

## Problem Statement

The current client portal has the underlying capability to run campaigns, invite participants, customise assessments, and review results, but the UX still feels page-oriented rather than job-oriented.

For the first real client user archetype, this creates unnecessary friction:

1. The dashboard is informative, but not operational enough.
2. The fastest actions are not prominent enough, especially:
   - launch a campaign
   - reuse a previous setup
   - copy the assessment link
   - invite participants
   - open results
3. Assessment customisation exists, but it sits too far from the launch moment.
4. Reports/results are accessible, but too much of the path still depends on drilling down rather than acting from the surfaces users already inhabit.

The client portal should behave like a lightweight operational product for consultant-style users, not like a reduced admin console.

---

## User Model

### Primary archetype

- Consultant-style operator
- Sometimes recruiter, hiring manager, or internal admin
- Usually 1-2 users per client account
- Wants speed and confidence more than configurability
- Will often reuse a previous assessment/campaign setup

### Working assumptions

- Users think in terms of `campaigns` first, not assessments first.
- One assessment per campaign is the default, even if multi-assessment support remains available.
- Users may be comfortable with advanced controls, but the default experience must work for the lowest common denominator.
- Client-facing UX should use the term `capabilities` where a simpler label is needed, while preserving underlying system terminology where necessary.

---

## Product Principles

1. **Campaign-first**
   The client portal should orient users around campaigns as the main operational object.

2. **Task-first dashboard**
   The dashboard should help users do the next thing, not just understand system state.

3. **Fastest path first**
   Reuse and send should be easier than build and configure.

4. **Safe by default**
   Sending a campaign should feel deliberate and clear.

5. **Progressive disclosure**
   Advanced controls remain available, but should not interrupt the default flow.

6. **Report-first results consumption**
   Users often want to open a result/report, then decide whether to download or send it.

---

## In Scope

- Client dashboard redesign
- Client launch flow redesign
- Client campaign list/action redesign
- Client participants/results access simplification
- Terminology updates in client UX (`capabilities`)
- Campaign link prominence
- Reuse-previous-campaign workflow
- Optional capability selection in launch flow

## Out of Scope

- Partner portal redesign
- Client-to-partner upgrade workflow
- Major admin IA changes
- Full formal campaign template system
- Side-by-side candidate comparison for this build

---

## Core Jobs To Support

The client portal should optimize around these three jobs:

1. Launch a campaign quickly
2. Send participants into the campaign with minimal friction
3. Find and review results quickly

Secondary jobs:

- Reuse an existing setup
- Optionally tailor the assessment to selected capabilities
- Download or send reports
- Find a participant across campaigns

---

## Information Architecture

### Top-level client navigation

Recommended top-level nav:

- `Dashboard`
- `Campaigns`
- `Participants`
- `Assessments` (kept for now, but de-emphasized)

### Navigation rationale

- `Dashboard` remains the main landing page.
- `Campaigns` is the primary operational workspace.
- `Participants` is the global cross-campaign results/search surface.
- `Assessments` is not the main destination for most users, but can remain as a secondary library/tooling surface while the dashboard carries more of the operational burden.

### Future note

If the redesigned dashboard and launch flow absorb most assessment discovery needs, `Assessments` can later be demoted further or folded into launch/reuse workflows.

---

## Dashboard Redesign

### Dashboard intent

The dashboard should answer:

- What should I do next?
- Which campaigns matter right now?
- How do I send the campaign quickly?
- Where are the newest results?

### Primary action area

Single dominant CTA:

- `Launch campaign`

Clicking `Launch campaign` should immediately present:

- `Reuse previous campaign`
- `New campaign`

This keeps the surface simple while making reuse the fastest path once selected.

### Core dashboard blocks

#### 1. Primary actions

- `Launch campaign`
- `View results`
- `Find participant`

`Launch campaign` should be visually dominant.

#### 2. Active / recent campaigns

Show the top 3 active campaigns if the layout stays compact and clear.

Each campaign card/row should expose:

- campaign name
- status
- participant progress
- primary action: `Copy link`
- secondary action: `Invite participants`
- tertiary action: `View results`

Clicking the campaign name should open the campaign itself.

#### 3. Campaign link shortcut block

This should be a dedicated dashboard affordance, not an incidental settings feature.

Recommended behavior:

- show the most relevant active campaigns
- make `Copy link` extremely easy
- allow rapid participant sending without opening a deeper settings screen

This is likely one of the highest-value operational improvements.

#### 4. Recent results

Show a compact list of the newest completed participant results across campaigns.

Each row should include:

- participant name
- campaign name
- completion recency
- `Open results`

#### 5. Secondary stats

Summary stats can remain, but should be visually secondary to the action blocks above.

Recommended stats:

- active campaigns
- total participants
- completed assessments/results

### Future enhancement

Add `favorite` or `pinned` campaigns to the dashboard as a quick-access mechanism.

Important product framing:

- favorites are a dashboard access tool
- they are **not** a formal template system

---

## Campaign Launch Redesign

### Launch entry point

`Launch campaign` should open a short operational wizard.

Step 1:

- `Reuse previous campaign`
- `New campaign`

### Reuse previous campaign

Reusing a campaign should copy everything except participants.

Carry forward by default:

- assessment selection
- capability selection/customisation
- campaign configuration
- launch settings
- relevant branding/experience settings

Do **not** carry forward:

- participants
- participant states/results

Users should still review and confirm before sending.

### New campaign

The new-campaign path should be minimal.

Required by default:

- campaign name
- assessment

Optional / deferred:

- dates
- advanced settings
- extra assessments

### Capability tailoring

Default behavior:

- full assessment

Optional expandable section:

- `Limit to selected capabilities`

Behavior:

- hidden unless explicitly expanded/selected
- grouped by the next level up in the hierarchy
- explorable / expandable rather than flat
- multi-select checklist

The client-facing language should emphasize `capabilities`, while preserving structural grouping from the underlying taxonomy.

### Send step

All three send methods should be visible as peer options:

- `Copy link`
- `Invite one`
- `Bulk upload`

Design intent:

- all are equally valid
- `Copy link` should be especially prominent because it is often the easiest operational path

### Completion state

After launch, the confirmation state should show:

- campaign created/updated successfully
- `Copy link`
- `Invite participants`
- `Open campaign`

---

## Campaigns List Redesign

### Role of the campaigns list

The campaigns list should be the main operational index for client users, not just an archive.

### Desired row behavior

- clicking the campaign name opens the campaign
- the most obvious row action is `Copy link`
- a visible secondary action should be `Invite participants`

### Suggested columns / signals

- campaign name
- status
- assessment summary
- participant progress
- created or last active
- direct actions

### Empty state

If no campaigns exist, the page should push users directly toward:

- `Launch campaign`
- `Create your first campaign`

The empty state should feel action-oriented, not explanatory.

---

## Campaign Detail Redesign

### Default landing inside a campaign

A campaign should likely open to the most useful operational view, not the most passive summary view.

Recommended default:

- `Participants` / `Results`

Not:

- `Overview`

Reason:

- these users are action-oriented once they enter a campaign
- they are likely checking participant progress, opening results, or sending links

### Recommended campaign tab order

Recommended order:

- `Participants` or `Results`
- `Assessment`
- `Invite`
- `Overview`
- `Settings`

Exact naming can be resolved during implementation, but configuration-heavy tabs should not lead the experience.

### Prompting within active campaigns

If a campaign is active and has no participants yet, the most useful prompt should be:

- `Invite participants`

This prompt should lead to:

- invite one
- bulk upload
- copy link

---

## Participants & Results

### Global participants page

`Participants` should remain the main global cross-campaign result-finding surface.

This page should support:

- cross-campaign search
- recent/latest result review
- jumping to participant-level detail

### Relationship between campaign and global views

- `Dashboard -> View results` should land on the global participants/results surface
- campaign-specific results should remain accessible from a campaign block or campaign page

### Participant-level review

Participant detail can continue to open to `Overview` by default, since it represents the broader participant context rather than a single campaign session action.

### Results access simplification

The quickest possible result/report flow should be direct from a participant/session table.

Desired behavior:

- `Open results` available directly from the relevant row
- report viewing easy from that result context
- report download and send actions available from the report page/view

---

## Assessments Surface

### Current recommendation

Keep `Assessments` in the client nav for now, but treat it as secondary.

### Product role

This surface should serve as:

- a library/reference area
- a possible entry to launch a campaign from an assessment

It should **not** be treated as the main home for client users.

### Potential follow-on enhancement

Add a direct `Launch campaign` or `Use this assessment` action from the assessment library so the page becomes operational rather than purely informational.

---

## Terminology

### Client-facing term

Use `capabilities` in client UX where a simpler term is helpful.

### Internal/domain terms

The system may still rely on:

- dimensions
- factors
- constructs

These can remain in advanced screens or supporting language where needed, but the primary launch flow should avoid overloading the user with taxonomy-heavy wording.

---

## Deferred Work

### Candidate comparison

Side-by-side candidate comparison is useful, especially for consultant-style review, but it is **deferred from this build**.

Future exploration should likely start with:

- same-campaign comparison only
- latest result per participant
- 2 candidates at a time
- on-screen comparison first
- full report summary plus key capabilities snapshot

This should be treated as a later results workflow once launch, sending, and result retrieval are strong.

### Formal campaign templates

Do not introduce a full template system in this phase.

For now:

- campaigns remain operational containers
- `Reuse previous campaign` acts as lightweight cloning

If reuse becomes dominant, template behavior can later be formalized.

---

## Likely Implementation Touchpoints

This redesign should mostly build on the current client surface rather than replace it wholesale.

Likely files/components to touch:

- `src/app/client/dashboard/client-dashboard.tsx`
- `src/app/client/campaigns/page.tsx`
- `src/components/campaigns/quick-launch-modal.tsx`
- `src/app/client/campaigns/create/page.tsx`
- `src/app/(dashboard)/campaigns/campaign-form.tsx`
- `src/app/client/campaigns/[id]/page.tsx`
- `src/app/client/campaigns/[id]/overview/page.tsx`
- `src/app/client/campaigns/[id]/participants/page.tsx`
- `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`
- `src/app/client/participants/page.tsx`
- `src/app/client/participants/global-participants.tsx`
- `src/app/client/assessments/page.tsx`
- `src/app/client/assessments/assessment-library-table.tsx`
- `src/components/app-sidebar.tsx`

---

## Phased Implementation Plan

### Phase 1: Dashboard and campaign access shortcuts

Goal:
- make the client dashboard operational immediately

Work:
- add stronger primary CTA area
- add active/recent campaign block
- add `Copy link` prominence
- add recent results block
- keep summary stats secondary

Expected outcome:
- client users can launch, send, and find results from the dashboard without exploring the nav

### Phase 2: Launch flow redesign

Goal:
- make campaign setup feel fast and safe

Work:
- `Launch campaign` entry split into `Reuse previous campaign` and `New campaign`
- implement reuse/clone behavior
- make capability selection optional and expandable
- make `Copy link`, `Invite one`, and `Bulk upload` peer send actions

Expected outcome:
- campaign creation becomes a guided operational flow instead of a form-first workflow

### Phase 3: Campaign list and campaign detail restructuring

Goal:
- make campaign surfaces action-oriented

Work:
- make `Copy link` the key row action in the campaigns list
- make `Invite participants` easier from campaign surfaces
- consider making campaign open into the participants/results view by default
- reorder or reframe campaign tabs around usage

Expected outcome:
- campaign pages become a place to act, not just inspect

### Phase 4: Results access simplification

Goal:
- reduce time-to-report

Work:
- strengthen `Open results` from participant/session rows
- improve report/view handoff from result context
- ensure client users can move from campaign or participants view to result/report with minimal clicks

Expected outcome:
- reviewing results becomes the second major fast path after launching campaigns

### Phase 5: Favorites / pinned campaigns

Goal:
- support repeated operational access for recurring campaign types

Work:
- allow a small set of pinned/favorite campaigns
- surface them in the dashboard

Expected outcome:
- repeated users can get to their most-used campaign setups even faster

---

## Acceptance Criteria

This redesign is successful when:

1. A client user can create or reuse a campaign without training.
2. A client user can copy the campaign link in one obvious action from the dashboard or campaign list.
3. A client user can invite participants without hunting through settings.
4. A client user can find a participant or recent result quickly from either the dashboard or participants page.
5. Capability tailoring is available, but does not block the default launch path.
6. The client portal feels like a focused product surface, not a reduced admin surface.

---

## Open Questions

These remain worth validating during implementation:

- whether campaign detail should default to `Participants` or a renamed `Results` tab
- whether the top 3 active campaigns fit cleanly on the dashboard at all breakpoints
- whether `Assessments` should remain in the client nav once dashboard/launch improvements land
- the precise shape of the capability selector interaction within the launch flow
