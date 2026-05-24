/**
 * steering.ts — shared prompt blocks for measurement mode, audience,
 * use-context, and playbook injection.
 *
 * Each block returns a non-empty string when it has content to contribute,
 * or an empty string when the input is absent. Callers concatenate the
 * non-empty blocks with `\n\n` to compose the user prompt.
 */
import type {
  Audience,
  MeasurementMode,
  PlaybookSnapshot,
  UseContext,
} from '@/types/database'

// =============================================================================
// Measurement mode
// =============================================================================

const MODE_GUIDANCE: Record<Exclude<MeasurementMode, 'open'>, string> = {
  behavioural: `**Measurement mode: Behavioural.**
Write stems that describe an observable behaviour, action, or pattern of behaviour
that the respondent (or rater) can endorse, disagree with, or recognise. Prefer
present-tense first-person declaratives ("I do X", "I tend to Y") for self-report.
Avoid abstract personality claims and inner-state language; the respondent should
be able to point to a *behaviour they do* (or have seen done).`,

  trait: `**Measurement mode: Trait / disposition.**
Write stems that capture an enduring tendency or disposition, not a single
behavioural episode. First-person declaratives are fine, and abstract phrasing
is acceptable here ("I am the kind of person who...", "I generally prefer...").
Items should generalise across contexts — if a stem only makes sense in one
specific situation, it belongs in behavioural or situational mode.`,

  capability: `**Measurement mode: Capability / can-do.**
Write stems that ask whether the respondent can perform, understand, or
produce something. Frame as ability claims ("I can...", "I know how to...",
"I am able to...") or as task descriptions where the respondent rates how well
they can do it. Anchor to observable performance, not preference or willingness.
For knowledge items, prefer specific procedural statements over vague competence
claims.`,

  situational: `**Measurement mode: Situational judgement.**
Each stem is a short scenario (1–3 sentences) followed by an implicit "what
would you do" or "how effective is this response". The respondent is judging a
response option, not endorsing a trait. The scenario must be realistic, work-
or context-relevant, and contain enough information that the right answer is
defensible — but not so much that the answer is obvious. Avoid trick scenarios
and culturally narrow examples.`,
}

export function renderMeasurementModeBlock(
  mode?: MeasurementMode,
  description?: string,
): string {
  if (!mode) return ''
  if (mode === 'open') {
    return description
      ? `## Measurement Mode (custom)\n${description}`
      : ''
  }
  return `## Measurement Mode\n${MODE_GUIDANCE[mode]}`
}

// =============================================================================
// Audience
// =============================================================================

const LEVEL_GUIDANCE: Record<
  Exclude<NonNullable<Audience['level']>, 'open'>,
  string
> = {
  entry: `entry-level / early-career respondents. Use plain, concrete vocabulary
(roughly B1 reading level for ESL accessibility). Avoid jargon, acronyms, and
abstractions. Frame examples around early-career situations — first projects,
learning the ropes, working under close supervision.`,

  mid: `mid-career respondents with several years of experience. Vocabulary may
include common professional terms but should not require specialist knowledge.
Frame examples around individual-contributor or first-line management situations.`,

  senior: `senior individual contributors and people-managers. Professional
vocabulary is fine; assume comfort with ambiguity and ownership language. Frame
examples around managing teams, owning outcomes, dealing with cross-functional
complexity.`,

  executive: `executive and C-suite respondents. Items may use board-level,
strategic, or financial vocabulary where appropriate. Frame examples around
governance, capital allocation, organisational design, and managing managers.`,

  mixed: `a mixed audience spanning levels. Default to mid-career vocabulary
and frame examples generically enough to be answerable by anyone from
individual contributors to senior managers.`,
}

export function renderAudienceBlock(audience?: Audience): string {
  if (!audience || (!audience.level && !audience.description)) return ''

  const lines: string[] = ['## Audience']
  if (audience.level && audience.level !== 'open') {
    lines.push(`Write for ${LEVEL_GUIDANCE[audience.level]}`)
  } else if (audience.level === 'open' && audience.description) {
    lines.push(`Write for the following audience: ${audience.description}`)
  } else if (audience.description) {
    lines.push(audience.description)
  }
  if (audience.level !== 'open' && audience.description) {
    lines.push(`Additional context: ${audience.description}`)
  }
  return lines.join('\n')
}

// =============================================================================
// Use-context
// =============================================================================

const CONTEXT_GUIDANCE: Record<Exclude<UseContext, 'open'>, string> = {
  development: `**Use-context: Development.**
Items will be used for formative feedback — the respondent (or their rater)
will see results and use them for growth. Tolerate moderate social-desirability
risk if it makes the item meaningful. Prefer growth-friendly framing ("I am
working on..." can be appropriate). Avoid stems that read as gotchas or
catch-22s; the respondent should not feel cornered.`,

  selection: `**Use-context: Selection.**
Items will be used in high-stakes hire/no-hire or promotion decisions. Faking
risk is real, so prefer concretely-anchored observable behaviour over abstract
self-claims. Avoid stems whose obviously-desirable answer is the high-scoring
answer. Where possible, write items that distinguish "endorse it because
they actually do it" from "endorse it because it sounds good".`,

  research: `**Use-context: Research / exploratory.**
Items will be used for psychometric analysis without immediate stakes for the
respondent. Latitude is wider — controversial framings, edge phrasings, and
items that probe extreme tendencies are acceptable. Prefer breadth of coverage
over single-context specificity.`,
}

export function renderUseContextBlock(
  context?: UseContext,
  description?: string,
): string {
  if (!context) return ''
  if (context === 'open') {
    return description
      ? `## Use Context (custom)\n${description}`
      : ''
  }
  return `## Use Context\n${CONTEXT_GUIDANCE[context]}`
}

// =============================================================================
// Playbook (rubric + exemplars)
// =============================================================================

export function renderPlaybookBlock(playbook?: PlaybookSnapshot): string {
  if (!playbook) return ''

  const sections: string[] = []

  if (playbook.rubric && playbook.rubric.trim()) {
    sections.push(`## Writing Playbook\n${playbook.rubric.trim()}`)
  }

  if (playbook.exemplars && playbook.exemplars.length > 0) {
    const lines = playbook.exemplars.map((ex) => {
      const tag = ex.verdict === 'good' ? '✓ Good' : '✗ Avoid'
      return `- **${tag}:** "${ex.stem}" — *${ex.reason}*`
    })
    sections.push(
      `### Exemplars\nImitate the *good* examples in style and specificity. Do not imitate the *avoid* examples — they illustrate failure modes.\n${lines.join('\n')}`,
    )
  }

  // SD tolerance and difficulty mix are advisory — surface them so the
  // model can self-steer.
  const advisories: string[] = []
  if (playbook.sdTolerance) {
    advisories.push(
      `Social-desirability tolerance: ${playbook.sdTolerance}. ${
        playbook.sdTolerance === 'low'
          ? 'Prefer counter-intuitive or behaviourally specific phrasings over claims everyone would want to endorse.'
          : playbook.sdTolerance === 'high'
            ? 'Acceptable to write items whose desirable answer is the high-scoring answer.'
            : 'Some socially-desirable phrasings are acceptable when they are the natural way to express the construct.'
      }`,
    )
  }
  if (playbook.difficultyMix) {
    const parts: string[] = []
    if (typeof playbook.difficultyMix.easy === 'number') {
      parts.push(`~${Math.round(playbook.difficultyMix.easy * 100)}% easy`)
    }
    if (typeof playbook.difficultyMix.moderate === 'number') {
      parts.push(`~${Math.round(playbook.difficultyMix.moderate * 100)}% moderate`)
    }
    if (typeof playbook.difficultyMix.hard === 'number') {
      parts.push(`~${Math.round(playbook.difficultyMix.hard * 100)}% hard`)
    }
    if (parts.length > 0) {
      advisories.push(`Target difficulty mix across this batch: ${parts.join(', ')}.`)
    }
  }
  if (advisories.length > 0) {
    sections.push(`### Playbook Advisories\n${advisories.join('\n')}`)
  }

  return sections.join('\n\n')
}

// =============================================================================
// Critique-specific helpers
// =============================================================================

export function renderCritiqueEmphasisBlock(playbook?: PlaybookSnapshot): string {
  if (!playbook?.critiqueEmphasis?.trim()) return ''
  return `## Critique Emphasis\n${playbook.critiqueEmphasis.trim()}`
}

export function renderCritiqueStrictnessBlock(playbook?: PlaybookSnapshot): string {
  if (!playbook?.critiqueStrictness) return ''
  const strictness = playbook.critiqueStrictness
  const text =
    strictness === 'lenient'
      ? 'Lean toward "keep" when the item is plausible. Only revise or drop items with clear defects.'
      : strictness === 'strict'
        ? 'Lean toward "revise" or "drop". An item should clearly excel against the construct, contrast set, and writing playbook to earn a "keep".'
        : 'Apply standard judgement. Keep items that fit, revise items with fixable issues, drop items with structural problems.'
  return `## Critique Strictness: ${strictness}\n${text}`
}
