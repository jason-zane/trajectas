// =============================================================================
// src/lib/chat/tools/find-assessment.ts
//
// Resolve an assessment (the instrument) the user named. Tenancy comes from
// the assessments SELECT policy on the requester's connection.
// =============================================================================

import 'server-only'

import { z } from 'zod'
import { defineChatTool } from '../registry'
import { toolOk, toolFail, type EntityLink } from '../envelope'
import { escapeLikePattern, sanitiseOrTerm, SEARCH_LIMIT } from './search-utils'

interface AssessmentRow {
  id: string
  title: string | null
  slug: string | null
  status: string | null
  scoring_method: string | null
  clients: { id: string; name: string | null } | null
}

export const findAssessmentTool = defineChatTool({
  name: 'find_assessment',
  description:
    'Find assessments (the instruments themselves) by title. Returns assessment ids. Call with an empty query to list the assessments visible to the user.',
  statusLabel: 'Searching assessments',
  params: z.object({
    query: z
      .string()
      .max(120)
      .optional()
      .describe('Part of the assessment title. Omit to list all visible assessments.'),
  }),
  async execute({ query }, { db }) {
    let builder = db
      .from('assessments')
      .select('id, title, slug, status, scoring_method, clients(id, name)')
      .is('deleted_at', null)

    const term = query?.trim()
    if (term) {
      builder = builder.ilike('title', `%${escapeLikePattern(sanitiseOrTerm(term))}%`)
    }

    const { data, error } = await builder
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMIT)

    if (error) {
      return toolFail('unavailable', `Assessment lookup failed: ${error.message}`)
    }

    const rows = (data ?? []) as unknown as AssessmentRow[]
    if (rows.length === 0) {
      return toolFail(
        'not_found',
        term
          ? `No assessment matching "${term}" is visible to you.`
          : 'No assessments are visible to you.',
      )
    }

    const links: EntityLink[] = rows.map((row) => ({
      kind: 'assessment' as const,
      id: row.id,
      label: row.title ?? 'Untitled assessment',
      sublabel: row.clients?.name ?? null,
      href: `/assessments/${row.id}/edit/overview`,
    }))

    return toolOk(
      {
        matchCount: links.length,
        truncated: links.length === SEARCH_LIMIT,
        assessments: rows.map((row, i) => ({
          assessmentId: row.id,
          title: row.title,
          status: row.status,
          scoringMethod: row.scoring_method,
          clientName: row.clients?.name ?? null,
          href: links[i].href,
        })),
      },
      {
        source: 'assessments',
        deepLink: links.length === 1 ? links[0].href : null,
        caveats:
          links.length === SEARCH_LIMIT
            ? [`Only the first ${SEARCH_LIMIT} matches are shown.`]
            : [],
      },
    )
  },
})
