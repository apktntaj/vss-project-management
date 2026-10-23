# Audit Fitur Auth — 2026-10-22

Hasil pemeriksaan menyeluruh fitur auth pada branch `auth` (commit `253fe94`): konfigurasi
NextAuth, middleware, semua 33 route handler, lapisan data, dan UI login. Metode: tiga jalur
eksplorasi paralel (config inti, konsumsi auth lintas app, lapisan data) + verifikasi manual
atas setiap temuan kunci. Dokumen ini dimaksudkan cukup untuk mengeksekusi perbaikan tanpa
audit ulang.

## Status sehat (tidak perlu diubah)

- Password di-hash **scrypt** self-describing (`scrypt$N$r$p$salt$hash`, `lib/auth/password.ts`)
  dan diverifikasi dengan `timingSafeEqual`. Bukan plaintext, bukan bcrypt.
- Bucket `attachments` privat; download di-proxy lewat `GET /api/attachments` yang ter-guard,
  `Cache-Control: private, no-store`. Tidak ada signed/public URL.
- `middleware.ts` adalah gerbang AuthN sesungguhnya (decode JWT, bukan sekadar keberadaan
  cookie): `/api/*` tanpa sesi → 401 JSON, halaman → redirect `/login`.
- 33/33 route handler ter-autentikasi; tidak ada endpoint yang benar-benar terbuka.
- `password_hash` tidak pernah keluar dari server (kolom eksplisit di semua query).

## Temuan (urut prioritas)

### P1 — User buatan Settings tidak bisa login (bug nyata)

`POST /api/settings` (resource `users`, `app/api/settings/route.ts:70-72`) menyisipkan
`app_users` **tanpa** baris `workspace_members`. Query login memakai inner join
`workspace_members!inner` (`features/auth/repository.ts:43`) yang disaring ke workspace
`slug='default'` — user tanpa baris membership menghasilkan nol baris → `CredentialsSignin`
→ "Email atau password tidak cocok". Efek lanjutan: PIC picker (`listWorkspaceMembers`,
`repository.ts:71-86`) hanya menampilkan admin@vss.local.

Satu-satunya path pembuatan user yang benar adalah `scripts/create-supabase-user.ts:54`
(yang meng-upsert membership).

**Perbaikan:** (a) sisipkan `workspace_members {workspace_id, user_id, role: 'MEMBER'}` di
`POST /api/settings` setelah insert user; (b) migrasi SQL backfill untuk user lama yang yatim
(`insert … select … on conflict do nothing` terhadap workspace `default`).

### P2 — Cutover ke features/auth belum tuntas (dua instance NextAuth)

Instance baru: `features/auth/nextauth.ts` (klaim `role`/`workspaceId`/`isAdmin`, secret =
`AUTH_SECRET` saja). Instance legacy: `auth.ts` root — konfigurasi duplikat penuh, callback
hanya menyalin `isAdmin`, secret fallback `AUTH_SECRET ?? NEXTAUTH_SECRET`, dan punya path
demo sendiri. Token antar-instance saling terbaca (cookie & secret sama), tapi sesi yang
dibaca instance legacy kehilangan proyeksi `role`/`workspaceId` — bug condition ini
terdokumentasi di `features/auth/auth.config.test.ts` ("Bug Condition Exploration").

**14 file masih di legacy `@/auth`:**

| File | Alasan pemakaian |
|---|---|
| `app/(dashboard)/layout.tsx:2` | cek sesi dashboard |
| `app/(dashboard)/settings/page.tsx:2` | gate `isAdmin` |
| `app/api/settings/route.ts:4` | `requireAdmin()` |
| `app/api/attachments/route.ts:3` | authn POST/GET |
| `app/api/operational-records/route.ts:3` | authn |
| `app/api/event-records/route.ts:3` | authn + lookup user by email |
| `app/api/lartas/route.ts:3` | authn |
| `app/api/parse-manifest/route.ts:2` | authn |
| `app/api/parse-shipment/route.ts:2` | authn |
| `app/api/classify-job-document/route.ts:2` | authn |
| `app/api/export-customs-workbook/route.ts:5` | authn |
| `app/api/ceisa/bc-23/draft/route.ts:2` | authn |
| `lib/supabase/event-api.ts:5` | `getEventApiContext()` |
| `lib/server/ceisa/http.ts:4` | `requireCeisaUser(admin)` |

**Perbaikan:** repoint semua ke `@/features/auth` (semua konsumen hanya membaca `.user` /
`isAdmin` — kompatibel dengan proyeksi baru), lalu hapus `auth.ts` legacy beserta
`authenticateDatabaseUser` (`lib/supabase/users.ts`) yang jadi mati.

### P3 — `/api/operational-records` adalah penulis tabel generik yang mem-bypass guard

`PUT`/`DELETE` dengan parameter `table` menulis/menghapus 16 tabel apa pun hanya dengan
autentikasi biasa (`app/api/operational-records/route.ts:32-55` →
`lib/supabase/operational-records.ts:86-107`) — termasuk `events`, `jobs`, `shipments`,
`customs_jobs` — **melewati** guard PIC-or-SUPERVISOR slice events dan proteksi derived-data.

Endpoint ini masih tulang punggung `lib/data-client.ts` (helper `records()`, baris 337) untuk
jobs/CIPL/shipments/customs-jobs/agents/job-documents/counters, jadi tidak bisa dihapus
sekadar. **Namun empat tabel sudah nol pemanggil** lewat jalur ini (terverifikasi):
`events`, `venues`, `event_organizers`, `operational_users` (semuanya sudah pindah ke
`/api/events` dan `/api/references/*`; direktori user cukup dari `/api/settings` yang
admin-gated).

**Perbaikan bertahap:** keluarkan keempat tabel itu dari `operationalTables` (menutup bypass
PIC-guard events + kebocoran direktori user via endpoint ini) tanpa menyentuh store yang
masih hidup. Migrasi penuh sisa store ke endpoint khusus mengikuti irama rebuild slice.

### P4 — `GET /api/jobs` membocorkan direktori user

Respons menyertakan seluruh `app_users` (email, `access_level`, `is_active`, timestamp) ke
setiap user terautentikasi (`app/api/jobs/route.ts`, query di blok `Promise.all`, proyeksi di
mapping `users`). Konsumennya (`listJobsWithEvents`, `lib/data-client.ts:600-630`) hanya
memakai `id` dan `name` untuk lookup `assignedTo`/`createdBy`.

**Perbaikan:** proyeksikan users menjadi `{id, name}` saja; sesuaikan tipe `JobsApiPayload`;
verifikasi tidak ada UI yang membaca field lain dari `assignedTo`.

### P5 — Hapus job tanpa guard

`DELETE /api/jobs/[jobId]` (`app/api/jobs/[jobId]/route.ts:12-57`) dapat dipanggil user biasa
apa pun, dengan cascade (`job_stages`, `job_documents`, `shipments`, `customs_jobs`). Kontras:
hapus event digerbang capability `event:delete` + objectGuard PIC-or-SUPERVISOR
(`features/events/use-cases/delete-event.ts`). Job punya `assignedToId`, jadi guard ala event
mungkin.

**Keputusan (2026-10-22):** guard = `assignedToId === currentUser.id` **atau** role
`SUPERVISOR`; bila `assignedToId` null → hanya SUPERVISOR. Server-side 403 dengan pesan
Indonesia; tombol UI boleh tetap tampil (pola toast 403 yang sudah dipakai).

### P6 — Demo mode jongkok di dua path

- Halaman login mengiklankan + prefill kredensial demo saat `!isSupabaseConfigured() &&
  NODE_ENV !== 'production'` (`app/(auth)/login/page.tsx:13,29-49`), tetapi path authorize
  aktif (instance baru) **tidak punya fallback demo** — `withWorkspace()` melempar error
  "Supabase wajib dikonfigurasi" yang bukan `AuthError`, sehingga `loginAction` melemparnya
  ke error boundary. Dev tanpa Supabase: login rusak meski UI menjanjikan demo.
- Sebaliknya `/api/settings` punya fallback demo **tanpa** guard `NODE_ENV`
  (`app/api/settings/route.ts:31,65-69,108-112`).
- Kredensial demo plaintext di `lib/demo-users.ts:5-24`, dibandingkan `===` (baris 37) —
  dapat diterima selama memang dev-only.

**Keputusan (2026-10-22):** sinkronkan ke path baru — `authenticateCredential` fallback ke
demo store hanya saat `!isSupabaseConfigured() && NODE_ENV !== 'production'` (petakan admin
demo → role SUPERVISOR, `workspaceId` dummy), dan beri guard `NODE_ENV` pada fallback demo
`/api/settings`.

### P7 — Minor / polesan

1. **Klaim JWT beku** — `role`/`isAdmin` disalin saat sign-in saja
   (`auth.config.ts:81-88`), tidak pernah di-refresh; `maxAge` tidak diset eksplisit
   (default 30 hari). Perubahan peran baru berlaku setelah login ulang. Set `maxAge`
   eksplisit + dokumentasikan "ganti peran = login ulang".
2. **Server action mati** — `features/auth/use-cases/sign-in.ts` dan `sign-out.ts` tidak
   dipakai siapa pun dan pesan errornya berbeda dari `loginAction` hidup. Hapus.
3. **Matcher middleware longgar** — `login` tanpa batasan (`middleware.ts:39`) ikut
   mengecualikan path semacam `/login-backup`. Perketat menjadi `login(/|$)`.
4. **User enumeration via timing** — `findUserByEmail` null untuk email tak dikenal tanpa
   scrypt (`repository.ts:98-104`). Internal tool: catat saja, tidak wajib dummy-verify.
5. **Dedup `ROLES` lokal di test** — `auth.config.test.ts:265` mendefinisikan `const ROLES`
   lokal padahal import dari `domain/auth/types` sudah ada (baris 354). Alternatif lebih
   kuat: turunkan dari `Object.keys(ROLE_CAPABILITIES)` (`capabilities.ts:36` bertipe
   `Record<Role, …>` = ekshaustif oleh compiler) sehingga konstanta `ROLES` bisa dihapus.
6. **IDOR attachments (catat, risiko diterima)** — upload boleh `ownerId` arbitrer, download
   by bare id tanpa cek akses per objek (`app/api/attachments/route.ts:14-23`). Bucket privat
   + proxy memitigasi pihak luar, bukan antar-user internal.
7. **RLS tanpa policy + service_role di mana-mana (by design)** — satu kunci
   `SUPABASE_SERVICE_ROLE_KEY` bocor = seluruh tenan terbuka; otorisasi sepenuhnya lapisan
   aplikasi. Dokumentasikan sebagai asumsi.
8. **Produk (di luar audit teknis)** — tidak ada ganti password mandiri / reset flow;
   `POST /api/settings` hard-code `role: 'STAFF'`; policy password tidak seragam (min 12 di
   script `create-supabase-user.ts:26`, min 1 di domain `domain/user/validation.ts`).

## Keputusan tercatat (2026-10-22)

1. **Cakupan:** laporan audit dulu, tanpa perubahan kode. Perbaikan menyusul per item.
2. **Demo mode:** sinkronkan ke path baru (bukan dihapus total).
3. **Guard hapus job:** `assignedTo` atau SUPERVISOR (lihat P5).

## Urutan implementasi yang disarankan

1. P1 workspace_members (bug login nyata + PIC picker).
2. P2 tuntaskan cutover legacy → `@/features/auth`, hapus `auth.ts`.
3. P6 sinkronkan demo fallback + guard `NODE_ENV`.
4. P3 keluarkan 4 tabel mati dari `operational-records`.
5. P4 proyeksi `{id, name}` di `GET /api/jobs`.
6. P5 guard hapus job.
7. P7 polesan (maxAge, dead code, matcher, dedup ROLES).

Validasi per langkah: `npx tsc --noEmit` + `npm run domain:test` (tambah file test baru ke
script), plus uji manual: buat user via Settings → login sebagai user itu → PIC picker
menampilkan dia; curl endpoint tanpa cookie → 401; user biasa hapus job → 403.
