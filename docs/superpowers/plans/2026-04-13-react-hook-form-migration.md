# React Hook Form Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the three largest manual form state components to React Hook Form + Zod, eliminating bespoke validation state, inconsistent error timing, and fragile `isDirty` tracking — which will make `useUnsavedChanges` more reliable and reduce component complexity.

**Architecture:** `react-hook-form` with `@hookform/resolvers/zod` for Zod schema validation (already used project-wide). Existing Zod schemas are reused. `form.formState.isDirty` replaces manual dirty tracking. Field arrays (`useFieldArray`) replace manual array manipulation for sections and items. Migration is incremental — one component at a time, not a big-bang rewrite.

**Tech stack:** `react-hook-form`, `@hookform/resolvers`

**Key reference files:**
- Construct form: `src/app/(dashboard)/constructs/[id]/` — find construct form component (~28KB)
- Section configurator: search for `section-configurator` in `src/components/` (~29KB)
- Assessment builder: `src/app/(dashboard)/assessments/[id]/builder/` (~26KB)
- Existing Zod schemas: search for `z.object` in the same directories
- `useUnsavedChanges`: `src/hooks/use-unsaved-changes.ts`

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install react-hook-form @hookform/resolvers`
- [ ] Read `node_modules/react-hook-form/README.md` — confirm `useForm`, `useFieldArray`, `Controller`, `FormProvider`, `useFormContext` API shapes
- [ ] Do NOT start migrating before reading — RHF has subtle controlled/uncontrolled distinctions that matter here

### Phase 2 — Create shared form component wrappers

- [ ] Create `src/components/ui/form.tsx` — RHF-aware wrappers for the project's existing input/select/textarea UI components:
  - `<FormField>` — wraps `Controller` with error display
  - `<FormItem>` — spacing wrapper
  - `<FormLabel>` — label with required indicator
  - `<FormMessage>` — error message display using `.text-caption` class
- [ ] These wrappers should compose with the existing `Input`, `Select`, `Textarea` components — not replace them

### Phase 3 — Migrate construct form (target: highest complexity)

- [ ] Read the construct form component fully before starting
- [ ] Extract or confirm the existing Zod schema for construct data
- [ ] Replace `useState` form fields with `useForm<ConstructFormValues>({ resolver: zodResolver(constructSchema), defaultValues })`
- [ ] Replace manual `isDirty` tracking with `formState.isDirty` passed to `useUnsavedChanges`
- [ ] Replace manual validation with RHF validation mode `onBlur`
- [ ] Replace form submission handler with `handleSubmit(onSubmit)` — `onSubmit` calls the existing server action
- [ ] Confirm auto-save fields (description, definition) still use `useAutoSave` — they should NOT be under RHF control (they are Zone 3; the form is Zone 2). Use `Controller` with `shouldUnregister: false` or keep them as uncontrolled outside the form.
- [ ] Run dev server and manually test: create, edit, unsaved changes warning, save, error states

### Phase 4 — Migrate section configurator

- [ ] Read the section configurator component before starting
- [ ] Identify the dynamic array of sections — replace with `useFieldArray({ name: 'sections' })`
- [ ] `fields.map(...)` replaces the current sections array `.map(...)`
- [ ] `append`, `remove`, `move` replace manual array state mutations
- [ ] `move` enables the reorder-on-drop handler to update form state atomically
- [ ] Test: add section, remove section, reorder section, unsaved changes on all three actions

### Phase 5 — Migrate assessment builder structural form

- [ ] Assessment builder is the most complex — read it fully before starting
- [ ] Scope: only the structural metadata form (assessment name, settings, section structure) — NOT the item editor inline forms (those can remain manual for now)
- [ ] Use `FormProvider` to share form context across the builder's sub-components
- [ ] Use `useFormContext` in child components that currently receive prop-drilled form state

### Phase 6 — Update useUnsavedChanges integration

- [ ] After each migration, confirm `useUnsavedChanges(formState.isDirty)` works correctly:
  - Navigate away with dirty form → dialog appears
  - Save successfully → `form.reset(savedValues)` → `isDirty` becomes false → no dialog
- [ ] Remove any manual `isDirty` boolean state that was replaced

---

## Acceptance criteria

- Construct form validation shows errors on blur (not on submit)
- `isDirty` correctly reflects whether the user has changed any field
- Section array reorder updates form state and isDirty flag
- Unsaved changes dialog appears on navigate-away with dirty form
- Form reset after successful save clears isDirty correctly
- Auto-save text fields (description, definition) are NOT affected by RHF (they operate independently)
- Component file sizes are meaningfully reduced (target: ~30% reduction in the migrated components)
