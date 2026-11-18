# Backlog UI halaman detail job

Sumber: audit UI/UX `app/(dashboard)/jobs/[id]/page.tsx` beserta komponennya (2026-11-18), lalu
implementasi tahap pertama. Dokumen ini mencatat (a) yang sudah dikerjakan, (b) temuan audit yang
belum dikerjakan, dan (c) kontrak UI yang menunggu backend atau keputusan bisnis. Konvensi repo
tetap di `AGENTS.md`; dokumen ini hanya backlog.

Catatan verifikasi: `npx tsc --noEmit` bersih, `npm run domain:test` 84 lulus (46 berkas),
`npm run guard:arch` lolos, `npm run build` sukses, `next lint` hanya memunculkan satu peringatan lama
(`react-hooks/exhaustive-deps` pada efek rangkaian job di page.tsx). Tampilan belum diperiksa di
browser, jadi poin yang diberi tanda "perlu verifikasi visual" harus dilihat langsung.

## (a) Yang sudah dikerjakan

| # | Item | Ringkasan | File |
|---|------|-----------|------|
| 1 | Warna badge | Badge Disposisi "Disposed" dan "Re-export" serta stat "Disposed package" menjadi slate. "Belum terisi" (Hall/Booth) menjadi amber. Merah hanya untuk data bermasalah. | `components/job-packages-table.tsx`, `components/job-manifest-section.tsx` |
| 2 | HS tidak valid | Badge "HS tidak valid" (rose) dan "Tanpa HS" (amber) pada baris. Peringatan dipindah ke atas tabel. Ringkasan menjadi tombol filter (`aria-pressed`) "N barang HS tidak valid" dan "N barang tanpa HS" yang hanya menampilkan baris bermasalah dan membuka grupnya. Ditambah "Buka semua" dan "Tutup semua". Nama exhibitor tidak diulang bila hanya satu peserta. Teks seragam "8/10 digit". | `components/job-barang-card.tsx` |
| 3 | Kontras | `text-slate-400` pada teks bermakna menjadi slate-500/600. Label 11px menjadi `text-xs`. | `job-documents-card`, `job-manifest-section`, `job-transport-document-card`, `job-exhibitor-summary`, `cipl-exhibitor-form`, `job-barang-card`, `job-notes-card` |
| 4 | Bar tab sticky | `flex-wrap`, daftar tab `max-w-full overflow-x-auto`, padding tab `px-3 sm:px-4`, tombol aksi `shrink-0`. Dihitung muat di 375px dengan 4 tab (perlu verifikasi visual). | `app/(dashboard)/jobs/[id]/page.tsx` |
| 5 | Tab Pabean | Tab baru "Pabean": `JobCustomsCard` (BC/Carnet/jaminan, dengan fieldset Pendaftaran, Identitas Carnet, Jaminan dan field Gudang/TPS `warehouseName`), daftar lampiran BC, dan kartu "Data pabean lanjutan" (nonaktif, "Belum tersedia — menunggu backend"). Transport tinggal B/L/AWB, dan untuk job turunan menampilkan petunjuk "mengikuti job masuk" beserta tautan. Job bertahap membuka tab Pabean sebagai default. Langkah readiness "Dokumen pabean" mengarah ke `pabean`; job tanpa tab Pabean (Local/Road) dialihkan ke Transport. | `page.tsx`, `components/job-customs-card.tsx`, `components/job-customs-pending-card.tsx` (baru), `components/job-documents-card.tsx` (prop `title`), `lib/job-readiness.ts` + `lib/job-readiness.test.ts` |
| 6 | Banner tenggat | Banner di bawah header: tenggat re-ekspor (Temporary Import, `guarantee.reExportDeadline`) dan masa berlaku carnet (ATA, `carnet.validUntil`). Job re-ekspor membaca dari job masuk. Hitung mundur, empat tingkat (Terjadwal/Mendekati tenggat/Mendesak/Lewat tenggat) dengan ikon dan teks selain warna. Ambang di konstanta `DEADLINE_WARNING_DAYS = 14` dan `DEADLINE_CRITICAL_DAYS = 7`. | `lib/job-deadlines.ts` + `lib/job-deadlines.test.ts` (baru, sudah masuk script `domain:test`), `components/job-deadline-banner.tsx` (baru) |
| 7 | Catatan satu kartu | Special instructions dan Catatan digabung menjadi `JobNotesPanel`. Special instructions terisi tampil menonjol (amber, ikon, teks tebal). Kosong hanya dua ajakan "Tambah …". Baris atas menjadi 2 kolom (Progress | Catatan) dengan `items-start`. Ikon pensil 32px, "Selengkapnya/Ringkas", penghitung karakter. | `components/job-notes-card.tsx`, `page.tsx` |
| 8 | Coba lagi | State error halaman memakai pola event: kartu dengan ikon, judul, pesan, tombol "Coba lagi" dan "Kembali ke Jobs". "Tidak ditemukan" dipisah. Pemuatan diberi nomor urut agar hasil usang diabaikan. | `page.tsx` |
| 9 | Antrean toast | `ToastViewport`: tumpukan di kanan bawah, maksimal 4, auto-dismiss per item (4 dtk sukses, 6,5 dtk error), pesan identik tidak digandakan, tombol tutup, z-index 110 (di atas dialog), `aria-live` pada wadah. Helper `notify()` bersama menggantikan helper lokal di page, cipl-entry-modal, job-customs-card, job-stage-card, job-notes-card, job-documents-card, job-detail-cards, job-party-invoice-card, cancel-job-dialog. | `components/toast-viewport.tsx` (baru), `components/layout.tsx`, `lib/notify.ts` (baru) |
| 10 | Migrasi dialog | `JobHeaderDialog`, `JobBillingDialog`, `CancelJobDialog` memakai `components/ui/dialog` (base-ui): fokus terjebak, Esc, pengembalian fokus. Form pembatalan dipasang hanya saat terbuka (alasan selalu mulai kosong), penutupan diblokir saat menyimpan. | `components/job-detail-cards.tsx`, `components/job-party-invoice-card.tsx`, `components/cancel-job-dialog.tsx` |
| 11 | Validasi inline | `validateCiplRows` (murni, ada tes): nama exhibitor wajib pada baris terisi, baris kosong di antara baris lain ditandai, deskripsi dan qty (> 0) wajib pada barang terisi, harga tidak negatif. Error tampil di bawah field dengan `aria-invalid` dan `aria-describedby`. Simpan diblokir, fokus ke field pertama yang salah, ringkasan `role="alert"` di modal dengan tombol "Ke isian pertama yang salah". Toast "baris dilewati" dihapus (diganti blokir). Form No Job: pesan di bawah field. Hapus exhibitor meminta konfirmasi inline (menyebut jumlah case/barang). Baris kosong dibuang tanpa konfirmasi. | `lib/cipl-form-validation.ts` + tes (baru, masuk `domain:test`), `components/cipl-entry-modal.tsx`, `components/cipl-exhibitor-form.tsx`, `lib/cipl-form-draft.ts` (hanya `export` pada `itemFilled`), `components/job-detail-cards.tsx` |

Perubahan kecil lain: ring fokus pada kontrol upload file CIPL (`has-[:focus-visible]`), tab aktif
tidak lagi berubah warna teks saat di-hover (`data-[active]:hover:*`, perlu verifikasi visual),
field customs memakai gaya `disabled`, tautan ke job masuk pada identitas carnet re-ekspor, pesan bila
job masuk gagal dimuat, label tombol Transport menjadi "Buat/Edit B/L-AWB" (teks petunjuk di kartu B/L
disamakan), tombol aksi tab disembunyikan di tab Pabean (form inline).

## (b) Temuan audit yang BELUM dikerjakan

Prioritas: T = Tinggi, S = Sedang, R = Rendah.

| ID | Temuan | Prio | Catatan |
|----|--------|------|---------|
| T1 | Status job (mis. "Selesai") bertabrakan dengan Progress Job 3/5 | T | Perlu keputusan domain (lihat bagian c). Minimal: beri nama berbeda, peringatan/konfirmasi saat memilih COMPLETED bila readiness belum penuh. |
| T4 | Dua jalur edit (inline vs dialog) di Billing. Tombol "Edit Billing" muncul walau tanpa `canEditBilling`. Pabean inline vs tombol aksi tab. | S | Pilih satu pola. |
| T5 | Packages dan Detail Barang masih dua tabel berisi data case yang sama. Belum ada pencarian teks (uraian/HS). Header tabel belum sticky. Packages satu exhibitor belum auto-collapse. | T/S | Sebagian teratasi (filter HS, buka/tutup semua). Sisa: gabung jadi tabel bertingkat, search, paginasi/virtualisasi. |
| T7 | Mata uang tidak tampil (Total amount, Harga, Nilai) | S | `CiplDocumentHeader.mataUang` ada tetapi tidak diteruskan. Lihat bagian c. |
| T8 | Kolom "Empty Storage" dan "Re-export" di tampilan manifest selalu "—" | R | Sembunyikan sampai ada data. |
| T9 | Header tidak menampilkan nama event dan tautan ke event | S | Perlu nama event pada data job atau pemuatan terpisah. |
| K1 | Pola tombol/spacing berbeda dengan event page (`inline-flex h-9 …` vs `.btn-*`, `space-y-6` vs `space-y-4`). Tiga sistem tombol di card detail. | S | |
| K3 | Perbaikan hover tab aktif sudah diterapkan | R | Perlu verifikasi visual. |
| K4 | Info header tanpa card dan ikon seperti event page | R | |
| S1 | `EmptyTabState` tanpa CTA dan deskripsi. Pesan kosong ganda di tab CIPL ("Belum ada data" + "Belum ada dokumen"). | S | |
| S2 | `JobStageCard`: sebelum rangkaian termuat, "Belum ada" dan tombol "Buat job …" aktif sesaat (risiko klik ganda, layout shift). | S | Tambah state loading. |
| S3 | Gagal memuat exhibitor event ditelan diam-diam (`.catch(() => setExhibitors([]))`). | S | Toast/banner, nonaktifkan penautan. |
| S4 | Tab dimuat ulang saat berpindah (hasil Periksa LARTAS hilang). | R | `keepMounted` atau angkat state. |
| S5 | Tab dari URL dibaca setelah mount (kedip) | R | Sebagian teratasi karena default tab dihitung dari job. Pakai `useSearchParams` untuk tuntas. |
| M3 | Error tagihan server tampil inline dan toast sekaligus | R | |
| M4 | Simpan tanpa perubahan menutup dialog tanpa umpan balik | R | |
| M6 | Helper toast lokal masih ada di komponen lain: `cipl-line-modal`, `event-form-modal`, `event-access-card`, `job-manifest-editor-modal`, `job-create-wizard`, `ticket-*`, `settings-*`, `change-password-form`. | R | Ganti ke `notify()`. |
| R2 | Modal CIPL padat di mobile (lebar field tetap, input ~32px). Daftar exhibitor/case panjang tanpa lipat. | S | Grid responsif, lipat per exhibitor/case. |
| R3 | Tabel lebar di mobile tanpa kolom pertama sticky. Tombol "Buat job …" kecil. | R | |
| A3 | Switch "Click to change view" (Inggris, oranye, kontras rendah, label-in-name) | S | Ganti segmented control "Ringkas / Manifest". |
| A4 | Kontras: tab aktif putih di atas `orange-600` sekitar 3,6:1 (token `btn-primary` sama) | S | Rekomendasi token: `orange-700`. |
| A5 | Target sentuh: tombol hapus case/barang (~30px), tab/tombol header `h-9` | S | |
| A6 | Draf catatan dibuang saat Esc tanpa konfirmasi. Modal CIPL ditutup tanpa peringatan perubahan belum disimpan. | S | |
| A6b | Langkah Progress pada tab aktif tetap tombol. `detail` terpotong (`title` saja). | R | |
| A6c | Remark (radiogroup) tanpa roving tabindex | R | |
| A6e | `TotalField` (nilai otomatis) berupa input disabled dan placeholder "0" mirip kosong | S | Tampilkan sebagai teks read-only. |
| A7 | Tidak ada `document.title` per job | R | |
| B1 | Campuran Inggris/Indonesia ("Special instructions", "Packages", "Click to change view", "Upload your CIPL…") dan istilah disposisi tidak seragam (Disposal/Disposed/Non-disposal/Re-export) | R/S | Perlu glosarium dari bisnis. |
| L1 | Hasil cek LARTAS belum punya status loading/skeleton. `aria-live` dipasang bersamaan dengan isinya. | R | |
| Kode mati | `SHOW_MUATAN_EXTRAS` (+ ~40 baris tabel inline) di page, `SHOW_KEPULANGAN` dan `chip()` di manifest, `ExhibitorSummaryTable` tak terpakai, teks "Tautkan & edit" di manifest-section menunjuk tombol yang tidak ada | R | Hapus setelah user setuju. |
| Ukuran file | `job-document-editor-dialog.tsx` 1237 baris (InvoiceEditor + TransportEditor), `save()` di `cipl-entry-modal.tsx` (~150 baris logika), tabel manifest 15 kolom | S | Pecah per dokumen, ekstrak `save()` ke hook/modul `lib/`. |
| Lain-lain | Default "Ganti baris CIPL yang sudah ada" tercentang. Scan AI tidak bisa dibatalkan (tanpa AbortController). `JobDocumentsCard` tidak punya retry. Gudang/TPS belum tampil di ringkasan. | S/R | |

Temuan baru dari implementasi:

- `JobDeadlineBanner` tidak menyembunyikan tenggat re-ekspor bila job re-ekspornya sudah selesai
  (status dokumen RELEASED atau COMPLETED). Belum diputuskan apakah itu berarti "terpenuhi" (lihat bagian c).
- Tidak ada peringatan bila tenggat belum diisi (mis. jaminan TI tanpa `reExportDeadline`).
- Berkas `CLAUDE.md` muncul sebagai untracked di working tree. Bukan dibuat oleh pekerjaan ini.

## (c) Kontrak UI yang menunggu backend atau bisnis

UI sudah dibuat nonaktif di `components/job-customs-pending-card.tsx` (tidak menyimpan apa pun). Saat
kontrak ada: aktifkan field, sambungkan ke penyimpanan lewat `@/lib/data-client`, hapus banner
"Belum tersedia". Pemilik: backend/domain job kecuali disebut lain.

### Field baru (usulan bentuk)

| Data | Field dan tipe | Letak usulan | Catatan |
|------|----------------|--------------|---------|
| BC 1.1 | `bc11Number: string`, `bc11Date: date`, `pos: string`, `subPos: string` | `customs[kind].bc11` atau pada manifest | Hanya tahap INBOUND, non-Carnet. Keputusan terbuka: milik job atau manifest (satu BC 1.1 bisa mencakup banyak job). |
| Jalur | `channel: 'GREEN' \| 'YELLOW' \| 'RED' \| null` | `customs[kind]` | Label UI Hijau/Kuning/Merah. Konfirmasi apakah ada jalur lain (mis. MITA). |
| Pemeriksaan fisik | `physicalInspection: { required: boolean \| null, inspectedAt: date \| null }` | `customs[kind]` | |
| SPPB | `sppbNumber: string`, `sppbDate: date` | `customs[kind]` | Status `RELEASED` ("Keluar (SPPB)") sudah ada tetapi tanpa nomor dan tanggal. |
| NOTUL / SPTNP | `assessmentType: 'NOTUL' \| 'SPTNP'`, `assessmentNumber`, `assessmentDate` (opsional `amount`, `currency`) | `customs[kind]` | Tanyakan apakah satu dokumen boleh punya lebih dari satu penetapan (jika ya: daftar, bukan satu field). |
| Status jaminan | `guarantee.status: 'ACTIVE' \| 'CLAIMED' \| 'RETURNED'`, `guarantee.statusDate: date` | `operational.guarantee` | Hanya Temporary Import INBOUND. Berkaitan dengan tenggat re-ekspor. |
| Lampiran BC | Kind lampiran `BC_2_0/2_3/2_5/3_0/2_7` sudah ada di `jobDocumentKinds`; UI daftar sudah memakainya | endpoint dokumen job yang ada | Perlu dipastikan: API simpan/hapus menerima kind `BC_*`, validasi tipe berkas, dan relasi lampiran ke dokumen BC tertentu. UI unggah belum ada. |
| Gudang/TPS | `warehouseName: string` sudah ada di model dan sudah disimpan oleh form | `customs[kind].warehouseName` | Keputusan terbuka: tetap teks bebas atau master data TPS (kode TPS + nama). |

Endpoint: semua field di atas cukup memperluas patch `saveJobOperationalDetails`
(`operational.customs[kind]`, `operational.guarantee`) beserta skema Zod di `domain/job/validation.ts`
dan migrasi. Tidak ada endpoint baru kecuali lampiran (di atas) dan rangkaian job (di bawah).

### Endpoint lain yang diusulkan

- **Rangkaian job**: `GET /api/jobs/[id]/series` mengembalikan job masuk dan turunan aktif. Saat ini
  halaman memanggil `listJobSummaries({ eventId })` lalu menyaring di klien (mengambil semua job event).
  Pemilik: backend.
- **Mata uang total CIPL**: `totalDokumen` hanya menjumlahkan `nilaiTotal`. Sertakan `currency` dari
  `CiplDocumentHeader.mataUang` pada hasil, dan tentukan perilaku bila mata uang campuran (tampilkan "—"
  atau rincian per mata uang). Pemilik: domain/cipl.

### Keputusan terbuka (bisnis/domain)

1. **Status job COMPLETED vs readiness.** Apakah COMPLETED boleh diset manual bila readiness belum
   penuh? Opsi: (a) tetap manual dengan peringatan, (b) guard di server (hanya bila langkah wajib
   selesai), (c) status diturunkan dari readiness. Sampai diputuskan, UI hanya bisa memberi peringatan.
2. **Status pabean: per dokumen atau per job.** Model sekarang per dokumen (`customs[kind].status`).
   Konfirmasi apakah tampilan header dan readiness cukup per dokumen aktif tahap job.
3. **Respon DJBC: field atau event log.** Simpan hasil (jalur, SPPB, NOTUL/SPTNP, pemeriksaan) sebagai
   field di dokumen, atau sebagai riwayat peristiwa (`job_customs_events`: jenis, waktu, nomor referensi,
   payload) dengan field di atas diturunkan dari peristiwa terakhir. Event log lebih cocok bila integrasi
   CEISA akan mengisinya otomatis (lihat `docs/ceisa-integration-contract.md`).
4. **BC 1.1 milik job atau manifest.** Memengaruhi letak field dan apakah dipakai bersama banyak job.
5. **Status jaminan dan ambang tenggat.** Nilai awal di `lib/job-deadlines.ts` hanya asumsi UI:
   peringatan (amber) pada ≤ 14 hari, mendesak (merah) pada ≤ 7 hari, lewat tenggat bila negatif. Bisnis
   perlu menetapkan: ambang hari, apakah berbeda untuk re-ekspor TI dan carnet, apakah tenggat dianggap
   terpenuhi setelah job re-ekspor RELEASED/COMPLETED, apakah perlu notifikasi di luar halaman, dan siapa
   yang diperingatkan.
6. **Endpoint rangkaian job** (di atas): siapa pemiliknya dan kapan dibuat.
7. **Mata uang di total CIPL** (di atas).
8. **Master TPS** atau teks bebas untuk gudang.
