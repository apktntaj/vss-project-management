---
name: new-migration
description: Create a new Supabase SQL migration in supabase/migrations with a unique timestamp, validate it with the architecture guard, and stop before applying it. Use when a schema change (table, column, index, RLS, function) is needed.
---

Migration requested: $ARGUMENTS

1. Load the `supabase-postgres-best-practices` skill before writing SQL. Inspect existing migrations
   in `supabase/migrations/` that touch the same tables so the change fits the current schema
   (use the Supabase MCP `list_tables` if the live schema is in doubt — read-only).

2. Name the file `supabase/migrations/YYYYMMDDHHMMSS_snake_case_name.sql`. The timestamp must be
   strictly greater than the latest existing one and must not collide with any existing file
   (two files already share `20261116000000` — don't repeat that). Check with
   `ls supabase/migrations | sort | tail -3`.

3. Write the SQL. Rules:
   - Relational columns, not a `payload jsonb` blob next to real columns (guard rule P5).
   - Keep it idempotent where cheap (`if not exists`, `create or replace`).
   - Comments explain the "why" in Indonesian with a `Mengapa:` prefix, matching existing files.

4. Run `npm run guard:arch` and fix any violation.

5. If `domain/` types, `lib/supabase/*` mappers, or `/api/*` handlers need to change, list them.

6. **Stop.** Show the SQL and ask the user whether to apply it. Only after explicit approval, apply
   it with the Supabase MCP `apply_migration` tool (name = the file's name without timestamp/extension).
   Never apply on your own initiative, and never edit a migration that has already been applied —
   write a new one instead.
