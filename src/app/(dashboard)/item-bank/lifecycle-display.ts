/**
 * Presentation vocabulary for the item bank admin (LR-8 / #347).
 *
 * Deliberately dependency-free and keyed by plain `string`:
 *
 *   - `src/lib/dal/item-bank-admin.ts` is `server-only`, so its runtime
 *     `ITEM_LIFECYCLE_STATES` const cannot be pulled into a client component.
 *     Everything here is looked up with a fallback instead, which also means a
 *     lifecycle state added in a migration renders as itself rather than
 *     crashing or silently disappearing from a table.
 *   - This module contains NO policy. It does not say which transitions are
 *     legal (the database function `item_lifecycle_legal_transitions()` owns
 *     that — see `getItemLifecycleTransitions()`), and it does not say which
 *     sign-offs a state requires (see ./signoff-policy.ts).
 *
 * DIFFICULTY IS A DESIGN PRIOR. Every helper here that formats a difficulty
 * number is named `...Prior...` and every caller pairs it with a visible
 * marker. See ./difficulty-prior.tsx for the rationale and the UI treatment.
 */

export type LifecycleTone = 'neutral' | 'progress' | 'positive' | 'caution' | 'danger'

export type LifecycleDisplay = {
  label: string
  /** One line a reviewer can act on, not a restatement of the state name. */
  description: string
  tone: LifecycleTone
}

const LIFECYCLE_DISPLAY: Record<string, LifecycleDisplay> = {
  draft: {
    label: 'Draft',
    description: 'Ingested but unreviewed. No sign-off has been recorded.',
    tone: 'neutral',
  },
  content_reviewed: {
    label: 'Content reviewed',
    description: 'A content sign-off stands. Fairness review is still outstanding.',
    tone: 'progress',
  },
  fairness_reviewed: {
    label: 'Fairness reviewed',
    description: 'Both sign-offs stand. Cleared to enter piloting.',
    tone: 'progress',
  },
  piloting: {
    label: 'Piloting',
    description: 'Collecting responses. No calibrated parameters yet.',
    tone: 'progress',
  },
  calibrated: {
    label: 'Calibrated',
    description: 'Pilot data has produced measured item parameters.',
    tone: 'positive',
  },
  operational: {
    label: 'Operational',
    description: 'In live service and reachable by candidates.',
    tone: 'positive',
  },
  suspended: {
    label: 'Suspended',
    description: 'Withdrawn from service pending a decision.',
    tone: 'caution',
  },
  retired: {
    label: 'Retired',
    description: 'Permanently withdrawn. Retained for historical scoring.',
    tone: 'caution',
  },
  killed: {
    label: 'Killed',
    description: 'Rejected outright and never delivered.',
    tone: 'danger',
  },
}

/** Reading order for lifecycle breakdowns; unknown states are appended by the caller. */
export const LIFECYCLE_ORDER = [
  'draft',
  'content_reviewed',
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
  'suspended',
  'retired',
  'killed',
] as const

export function lifecycleDisplay(state: string): LifecycleDisplay {
  return (
    LIFECYCLE_DISPLAY[state] ?? {
      label: state.replace(/_/g, ' '),
      description: 'Unrecognised lifecycle state — added by a migration this UI has not been taught about.',
      tone: 'neutral',
    }
  )
}

const TONE_CLASS: Record<LifecycleTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  progress: 'bg-info/10 text-info',
  positive: 'bg-[var(--emerald)]/10 text-[var(--emerald-dark)]',
  caution: 'bg-[var(--gold)]/15 text-[var(--emerald-dark)]',
  danger: 'bg-destructive/10 text-destructive',
}

export function lifecycleToneClass(state: string): string {
  return TONE_CLASS[lifecycleDisplay(state).tone]
}

/**
 * The per-distractor error vocabulary, from
 * docs/.../03-logical-reasoning-design.md §3.4 and §7.5, matching the CHECK
 * constraint on the diagnostics table.
 *
 * A code with no entry here still renders (as itself) rather than vanishing.
 */
const ERROR_LABELS: Record<string, { name: string; description: string }> = {
  WR: {
    name: 'Wrong rule',
    description: 'Applies a plausible but incorrect rule — e.g. addition where subtraction operates.',
  },
  IR: {
    name: 'Incomplete rule',
    description: 'Correct on a subset of the operating rules, violating exactly one. The classic near-miss.',
  },
  PM: {
    name: 'Perceptual match',
    description: 'Resembles the texture of nearby grid cells without satisfying the rules. Captures gist-matching.',
  },
  RP: {
    name: 'Repetition',
    description: 'Copies an existing grid cell, typically an adjacent one. Captures "continue what I last saw".',
  },
  CNV: {
    name: 'Illicit conversion',
    description: 'Treats "All A are B" as "All B are A", or converts an O-proposition.',
  },
  OVG: {
    name: 'Overgeneralisation',
    description: 'Upgrades a particular ("some") to a universal ("all" / "no").',
  },
  UMD: {
    name: 'Undistributed middle',
    description: 'Links terms through a middle term that licenses no link.',
  },
  ATM: {
    name: 'Atmosphere',
    description: 'Conclusion matches the mood of the premises without being entailed by them.',
  },
  REV: {
    name: 'Inverted rule reading',
    description: 'Confuses "if VEX then red" with "if red then VEX".',
  },
}

export function errorLabelDisplay(code: string): { name: string; description: string } {
  return (
    ERROR_LABELS[code] ?? {
      name: code,
      description: 'Unrecognised error code — recorded against this distractor but not in this UI’s vocabulary.',
    }
  )
}

const BAND_LABELS: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  very_hard: 'Very hard',
}

export const DIFFICULTY_PRIOR_BAND_ORDER = ['easy', 'moderate', 'hard', 'very_hard'] as const

export function difficultyPriorBandLabel(band: string | null): string {
  if (!band) return 'Unbanded'
  return BAND_LABELS[band] ?? band.replace(/_/g, ' ')
}

/** Formats a design-prior logit. Callers MUST pair this with a visible prior marker. */
export function formatDifficultyPriorB(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(2)
}

/** A reviewer identity line: name if we have one, else email, else the raw id. */
export function reviewerLabel(name: string | null, email: string | null, profileId: string): string {
  return name ?? email ?? profileId
}
