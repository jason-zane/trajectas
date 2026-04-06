# Partner Entitlements — Schema, Actions & Admin UI

## Context

Partners currently have no entitlement system. Platform admins can't control which assessments or report templates a partner has access to, can't set usage quotas, and can't enable/disable branding customisation at the partner level. This is the data foundation for the broader partner portal buildout.

The design mirrors the existing client entitlement model (`client_assessment_assignments`, `client_report_template_assignments`, `clients.can_customize_branding`) at the partner level, adding hierarchical enforcement so partners control what their clients can access.

## Design Decisions

- **Mirror the client model** — same table structure, same action patterns, same admin UI layout. Consistency over novelty.
- **Independent quotas at each level** — platform sets a partner quota, partner sets client quotas. Both are checked independently. A client hitting their limit doesn't mean the partner is out; the partner can reallocate.
- **Partner controls client branding** — if the partner's `can_customize_branding` is off, none of their clients can customise branding. The partner acts as a gatekeeper.
- **Read-time cascading** — branding and assessment availability are checked at read time, not enforced by write-time cascades. Toggling a partner flag doesn't bulk-update client records.
- **Admin UI on partner settings tab** — matches the client settings page pattern (feature flags + assignment tables).

---

## 1. Schema Changes

### 1a. New column on `partners` table

```sql
ALTER TABLE partners ADD COLUMN can_customize_branding BOOLEAN NOT NULL DEFAULT false;
```

### 1b. New table: `partner_assessment_assignments`

Mirrors `client_assessment_assignments` exactly (uses `is_active` pattern, includes `assigned_by`, `updated_at`, proper FKs and indexes):

```sql
CREATE TABLE partner_assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  quota INTEGER,  -- NULL = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, assessment_id)
);

CREATE INDEX idx_partner_assessment_assignments_partner
  ON partner_assessment_assignments(partner_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON partner_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

RLS policies:
- Platform admins: full access
- Partner admins: read access to their own partner's rows

### 1c. New table: `partner_report_template_assignments`

Mirrors `client_report_template_assignments`:

```sql
CREATE TABLE partner_report_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, report_template_id)
);

CREATE INDEX idx_partner_report_template_assignments_partner
  ON partner_report_template_assignments(partner_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON partner_report_template_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

RLS policies: same pattern as above.

### 1d. Partner quota usage SQL function

Mirrors `get_assessment_quota_usage` but scoped to partner (counts across all partner's clients):

```sql
CREATE OR REPLACE FUNCTION get_partner_assessment_quota_usage(
  p_partner_id UUID,
  p_assessment_id UUID
) RETURNS INTEGER AS $$
  SELECT COALESCE(COUNT(DISTINCT cp.id), 0)::INTEGER
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON cp.campaign_id = ca.campaign_id
  JOIN campaigns c ON cp.campaign_id = c.id
  JOIN clients cl ON c.client_id = cl.id
  WHERE cl.partner_id = p_partner_id
    AND ca.assessment_id = p_assessment_id
    AND cp.status NOT IN ('abandoned', 'withdrawn')
$$ LANGUAGE sql STABLE;
```

RLS policies: same pattern as above.

---

## 2. Server Actions

### 2a. New file: `src/app/actions/partner-entitlements.ts`

Mirrors `src/app/actions/client-entitlements.ts`.

**Assessment assignment functions:**
- `getPartnerAssessmentAssignments(partnerId)` — returns assigned assessments with quota and usage. Auth: `requirePartnerAccess(partnerId)` then `canAccessPartner(scope, partnerId)`.
- `assignAssessmentToPartner(partnerId, assessmentId, quota?)` — creates assignment row with `assigned_by`. Auth: `requirePartnerAccess(partnerId)` then `assertAdminOnly(scope)`.
- `removeAssessmentFromPartner(partnerId, assessmentId)` — sets `is_active = false`. Auth: `requirePartnerAccess(partnerId)` then `assertAdminOnly(scope)`. **Edge case:** if any clients still have this assessment assigned (via `client_assessment_assignments` where `is_active = true`), block removal with error "Remove this assessment from all clients first." This prevents orphaned client assignments.
- `updatePartnerAssessmentQuota(partnerId, assessmentId, quota)` — updates quota. Auth: same as above. Reducing quota below current usage is allowed — existing sessions are grandfathered, only new invitations are blocked.

**Report template functions** — use a combined toggle pattern matching client entitlements:
- `getPartnerReportTemplateAssignments(partnerId)` — returns assigned templates. Auth: `requirePartnerAccess(partnerId)`.
- `togglePartnerReportTemplateAssignment(partnerId, templateId, assigned: boolean)` — upsert/deactivate pattern matching `toggleReportTemplateAssignment` in client entitlements. Auth: `requirePartnerAccess(partnerId)` then `assertAdminOnly(scope)`.

**Branding toggle:**
- `togglePartnerBranding(partnerId, canCustomize: boolean)` — sets `can_customize_branding` to the explicit value (not read-and-flip, avoids race conditions). Auth: `requirePartnerAccess(partnerId)` then `assertAdminOnly(scope)`. Zone 1 immediate with toast.

### 2b. Modify: `src/app/actions/client-entitlements.ts`

**Assessment assignment guard:** In `assignAssessmentToClient`, if the client has a `partner_id`, check that the assessment exists in `partner_assessment_assignments` for that partner before allowing the assignment. If not, return an error: "This assessment is not available through the partner's allocation."

**Branding cascade (read-time):** The existing check for `can_customize_branding` on clients needs to also verify the partner's flag if the client belongs to a partner. This affects:
- The client settings UI — show the branding toggle as disabled with "Controlled by partner" note when the partner has branding off.
- The client portal brand page — check both client and partner flags before rendering the editor.
- The campaign branding page — when resolving inherited brand, the cascade check should respect partner override.

**Implementation approach:** Add a helper `isClientBrandingEnabled(clientId)` that checks both the client's own flag AND the partner's flag (if partner exists). Use this everywhere instead of reading `client.can_customize_branding` directly.

### 2c. Quota enforcement

**New helper in `partner-entitlements.ts`:** `checkPartnerQuotaAvailability(partnerId, assessmentId)` — calls the SQL function `get_partner_assessment_quota_usage(partnerId, assessmentId)` via `db.rpc()`, compares against the partner's quota from `partner_assessment_assignments`. Returns `{ available: boolean, usage: number, quota: number | null }`.

**Modify `checkQuotaAvailability` in `src/app/actions/client-entitlements.ts`:** After the existing client-level quota check passes, if the client has a `partner_id`, also call `checkPartnerQuotaAvailability`. Both must pass. If the partner quota is exceeded, return an error distinguishing it from client quota ("Partner allocation exhausted for this assessment").

**Call site:** `checkQuotaAvailability` is called from `src/app/actions/campaigns.ts` (in `inviteParticipant`). No changes needed at the call site — the function internally resolves the partner and checks both levels. When `partner_id` is null, the partner check is a no-op.

---

## 3. Admin UI — Partner Settings Tab

### 3a. Partner detail shell

The "Settings" tab already exists in the partner detail shell tabs array. No change needed — just verify the route `src/app/(dashboard)/partners/[slug]/settings/page.tsx` is created to serve it.

### 3b. Partner settings page

**New files:**
- `src/app/(dashboard)/partners/[slug]/settings/page.tsx` — server component
- `src/app/(dashboard)/partners/[slug]/settings/partner-settings-panel.tsx` — client component
- `src/app/(dashboard)/partners/[slug]/settings/loading.tsx` — shimmer skeleton

**Layout:** Three cards, matching the client settings page:

1. **Feature Flags** — `can_customize_branding` toggle. Label: "Custom Branding". Description: "Allow this partner and their clients to customise their own brand." Zone 1 immediate toggle with toast confirmation.

2. **Assessment Assignments** — table with columns: Assessment Name, Quota (editable, or "Unlimited"), Usage (live count), Remove button. "Assign Assessment" button at the top opens a picker dialog listing all assessments not yet assigned. Quota is optional (null = unlimited).

3. **Report Template Assignments** — table with columns: Template Name, Remove button. "Assign Template" button opens a picker dialog.

### 3c. Client settings page update

When the client belongs to a partner and the partner has `can_customize_branding` disabled:
- The branding toggle renders as disabled (greyed out)
- Helper text below: "Brand customisation is controlled by the partner. Contact the partner admin to enable."

When the client belongs to a partner, the assessment assignment picker only shows assessments from the partner's pool (not all assessments on the platform).

---

## Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/00073_partner_entitlements.sql` | Schema: `can_customize_branding` column, two assignment tables, quota RPC function, RLS, indexes, triggers |
| `src/app/actions/partner-entitlements.ts` | Server actions for partner assignments and branding toggle |
| `src/app/(dashboard)/partners/[slug]/settings/page.tsx` | Partner settings page (server component) |
| `src/app/(dashboard)/partners/[slug]/settings/partner-settings-panel.tsx` | Partner settings panel (client component) |
| `src/app/(dashboard)/partners/[slug]/settings/loading.tsx` | Shimmer loading state |

## Files to Modify

| File | Changes |
|---|---|
| `src/types/database.ts` | Add `canCustomizeBranding` to `Partner` interface. Add `PartnerAssessmentAssignment`, `PartnerReportTemplateAssignment` types. |
| `src/lib/supabase/mappers.ts` | Add `mapPartnerAssessmentAssignmentRow`, `mapPartnerReportTemplateAssignmentRow` mapper functions |
| `src/app/actions/client-entitlements.ts` | Add partner pool guard on `assignAssessmentToClient`, add `isClientBrandingEnabled` helper, extend `checkQuotaAvailability` with partner-level check |
| `src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx` | Show branding toggle as disabled with "Controlled by partner" when partner flag is off; limit assessment picker to partner pool |
| `src/app/client/settings/brand/client/page.tsx` (client portal route) | Use `isClientBrandingEnabled` instead of direct `can_customize_branding` flag check |

## Files NOT Changed

- `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx` — "Settings" tab already exists in the tabs array
- `src/app/actions/brand.ts` — already handles partner branding (auth was widened in prior work)
- `src/app/actions/campaigns.ts` — calls `checkQuotaAvailability` which is modified internally; call site unchanged
- Brand editor components — already built and reusable
- `partners` table core schema — only adding a column, not restructuring
- Assessment runner — quota checked at session creation, not during assessment

## Verification

1. `npm run db:push` — migration applies cleanly
2. Regenerate Supabase types after migration
3. `npm run test:unit` — all tests pass
4. `npx tsc --noEmit` — clean compilation
4. **Admin: partner settings** — navigate to `/partners/[slug]/settings`, see feature flags + assignment tables
5. **Assign assessment to partner** — picker shows all assessments, can set quota, assignment appears in table
6. **Assign assessment to client** — when client belongs to a partner, picker only shows assessments from partner's pool
7. **Quota enforcement** — create sessions up to partner quota, verify next session is blocked
8. **Branding cascade** — disable partner branding → client branding toggle greys out → client portal brand page shows disabled message
9. **Branding cascade (enable)** — enable partner branding → client toggle becomes active → client can edit brand
