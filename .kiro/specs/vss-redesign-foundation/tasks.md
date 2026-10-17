# Implementation Plan: VSS Redesign — Foundation + Event Domain

## Overview

Ground-up redesign dengan clean cutover (DD-A4) — bukan `/api/v2` di samping kode lama. Rencana
dibangun berlapis: fondasi lintas-domain lebih dulu, lalu slice `auth`, lalu slice Event, masing-masing
bersandar pada lapisan sebelumnya. Arsitektur terkunci: Next.js 14 App Router (Server Component untuk
baca + route handler untuk tulis), vertical-slice hibrida (`domain/` murni + `features/` use-case +
repository + komponen + route tipis), gaya fungsional ringan (use-case memanggil repository langsung,
port selektif untuk integrasi berat), Postgres relasional ternormalisasi (kolom nyata + FK + CHECK,
tanpa `payload` jsonb), penomoran berbasis sequence Postgres, `middleware.ts` sebagai gerbang AuthN,
otorisasi peran + per-objek di lapisan use-case via slice `auth`, penegakan `server-only`, lampiran
Storage privat lewat id, dan kontrak error seragam.

Implementasi memakai **TypeScript** (stack terkunci di design — React 18, TS 5.7 strict, Zod 3,
NextAuth v5, `@supabase/supabase-js`, `fast-check` untuk property test). Teks pengguna bahasa
Indonesia; identifier/enum/kode bahasa Inggris `SCREAMING_SNAKE_CASE`.

**Catatan verifikasi (berlaku untuk semua task):** gerbang verifikasi proyek adalah
`npx tsc --noEmit` (harus tetap bersih), `npm run domain:test`, dan `npm run build` (untuk perubahan
yang menyentuh route/komponen). **Setiap file `*.test.ts` baru WAJIB didaftarkan ke script
`domain:test` di `package.json`** — kalau tidak, test itu diam-diam tidak pernah dieksekusi (konvensi
proyek). File test baru memakai `bun:test` (`import { expect, test } from 'bun:test'`).

## Tasks

- [x] 1. Scaffolding fondasi: dependency, path alias, dan kerangka folder slice
  - Tambahkan/verifikasi dependency: `server-only`, `@supabase/supabase-js`, `zod`, `next-auth@beta`
    (v5), dan `fast-check` (dev, untuk property test); pin versi eksak sesuai konvensi proyek
  - Verifikasi path alias `@/` dari root repo di `tsconfig.json` (`compilerOptions.paths`)
  - Buat kerangka folder kosong-berisi-placeholder: `domain/shared/`, `domain/auth/`, `domain/event/`,
    `features/auth/`, `features/events/`, `lib/server/`, `lib/auth/`, `app/api/events/`,
    `app/(dashboard)/events/`
  - _Requirements: 4.1, 5_

- [x] 2. Migrasi dasar: workspaces, app_users (dengan role), workspace_members + RLS
  - [x] 2.1 Tulis migrasi SQL fondasi di `supabase/migrations/`
    - `workspaces` (slug unik + CHECK format, seed `slug = 'default'`)
    - `app_users` (email lower-case unik, `full_name` CHECK 1–120, `role` CHECK IN
      `STAFF|SUPERVISOR|CUSTOMER_SERVICE|DOCUMENT_ASSISTANT`, `is_active`, `password_hash`,
      `created_at`/`updated_at`) — tanpa kolom `is_admin`
    - `workspace_members` (PK komposit `workspace_id, user_id`, kedua FK `on delete cascade`)
    - Aktifkan RLS dan `revoke all ... from anon, authenticated` pada tabel operasional
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 3. Modul fondasi bersama: db client, error contract, shared validation, numbering
  - [x] 3.1 Implementasi `lib/server/db.ts` — service-role client + `withWorkspace()`
    - `import 'server-only'` sebagai import efektif pertama
    - Service-role Supabase client; helper `withWorkspace()` yang me-resolve `slug = 'default'`
    - _Requirements: 3.2, 4.3, 5.4, 20.2_
  - [x] 3.2 Implementasi `domain/shared/validation.ts` — tipe `Validation<T>` + helper validator murni
    - `ValidationIssue`, `Validation<T>` (ok/issues), helper kombinator; murni, tak throw, kumpulkan
      semua issue; tanpa storage/HTTP/React/Supabase
    - _Requirements: 4.1, 8.8_
  - [x] 3.3 Implementasi `lib/server/errors.ts` — `ApiError` + mapper kontrak error
    - `ApiError(status, message)`; `toErrorResponse(error)` memetakan ZodError→400,
      ApiError→status-nya, lainnya→503 `Layanan sedang tidak tersedia. Coba lagi.`; bentuk
      `{ error: '<pesan Indonesia>' }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  - [ ]* 3.4 Unit test untuk mapper error contract
    - Uji setiap cabang status (401/403/404/400/409/503) menghasilkan bentuk `{ error }` + status benar
    - Daftarkan file test ke script `domain:test`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  - [x] 3.5 Implementasi sequence numbering + `nextCustomsJobNumber` (`lib/server/numbering.ts`)
    - Migrasi: `create sequence ... customs_job_number_seq` + fungsi `nextval` yang dipanggil via rpc
    - `import 'server-only'`; format `VSS-XXXXX` (zero-pad ke 5 digit, tanpa potong bila >5 digit);
      hanya dari sequence Postgres (tanpa baca-ubah-tulis klien); gagal fetch → tidak terbitkan nomor
      dan kembalikan indikasi error tanpa mengubah sequence
    - _Requirements: 6.1, 6.2, 6.4, 6.5_
  - [ ]* 3.6 Property test untuk numbering
    - **Property 4: Penomoran aman-race (unik + monoton naik ketat)**
    - **Validates: Requirements 6.3**
    - Pakai `fast-check`; verifikasi juga format zero-pad (6.1) dan >5 digit tanpa potong (6.2)
    - Daftarkan file test ke script `domain:test`

- [ ] 4. Checkpoint — fondasi
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Domain auth murni: tipe, validator kredensial, kontrak hashing
  - [x] 5.1 Implementasi `domain/auth/types.ts` dan `domain/auth/validation.ts`
    - `User`, `Session`, `Role` murni; validator kredensial murni mengembalikan `Validation<T>`
      (tak throw, kumpulkan semua issue); kontrak logika hashing password (scrypt + salt acak, hash
      self-describing berversi, perbandingan `timingSafeEqual`); tanpa storage/HTTP/React/Supabase
    - _Requirements: 17.1, 17.2, 17.3_
  - [ ]* 5.2 Unit test untuk validator kredensial + kontrak hashing
    - Uji validator mengumpulkan semua issue tanpa throw; uji kontrak hash berversi + verifikasi
      waktu-konstan terhadap vektor diketahui
    - Daftarkan file test ke script `domain:test`
    - _Requirements: 17.1, 17.2, 17.3_

- [x] 6. Slice auth: repository, NextAuth, Server Action, Authorizer, middleware
  - [x] 6.1 Implementasi `features/auth/repository.ts` (user repository, server-only)
    - `import 'server-only'`; baca `app_users` untuk verifikasi kredensial; saat menurunkan CurrentUser
      kembalikan hanya `{ id, role, workspaceId }` tanpa `password_hash`
    - _Requirements: 3.2, 18.2, 20.1, 20.3_
  - [x] 6.2 Implementasi `features/auth/nextauth.ts` + `lib/auth/password.ts`
    - NextAuth v5 Credentials + strategi JWT; token membawa `role` (bentuk CurrentUser
      `{ id, role, workspaceId }`); `lib/auth/password.ts` scrypt self-describing + `timingSafeEqual`
    - Password plaintext tidak pernah di-log atau dikembalikan di respons
    - _Requirements: 18.1, 18.2, 18.4, 20.1_
  - [x] 6.3 Implementasi Server Action `signIn`/`signOut` (`features/auth/use-cases/*`)
    - Satu-satunya Server Action di sistem; kredensial valid → Session JWT membawa role; kredensial
      tidak valid → tolak, tak bentuk sesi, pesan `Email atau kata sandi salah.`; sign-out mengakhiri
      sesi
    - _Requirements: 18.1, 18.3, 18.5, 18.6_
  - [x] 6.4 Implementasi Authorizer `features/auth/authorize.ts` + `features/auth/index.ts`
    - `import 'server-only'`; `can(role, capability)` murni (pemetaan peran→Capability tunggal),
      `requireCurrentUser()` menurunkan CurrentUser dari sesi terverifikasi (401
      `Autentikasi diperlukan.` bila tak ada sesi), `authorize(currentUser, capability, objectGuard?)`
      mengecek peran DULU lalu guard per-objek; tolak peran → 403, tolak objek → 403; `index.ts`
      re-export batas publik slice
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 19.1, 19.2, 19.3, 19.4_
  - [ ]* 6.5 Property test untuk pemetaan peran `can(role, capability)`
    - **Property 2: Otorisasi peran — izin iff role dipetakan ke capability**
    - **Validates: Requirements 7.3, 19.4**
    - Pakai `fast-check` atas seluruh kombinasi Role × Capability
    - Daftarkan file test ke script `domain:test`
  - [ ]* 6.6 Unit test urutan evaluasi Authorizer (peran dulu, lalu objek)
    - Uji guard per-objek tidak dievaluasi jika peran gagal; tolak objek → 403 saat peran lolos
    - Daftarkan file test ke script `domain:test`
    - _Requirements: 7.2, 7.4, 7.6_
  - [x] 6.7 Implementasi `middleware.ts` sebagai gerbang AuthN global
    - Delegasi logika AuthN ke slice `auth`; request halaman tanpa sesi → redirect `/login`; request
      API tanpa sesi → 401 `Autentikasi diperlukan.` sesuai kontrak error; sesi valid → teruskan ke
      Server_Component/Route_Handler
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7. Checkpoint — slice auth
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Domain event murni: tipe, Zod schema, validator invariant
  - [x] 8.1 Implementasi `domain/event/types.ts`
    - `EventDisplayStatus` (`soon|ongoing|done`), `EventLifecycle` (`ACTIVE|CANCELLED|ARCHIVED`),
      `EventListQuery`, `EventListPage`, `EventListItem`, `EventInput`; murni tanpa storage/Supabase
    - _Requirements: 4.1, 13.1, 16.5_
  - [x] 8.2 Implementasi `domain/event/validation.ts` — Zod + validator invariant
    - `eventInputSchema` (`.strict()`, `name` trim 1–200, `alias` optional trim ≤200, `venueId`/
      `eventOrganizerId`/`picId` uuid, `startsOn`/`endsOn` YYYY-MM-DD, `.superRefine` `endsOn>=startsOn`);
      `cancelEventSchema` (`reason` trim 1–1000); `validateEventReferences(ctx)` murni mengembalikan
      `Validation<true>` dengan semua referensi tidak valid + pesan Indonesia
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 11.3, 12.4, 13.4_
  - [ ]* 8.3 Property test untuk Event_Display_Status dari tanggal
    - **Property 6 (pendukung): display status deterministik dari tanggal** (`soon` jika hari ini <
      startsOn, `ongoing` jika di antara inklusif, `done` jika > endsOn)
    - **Validates: Requirements 16.5**
    - Pakai `fast-check`; daftarkan file test ke script `domain:test`
  - [ ]* 8.4 Unit test untuk Zod schema + `validateEventReferences`
    - Uji nama kosong/>200 → pesan `Nama event wajib diisi.`; `endsOn<startsOn` → pesan tanggal;
      alias trim dipertahankan/di-null-kan; referensi invalid mengumpulkan semua issue
    - Daftarkan file test ke script `domain:test`
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 13.4_

- [x] 9. Migrasi event: venues, event_organizers, events, event_cancellations + RLS
  - [ ] 9.1 Tulis migrasi SQL master data + event di `supabase/migrations/`
    - `venues` (`legal_name` CHECK 1–200, `alias_name` nullable, `city`, index `workspace_id,
      legal_name`); `event_organizers` (`legal_name` CHECK 1–200, index serupa)
    - `events` (`name` CHECK 1–200, `alias` nullable persisted, `venue_id`/`event_organizer_id`
      `on delete restrict`, `pic_id` NOT NULL `on delete restrict`, `starts_on`/`ends_on` date,
      `status` CHECK IN `ACTIVE|CANCELLED|ARCHIVED` default `ACTIVE`, `created_by_id`, `created_at`/
      `updated_at`, CHECK `ends_on >= starts_on`); index starts desc, status, dan `venue_id,starts_on,
      ends_on` untuk deteksi konflik venue
    - `event_cancellations` (`event_id` UNIQUE FK `on delete cascade`, `reason` CHECK 1–1000,
      `cancelled_by_id`, `cancelled_at`)
    - Aktifkan RLS + `revoke all ... from anon, authenticated` untuk keempat tabel
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 10.2, 12.3, 13.1, 13.5, 14.1, 15.1_

- [x] 10. Repository event (server-only, satu-satunya pemilik query)
  - [x] 10.1 Implementasi `features/events/repository.ts`
    - `import 'server-only'`; `EventRow`; `insertEvent`, `updateEvent`, `findEventById`,
      `findEventSummary`, `deleteEvent`, `insertCancellation`, `checkReferences`, `hasDerivedData`
    - `queryEventList` dengan filter SERVER-SIDE: join venue/EO/PIC, `ilike` substring pada name/alias/
      venue/organizer/PIC, filter lifecycle, computed display status dari `current_date`, agregat
      ringkasan (total, ongoing, exhibitors, ciplItems), dan perhitungan attention (overlap jadwal +
      konflik venue) — tanpa baca seluruh tabel ke memori
    - _Requirements: 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_
  - [ ]* 10.2 Unit test untuk pembentukan query filter `queryEventList`
    - Uji search kosong tak memfilter; filter lifecycle; ilike menjangkau kelima field; agregat +
      attention terbentuk
    - Daftarkan file test ke script `domain:test`
    - _Requirements: 16.2, 16.3, 16.4, 16.6, 16.7_

- [x] 11. Use-case event (orkestrasi + AuthZ + invariant server) + route handler tipis
  - [ ] 11.1 Implementasi use-case baca `list-events-for-dashboard.ts` + `get-event-summary.ts`
    - `import 'server-only'`; `authorize(currentUser, 'event:read')` lalu panggil repository langsung;
      indikator error bila query agregat/daftar/attention gagal (tidak merender data parsial sebagai
      valid)
    - _Requirements: 2.1, 2.2, 4.2, 4.5, 16.1, 16.8_
  - [ ] 11.2 Implementasi use-case `create-event.ts`
    - `authorize(currentUser, 'event:create')` sebelum tulis; `checkReferences` → `validateEventReferences`
      (domain murni) → `ApiError(400)` bila invalid; persist alias ter-trim atau null; status awal
      `ACTIVE`
    - _Requirements: 2.6, 7.1, 7.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [ ] 11.3 Implementasi use-case `update-event.ts`
    - `authorize(currentUser, 'event:update')`; 404 `Event tidak ditemukan.` bila tak ada; invariant
      `endsOn>=startsOn` (400 pesan tanggal); persist alias diperbarui; perbarui `updated_at`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [ ] 11.4 Implementasi use-case `cancel-event.ts`
    - `authorize(currentUser, 'event:cancel', guard = pic_id===currentUser.id || role==='SUPERVISOR')`;
      alasan kosong → 400 `Alasan pembatalan wajib diisi.` tanpa ubah status/buat cancellation; valid →
      set `status='CANCELLED'` + buat tepat satu `event_cancellations` (alasan, pelaku, waktu);
      pertahankan bijection CANCELLED↔cancellation
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 15.2, 15.3, 15.4_
  - [ ] 11.5 Implementasi use-case `delete-event.ts` dan `archive-event.ts`
    - Delete: 404 bila tak ada; `authorize('event:delete', guard PIC-or-SUPERVISOR)`; `hasDerivedData`
      → 409 arahkan batal/arsip; selain itu hapus → 204; non-PIC non-SUPERVISOR → 403 pesan
      `Hanya PIC event atau supervisor yang dapat melakukan tindakan ini.`
    - Archive: set `status='ARCHIVED'` dan pertahankan seluruh data turunan
    - _Requirements: 7.1, 7.7, 14.1, 14.2, 14.3, 14.4, 14.5, 15.2, 15.3, 15.4_
  - [ ] 11.6 Implementasi route handler tipis `app/api/events/route.ts` dan `app/api/events/[eventId]/route.ts`
    - `runtime='nodejs'`, `dynamic='force-dynamic'`; `requireCurrentUser()` → parse Zod → delegasi
      use-case → `toErrorResponse`; POST 201, PATCH/cancel, DELETE 204; tanpa SQL/aturan bisnis di route
    - _Requirements: 2.3, 2.5, 2.6, 7.7, 8.1_
  - [ ]* 11.7 Integration test — bypass UI tetap menegakkan AuthZ + invariant
    - **Property 3: invariant server & Property 2: AuthZ server (POST/DELETE langsung ke route)**
    - **Validates: Requirements 7.7, 10.7, 11.x, 14.3, 15.2**
    - Uji input tak valid ditolak (400), peran/objek tak berwenang ditolak (403), hapus dengan data
      turunan ditolak (409) tanpa UI; daftarkan file test ke script `domain:test`

- [ ] 12. Checkpoint — slice event
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Komponen slice event: Server Component page + sub-komponen + leaf klien
  - [x] 13.1 Implementasi RSC `app/(dashboard)/events/page.tsx` + `features/events/components/event-list.tsx`
    - `dynamic='force-dynamic'`; `requireCurrentUser()` lalu `await listEventsForDashboard` di server;
      `EventList` sebagai sub-komponen server; tanpa `'use client'`, tanpa SQL/Supabase di komponen;
      tampilkan ringkasan + Attention_Panel; indikator error bila data gagal dimuat
    - _Requirements: 2.1, 2.2, 16.1, 16.6, 16.8_
  - [x] 13.2 Implementasi sub-komponen server `features/events/components/event-card.tsx`
    - Server Component (tanpa `'use client'`) yang `await getEventSummary(id)` (kolokasi baca); query
      tetap di repository; aksi interaktif dipisah ke leaf klien
    - _Requirements: 2.1, 2.2, 4.4_
  - [x] 13.3 Implementasi leaf klien `event-form-modal.tsx` dan `event-filters.tsx` + `features/events/index.ts`
    - `'use client'`; mutasi via `fetch('/api/events', { cache: 'no-store' })` lalu `router.refresh()`
      saat sukses; tanpa impor modul server-only; error validasi per-field inline; `index.ts`
      re-export batas publik slice
    - _Requirements: 2.3, 2.4, 3.1, 3.3_

- [x] 14. Master data venue/EO: create-inline + referenced-by-id
  - [x] 14.1 Implementasi repository + use-case + route master data venue/EO
    - `authorize(currentUser, 'reference:create')`; `legal_name` kosong/spasi → 400; create inline lalu
      event merujuk lewat FK id (bukan nilai digandakan); pilih yang sudah ada dalam workspace
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [ ]* 14.2 Unit test validasi master data inline
    - Uji `legal_name` kosong/spasi ditolak 400; record terbuat lalu dirujuk lewat id
    - Daftarkan file test ke script `domain:test`
    - _Requirements: 12.2, 12.4_

- [x] 15. Guard arsitektur lintas-cutting (P1, P5)
  - [x] 15.1 Implementasi skrip guard arsitektur + registrasi di `package.json`
    - Lint/grep: gagal (exit non-nol) bila file `'use client'` (di `app/**` non-`api`, `components/**`,
      `features/**/components/*`) mengimpor `server-only` module (`features/**/use-cases/*`,
      `features/**/repository.ts`, `lib/server/*`) atau `@supabase/supabase-js`, langsung/transitif;
      laporkan path file + baris impor; tanpa memodifikasi sumber
    - Guard P5: gagal bila ada kolom `payload` jsonb yang menduplikasi field relasional di migrasi
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 5.3, 20.2_
  - [ ]* 15.2 Test fixture untuk guard arsitektur
    - Fixture pelanggaran (klien impor server-only) → guard gagal exit non-nol; fixture bersih → lolos
    - **Property 1: batas server/klien** dan **Property 5: tanpa dua sumber kebenaran**
    - **Validates: Requirements 3.1, 3.5, 5.3**
    - Daftarkan file test ke script `domain:test`

- [x] 16. Final checkpoint — seluruh fondasi + slice auth + slice event
  - Ensure all tests pass (`npx tsc --noEmit`, `npm run domain:test`, `npm run build`), ask the user if
    questions arise.

## Notes

- Tasks bertanda `*` bersifat opsional (unit/property/integration test) dan dapat dilewati untuk MVP
  lebih cepat; task inti tidak pernah ditandai opsional.
- Setiap task merujuk sub-requirement granular untuk ketertelusuran.
- Property test memetakan ke correctness property desain: P1 (15.2), P2 (6.5, 11.7), P3 (11.7),
  P4 (3.6), P5 (15.2), P6 (8.3 pendukung).
- **Setiap `*.test.ts` baru WAJIB didaftarkan ke script `domain:test`** di `package.json`, kalau tidak
  test tidak pernah berjalan (konvensi proyek). File test baru memakai `bun:test`.
- Gerbang verifikasi: `npx tsc --noEmit` (jaga tetap bersih) + `npm run domain:test`; tambah
  `npm run build` untuk perubahan yang menyentuh route/komponen.
- Cutover bersih (DD-A4): bangun skema baru langsung, bukan di samping kode lama.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.5"] },
    { "id": 2, "tasks": ["3.4", "3.6", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1", "6.2", "8.1"] },
    { "id": 4, "tasks": ["6.3", "6.4", "8.2"] },
    { "id": 5, "tasks": ["6.5", "6.6", "6.7", "8.3", "8.4", "9.1"] },
    { "id": 6, "tasks": ["10.1", "14.1"] },
    { "id": 7, "tasks": ["10.2", "11.1", "11.2", "11.3", "11.4", "11.5", "14.2"] },
    { "id": 8, "tasks": ["11.6", "13.2"] },
    { "id": 9, "tasks": ["11.7", "13.1", "13.3", "15.1"] },
    { "id": 10, "tasks": ["15.2"] }
  ]
}
```
