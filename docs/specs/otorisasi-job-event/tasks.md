# Otorisasi job per event — Tasks

Item jadwal: B6. Desain: `design.md` (semua bagian disetujui 20 Nov). Implementer: Bebe.

Aturan untuk setiap tugas:
- Baca **hanya** bagian `design.md` yang disebut (nomor baris per 20 Nov; cari judulnya bila bergeser)
  ditambah file kode yang disentuh. Jangan menambah, membuang, atau mengubah signature, data
  definition, atau contoh. Bila desain bolong, berhenti dan laporkan.
- Setiap `check-expect` menjadi satu assertion di `*.test.ts` terdekat. File tes baru ditambahkan ke
  script `domain:test` di `package.json`.
- Akhiri setiap tugas dengan `npx tsc --noEmit` dan `npm run domain:test`; laporkan hasilnya apa adanya.
  Tugas boleh selesai dengan galat tsc di file yang memang dijadwalkan tugas berikutnya; sebutkan.
- Tanpa dependency baru, tanpa commit, tanpa menerapkan migrasi.

## T1. Migrasi + tipe peran
Desain: `## Data` (baris 12–90), `## Storage` (cari judul), `#### Tabel peran` (277–311),
`#### Fungsi murni pengguna` (595–644).
- [x] Migrasi `role_spesialis_dan_pemilik_job_turunan` (skill `new-migration`; jangan diterapkan).
- [x] `domain/auth/types.ts`: `Role` = CS | SPESIALIS | FINANCE, `ROLE_LABELS`.
- [x] `domain/job/types.ts`: `jobJenisValues`, `JobJenis`.
- [x] `domain/user/types.ts` + `domain/user/validation.ts` (+ tes): `handledJobJenis`,
      `normalize-handled-jenis`, `handled-jenis-error`, `userCreateSchema`, `userUpdateSchema`. Modul tetap murni.
- [x] `features/auth/capabilities.ts`: tabel peran baru; tulis ulang tes `can` di `auth.config.test.ts`
      (fixture STAFF → SPESIALIS).
- [x] Perbaiki pemakai lama STAFF/OPERATIONS/DOCUMENT_ASSISTANT yang membuat tsc gagal (cari dengan grep).

## T2. `write-scope.ts` + tes
Desain: `### Data yang dibutuhkan`, `### Fungsi puncak`, `### Wishlist` (backend),
`#### Fungsi murni lain`, `#### Calon penerima akses` (bagian murni) — baris 125–594.
- [x] `features/auth/write-scope.ts` (tanpa `server-only`; impor hanya `./capabilities` dan tipe domain).
- [x] `features/auth/write-scope.test.ts`, masuk `domain:test`.

## T3. Guard event + akses event + agent
Desain: `#### Event: guard pengelola`, `#### Daftarkan agent ke event`, bagian lapisan tepi
`#### Calon penerima akses` (`find-active-member`, `list-event-access`, `grant-event-access`).
- [x] `event-guards.ts`: pengelola = admin atau PIC.
- [x] `createEvent`, `createVenue`, `createEventOrganizer`: admin saja lewat tabel peran.
- [x] `manage-event-access.ts` + repository: calon disaring CS/Spesialis, `grant-target-error`.
- [x] `POST /api/events/[id]/agents`: PIC/admin.

## T4. Guard tulis job + pemilik turunan + lampiran
Desain: `#### Job: guard tulis`, `#### Pemilik job turunan`, `#### Route lampiran`,
`### Jalur tulis dan guard-nya` (tabel Job), `### Catatan implementasi`.
- [x] `job-guards.ts`: `load-event-relation`, `load-handled-jenis`, `authorize-job-create-in-event`,
      `authorize-loaded-job-write`, `authorize-job-write`, `authorize-job-attachment-write`.
- [x] `createJob` memakai guard buat; `PUT /api/jobs/[id]/inward` memakai `authorizeJobWrite`.
- [x] `stage-jobs.ts`: `created_by_id` = pemilik job masuk; `ensureStageJobs(inbound)`.
- [x] `POST /api/attachments`: `authorizeJobAttachmentWrite`.

## T5. Exhibitor lewat job
Desain: `#### Exhibitor (BERUBAH)` (801–904).
- [x] Repository `exhibitor-linked-to-job?` (`features/jobs/repository/job-crud.ts`).
- [x] `createExhibitors`, `updateExhibitor` dengan `viaJobId`; route membaca query `viaJobId`.

## T6. Akses tulis saya + kontrak data-client
Desain: `#### Akses tulis saya` (905–939), `#### Kontrak lib/data-client` (980–1051).
- [x] Repository + use-case `getMyWriteAccess`, route `GET /api/account/write-access`.
- [x] `lib/data-client.ts`: `getMyWriteAccess`, `viaJobId` di exhibitor, urutan baru
      `applyCiplAutofill` + `unfilledExhibitors`, re-export write-scope, JSDoc akses event.

## T7. Settings → Pengguna (backend)
Desain: `#### Settings → Pengguna` (940–979).
- [x] `app/api/settings/route.ts`: `handledJobJenis`, `settingsValidationBody`.
- [x] `lib/demo-users.ts`, `scripts/create-supabase-user.ts`, `SettingsValidationError` di data-client.

## T8. Fungsi murni UI + hook + GuardedButton
Desain UI: `### Contoh pengguna dan data UI`, `### Fungsi murni UI`, `### Hook useWriteAccess`,
`### Umpan balik penolakan` (baris 1212–1588); `unfilled-exhibitors-message`, `job-jenis-list-label`.
- [x] `lib/write-access.ts` + `lib/write-access.test.ts` (masuk `domain:test`).
- [x] `lib/job-jenis.ts` `job-jenis-list-label` + tes; `domain/exhibition/cipl-autofill.ts`
      `unfilled-exhibitors-message` + tes.
- [x] `lib/use-write-access.ts`, `components/guarded-button.tsx`, `ActionMenu` `deniedReason`.

## T9. UI daftar dan detail event
Desain UI: `EventsPage`, `EventList`, `EventCardActions`, `EventDetailPage`, sub-komponen `JobRow`,
`EventAccessCard`.
- [x] Gerbang Event baru, menu kelola event, kartu Akses event (dipasang), New Job dan aksi baris
      job dengan `GuardedButton`/`deniedReason`.

## T10. UI daftar job + wizard
Desain UI: `JobsPage`, sub-komponen `JobCreateWizard`.
- [x] Wizard: event dulu, lalu jenis dari `creatable-jenis`; Job baru dengan alasan bila tidak boleh.

## T11. UI detail job
Desain UI: `JobDetail`, sub-komponen `JobNotesPanel`, `JobStageCard`, `JobCustomsCard`,
`JobPartyInvoiceCard`, `JobBillingDialog`.
- [x] Semua tombol tulis job lewat `GuardedButton`; tagihan tetap `useCanEditBilling`.

## T12. UI Settings + alur CIPL
Desain UI: `SettingsManager`, `#### Alur simpan CIPL dan exhibitor`.
- [x] Peran CS/Spesialis/Finance, jenis job wajib bila Spesialis, galat inline.
- [x] `CiplEntryModal` toast `unfilled-exhibitors-message`; `CiplLineModal` urutan simpan baru.

## T13. Verifikasi dan penutup (manajer)
- [x] `npx tsc --noEmit`, `npm run domain:test`, `npm run build`, skill `verify`.
- [x] Gabungkan definisi data B6 ke `docs/domain/*-data-definitions.md`.
- [x] Perbarui B6 di `docs-v2/scope-v1.md` (Status item + Log progres).
