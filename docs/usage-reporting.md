# Usage reporting

Client and partner records have a Usage tab. Both portals also have a Usage link in their sidebar. Business → Usage provides the cross-account view, with partner/client filters and grouping by client, partner or campaign.

Reporting opens on the current month; client Billing opens on the previous completed month. Choose a month, quarter, custom inclusive dates, or All time. The UTC timezone matches the existing billing run. Monthly views have previous/next controls, and the selection is preserved when switching between client Usage and Billing or drilling into a client/partner from Business.

## Count definitions

- **Participants added:** invitations and self-registrations by the participant record's original creation date. Resending an invitation does not move this event into another period.
- **Participants started:** records with a first-start timestamp inside the period.
- **Completed journeys:** participants whose status is completed and whose completion timestamp is inside the period. One journey means finishing all assessments in a campaign, matching the current billing unit.

Events use their own timestamps. A participant added in March and completed in April contributes to March additions and April completions. No period conversion percentage is shown because those totals are different cohorts. 360 raters and soft-deleted participants/campaigns are excluded. Quota allocations and limits are independent of these reports.

CSV exports contain the whole selected period and account scope, including zero-activity rows, UTC boundaries, generation time, count unit and live-report status. Table search only changes the displayed rows. Participant identities are never included.

## Partner attribution and billing

Partner operational totals use each client's current partner, plus separately labelled partner-owned campaigns. These reports are not evidence of historical billing ownership following client reassignment.

Client Billing shows a current-rate estimate for a selected bounded period, or the saved quantity/rate/amount when an existing billing snapshot matches the period. The saved-statement history retains frozen figures and invoice links; a non-zero snapshot with no invoice link is marked as needing reconciliation rather than considered invoiced.

Reporting and exports work with monthly billing off. This release does not change billable units, quota renewal, payer assignments, pricing history, Stripe issuance or its schedule. Choosing a reporting period never sends an invoice. Partner invoicing and custom-period invoicing require explicit payer attribution, historical event allocation and overlap/retry protection before being enabled.

## Implementation and verification

Date helpers and aggregation live in `src/lib/usage/`; privileged reads live in `src/lib/dal/usage-report.ts` and `usage-statements.ts`. Every report resolves its authorised workspace and applies explicit tenant predicates. Queries are paginated in stable id order before aggregation, including portfolios exceeding the PostgREST row limit. Saved statements are platform-admin-only.

Tests cover UTC boundaries, leap months, malformed ranges, independent event dates, idle clients, partner-owned activity, stale partner copies, more than 1,000 events, CSV formula escaping, lower database row caps, partial-query failures and authorization denial. Local browser verification covers account drill-down, month selection, inclusive single-day dates, Billing tab period retention, CSV totals, partner/client portals, cross-client denial and the mobile layout.
