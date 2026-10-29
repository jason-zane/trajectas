#!/usr/bin/env node
/** Push reviewed migrations to hosted development. No Docker or .env.local. */
import { execFileSync } from 'node:child_process'
import { requireDevelopmentDatabaseUrl } from './development-database-target.mjs'
try {
  const extra = process.argv.slice(2)
  if (extra.some(arg => arg !== '--dry-run') || extra.length > 1) throw new Error('Only --dry-run is supported. Review target/history before applying migrations.')
  const url = requireDevelopmentDatabaseUrl(process.env.TRAJECTAS_DEVELOPMENT_DATABASE_URL)
  execFileSync('supabase', ['db','push','--db-url',url,...extra], { stdio:'inherit' })
} catch (error) {
  // CLI errors contain argv (including credentials): never print those objects.
  console.error(error instanceof Error && !('status' in error) ? error.message : 'Development migration command failed; inspect the CLI output.')
  process.exit(1)
}
