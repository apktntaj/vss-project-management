# Development Guidelines

## Default delivery workflow

<!---->
<!-- Saat pengguna memberi daftar perubahan atau bug untuk proyek ini, perlakukan daftar tersebut sebagai pekerjaan implementasi lengkap: -->
<!---->
<!-- 1. Buat GitHub issue yang merangkum daftar tersebut beserta acceptance criteria. -->
<!-- 2. Implementasikan seluruh item pada issue. -->
<!-- 3. Jalankan validasi yang relevan. -->
<!-- 4. Buat commit dengan pesan yang merujuk pada issue. -->
<!-- 5. Tutup GitHub issue setelah implementasi dan validasi berhasil. -->
<!-- 6. Laporkan URL issue, hasil validasi, dan hash commit. -->
<!---->
<!-- Jangan meminta pengguna mengulang instruksi untuk membuat issue, mengimplementasikan, membuat commit, atau menutup issue, kecuali pengguna secara eksplisit meminta salah satu langkah tersebut dilewati. -->
<!---->
<!-- ## Data access -->
<!---->
<!-- - Code in `app/` and `components/` must not import `@/lib/indexeddb` directly. -->
<!-- - Access persisted data only through the public façade `@/lib/data-client`. -->
<!-- - Domain entities must not contain `Blob`, `File`, IndexedDB types, or other storage-specific values. File content is accessed through the attachment API by ID. -->
<!-- - Only storage adapters may access IndexedDB APIs. -->
<!-- - A user action that writes an aggregate and its attached files must use one storage transaction. -->
<!-- - Preserve existing IndexedDB data with forward, idempotent migrations. Do not reset browser data as part of a schema change. -->

## Repository summary

Detailed, verified conventions live in `.kiro/steering/`. Read those first — they supersede any
older description in this file, in `README.md`, or in `docs/`:

- `product.md` — what the system does, entity hierarchy, which routes are live
- `tech.md` — stack, env vars, commands, test caveats
- `structure.md` — real directory map and where new code belongs
- `data-access.md` — the mandatory data flow (this is the one that matters most)
- `conventions.md` — language, validation, toast, page/loading patterns
- `pitfalls.md` — known landmines and anti-patterns not to propagate
- `database.md`, `ceisa.md` — loaded when touching `supabase/**` or `**/ceisa/**`

Business requirements reconstructed from the running code, plus open gaps `G-1`..`G-10`, are in
`.kiro/requirements.md`.

Quick orientation:

- **Purpose:** internal operational workspace for a freight-forwarding company handling MICE
  exhibition cargo in Indonesia — events, exhibitors, CIPLs, shipments, Indonesian customs (BC) jobs,
  and coordination tickets.
- **Stack:** Next.js 14 App Router, React 18, TypeScript 5.7, Tailwind 3.4, @base-ui/react, Zod,
  NextAuth v5 Credentials, dnd-kit, Supabase. Path alias `@/` resolves from the repository root.
- **Storage is Supabase only.** Postgres for data, a private `attachments` bucket for files. There is
  no IndexedDB, no `lib/file.ts`, no `lib/mock-data.ts`, and no `app_records` table — statements to
  the contrary elsewhere in the repo are obsolete.
- **Data boundary:** UI code reads and writes data only through `@/lib/data-client`, which is a
  `'use client'` module that calls `/api/*` route handlers. Route handlers are the only place that
  touches Supabase, via `lib/supabase/*` (all `server-only`). Never import a storage adapter from
  `app/**/page.tsx` or `components/**`. Attachments are referenced by ID; domain entities never hold
  `Blob`/`File`.
- **Mutations use route handlers, not Server Actions.** The only server actions in the repo are
  sign-in and sign-out. There is no `revalidatePath`/`router.refresh()`; components refetch and
  `setState` after a mutation.
- **Auth:** `auth.ts` configures the credentials provider; the session carries `user.isAdmin`. There
  is no `middleware.ts`, so every new route handler must guard itself. `lib/demo-users.ts` is a
  non-production fallback used only when Supabase is unconfigured.
- **Domain:** `domain/` holds storage-agnostic entity types and validation. `domain/v2/` is an
  unused exploratory meta-model — do not build on it, and do not delete it (`domain:test` references it).
- **Form feedback:** every mutation result MUST produce a toast for success and failure, rendered only
  at the bottom-right of the viewport. Keep field-level validation errors near their inputs; do not
  replace them with, or duplicate them as, toasts.
- **Validation commands:** `npx tsc --noEmit` (currently clean — keep it that way),
  `npm run domain:test` (bun, explicit file list; new test files must be added to the script or they
  never run), `npm run build`. Use the narrowest relevant command for documentation-only changes.
