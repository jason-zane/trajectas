#!/bin/bash
# Auto-push Supabase migrations when a migration file is written/edited
f=$(jq -r '.tool_input.file_path // empty')
echo "$f" | grep -q 'supabase/migrations/.*\.sql$' || exit 0
cd /Users/jasonhunt/projects/talent-fit
. .env.local
npx supabase db push --db-url "postgresql://postgres:${DATABASE_PASSWORD}@db.rwpfwfcaxoevnvtkdmkx.supabase.co:5432/postgres" 2>&1
