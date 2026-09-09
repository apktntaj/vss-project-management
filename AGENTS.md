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

- **Purpose:** VSS Project Management is a browser-local operational workspace for exhibition events, exhibitors, shipments/customs jobs, CIPLs, and coordination tickets.
- **Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Zod, NextAuth Credentials, and dnd-kit. Path alias `@/` resolves from the repository root.
- **UI:** Route entry points are in `app/`; reusable interactive UI is in `components/`. The dashboard covers events and operational timeline; dedicated routes cover events, jobs, kanban tickets, CIPL versions/shipments, and settings.
- **Domain:** `domain/` holds entity types and validation rules. Keep it storage-agnostic and validate inputs with the existing Zod schemas.
- **Data boundary:** UI code accesses application data through `@/lib/data-client`; storage-specific work belongs behind that façade. Do not import storage adapters from `app/` or `components/`. Attachments are addressed by ID rather than embedded as storage values in domain entities.
- **Demo authentication:** `auth.ts` configures NextAuth's credentials provider. Its users live in server-only `lib/demo-users.ts`; the authenticated session carries `user.isAdmin`. Demo credentials are development-only and must not be treated as production authentication.
- **Runtime data:** Documentation describes browser-runtime demo data seeded by `lib/mock-data.ts`, with CRUD and ticket state reset on reload. Verify the active adapter before changing persistence: `lib/data-client.ts` is the public contract, and its backing implementation can be replaced independently.
- **Validation:** Run `npx tsc --noEmit` for type checking, `npm run domain:test` for domain validation, and `npm run build` for a production build. Use the narrowest relevant command for documentation-only changes.
