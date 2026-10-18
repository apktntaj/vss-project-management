# Implementation Plan

- [x] 1. Tulis exploration test untuk bug condition (SEBELUM perbaikan)
  - **Property 1: Bug Condition** - Sesi login kehilangan `role`/`workspaceId`
  - **CRITICAL**: Test ini HARUS GAGAL pada kode belum-diperbaiki — kegagalannya membuktikan bug ada.
  - **DO NOT attempt to fix the test or the code when it fails** pada langkah ini.
  - **NOTE**: Test ini meng-encode perilaku yang diharapkan — ia akan memvalidasi perbaikan ketika
    nanti LULUS setelah implementasi (dipakai ulang di task 3.2).
  - **GOAL**: Memunculkan counterexample yang membuktikan sesi pengguna yang sudah login kehilangan
    `role`/`workspaceId` sehingga `requireCurrentUser()` menolak 401.
  - **Scoped PBT Approach**: Bug ini deterministik pada bentuk callback. Scope properti ke kasus
    konkret yang gagal: principal bergaya legacy yang HANYA membawa `isAdmin` (tanpa `role`/`workspaceId`).
  - Buat file test baru `features/auth/auth.config.test.ts` memakai `import { expect, test } from 'bun:test'`
    (gaya per-test agar hasil terlaporkan).
  - **WAJIB**: Daftarkan path `features/auth/auth.config.test.ts` ke script `domain:test` di
    `package.json` — tanpa ini test tidak pernah dieksekusi.
  - Jalankan rantai callback pada kode belum-diperbaiki: `applyJwtClaims({}, { isAdmin: true })` lalu
    `projectSession(baseSession, token)`, dan assert `session.user.role` serta `session.user.workspaceId`
    TERISI untuk pengguna yang sudah login (Bug Condition `isBugCondition` dari design).
  - Assertion harus mencerminkan Expected Behavior dari design: `projectSession` menghasilkan
    `session.user.role`/`workspaceId` yang terdefinisi, dan narrowing ala `requireCurrentUser`
    (cek `user.id && user.role && user.workspaceId`) tidak menolak.
  - Catatan: karena `applyJwtClaims`/`projectSession` belum diekstrak pada kode belum-diperbaiki,
    tulis test terhadap seam callback yang akan diekstrak di task 3.3; pada baseline test ini GAGAL.
  - Jalankan test pada kode belum-diperbaiki.
  - **EXPECTED OUTCOME**: Test GAGAL (benar — membuktikan bug ada: `role`/`workspaceId` hilang dari sesi).
  - Dokumentasikan counterexample yang ditemukan (mis. `session.user.role === undefined` dan
    `session.user.workspaceId === undefined` untuk principal `{ isAdmin: true }`).
  - Tandai task selesai saat test ditulis, dijalankan, dan kegagalannya terdokumentasi.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Tulis preservation property tests (SEBELUM perbaikan)
  - **Property 2: Preservation** - Perilaku non-bug tidak berubah
  - **IMPORTANT**: Ikuti observation-first — amati perilaku kode belum-diperbaiki untuk input yang
    BUKAN bug condition lebih dulu, lalu kunci dengan test.
  - Tambahkan ke `features/auth/auth.config.test.ts` (sudah terdaftar di `domain:test` dari task 1).
  - Observe + kunci perilaku untuk input `NOT isBugCondition`:
    - Tanpa sesi / token tanpa `role`/`workspaceId`: proyeksi sesi tetap menghasilkan bentuk yang
      DITOLAK narrowing `requireCurrentUser` → 401 terjaga (Req 3.2, 3.3); guard halaman tetap
      redirect `/login` (Req 3.1).
    - Peran 403: iterasi generatif ringan `ROLES` × `Capability` memastikan `can(role, capability)`
      konsisten dengan `ROLE_CAPABILITIES` — `CUSTOMER_SERVICE`/`DOCUMENT_ASSISTANT` hanya
      `event:read` (Req 3.5).
    - `isAdmin` untuk `/settings`: round-trip principal `isAdmin: true/false` lewat
      `applyJwtClaims`→`projectSession` menghasilkan `session.user.isAdmin` yang sama (Req 3.6).
  - Pendekatan property-based ringan (tanpa menambah dependency `fast-check`): loop generatif di
    dalam `bun:test` atas `ROLES` × `{ true, false }` isAdmin × beberapa contoh `id`/`workspaceId`.
  - Catatan kredensial salah (Req 3.4): `authenticateCredential` mengembalikan `null` untuk email
    tak dikenal / user nonaktif / password salah — jalur ini tidak berubah oleh perbaikan dan
    diverifikasi lewat `npx tsc --noEmit` + `npm run build`; tulis assertion murni hanya untuk seam
    yang dapat diuji unit (`can`, callback).
  - Jalankan tests pada kode belum-diperbaiki.
  - **EXPECTED OUTCOME**: Test LULUS (mengonfirmasi baseline perilaku yang harus dipertahankan).
    Bagian yang mengacu `applyJwtClaims`/`projectSession`/`isAdmin` akan diaktifkan penuh setelah
    ekstraksi di task 3.3; bagian `can()` harus lulus sejak baseline.
  - Tandai task selesai saat tests ditulis, dijalankan, dan lulus pada kode belum-diperbaiki.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

^- [x] 3. Perbaikan untuk 401 pada `/events` — satukan jalur cetak-token ke New Auth Slice (token terpadu)

  - [x] 3.1 Bawa `isAdmin` di domain + repository slice auth
    - `domain/auth/types.ts`: tambah `isAdmin: boolean` pada tipe `User`; deklarasikan
      `AuthenticatedPrincipal = CurrentUser & { isAdmin: boolean }`. `CurrentUser` TETAP
      `{ id, role, workspaceId }` agar otorisasi tidak berubah.
    - `features/auth/repository.ts`: tambah `is_admin` ke `USER_COLUMNS` dan ke `AppUserRow`;
      petakan ke `isAdmin` saat membangun `User`; `authenticateCredential` mengembalikan
      `AuthenticatedPrincipal` (`{ id, role, workspaceId, isAdmin }`) — reduksi tetap membuang
      `passwordHash`, plaintext/hash tidak pernah di-log. Pertahankan `import 'server-only'`.
    - _Bug_Condition: isBugCondition(request) — sesi login tanpa `role`/`workspaceId`_
    - _Expected_Behavior: principal membawa `role`, `workspaceId`, dan `isAdmin` untuk dicetak ke token_
    - _Preservation: Preservation Requirements — `CurrentUser` shape & otorisasi tak berubah_
    - _Requirements: 2.2, 2.3, 3.6_

  - [x] 3.2 Kembalikan `isAdmin` dari credential provider slice baru
    - `features/auth/nextauth.ts`: pada `authorize`, kembalikan `{ id, role, workspaceId, isAdmin }`
      dari principal (sah terhadap augmentasi opsional `User` di `types/next-auth.d.ts`).
    - Pertahankan `import 'server-only'` dan delegasi verifikasi ke `authenticateCredential`.
    - _Bug_Condition: isBugCondition(request) dari design_
    - _Expected_Behavior: objek user sign-in membawa `role`/`workspaceId`/`isAdmin`_
    - _Preservation: kegagalan kredensial tetap `null` → sign-in ditolak (Req 3.4)_
    - _Requirements: 2.2, 3.4_

  - [x] 3.3 Ekstrak callback murni + bawa `isAdmin` di token dan sesi
    - `features/auth/auth.config.ts`: ekstrak badan kedua callback menjadi fungsi murni bernama yang
      diekspor: `applyJwtClaims(token, user)` dan `projectSession(session, token)`, lalu rujuk dari
      objek config.
    - `applyJwtClaims`: saat `user` ada, salin `role`, `workspaceId`, DAN `token.isAdmin = user.isAdmin`;
      saat `user` tidak ada, kembalikan token apa adanya (permintaan non-sign-in).
    - `projectSession`: proyeksikan `id` (dari `token.sub`), `role`, `workspaceId`, dan
      `session.user.isAdmin = Boolean(token.isAdmin)`; field hilang → `role`/`workspaceId` `undefined`,
      `isAdmin` `false`.
    - Modul TETAP tanpa `import 'server-only'` dan tanpa impor Node/Supabase (edge-safe).
    - _Bug_Condition: isBugCondition(request) dari design_
    - _Expected_Behavior: expectedBehavior(result) — token/sesi membawa `role`/`workspaceId`/`isAdmin`_
    - _Preservation: token tanpa klaim → `role`/`workspaceId` undefined (401 terjaga); `isAdmin` round-trip_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.6_

  - [x] 3.4 Arahkan endpoint + jalur mint/clear sesi ke New Auth Slice
    - `app/api/auth/[...nextauth]/route.ts`: `import { handlers } from '@/features/auth'` menggantikan `@/auth`.
    - `app/(auth)/login/actions.ts`: `signIn` dari `@/features/auth`; pertahankan bentuk
      `loginAction(_state, formData)` dan pesan Indonesia `'Email atau password tidak cocok.'`
      (kontrak `useFormState` dan Req 3.4 tidak berubah).
    - `app/(dashboard)/actions.ts`: `signOut` dari `@/features/auth`; pertahankan `redirectTo: '/login'`.
    - JANGAN ubah `app/(dashboard)/layout.tsx`, `settings/page.tsx`, guard CEISA, atau
      `features/auth/authorize.ts` — token terpadu membawa `isAdmin` yang mereka baca.
    - _Bug_Condition: isBugCondition(request) — jalur mint terikat instance legacy (akar utama)_
    - _Expected_Behavior: token dicetak/dibaca oleh instance yang sama (unified JWT)_
    - _Preservation: cookie/`AUTH_SECRET` sama → pembaca legacy `isAdmin` tetap berfungsi (Req 3.6)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verifikasi exploration test bug condition kini LULUS
    - **Property 1: Expected Behavior** - Sesi login membawa `role` dan `workspaceId`
    - **IMPORTANT**: Jalankan ulang test YANG SAMA dari task 1 — JANGAN tulis test baru.
    - Test dari task 1 meng-encode perilaku yang diharapkan; ketika lulus ia mengonfirmasi bug teratasi.
    - Jalankan `npm run domain:test`.
    - **EXPECTED OUTCOME**: Test LULUS (mengonfirmasi `role`/`workspaceId`/`isAdmin` kini terbawa).
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verifikasi preservation tests tetap LULUS
    - **Property 2: Preservation** - Perilaku non-bug tidak berubah
    - **IMPORTANT**: Jalankan ulang tests YANG SAMA dari task 2 — JANGAN tulis tests baru.
    - Jalankan `npm run domain:test`.
    - **EXPECTED OUTCOME**: Tests LULUS (tanpa regresi: 401 tanpa sesi, 403 peran, `isAdmin` utuh).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

^- [x] 4. Checkpoint - Pastikan semua validasi lulus
  - `npx tsc --noEmit` tetap BERSIH (tidak ada error baru).
  - `npm run domain:test` lulus, termasuk `features/auth/auth.config.test.ts` yang baru terdaftar.
  - `npm run build` sukses (menyentuh route `app/api/auth/[...nextauth]` dan server action login/logout).
  - Pastikan semua test lulus; tanyakan ke user bila muncul pertanyaan.

## Catatan implementasi (penyelesaian 2026-10-19)

Tiga penyelesaian di luar teks task, semuanya diperlukan agar validasi task 4 lulus:

1. **Principal membawa `email` + `fullName`** (`domain/auth/types.ts`, `repository.ts`,
   `nextauth.ts`). Spec hanya menjamin `isAdmin` untuk pembaca legacy, tetapi konsumen sesi juga
   membaca `session.user.name` (AppShell) dan `session.user.email` (lookup `app_users` di
   `app/api/event-records` + `lib/supabase/event-api.ts`). Tanpa ini, token terpadu justru
   mematahkan jalur tersebut. `CurrentUser` otorisasi tetap minimal `{ id, role, workspaceId }`.
2. **Tabel kapabilitas dipindah ke `features/auth/capabilities.ts`** (murni, tanpa
   `server-only`); `authorize.ts` me-re-export-nya. Sebelumnya `auth.config.test.ts` gagal
   dimuat bun test karena `import 'server-only'` di `authorize.ts`.
3. **Guard narrowing `requireCurrentUser` dikembalikan** (sempat dikomentari saat debugging) dan
   **simulasi test diberi `token.sub`** — NextAuth v5 menetapkan `token.sub = user.id` di luar
   callback kustom; simulasi lama tidak memodelkannya sehingga `session.user.id` undefined.

Akibat cutover: cookie lama (tanpa `role`/`workspaceId`) ditolak 401 oleh narrowing — pemiliknya
cukup login ulang sekali. Pembaca `@/auth` legacy (layout, settings, guard CEISA, API routes)
TIDAK diubah sesuai task 3.4; mereka tetap berfungsi karena secret dan cookie sama.

### Tambahan pasca-verifikasi (2026-10-19, laporan "masih error" di /events)

Cookie pra-cutover membuat user terjebak: `/events` meledak ApiError(401) tanpa penanganan,
dan `/login` memantulkannya kembali ke `/` karena hanya mengecek `session?.user`. Dua perbaikan:

- `app/(auth)/login/page.tsx`: ganti ke `auth` slice baru; hanya redirect ke `/` bila klaim
  lengkap (id+role+workspaceId) — cookie basi tetap ditampilkan form untuk login ulang.
- `app/(dashboard)/events/page.tsx`: tangkap `ApiError(401)` dari `requireCurrentUser` →
  `redirect('/login')` alih-alih halaman error.

Diverifikasi end-to-end (server uji + cookie tempaan): cookie lama → /events redirect ke
/login + form tampil + API 401; cookie baru (role/workspaceId/email/name) → /events 200 dan
API 200.
