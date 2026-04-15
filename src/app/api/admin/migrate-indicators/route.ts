import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * One-time migration: reformat factor indicator text as HTML bullet points,
 * rewrite definitions to remove "stable tendency", and restore AI Exploration.
 *
 * GET /api/admin/migrate-indicators?dry=1   → preview changes
 * GET /api/admin/migrate-indicators?dry=0   → apply changes
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry') !== '0'

  const db = createAdminClient()

  // Fetch all active factors
  const { data: factors, error } = await db
    .from('factors')
    .select('id, name, slug, definition, description, indicators_low, indicators_mid, indicators_high')
    .is('deleted_at', null)
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const changes: Record<string, Record<string, { from: string | null; to: string }>> = {}

  for (const factor of factors ?? []) {
    const updates: Record<string, string> = {}

    // --- AI Exploration: full content restore ---
    if (factor.slug === 'ai-exploration') {
      updates.definition = 'AI Exploration is the capability to engage with AI through proactive testing, iteration, and discovery, using experimentation to build understanding and uncover useful applications.'

      updates.description = 'AI Exploration captures how readily a person engages with AI through active experimentation. It is visible in people who try new approaches, learn from imperfect outputs, and keep iterating long enough to discover what works and where useful applications may exist. The emphasis is not on current mastery, but on exploratory engagement: testing tools, adjusting methods, and using experimentation to expand practical understanding.'

      updates.indicators_low = formatAsBullets([
        'Uses AI in narrow, familiar, or highly cautious ways.',
        'Waits for direction before trying new AI approaches.',
        'Gives up quickly when early outputs are weak.',
        'Stays close to established usage patterns.',
        'Treats poor outputs as reasons to stop rather than signals to refine.',
      ])

      updates.indicators_mid = formatAsBullets([
        'Uses AI beyond the most basic cases, but mainly within familiar boundaries.',
        'Tries alternative prompts or methods when the task clearly requires it.',
        'Learns from some weak outputs, though iteration is inconsistent.',
        'Explores new AI use cases when prompted by task demands or visible opportunities.',
        'Builds understanding through experimentation, but not in a strongly self-directed way.',
      ])

      updates.indicators_high = formatAsBullets([
        'Experiments with AI tools or approaches without waiting for detailed instruction.',
        'Tests alternative prompts, methods, or workflows when outputs are weak.',
        'Uses failed or imperfect outputs as information for refinement.',
        'Explores beyond the immediate task to uncover broader possibilities.',
        'Treats experimentation as a way to build understanding, not just get an answer.',
      ])
    } else {
      // --- Other factors: rewrite definition + reformat indicators ---

      // Rewrite definition: replace "A stable tendency to" with capability-based phrasing
      if (factor.definition) {
        let newDef = factor.definition
        newDef = newDef.replace(/^A stable tendency to /i, `${factor.name} is the capability to `)
        newDef = newDef.replace(/^The stable tendency to /i, `${factor.name} is the capability to `)
        if (newDef !== factor.definition) {
          updates.definition = newDef
        }
      }

      // Reformat indicators: split at semicolons into bullet points
      if (factor.indicators_low) {
        const reformatted = reformatIndicators(factor.indicators_low)
        if (reformatted !== factor.indicators_low) {
          updates.indicators_low = reformatted
        }
      }
      if (factor.indicators_mid) {
        const reformatted = reformatIndicators(factor.indicators_mid)
        if (reformatted !== factor.indicators_mid) {
          updates.indicators_mid = reformatted
        }
      }
      if (factor.indicators_high) {
        const reformatted = reformatIndicators(factor.indicators_high)
        if (reformatted !== factor.indicators_high) {
          updates.indicators_high = reformatted
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const changeDetail: Record<string, { from: string | null; to: string }> = {}
      for (const [field, newVal] of Object.entries(updates)) {
        changeDetail[field] = {
          from: (factor as Record<string, unknown>)[field] as string | null,
          to: newVal,
        }
      }
      changes[`${factor.name} (${factor.id})`] = changeDetail

      if (!dryRun) {
        const { error: updateError } = await db
          .from('factors')
          .update(updates)
          .eq('id', factor.id)
        if (updateError) {
          return NextResponse.json(
            { error: `Failed to update ${factor.name}: ${updateError.message}`, partialChanges: changes },
            { status: 500 },
          )
        }
      }
    }
  }

  return NextResponse.json({
    mode: dryRun ? 'DRY RUN — no changes applied' : 'APPLIED',
    factorsScanned: factors?.length ?? 0,
    factorsChanged: Object.keys(changes).length,
    changes,
  })
}

/** Convert an array of indicator strings into an HTML unordered list. */
function formatAsBullets(items: string[]): string {
  const lis = items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
    .join('')
  return `<ul>${lis}</ul>`
}

/** Split indicator text at semicolons, capitalise, add full stops, format as bullet list. */
function reformatIndicators(text: string): string {
  // If already HTML (contains <ul> or <li>), leave it alone
  if (/<[uo]l|<li/i.test(text)) return text

  // Split at semicolons
  const parts = text.split(/;\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) {
    // No semicolons — try splitting at newlines
    const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean)
    if (lines.length <= 1) return text // single block of text, leave as-is
    return formatAsBullets(lines.map(ensureFullStop).map(capitaliseFirst))
  }

  return formatAsBullets(parts.map(ensureFullStop).map(capitaliseFirst))
}

function ensureFullStop(s: string): string {
  return s.replace(/[;,.]?\s*$/, '.')
}

function capitaliseFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
