# On-demand report generation — design stub (parked)

> Status: **Parked** — not in scope for the current report-attachment work.
> Captured here so the model is preserved while we ship the simpler auto-on-submit flow.

## Problem

Today, the only moment a report PDF gets created is when a participant clicks "Submit" on their assessment. The set of reports generated is the union of:

- reports bound to the assessment (`assessment_report_templates`)
- reports explicitly attached to the campaign (`campaign_report_templates`)
- the platform fallback (`report_templates.is_default = true`) if both are empty

If someone — admin, partner, client — later wants a *different* report for a participant whose session has already been submitted, there is no way to do that without re-running the assessment.

This blocks a few legitimate cases:

- Consultant adds a custom "executive coaching brief" report after a cohort finishes and wants it generated retroactively for the whole cohort.
- Admin builds a new template via the block-builder and wants to preview it against a real-but-old session.
- Partner ships a fresh template version and wants to backfill it for all clients without rerunning sessions.

## Shape of the feature

Add an explicit "generate this report for this session" action that is **decoupled from session submit**.

```
   ┌────────────────────────────────────────────────────────────┐
   │  Admin / consultant view of a participant session           │
   │                                                              │
   │  Existing snapshots:                                         │
   │    • 5Brains Report      (auto, ready)                       │
   │    • Cohort summary       (auto, ready)                      │
   │                                                              │
   │  ┌── [+] Generate another report against this session ──┐   │
   │  │ Dropdown: pick a template from the library           │   │
   │  │ → triggers a new report_snapshots row                 │   │
   │  │ → runs through the same runner pipeline               │   │
   │  └───────────────────────────────────────────────────────┘   │
   └────────────────────────────────────────────────────────────┘
```

## Data model implications

Minimal:

- `report_snapshots` already supports many rows per `participant_session_id` (unique constraint is `(participant_session_id, template_id)`). Manually-triggered snapshots fit in the existing shape.
- An additional column `created_via TEXT` (e.g. `'auto_on_submit' | 'manual'`) would let us distinguish them in the UI and in support audits. Not strictly required, but cheap and useful.
- Authorisation: needs to gate by who's allowed to trigger generation. Probably mirrors the existing pattern — platform admins always; partner admins for their clients; client admins for their own data; not participants.

## Server actions

One new action:

```ts
generateReportSnapshot(input: {
  participantSessionId: string
  templateId: string
}): Promise<{ snapshotId: string } | { error: string }>
```

- Validates the caller can act on this session AND can see this template (library visibility).
- Inserts a `report_snapshots` row with `status='pending'` and `template_id` set.
- Defers to the existing runner (no new render path needed).

If the template was already generated for this session, return the existing snapshot id (idempotent) — or allow re-generation behind an explicit `force` flag if we discover a use case.

## UX touch-points

- Participant session detail page (admin view): a "+ Generate another report" action next to the existing snapshot list.
- Bulk action on the campaign session list: "Generate this template for the X selected sessions."

Both pull from the same library list the campaign-extras dropdown uses, scoped by the client's visibility allow-list.

## Why we're not building it now

The auto-on-submit flow plus the new assessment-default binding covers the 80% case. On-demand generation is the long tail. Worth building once a real "I need to backfill" or "I'm iterating on a template" use case shows up. Until then it'd just be a button nobody clicks.

## Related work that lands here when we do build it

- Multi-audience tagging on snapshots (`report_snapshots.audience_type`) — currently dormant. If we add per-audience views (participant sees this, consultant sees that), the on-demand flow is the natural place to set the audience on the new snapshot.
- Template versioning — if a template changes after a snapshot is generated, the snapshot is frozen. On-demand re-generation against the current template version is one resolution path.
