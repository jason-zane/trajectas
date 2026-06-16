#!/bin/bash
# Auto-push Supabase migrations when a migration file is written/edited
f=$(jq -r '.tool_input.file_path // empty')
echo "$f" | grep -q 'supabase/migrations/.*\.sql$' || exit 0
# cd into the repo/worktree that owns the edited migration, so db push
# picks up the new file; .env.local only exists in the primary checkout.
cd "${f%/supabase/migrations/*}" || exit 0
if [ -f .env.local ]; then . .env.local; else . /Users/jasonhunt/Developer/trajectas/.env.local; fi
npx supabase db push --db-url "postgresql://postgres:${DATABASE_PASSWORD}@db.rwpfwfcaxoevnvtkdmkx.supabase.co:5432/postgres" 2>&1
