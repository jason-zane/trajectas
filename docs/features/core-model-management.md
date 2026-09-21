# Core model management

Platform administrators use **Library → Core Model** (`/model-management`) in the platform workspace to control distribution of the shared capability library. Customer-owned factors are not included.

| Control | Effect |
| --- | --- |
| Role matching | Updates the existing `is_match_eligible` flag used by the matching pipeline. Outcome and level applicability continue to narrow each role's candidate pool. |
| Assessment building | Controls new capability selections in the assessment builder. Inactive/deleted/draft capabilities remain excluded. Existing assessment selections can be retained. Internal system-scoped campaign creation keeps its existing behavior. |
| Public library | Publishes active platform-owned reference information on `/capability-model`. This is independent of matching and assessment availability. |

Switches save immediately. Search and filters help select a subset for bulk changes. A mixed selection containing an unavailable capability is rejected in full when enabling; disable remains available for cleanup. Open the capability name to edit grouping, definition, applicability, or readiness.

Readiness is an editorial completeness workflow, not psychometric validation. Enabling matching/assessment requires a non-draft capability. Existing matching does not require the stricter `match_ready` tier. Publishing requires a primary category and nonempty definition. Existing channel flags can remain configured on while an inactive/draft capability is unavailable in its consumer; the screen shows the reason.

## Rollout

Apply `20260921012943_capability_channel_controls.sql` on local Supabase and run integration checks before the production migration/app rollout. The migration was verified on local Supabase and applied to production on21 September2026. Assessment eligibility defaults true to preserve existing selection behavior; public visibility defaults false for future additions. The launch migration publishes the26 existing active, categorised, non-draft capabilities with definitions. The three drafts remain private. The development-only public snapshot intentionally remains a read-only library preview and does not reflect these publication flags.

The management UI has no production auth bypass. The ignored local Vite harness at `http://127.0.0.1:3118/manage.html` is a labelled simulation for reviewing the component without a local database.
