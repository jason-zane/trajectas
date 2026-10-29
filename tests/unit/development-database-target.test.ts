import { describe, expect, it } from 'vitest'
import { requireDevelopmentDatabaseUrl } from '../../scripts/development-database-target.mjs'

describe('hosted development database helpers', () => {
  it('accepts only the explicit development direct or pooler target', () => {
    expect(requireDevelopmentDatabaseUrl('postgresql://postgres:test@db.bgrvqvtlhmfmvcytncgw.supabase.co:5432/postgres')).toContain('bgrvqvtlhmfmvcytncgw')
    expect(requireDevelopmentDatabaseUrl('postgresql://postgres.bgrvqvtlhmfmvcytncgw:test@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres')).toContain('bgrvqvtlhmfmvcytncgw')
  })
  it.each([undefined,'postgresql://postgres:test@db.rwpfwfcaxoevnvtkdmkx.supabase.co/postgres',
    'postgresql://postgres.rwpfwfcaxoevnvtkdmkx:test@aws-0-ap-southeast-2.pooler.supabase.com/postgres',
    'postgresql://postgres:test@db.bgrvqvtlhmfmvcytncgw.supabase.co.evil.test/postgres',
    'https://db.bgrvqvtlhmfmvcytncgw.supabase.co/postgres',
    'postgresql://postgres:test@db.bgrvqvtlhmfmvcytncgw.supabase.co/postgres?host=another-project'])('refuses missing, wrong-project or overridden connection: %s', value => {
    expect(()=>requireDevelopmentDatabaseUrl(value)).toThrow()
  })
})
