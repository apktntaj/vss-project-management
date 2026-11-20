---
name: verify
description: Run the full validation suite for this repo (tsc, domain tests, architecture guard, lint) and check that every test file is registered in domain:test. Use before declaring a code change done or before committing.
---

Run from the repo root and report results as a short pass/fail table, with the relevant error output
for any failure.

1. **Orphaned tests check** — list every `*.test.ts` outside `node_modules` and flag any not named in
   the `domain:test` script of `package.json` (those never run):

   ```bash
   script=$(jq -r '.scripts["domain:test"]' package.json)
   git ls-files --cached --others --exclude-standard '*.test.ts' | while read -r f; do
     case " $script " in *" $f "*) ;; *) echo "NOT IN domain:test: $f" ;; esac
   done
   ```

   If any are found, offer to append them to the script.

2. Run these in order; keep going after a failure so the report is complete:
   - `npx tsc --noEmit`
   - `npm run domain:test` (needs `bun` on PATH)
   - `npm run guard:arch`
   - `npm run lint` — the exhaustive-deps warning in `app/(dashboard)/jobs/[id]/page.tsx` is known
     and pre-existing; report any *other* warning or error.

3. Only if the user asks (or before a commit/PR): `npm run build`.

Do not fix failures silently — report them first, then propose fixes.
