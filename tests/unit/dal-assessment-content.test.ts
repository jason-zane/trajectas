import { describe, expect, it, vi } from 'vitest'

// Route throwActionError straight to a plain Error so the observability
// pipeline (next/server after(), error_events persistence) stays out of play.
vi.mock('@/lib/security/action-errors', () => ({
  logActionError: vi.fn(),
  throwActionError: (_context: string, publicMessage: string) => {
    throw new Error(publicMessage)
  },
}))

import {
  getAssessmentContentSummaries,
  listEmptyAssessments,
} from '@/lib/dal/assessment-content'

type Result = { data?: unknown; error?: unknown }

/**
 * Table-aware fake: from(table) consumes the next canned result for that
 * table; chain methods no-op and the builder itself is awaitable.
 */
function fakeDb(results: Record<string, Result[]>) {
  const queues = new Map(Object.entries(results).map(([t, r]) => [t, [...r]]))
  const tablesQueried: string[] = []
  const db = {
    from(table: string) {
      tablesQueried.push(table)
      const queue = queues.get(table) ?? []
      const result = queue.length > 0 ? (queue.shift() as Result) : { data: [], error: null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {}
      for (const m of ['select', 'in', 'is', 'eq', 'order', 'limit']) {
        builder[m] = () => builder
      }
      builder.then = (
        resolve: (value: Result) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject)
      return builder
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, tablesQueried }
}

describe('getAssessmentContentSummaries', () => {
  it('returns [] for an empty id list without querying', async () => {
    const { db, tablesQueried } = fakeDb({})
    expect(await getAssessmentContentSummaries(db, [])).toEqual([])
    expect(tablesQueried).toEqual([])
  })

  it('flags a traditional assessment with factors but no sections as empty (the Watermark case)', async () => {
    const { db } = fakeDb({
      assessments: [
        { data: [{ id: 'a1', title: 'Watermark test', format_mode: 'traditional' }] },
      ],
      assessment_sections: [{ data: [] }],
    })

    const [summary] = await getAssessmentContentSummaries(db, ['a1'])
    expect(summary).toMatchObject({
      assessmentId: 'a1',
      title: 'Watermark test',
      formatMode: 'traditional',
      itemCount: 0,
      hasDeliverableContent: false,
    })
  })

  it('sums nested section item counts for traditional assessments', async () => {
    const { db } = fakeDb({
      assessments: [{ data: [{ id: 'a1', title: 'Full', format_mode: 'traditional' }] }],
      assessment_sections: [
        {
          data: [
            { assessment_id: 'a1', assessment_section_items: [{ count: 5 }] },
            { assessment_id: 'a1', assessment_section_items: [{ count: 3 }] },
          ],
        },
      ],
    })

    const [summary] = await getAssessmentContentSummaries(db, ['a1'])
    expect(summary).toMatchObject({ itemCount: 8, hasDeliverableContent: true })
  })

  it('treats forced-choice blocks as non-deliverable — the runner only serves sections', async () => {
    const { db, tablesQueried } = fakeDb({
      assessments: [{ data: [{ id: 'a2', title: 'FC', format_mode: 'forced_choice' }] }],
      assessment_sections: [{ data: [] }],
    })

    const [summary] = await getAssessmentContentSummaries(db, ['a2'])
    expect(summary).toMatchObject({
      formatMode: 'forced_choice',
      itemCount: 0,
      hasDeliverableContent: false,
    })
    // Blocks have no delivery path, so they must not count as content.
    expect(tablesQueried).not.toContain('forced_choice_blocks')
    expect(tablesQueried).toContain('assessment_sections')
  })

  it('listEmptyAssessments returns only the empty ones from a batch', async () => {
    const { db } = fakeDb({
      assessments: [
        {
          data: [
            { id: 'a1', title: 'Has items', format_mode: 'traditional' },
            { id: 'a2', title: 'Empty shell', format_mode: 'traditional' },
          ],
        },
      ],
      assessment_sections: [
        { data: [{ assessment_id: 'a1', assessment_section_items: [{ count: 12 }] }] },
      ],
    })

    const empties = await listEmptyAssessments(db, ['a1', 'a2'])
    expect(empties).toHaveLength(1)
    expect(empties[0]).toMatchObject({ assessmentId: 'a2', title: 'Empty shell' })
  })

  it('throws the public message when the assessments query fails', async () => {
    const { db } = fakeDb({
      assessments: [{ data: null, error: { message: 'boom' } }],
    })

    await expect(getAssessmentContentSummaries(db, ['a1'])).rejects.toThrow(
      /unable to check assessment content/i,
    )
  })
})
