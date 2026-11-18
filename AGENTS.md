# Development Guidelines

## Default delivery workflow: the HtDP design recipe

New features and refactors of a feature follow the *How to Design Programs* design recipe, top-down.
The shape of the program follows the shape of the data.

1. **Data definition.** Shape, interpretation (what each part means in the real world), and invariants
   (constraints that must always hold). Nothing is designed before the data it consumes and produces
   is defined.
2. **Signature and purpose.** One line stating *what* the function produces, not *how*.
3. **Examples.** Concrete inputs with their expected outputs, in domain language. These become tests.
4. **Template.** The body's skeleton is derived from the input's shape: one branch per variant of an
   itemization, one access per relevant field of a structure, an empty and a non-empty case for a list.
5. **Body.** Fill each branch. When a helper is needed, do not build it now: write its signature,
   purpose and examples, add it to the **wishlist**, and assume it works.
6. **Recurse.** Take one wishlist item and apply steps 1–5 to it. Design is finished when the wishlist
   is empty.

Design and implementation are separate steps done by different people. The design is written first,
completely, in the notation below; implementation is a translation of it into TypeScript and must not
add, drop or change signatures, data definitions or examples. If the design turns out to be incomplete
or wrong, implementation stops and the gap goes back to the designer.

The recipe fits pure logic best (`domain/`, `lib/` helpers without I/O). Route handlers, Supabase
access and UI effects are a thin shell at the edge; they are still designed (signatures with `[IO X]`,
see below) but kept as small as possible.

### Spec files

Each feature lives in `docs/specs/<feature>/` (template in `docs/specs/_template/`):

- `requirements.md`: problem, users, expected outcome, and open questions.
- `design.md`: data definitions, backend functions, UI components, and storage changes, in the
  notation below. Every function has signature, purpose and examples; the wishlist is empty.
- `tasks.md`: implementation order and checklist.

New or changed data definitions are also merged into `docs/domain/*-data-definitions.md` once the
feature is implemented.

### Design notation (HtDP-style Racket, ISL+)

The design is not executed; it must only be precise. Types live in comments, as in HtDP.

```racket
;; Kelengkapan is one of:
;;  - 'LENGKAP
;;  - (make-kurang [NEList-of Kekurangan])
;;  - 'BELUM_ADA
;; interpretation: completeness of one exhibitor's CIPL
(define-struct kurang (daftar))

;; status-cipl : [Maybe Cipl] -> Kelengkapan
;; purpose: completeness status of one CIPL, including when it is missing
(check-expect (status-cipl #false) 'BELUM_ADA)
(define (status-cipl c)
  (cond [(false? c) 'BELUM_ADA]
        [else ...]))

;; ambil-cipl-event : EventId -> [IO [List-of Cipl]]
;; purpose: all CIPLs attached to an event (reads storage)
```

- Atomic and enumeration values: `Number`, `Nat`, `String`, `Boolean`, `Date` (ISO date string),
  `DateTime`, and symbols. A symbol is written exactly as the literal used in code (`'RE_EXPORT`).
- Invariants that a type cannot express are written as `;; invariant:` lines under the definition.
- Effects are explicit: a function that reads or writes storage, calls the network, or touches the
  session returns `[IO X]`. A function without `[IO ...]` is pure.
- UI components are functions `Props -> View`. The view is an s-expression naming existing components
  (`(Card (CardHeader ...) ...)`). Local state is written as `;; state: name : Type, initial value`,
  and every user event as `;; on (event args) : State -> State` or `-> [IO ...]` for mutations.
- Storage changes (tables, columns, constraints, RLS) are described as a table in a `## Storage`
  section; they are not data transitions and need no Lisp notation.

### Translation to TypeScript

| Design | TypeScript |
|---|---|
| `Number`, `Nat` | `number` (`Nat` checked by Zod at the boundary) |
| `String`, `Boolean` | `string`, `boolean` |
| `Date`, `DateTime` | ISO `string`, as used by the nearest aggregate |
| `'SYMBOL` enumeration | string-literal union `'SYMBOL' \| ...` |
| `(define-struct name (field-a field-b))` | `type Name = { readonly fieldA: ...; readonly fieldB: ... }` (kebab-case to camelCase, struct name to PascalCase) |
| itemization of structures | discriminated union on `kind`, reusing the aggregate's existing `kind` values; new ones in SCREAMING_SNAKE_CASE |
| `[Maybe X]` | `X \| null` |
| `[List-of X]` / `[NEList-of X]` | `readonly X[]` / `readonly [X, ...X[]]` |
| `name : A B -> C` | exported `function name(a: A, b: B): C` (kebab-case to camelCase; `pred?` to `isPred`) |
| `[IO X]` | `Promise<X>`, allowed only in `lib/server`, `lib/supabase`, `app/api/**` and `lib/data-client` — never in `domain/` |
| `cond` over an itemization | exhaustive `switch` with a `never` check in `default` |
| `local` | non-exported helper or inner `const` |
| `;; invariant:` | Zod refinement at the boundary plus a test |
| `check-expect` | one assertion in the matching `*.test.ts`, following the nearest test file's style; new test files are added to `domain:test` |
| `Props -> View` component | React component with typed props, Server Component unless state or events require `'use client'` |

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

This file is the source of truth for conventions. `docs/` holds historical design documents that may
describe an older architecture — when they conflict with this file, this file wins.

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
- **Auth:** `auth.ts` configures the credentials provider; the session carries `user.isAdmin`.
  `middleware.ts` is the global AuthN gate (401 for `/api/*`, redirect to `/login` for pages), so
  unauthenticated traffic never reaches handlers; handlers still perform their own authorization.
  `lib/demo-users.ts` is a non-production fallback used only when Supabase is unconfigured.
- **Domain:** `domain/` holds storage-agnostic entity types and validation, one directory per
  aggregate (`event/`, `exhibition/`, `job/`, `ticket/`, ...).
- **Form feedback:** every mutation result MUST produce a toast for success and failure, rendered only
  at the bottom-right of the viewport. Keep field-level validation errors near their inputs; do not
  replace them with, or duplicate them as, toasts.
- **Orange color:** orange (`--primary`, `bg-primary`, `bg-orange-*`) is a button/surface accent
  and reads as an "alert", like red. NEVER use orange for font color (`text-orange-*`,
  `text-primary`, `hover:text-orange-*`) or for chart/progress bar fills; use `text-foreground`,
  `text-muted-foreground`, or slate (`bg-slate-600` for bars). Orange text is allowed only for a
  genuine alert/warning message. Buttons, active nav, and tinted surfaces keep their orange.
- **Validation commands:** `npx tsc --noEmit` (currently clean — keep it that way),
  `npm run domain:test` (bun, explicit file list; new test files must be added to the script or they
  never run), `npm run build`. Use the narrowest relevant command for documentation-only changes.
