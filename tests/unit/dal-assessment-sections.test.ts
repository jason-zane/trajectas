import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/security/action-errors', () => ({
  logActionError: vi.fn(),
  throwActionError: (_context: string, publicMessage: string) => {
    throw new Error(publicMessage)
  },
}))

// The per-construct limit rule lookup is a server action with its own DB
// client — stub it so the module under test runs against the fake db only.
vi.mock('@/app/actions/item-selection-rules', () => ({
  getItemsPerConstructForCount: vi.fn(async () => null),
}))

import {
  autoBuildSectionsFromFactors,
  buildDefaultSectionDrafts,
} from '@/lib/dal/assessment-sections'

type Result = { data?: unknown; error?: unknown; count?: number | null }

/**
 * Table-aware fake: from(table) consumes the next canned result for that
 * table; chain methods no-op (but are recorded) and the builder is awaitable.
 */
function fakeDb(results: Record<string, Result[]>) {
  const queues = new Map(Object.entries(results).map(([t, r]) => [t, [...r]]))
  const ops: Array<{ table: string; method: string; args: unknown[] }> = []
  const db = {
    from(table: string) {
      const queue = queues.get(table) ?? []
      const result = queue.length > 0 ? (queue.shift() as Result) : { data: [], error: null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {}
      for (const m of ['select', 'insert', 'in', 'is', 'eq', 'maybeSingle', 'order', 'limit']) {
        builder[m] = (...args: unknown[]) => {
          ops.push({ table, method: m, args })
          return builder
        }
      }
      builder.then = (
        resolve: (value: Result) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve, reject)
      return builder
    },
  }
  const opsFor = (table: string, method: string) =>
    ops.filter((op) => op.table === table && op.method === method)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, opsFor }
}

describe('buildDefaultSectionDrafts', () => {
  it('creates one draft per format with the shared default copy', () => {
    const drafts = buildDefaultSectionDrafts([
      { responseFormatId: 'rf-likert', formatName: 'Likert', formatType: 'likert', itemCount: 40 },
      { responseFormatId: 'rf-sjt', formatName: 'SJT', formatType: 'sjt', itemCount: 8 },
    ])

    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({
      responseFormatId: 'rf-likert',
      title: 'Self-Report Questionnaire',
      displayOrder: 0,
      itemOrdering: 'randomised',
    })
    // SJT scenarios keep their authored order.
    expect(drafts[1]).toMatchObject({ itemOrdering: 'fixed', displayOrder: 1 })
    // Titles must be non-empty: assessment_sections.title is NOT NULL.
    for (const d of drafts) expect(d.title.trim().length).toBeGreaterThan(0)
  })
})

describe('autoBuildSectionsFromFactors', () => {
  const ASSESSMENT = 'aaaa1111-1111-1111-1111-111111111111'

  const item = (id: string, construct: string, format: string) => ({
    id,
    construct_id: construct,
    response_format_id: format,
    display_order: 0,
    difficulty: 'medium',
    reverse_scored: false,
    response_formats: { id: format, name: 'Likert', type: 'likert' },
  })

  it('materialises sections and section items from the factor→construct chain (the Watermark shape)', async () => {
    const { db, opsFor } = fakeDb({
      assessments: [
        { data: { format_mode: 'traditional' } }, // mode check (maybeSingle)
        { data: [{ id: ASSESSMENT, title: 'Watermark test', format_mode: 'traditional' }] }, // recount
      ],
      assessment_sections: [
        { count: 0 }, // pre-existing layout check
        { data: [{ id: 'sec-1', response_format_id: 'rf-likert' }] }, // insert().select()
        { data: [{ assessment_id: ASSESSMENT, assessment_section_items: [{ count: 2 }] }] }, // recount
      ],
      assessment_factors: [{ data: [{ factor_id: 'f1' }, { factor_id: 'f2' }] }],
      factor_constructs: [
        { data: [{ construct_id: 'c1' }, { construct_id: 'c2' }] }, // format breakdown
        { data: [{ construct_id: 'c1' }, { construct_id: 'c2' }] }, // persistSections
      ],
      items: [
        { data: [item('i1', 'c1', 'rf-likert'), item('i2', 'c2', 'rf-likert')] }, // format breakdown
        { data: [item('i1', 'c1', 'rf-likert'), item('i2', 'c2', 'rf-likert')] }, // persistSections
      ],
      assessment_section_items: [{ error: null }],
    })

    const result = await autoBuildSectionsFromFactors(db, ASSESSMENT)

    expect(result).toEqual({ built: true, itemCount: 2 })
    expect(opsFor('assessment_sections', 'insert')).toHaveLength(1)
    const sectionInsert = opsFor('assessment_sections', 'insert')[0].args[0] as Array<
      Record<string, unknown>
    >
    expect(sectionInsert[0]).toMatchObject({
      assessment_id: ASSESSMENT,
      response_format_id: 'rf-likert',
      title: 'Self-Report Questionnaire',
    })
    const itemInsert = opsFor('assessment_section_items', 'insert')[0].args[0] as Array<
      Record<string, unknown>
    >
    expect(itemInsert).toHaveLength(2)
    expect(itemInsert[0]).toMatchObject({ section_id: 'sec-1', item_id: 'i1' })
  })

  it('no-ops when no factors are selected', async () => {
    const { db, opsFor } = fakeDb({
      assessments: [{ data: { format_mode: 'traditional' } }],
      assessment_sections: [{ count: 0 }],
      assessment_factors: [{ data: [] }],
    })

    expect(await autoBuildSectionsFromFactors(db, ASSESSMENT)).toEqual({
      built: false,
      itemCount: 0,
    })
    expect(opsFor('assessment_sections', 'insert')).toHaveLength(0)
  })

  it('never clobbers an existing section layout', async () => {
    const { db, opsFor } = fakeDb({
      assessments: [{ data: { format_mode: 'traditional' } }],
      assessment_sections: [{ count: 2 }],
    })

    expect(await autoBuildSectionsFromFactors(db, ASSESSMENT)).toEqual({
      built: false,
      itemCount: 0,
    })
    expect(opsFor('assessment_sections', 'insert')).toHaveLength(0)
  })

  it('no-ops for forced-choice assessments — no serving path', async () => {
    const { db, opsFor } = fakeDb({
      assessments: [{ data: { format_mode: 'forced_choice' } }],
    })

    expect(await autoBuildSectionsFromFactors(db, ASSESSMENT)).toEqual({
      built: false,
      itemCount: 0,
    })
    expect(opsFor('assessment_sections', 'insert')).toHaveLength(0)
  })

  it('no-ops when the factors resolve to zero active items', async () => {
    const { db, opsFor } = fakeDb({
      assessments: [{ data: { format_mode: 'traditional' } }],
      assessment_sections: [{ count: 0 }],
      assessment_factors: [{ data: [{ factor_id: 'f1' }] }],
      factor_constructs: [{ data: [{ construct_id: 'c1' }] }],
      items: [{ data: [] }],
    })

    expect(await autoBuildSectionsFromFactors(db, ASSESSMENT)).toEqual({
      built: false,
      itemCount: 0,
    })
    expect(opsFor('assessment_sections', 'insert')).toHaveLength(0)
  })
})
