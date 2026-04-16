// =============================================================================
// Minimal chainable Supabase-like mock for unit tests. Records all insert/delete
// calls in a log so assertions can inspect what the code wrote. Scripts return
// values per table by giving `maybeSingle`, `single`, and `data` values in a
// table-keyed map.
// =============================================================================

export interface MockTableScript {
  // Return value for a chain ending in .maybeSingle() (for select flows)
  maybeSingle?: { data: unknown; error?: unknown }
  // Return value for a chain ending in .single() (typically insert...select().single())
  single?: { data: unknown; error?: unknown }
  // Return value for a chain ending with no terminator (resolves as the builder itself)
  data?: unknown
  error?: unknown
}

export interface InsertCall {
  table: string
  rows: unknown[] | unknown
}

export interface MockDb {
  db: unknown
  insertCalls: InsertCall[]
  deleteCalls: Array<{ table: string }>
  // Flip a table script after initial setup (for idempotency tests)
  setScript: (table: string, script: MockTableScript) => void
}

export function makeMockDb(scripts: Record<string, MockTableScript>): MockDb {
  const insertCalls: InsertCall[] = []
  const deleteCalls: Array<{ table: string }> = []
  const tableScripts: Record<string, MockTableScript> = { ...scripts }

  const buildBuilder = (table: string) => {
    // The chain returned here has ALL terminal + chaining methods; each
    // chaining method returns the same object, so any call sequence works.
    const builder: Record<string, unknown> = {}
    const chainMethods = [
      'select',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'neq',
      'in',
      'is',
      'not',
      'or',
      'lt',
      'lte',
      'gt',
      'gte',
      'like',
      'ilike',
      'contains',
      'containedBy',
      'order',
      'limit',
      'range',
      'match',
    ]
    for (const m of chainMethods) {
      builder[m] = (...args: unknown[]) => {
        if (m === 'insert') insertCalls.push({ table, rows: args[0] })
        if (m === 'delete') deleteCalls.push({ table })
        return builder
      }
    }
    // Terminal promise-returning methods
    builder.maybeSingle = async () => {
      const current = tableScripts[table] ?? {}
      return current.maybeSingle ?? { data: null, error: null }
    }
    builder.single = async () => {
      const current = tableScripts[table] ?? {}
      return current.single ?? { data: null, error: null }
    }
    // Make the whole builder thenable (so `await db.from('x').insert(…)` resolves)
    builder.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
      const current = tableScripts[table] ?? {}
      resolve({ data: current.data ?? null, error: current.error ?? null })
    }
    return builder
  }

  const db = {
    from: (table: string) => buildBuilder(table),
  }

  return {
    db,
    insertCalls,
    deleteCalls,
    setScript(table, script) {
      tableScripts[table] = script
    },
  }
}
