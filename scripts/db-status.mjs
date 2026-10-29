#!/usr/bin/env node
/** Inspect hosted-development migration history without reading .env.local. */
import { execFileSync } from 'node:child_process'
import { requireDevelopmentDatabaseUrl } from './development-database-target.mjs'
try {
  if (process.argv.length > 2) throw new Error('No target overrides are accepted.')
  const url = requireDevelopmentDatabaseUrl(process.env.TRAJECTAS_DEVELOPMENT_DATABASE_URL)
  execFileSync('supabase',['migration','list','--db-url',url], {stdio:'inherit'})
} catch (error) {
  console.error(error instanceof Error && !('status' in error) ? error.message : 'Development status command failed; inspect the CLI output.')
  process.exit(1)
}
