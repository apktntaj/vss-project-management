# Status CIPL diturunkan dari berkas & data (tahap 1)

## Context

Di `/jobs/:id`, label "Menunggu CIPL" dan langkah stepper "CIPL · Belum ada" membaca
`operational.cipl.status`, yaitu field manual (default `MISSING`). Field ini hanya berubah lewat form
"Ubah" (`CiplForm`). Scan CIPL, unggah commercial invoice, dan ekstraksi tidak pernah menyentuhnya,
sehingga tampilan bertentangan dengan data.

Keputusan user (2026-11-06):
- CIPL biasanya satu berkas gabungan, tapi bisa datang sebagai CI dan PL terpisah.
- Status "Diminta" dan konsep verifikasi dihapus.
- Revisi menimpa data lama.

Hasil yang dituju: status CIPL dihitung otomatis dengan tiga nilai saja, yaitu **Menunggu CIPL**,
**Sebagian (PL belum ada / CI belum ada)**, dan **Diterima**. Tidak ada lagi field status manual.

Penyatuan data barang (`operational.invoice`/`invoiceItems` → CIPL kanonik) **tidak** termasuk tahap
ini; lihat bagian "Tahap 2" di akhir. Alasannya: export workbook BC butuh field yang belum dimiliki
`CiplDocument` (negara asal, berat per item, freight/insurance, alamat/NPWP pihak).

## Model

Sebuah peran CIPL dianggap **tercakup** bila ada berkasnya **atau** datanya:

| Peran | Berkas lampiran job (`attachments.kind`) | Data di job |
|---|---|---|
| Commercial invoice | `CIPL` atau `COMMERCIAL_INVOICE` | `ciplDocument` ≠ null atau `operational.invoice` ≠ null |
| Packing list | `CIPL` atau `PACKING_LIST` (kind baru) | `ciplLines.length > 0` |

Status: tidak ada yang tercakup → `MISSING`; hanya satu → `PARTIAL` (dengan peran yang kurang);
keduanya → `RECEIVED`. Tanggal diterima = `created_at` lampiran CIPL/CI/PL terbaru (null bila hanya
data). Menghapus lampiran ikut menurunkan status, karena status dihitung saat dibaca.

## Perubahan

### Domain
- `domain/job/types.ts`:
  - Hapus `JobCiplInfo` dan `operational.cipl`.
  - Tambah `PACKING_LIST` ke `jobDocumentKinds` beserta labelnya.
  - Tambah field baca-saja `ciplSources: { kind: 'CIPL' | 'COMMERCIAL_INVOICE' | 'PACKING_LIST'; receivedAt: string }[]` pada `Job`.
- File baru `domain/job/cipl-status.ts`: fungsi murni `deriveCiplStatus(job)` → `{ status: 'MISSING' | 'PARTIAL' | 'RECEIVED', hasInvoice, hasPackingList, receivedAt }`, ditambah label Indonesia. Testnya `domain/job/cipl-status.test.ts`, **didaftarkan ke script `domain:test`**.
- `domain/job/operational.ts` (default & normalize) dan `domain/job/validation.ts:151`: buang `cipl`.

### Repository / API
- `features/jobs/repository/job-queries.ts` (`listJobs`, `listJobSummaries` bila dipakai tabel) dan pemuat job tunggal:
  - Setelah memuat job, jalankan satu query tambahan: `attachments` dengan `owner_type='JOB'`, `kind in ('CIPL','COMMERCIAL_INVOICE','PACKING_LIST')`, dan `owner_id in (ids)`.
  - Hasilnya dipetakan ke `ciplSources`. Query ini diperlukan karena `owner_id` berupa teks tanpa FK, jadi tidak bisa di-embed.
- `lib/server/extraction/job-classify.ts:11` `toLegacyDocumentKind`: `CIPL_COMBINED → CIPL`, `PACKING_LIST → PACKING_LIST`. Sebelumnya masing-masing dipetakan ke COMMERCIAL_INVOICE dan OTHER.
- `app/api/ceisa/bc-23/draft/route.ts:29`: terima kind `CIPL` selain `COMMERCIAL_INVOICE`.
- Migrasi baru `supabase/migrations/20261106000000_drop_operational_cipl.sql`, berisi `update public.jobs set operational = operational - 'cipl';`. Pakai header "Mengapa:" dan `begin/commit` seperti migrasi lain.

### UI
- `components/job-upload-dialog.tsx:154-156`:
  - Simpan kind sesuai mapping baru.
  - **Hanya teruskan `invoice` bila jenisnya `COMMERCIAL_INVOICE` atau `CIPL_COMBINED`.** Ini memperbaiki bug: packing list saat ini menimpa `operational.invoice`.
- `components/job-detail-cards.tsx`:
  - Hapus `CiplForm`, `ciplStatusLabels`, dan tombol "Ubah" di kartu CIPL.
  - `JobCiplStatusCard` menampilkan status turunan, misalnya "Sebagian · Packing list belum ada"; daftar berkas sumber (CI / PL / gabungan) beserta tanggalnya; No. invoice dari `job.commercialInvoiceNumber` / `ciplDocument.nomor`; dan tombol "Tambah / scan CIPL".
  - Field manual "No. Invoice" yang tadinya ada di `CiplForm` tidak dipindah. Nomor tetap bisa diubah lewat header job (`HeaderForm`, No. commercial invoice).
- `lib/job-readiness.ts`: langkah CIPL memakai `deriveCiplStatus`: `MISSING → todo`, `PARTIAL → doing`, `RECEIVED → done`. Perbarui `lib/job-readiness.test.ts`.
- `components/job-table.tsx:32-37, 130, 188`: badge CIPL memakai `deriveCiplStatus`, tanpa `referenceNumber`.
- `domain/job/operational.test.ts`: buang ekspektasi `cipl`.

### Yang dipakai ulang
- `getOperationalDetails`/`normalizeOperationalDetails` untuk membaca `operational.invoice`.
- `jobDocumentKinds` dan label lampiran (`components/job-attachments-card.tsx:90`), sehingga PL langsung tampil berlabel.

## Catatan data lama
Lampiran yang sudah ada tidak bisa dipetakan ulang dengan andal: dulu CIPL gabungan disimpan sebagai
`COMMERCIAL_INVOICE` dan PL sebagai `OTHER`. Job seperti itu akan tampil "Sebagian (PL belum ada)"
kecuali `ciplLines` sudah terisi. Solusinya cukup scan atau unggah ulang. Tidak ada backfill.

## Verifikasi
1. `npx tsc --noEmit` bersih; `npm run domain:test` (termasuk `cipl-status.test.ts`) lulus; `npm run build`.
2. Terapkan migrasi ke Supabase lokal/dev.
3. Di app (`localhost:3001`):
   - Job tanpa berkas → "Menunggu CIPL" dan stepper todo.
   - Unggah commercial invoice saja lewat dialog unggah → "Sebagian · Packing list belum ada"; stepper doing; lampiran berlabel CI.
   - Unggah packing list → "Diterima", dan `operational.invoice` tidak tertimpa (Details Barang tetap sama).
   - Job lain: scan CIPL gabungan lewat "Tambah / scan CIPL" → "Diterima"; Blok Manifest terisi; badge di daftar Jobs ikut berubah.
   - Hapus lampiran → status turun lagi.

## Tahap 2 (rencana terpisah, belum dikerjakan)
Satukan data barang ke CIPL kanonik:
- Perluas `CiplDocument`/`BarisBarang` dengan field yang dibutuhkan export workbook.
- Modal scan CIPL menerima satu berkas gabungan atau dua berkas (CI + PL), lalu digabung lewat `lib/server/extraction/cipl-merge.ts`, yang sekarang belum dipakai di mana pun.
- Timpa per peran.
- Alihkan Details Barang, export workbook, dan perbandingan B/L ke CIPL, lalu hapus `operational.invoice`/`invoiceItems`/`invoiceNumber`.
