# Events Page Auth 401 Bugfix Design

## Overview

Halaman `/events` dan seluruh permukaan yang menurunkan `CurrentUser` lewat `requireCurrentUser()`
menolak pengguna yang sudah login dengan HTTP 401 (`Autentikasi diperlukan.`). Penyebabnya bukan
cookie basi biasa, melainkan **cutover autentikasi yang setengah jadi**: ada dua instance NextAuth v5
yang berbagi satu cookie sesi, tetapi jalur yang MENCETAK token (login) berbeda dari jalur yang
MEMBACA token untuk otorisasi event.

- Jalur sign-in yang dipakai login terikat ke instance **legacy** `@/auth` (`auth.ts`), yang callback
  `jwt`/`session`-nya hanya menuliskan `isAdmin` ke token — tidak ada `role` maupun `workspaceId`.
- Halaman event dan route handler event/master-data membaca sesi lewat **slice auth baru**
  (`features/auth/nextauth.ts` + `features/auth/auth.config.ts`), yang mensyaratkan `role` dan
  `workspaceId`. `requireCurrentUser()` menolak sesi tanpa dua klaim itu sebagai belum terautentikasi.

Akibatnya setiap sesi yang dicetak form login saat ini tidak pernah membawa `role`/`workspaceId`,
sehingga `requireCurrentUser()` selalu 401 untuk pengguna yang sebenarnya sudah login.

Strategi perbaikan (sesuai arahan desain): **menyatukan jalur sign-in/cetak-token ke slice auth
baru** sehingga JWT yang dicetak membawa `role`, `workspaceId`, DAN tetap `isAdmin`. Dengan begitu
`requireCurrentUser()` TIDAK perlu dilemahkan, dan pembaca legacy (`AppShell`, `/settings`, guard
CEISA) yang masih membaca `isAdmin` tetap berfungsi karena token tunggal yang baru membawa semua
klaim. Karena kedua instance berbagi `AUTH_SECRET` dan nama cookie default yang sama, satu token
terpadu dapat dibaca oleh kedua instance tanpa divergensi.

## Glossary

- **Bug_Condition (C)**: Sebuah permintaan ke permukaan terproteksi yang menurunkan `CurrentUser`
  membawa sesi JWT terotentikasi yang TIDAK memuat klaim `role` dan/atau `workspaceId`.
- **Property (P)**: Untuk sesi pengguna yang sudah login, `requireCurrentUser()` berhasil menurunkan
  `CurrentUser { id, role, workspaceId }` dan permukaan tidak lagi menolak dengan 401.
- **Preservation**: Perilaku yang WAJIB tak berubah — redirect `/login` saat tanpa sesi, 401 untuk
  `/api/*` tanpa sesi, penolakan kredensial salah, penolakan peran 403, dan akses admin `/settings`
  berbasis `isAdmin`.
- **Legacy Auth Instance**: Instance NextAuth di `auth.ts`, diekspor sebagai `@/auth`. Callback-nya
  hanya menuliskan `isAdmin`. Mengautentikasi lewat `lib/supabase/users.ts` / `lib/demo-users.ts`.
- **New Auth Slice**: Instance NextAuth di `features/auth/nextauth.ts` (men-spread
  `features/auth/auth.config.ts`), diekspor lewat barrel `@/features/auth`. Credential provider-nya
  memakai `authenticateCredential` (repository → Supabase). Callback-nya menuliskan `role` dan
  `workspaceId`.
- **Unified JWT**: Token JWT tunggal yang, setelah perbaikan, membawa `role`, `workspaceId`, dan
  `isAdmin` sekaligus — dapat dibaca benar oleh Legacy Auth Instance maupun New Auth Slice.
- **`requireCurrentUser`**: Fungsi di `features/auth/authorize.ts` yang memanggil `auth()` New Auth
  Slice; melempar `ApiError(401, 'Autentikasi diperlukan.')` bila `user.id`/`user.role`/
  `user.workspaceId` tidak lengkap, selain itu mengembalikan `{ id, role, workspaceId }`.
- **`role`**: `STAFF | SUPERVISOR | CUSTOMER_SERVICE | DOCUMENT_ASSISTANT` (`domain/auth/types.ts`),
  dipakai pemetaan kapabilitas di `authorize.ts`.
- **`workspaceId`**: ID workspace single-tenant (`slug = 'default'`) yang menyertai `CurrentUser`.
- **`isAdmin`**: Flag boolean terpisah dari `role` (kolom `app_users.is_admin`) yang menggerbang
  `/settings` dan endpoint CEISA.

## Bug Details

### Bug Condition

Bug muncul ketika sebuah permintaan ke permukaan terproteksi (halaman `/events`, route handler event
`app/api/events/**`, atau master data referensi `features/events/use-cases/list-references.ts`
lewat `app/api/event-records`) menurunkan `CurrentUser` sementara sesi JWT terotentikasi tidak
memuat `role` dan/atau `workspaceId`. Token seperti itu dicetak oleh Legacy Auth Instance pada saat
login, yang callback `jwt`-nya hanya menyalin `isAdmin`. New Auth Slice membaca token yang sama
namun tidak menemukan `role`/`workspaceId`, sehingga `requireCurrentUser()` memperlakukannya sebagai
belum terautentikasi.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request ke permukaan terproteksi yang memanggil requireCurrentUser()
  OUTPUT: boolean

  session := NewAuthSlice.auth(request)           // membaca cookie JWT bersama

  RETURN sessionIsAuthenticated(session)          // pengguna benar-benar sudah login
         AND session.user.id IS PRESENT
         AND (session.user.role IS ABSENT
              OR session.user.workspaceId IS ABSENT)
END FUNCTION
```

Perilaku benar yang diharapkan untuk input yang memenuhi bug condition:
```
FUNCTION expectedBehavior(result)
  INPUT: result dari requireCurrentUser() untuk sesi pengguna yang sudah login
  OUTPUT: boolean

  RETURN result IS CurrentUser { id, role, workspaceId }
         AND requireCurrentUser did NOT throw ApiError(401)
END FUNCTION
```

### Examples

- **Buka `/events` setelah login (bug):** Pengguna login lewat form → cookie dicetak Legacy Instance
  (`token = { sub, isAdmin }`). Membuka `/events` → `requireCurrentUser()` membaca sesi tanpa
  `role`/`workspaceId` → lempar 401 → halaman merender keadaan gagal, dashboard tak pernah muncul.
  Diharapkan: dashboard event ter-render.
- **POST `/api/events` setelah login (bug):** Handler memanggil `requireCurrentUser()` lebih dulu →
  401 sebelum Zod/parse — padahal pengguna sudah login. Diharapkan: lanjut ke otorisasi peran
  (201 bila STAFF/SUPERVISOR, atau 403 bila peran tak berhak).
- **Master data referensi (bug):** Alur `list-references` / `reference:create` yang menurunkan
  `CurrentUser` menolak 401. Diharapkan: diputuskan berdasarkan peran.
- **Admin buka `/settings` (harus tetap jalan):** `/settings` membaca `session.user.isAdmin` lewat
  Legacy Instance. Perbaikan tidak boleh menghilangkan `isAdmin` dari token.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Permintaan halaman terproteksi TANPA sesi tetap dialihkan ke `/login` (middleware + guard layout).
- Permintaan `/api/*` terproteksi TANPA sesi tetap membalas 401 `{ "error": "Autentikasi diperlukan." }`.
- `requireCurrentUser()` pada permintaan yang benar-benar tanpa sesi lengkap tetap melempar 401
  dengan pesan `Autentikasi diperlukan.`.
- Kredensial salah pada form login tetap ditolak dengan pesan kesalahan kredensial.
- Penolakan otorisasi peran tetap 403 (tabel `ROLE_CAPABILITIES` + `can`/`authorize` tidak diubah).
- Admin tetap dapat membuka `/settings` berdasarkan `isAdmin`; guard admin CEISA tetap berfungsi.

**Scope:**
Semua input yang BUKAN "sesi terotentikasi tanpa `role`/`workspaceId`" tidak boleh terpengaruh oleh
perbaikan ini. Ini mencakup:
- Permintaan tanpa sesi sama sekali (halaman maupun API).
- Sign-in dengan kredensial salah.
- Pengguna login dengan peran yang tidak berhak atas sebuah kapabilitas.
- Pembacaan `isAdmin` oleh `AppShell`, `/settings`, dan route CEISA.

## Hypothesized Root Cause

Analisis kode mengonfirmasi akar masalah berikut (bukan sekadar dugaan):

1. **Jalur cetak-token terikat ke instance yang salah (akar utama).** `app/(auth)/login/actions.ts`
   memanggil `signIn` dari `@/auth` (Legacy Instance), dan `app/api/auth/[...nextauth]/route.ts`
   mengekspor `handlers` dari `@/auth`. Callback `jwt` legacy hanya `token.isAdmin = user.isAdmin`;
   `role`/`workspaceId` tidak pernah ditulis ke token.

2. **Jalur baca-token untuk event memakai instance lain.** `features/auth/authorize.ts`
   (`requireCurrentUser`) memanggil `auth()` dari New Auth Slice, yang callback `session`-nya
   (`auth.config.ts`) memproyeksikan `role`/`workspaceId` dari token. Karena token legacy tak memuat
   keduanya, hasilnya `undefined` → 401.

3. **Use-case sign-in baru belum tersambung.** `features/auth/use-cases/sign-in.ts` (memakai New
   Auth Slice `signIn`) sudah ada namun tidak dipakai oleh `login-form.tsx` maupun route `/api/auth`.
   Jadi perbaikan adalah MENYAMBUNGKAN jalur yang sudah dirancang, bukan menulis mekanisme baru.

4. **`isAdmin` tidak dibawa slice baru.** New Auth Slice (`authenticateCredential` → `CurrentUser`,
   callback hanya `role`/`workspaceId`) tidak membawa `isAdmin`. Memindahkan cetak-token ke slice
   baru tanpa menambahkan `isAdmin` akan mematahkan `/settings` — jadi perbaikan harus membawa
   `isAdmin` juga agar token tetap terpadu.

## Correctness Properties

Property 1: Bug Condition - Sesi login membawa role dan workspaceId

_For any_ input di mana bug condition berlaku (`isBugCondition` bernilai true untuk sesi pengguna
yang sudah login namun tanpa `role`/`workspaceId`), setelah jalur sign-in disatukan ke New Auth
Slice, token yang dicetak SHALL memuat `role` dan `workspaceId` pengguna sehingga
`requireCurrentUser()` menurunkan `CurrentUser { id, role, workspaceId }` dan permukaan terproteksi
SHALL tidak lagi menolak dengan 401.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Perilaku non-bug tidak berubah

_For any_ input di mana bug condition TIDAK berlaku (`isBugCondition` bernilai false) — permintaan
tanpa sesi, kredensial salah, peran tak berhak, atau pembacaan `isAdmin` — kode setelah perbaikan
SHALL menghasilkan perilaku yang sama dengan sebelum perbaikan: redirect `/login` atau 401 untuk
tanpa sesi, penolakan kredensial salah, 403 untuk peran tak berhak, dan izin `/settings` berbasis
`isAdmin` tetap utuh.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Prinsip

Satukan **jalur cetak/clear/endpoint sesi** ke New Auth Slice, dan jadikan token yang dicetak
**terpadu** (membawa `role`, `workspaceId`, dan `isAdmin`). Pembaca legacy yang hanya memakai
`isAdmin` (`AppShell` via `layout.tsx`, `/settings`, route API lain, guard CEISA) TIDAK perlu diubah
karena mereka berbagi `AUTH_SECRET` + cookie dan membaca `isAdmin` yang kini ada di token terpadu.
`requireCurrentUser()` tidak diubah (tidak dilemahkan).

### Changes Required

**1. Repository slice auth — ambil dan bawa `is_admin`.**

**File**: `features/auth/repository.ts`

- Tambahkan `is_admin` ke `USER_COLUMNS` dan ke tipe `AppUserRow`.
- Petakan ke field `isAdmin` saat membangun `User`.
- `authenticateCredential` mengembalikan principal yang membawa `isAdmin` di samping
  `{ id, role, workspaceId }` — mis. tipe `AuthenticatedPrincipal = CurrentUser & { isAdmin: boolean }`.
  (Reduksi tetap membuang `passwordHash`; plaintext tidak pernah di-log.)

**File**: `domain/auth/types.ts`

- Tambahkan `isAdmin: boolean` pada tipe `User`.
- Deklarasikan `AuthenticatedPrincipal = CurrentUser & { isAdmin: boolean }` (atau serupa).
  `CurrentUser` TETAP `{ id, role, workspaceId }` agar otorisasi tidak berubah.

**2. Credential provider slice baru — kembalikan `isAdmin`.**

**File**: `features/auth/nextauth.ts`

- Pada `authorize`, kembalikan `{ id, role, workspaceId, isAdmin }` dari principal
  (bentuk ini sah terhadap augmentasi `User` di `types/next-auth.d.ts` yang semua fieldnya opsional).

**3. Callback edge-safe — bawa `isAdmin` di token dan sesi.**

**File**: `features/auth/auth.config.ts`

- Callback `jwt`: selain `role`/`workspaceId`, set `token.isAdmin = user.isAdmin` saat `user` ada.
- Callback `session`: tambah `session.user.isAdmin = Boolean(token.isAdmin)` (selaras augmentasi
  `Session['user'].isAdmin: boolean`).
- Modul ini TETAP tanpa `import 'server-only'` dan tanpa impor Node/Supabase — perubahan hanya
  menyalin klaim, aman untuk edge/`middleware.ts`.
- Untuk ketertestan (lihat Testing Strategy), ekstrak badan kedua callback menjadi fungsi murni
  bernama yang diekspor (mis. `applyJwtClaims(token, user)` dan `projectSession(session, token)`)
  lalu rujuk dari objek config.

**4. Endpoint NextAuth — pakai instance slice baru.**

**File**: `app/api/auth/[...nextauth]/route.ts`

- `import { handlers } from '@/features/auth'` menggantikan `@/auth`, agar endpoint
  sign-in/callback/session berjalan pada instance yang sama dengan yang mencetak token.

**5. Jalur login — cetak token lewat slice baru.**

**File**: `app/(auth)/login/actions.ts`

- Ganti `import { signIn } from '@/auth'` menjadi `signIn` dari `@/features/auth`
  (`features/auth/nextauth.ts`). Pertahankan bentuk `loginAction(_state, formData)` dan pesan
  Indonesia `'Email atau password tidak cocok.'` agar `login-form.tsx` (`useFormState`) dan
  perilaku kredensial-salah (Req 3.4) tidak berubah. (Alternatif: tujukan form ke
  `features/auth/use-cases/sign-in.ts`; tidak dipilih karena mengubah kontrak `useFormState` form.)

**6. Sign-out — clear lewat slice baru (konsistensi mint/clear).**

**File**: `app/(dashboard)/actions.ts`

- Ganti `signOut` ke `@/features/auth` agar sesi dibersihkan oleh instance yang sama. Cookie yang
  sama tetap terhapus; `redirectTo: '/login'` dipertahankan.

### Yang sengaja TIDAK diubah

- `app/(dashboard)/layout.tsx`, `app/(dashboard)/settings/page.tsx`, dan route API lain yang
  memanggil `auth()` dari `@/auth` TIDAK diubah. Token terpadu membawa `isAdmin`, dan callback
  `session` legacy memproyeksikannya; mereka tidak membutuhkan `role`/`workspaceId`. Mempertahankan
  footprint kecil mengurangi risiko regresi. (Cutover penuh ke slice baru adalah pekerjaan terpisah
  di luar bugfix ini.)
- `features/auth/authorize.ts` (`requireCurrentUser`, `can`, `authorize`) TIDAK diubah.

### Catatan sesi yang sudah ada (wajib re-login sekali)

Strategi sesi adalah JWT tanpa server-side store. Token yang dicetak SEBELUM perbaikan hanya memuat
`isAdmin`; callback `jwt` tidak mem-backfill token lama (ia menulis `role`/`workspaceId` hanya saat
`user` hadir, yaitu saat sign-in baru). Karena itu:

- Pengguna dengan cookie pra-perbaikan akan tetap 401 di `/events` sampai mereka **sign-out lalu
  sign-in ulang**, yang mencetak token terpadu baru.
- Ini konsisten dengan sifat sesi per-browser-session di `.kiro/requirements.md` dan tidak memerlukan
  migrasi data. Tidak ada invalidasi paksa; dampaknya satu kali per pengguna setelah rilis.
- Verifikasi tambahan: pastikan `AUTH_SECRET` terpasang (bukan hanya `NEXTAUTH_SECRET`), karena New
  Auth Slice membaca `process.env.AUTH_SECRET`; bila berbeda dari secret Legacy Instance, cookie
  lintas-instance tidak dapat didekripsi.

## Testing Strategy

### Validation Approach

Dua fase: pertama munculkan counterexample yang membuktikan bug pada kode belum-diperbaiki, lalu
verifikasi perbaikan bekerja dan perilaku non-bug terjaga. Karena repo tidak punya test untuk route
handler/komponen dan `auth()`/`signIn` adalah server-only yang sulit diunit-test, seam yang diuji
adalah **fungsi callback murni** `applyJwtClaims`/`projectSession` (hasil ekstraksi di
`auth.config.ts`) plus fungsi otorisasi murni `can`. File test baru WAJIB didaftarkan ke script
`domain:test` di `package.json` (mis. `features/auth/auth.config.test.ts`), memakai
`import { expect, test } from 'bun:test'`; jika tidak, test diam-diam tidak pernah berjalan.

### Exploratory Bug Condition Checking

**Goal**: Memunculkan counterexample yang membuktikan bug SEBELUM perbaikan dan mengonfirmasi akar
masalah. Bila terbantah, hipotesis di-revisi.

**Test Plan**: Jalankan rantai callback pada kode belum-diperbaiki untuk `user` bergaya legacy (hanya
`isAdmin`) dan amati `role`/`workspaceId` hilang dari token/sesi — bentuk yang membuat
`requireCurrentUser()` 401.

**Test Cases**:
1. **Legacy mint lewat `/events`**: `applyJwtClaims(token, { isAdmin: true })` → token tanpa
   `role`/`workspaceId`; `projectSession` menghasilkan `session.user.role === undefined` (akan gagal
   di kode belum-diperbaiki karena callback legacy tak menulis `role`).
2. **Legacy mint lewat `/api/events`**: sesi tanpa `role`/`workspaceId` → narrowing
   `requireCurrentUser` menolak (401) meski pengguna login.
3. **Master data referensi**: sama — turunkan `CurrentUser` dari sesi legacy → 401.
4. **Edge — token hanya `sub`**: tanpa klaim apa pun selain `sub` → tetap 401 (batas bawah).

**Expected Counterexamples**:
- `session.user.role`/`session.user.workspaceId` `undefined` untuk pengguna yang sudah login.
- Penyebab: callback `jwt` yang mencetak hanya menulis `isAdmin`; instance pembaca mengharap
  `role`/`workspaceId`.

### Fix Checking

**Goal**: Untuk semua input yang memenuhi bug condition, fungsi yang diperbaiki menghasilkan perilaku
yang diharapkan.

**Pseudocode:**
```
FOR ALL principal WHERE user sudah terautentikasi DO
  token   := applyJwtClaims({}, principal)         // principal = { id, role, workspaceId, isAdmin }
  session := projectSession(baseSession, token)
  ASSERT session.user.role       == principal.role
  ASSERT session.user.workspaceId == principal.workspaceId
  ASSERT session.user.isAdmin     == principal.isAdmin
  ASSERT requireCurrentUser-narrowing(session) == { id, role, workspaceId }  // tidak 401
END FOR
```

### Preservation Checking

**Goal**: Untuk semua input yang TIDAK memenuhi bug condition, fungsi yang diperbaiki menghasilkan
hasil yang sama dengan sebelum perbaikan.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT behavior_original(input) == behavior_fixed(input)
END FOR
```

**Testing Approach**: Property-based cocok untuk preservation karena ia membangkitkan banyak kasus
otomatis lintas domain input dan menangkap edge case. Repo belum punya `fast-check`; untuk menghindari
menambah dependency, gunakan loop generatif ringan di dalam `bun:test` (iterasi `ROLES` ×
`{true,false}` isAdmin × beberapa `workspaceId`/`id` contoh). Amati perilaku kode belum-diperbaiki
lebih dulu untuk jalur non-bug, lalu kunci dengan test.

**Test Cases**:
1. **Tanpa sesi → 401/redirect**: `projectSession` atas token tanpa `role`/`workspaceId` tetap
   menghasilkan sesi yang ditolak narrowing `requireCurrentUser` (401 terjaga, Req 3.2/3.3); guard
   halaman/middleware tetap redirect `/login` (Req 3.1).
2. **Kredensial salah**: `authenticateCredential` mengembalikan `null` untuk email tak dikenal,
   user nonaktif, atau password salah → `signIn` menolak → pesan kredensial salah (Req 3.4).
3. **Peran 403**: `can(role, capability)` tidak berubah untuk seluruh `ROLES` × `Capability`
   (mis. `CUSTOMER_SERVICE`/`DOCUMENT_ASSISTANT` hanya `event:read`) → `authorize` tetap 403
   (Req 3.5).
4. **`isAdmin` untuk `/settings`**: round-trip principal `isAdmin: true/false` lewat
   `applyJwtClaims`→`projectSession` menghasilkan `session.user.isAdmin` yang sama; pembaca legacy
   (`/settings`, CEISA) tetap menggerbang benar (Req 3.6).

### Unit Tests

- `applyJwtClaims`: menyalin `role`, `workspaceId`, `isAdmin` saat `user` ada; tidak mengubah token
  saat `user` tidak ada (permintaan non-sign-in).
- `projectSession`: memproyeksikan `id` (dari `token.sub`), `role`, `workspaceId`, `isAdmin`; field
  hilang → `role`/`workspaceId` `undefined`, `isAdmin` `false`.
- Narrowing `requireCurrentUser`: sesi lengkap → `{ id, role, workspaceId }`; sesi tanpa salah satu
  field → melempar `ApiError(401, 'Autentikasi diperlukan.')`.
- `can(role, capability)`: tabel kapabilitas utuh (regression guard).

### Property-Based Tests

- Bangkitkan principal acak `{ id, role ∈ ROLES, workspaceId, isAdmin }` → `applyJwtClaims` lalu
  `projectSession` me-round-trip seluruh klaim tanpa kehilangan (fix checking).
- Bangkitkan token acak yang SENGAJA kehilangan `role` atau `workspaceId` → narrowing selalu menolak
  (401 terjaga, preservation).
- Bangkitkan `role` × `Capability` acak → `can` konsisten dengan `ROLE_CAPABILITIES` (preservation).

### Integration Tests

- Alur login→`/events`: sign-in via slice baru → buka `/events` → dashboard ter-render tanpa 401
  (manual/E2E; tidak ada harness route di repo saat ini).
- `/api/events` POST oleh pengguna login: lolos 401, lanjut ke 201 (peran berhak) atau 403 (tak
  berhak).
- Sign-out → akses halaman terproteksi → redirect `/login` (Req 3.1).
- Regresi admin: admin buka `/settings` tetap diizinkan; non-admin diarahkan ke `/` (Req 3.6).
