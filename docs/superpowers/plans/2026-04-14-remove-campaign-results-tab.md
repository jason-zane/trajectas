# Remove Campaign Results Tab + Improve Access Links

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant "Results" tab from campaigns across all three portals (admin, client, partner), and add toggle (activate/deactivate) + delete capabilities to campaign access links.

**Architecture:** Delete the three results route directories, the shared CampaignResultsHub component and its sub-components, the `campaign-results.ts` server action file, and the `getCampaignSessions` action (only consumer). Remove the "Results" tab entry from the shared campaign detail shell. Add `reactivateAccessLink` and `deleteAccessLink` server actions and update the access links UI to support toggling and deletion.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase

---

### Task 1: Remove the "Results" tab from campaign navigation

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx:11` (the `allTabs` array)

- [ ] **Step 1: Remove the Results tab entry**

In `campaign-detail-shell.tsx`, remove this line from the `allTabs` array:

```ts
  { label: "Results", segment: "results" },
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | head -30` or `npx tsc --noEmit`
Expected: No errors related to the tabs change (results pages still exist but are just unreachable)

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/campaign-detail-shell.tsx
git commit -m "Remove Results tab from campaign navigation"
```

---

### Task 2: Delete the three results route directories

**Files:**
- Delete: `src/app/(dashboard)/campaigns/[id]/results/` (entire directory)
- Delete: `src/app/client/campaigns/[id]/results/` (entire directory)
- Delete: `src/app/partner/campaigns/[id]/results/` (entire directory)

- [ ] **Step 1: Delete admin results route**

```bash
rm -rf src/app/\(dashboard\)/campaigns/\[id\]/results
```

- [ ] **Step 2: Delete client results route**

```bash
rm -rf src/app/client/campaigns/\[id\]/results
```

- [ ] **Step 3: Delete partner results route**

```bash
rm -rf src/app/partner/campaigns/\[id\]/results
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS — no other code imports from these routes

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Delete campaign results route directories (admin, client, partner)"
```

---

### Task 3: Delete the shared results components

**Files:**
- Delete: `src/components/results/campaign-results-hub.tsx`
- Delete: `src/components/results/results-by-session-table.tsx`
- Delete: `src/components/results/results-factor-scores-table.tsx`

Before deleting, verify these are only imported by the (now-deleted) results pages:

- [ ] **Step 1: Verify no remaining imports**

```bash
rg "campaign-results-hub|ResultsBySessionTable|ResultsFactorScoresTable" src/ --type ts --type tsx
```

Expected: No matches (the results pages are already deleted)

- [ ] **Step 2: Delete the three component files**

```bash
rm src/components/results/campaign-results-hub.tsx
rm src/components/results/results-by-session-table.tsx
rm src/components/results/results-factor-scores-table.tsx
```

- [ ] **Step 3: Check if the results directory is now empty or has other files**

```bash
ls src/components/results/
```

If other files remain (e.g., `participant-detail-view.tsx`), leave the directory. If empty, delete it.

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Delete shared campaign results hub components"
```

---

### Task 4: Delete the campaign-results server action file

**Files:**
- Delete: `src/app/actions/campaign-results.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
rg "campaign-results" src/ --type ts --type tsx -g '!*.md'
```

Expected: No matches in `.ts`/`.tsx` files

- [ ] **Step 2: Delete the file**

```bash
rm src/app/actions/campaign-results.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Delete getCampaignFactorScores server action (unused)"
```

---

### Task 5: Remove getCampaignSessions from sessions action file

**Files:**
- Modify: `src/app/actions/sessions.ts:457-end` (the `getCampaignSessions` export and its `CampaignSessionRow` type)

- [ ] **Step 1: Verify no remaining callers**

```bash
rg "getCampaignSessions|CampaignSessionRow" src/ --type ts --type tsx
```

Expected: Only matches in `src/app/actions/sessions.ts` itself (the definition)

- [ ] **Step 2: Remove the getCampaignSessions function and CampaignSessionRow type**

Delete the `CampaignSessionRow` type and the `getCampaignSessions` export function from `src/app/actions/sessions.ts`. These should be near the end of the file (around line 457+). Also remove any imports that become unused after this deletion.

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/sessions.ts
git commit -m "Remove getCampaignSessions (no longer used)"
```

---

### Task 6: Add reactivateAccessLink and deleteAccessLink server actions

**Files:**
- Modify: `src/app/actions/campaigns.ts` (add two new server actions after `deactivateAccessLink` ~line 1333)

- [ ] **Step 1: Add reactivateAccessLink action**

Add this function after `deactivateAccessLink` in `src/app/actions/campaigns.ts`. It follows the same pattern as `deactivateAccessLink` but sets `is_active: true`:

```ts
export async function reactivateAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .update({ is_active: true })
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('reactivateAccessLink', error)
    return { error: 'Unable to reactivate access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.reactivated',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}
```

- [ ] **Step 2: Add deleteAccessLink action**

Add this function immediately after `reactivateAccessLink`. No FK references exist to `campaign_access_links`, so a hard delete is safe:

```ts
export async function deleteAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .delete()
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('deleteAccessLink', error)
    return { error: 'Unable to delete access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.deleted',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/campaigns.ts
git commit -m "Add reactivateAccessLink and deleteAccessLink server actions"
```

---

### Task 7: Update CampaignAccessLinks UI to support toggle and delete

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx`

The current UI only shows a deactivate button (XCircle) for active links. Update it to:
- Show a **toggle** button for active/inactive (deactivate active links, reactivate inactive links)
- Show a **delete** button (Trash2) for all links, with a confirmation

- [ ] **Step 1: Update imports**

In `campaign-access-links.tsx`, update the imports:

```ts
import { Plus, Copy, XCircle, Link2, Power, Trash2 } from "lucide-react";
import {
  createAccessLink,
  deactivateAccessLink,
  reactivateAccessLink,
  deleteAccessLink,
} from "@/app/actions/campaigns";
```

Remove `XCircle` from the import (replaced by `Power`).

- [ ] **Step 2: Add handler functions**

Add these handlers alongside the existing `handleDeactivate`:

```ts
async function handleToggleActive(linkId: string, currentlyActive: boolean) {
  const result = currentlyActive
    ? await deactivateAccessLink(campaignId, linkId)
    : await reactivateAccessLink(campaignId, linkId);
  if (result?.error) {
    toast.error(result.error);
    return;
  }
  toast.success(currentlyActive ? "Link deactivated" : "Link activated");
}

async function handleDelete(linkId: string) {
  if (!confirm("Delete this access link? This cannot be undone.")) return;
  const result = await deleteAccessLink(campaignId, linkId);
  if (result?.error) {
    toast.error(result.error);
    return;
  }
  toast.success("Link deleted");
}
```

You can remove the old `handleDeactivate` function since `handleToggleActive` replaces it.

- [ ] **Step 3: Update the link row actions**

Replace the current action buttons section (the Badge + Copy + XCircle buttons at the end of each link row) with:

```tsx
<Badge variant={link.isActive ? "default" : "outline"}>
  {link.isActive ? "Active" : "Inactive"}
</Badge>
{link.isActive && (
  <Button
    size="icon"
    variant="ghost"
    className="size-8"
    onClick={() => copyUrl(link.token)}
  >
    <Copy className="size-3.5" />
  </Button>
)}
<Button
  size="icon"
  variant="ghost"
  className="size-8 text-muted-foreground hover:text-foreground"
  onClick={() => handleToggleActive(link.id, link.isActive)}
  title={link.isActive ? "Deactivate link" : "Activate link"}
>
  <Power className="size-3.5" />
</Button>
<Button
  size="icon"
  variant="ghost"
  className="size-8 text-muted-foreground hover:text-destructive"
  onClick={() => handleDelete(link.id)}
  title="Delete link"
>
  <Trash2 className="size-3.5" />
</Button>
```

Key changes from current UI:
- Copy button only shows when link is active (no point copying an inactive link)
- Power icon always shows and toggles between activate/deactivate
- Trash2 icon always shows for permanent deletion

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx
git commit -m "Add toggle and delete actions to campaign access links UI"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full build check**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify no dead references to results tab**

```bash
rg "campaign-results-hub|ResultsBySessionTable|ResultsFactorScoresTable|getCampaignFactorScores" src/ --type ts --type tsx
```

Expected: No matches

- [ ] **Step 3: Manually test access link toggle and delete**

Navigate to a campaign's Participants or Settings page where access links are shown. Verify:
- Clicking the Power icon on an active link deactivates it (badge changes to "Inactive", copy button hides)
- Clicking the Power icon on an inactive link reactivates it (badge changes to "Active", copy button shows)
- Clicking the Trash icon shows a confirmation dialog; confirming removes the link from the list

- [ ] **Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: clean up stray references after results tab removal"
```
