# Scope v1, Progres, dan Kalender

Status: **DRAF** · 2026-11-19 · disusun dari riwayat chat ([riwayat-scope.md](riwayat-scope.md)) dan
kondisi kode per commit `2be1a6a`. Belum dikonfirmasi ke klien.

---

## 1. Scope v1

Workspace Vissasa mencatat seluruh pekerjaan Vissasa, membaca dokumen yang masuk, dan
menghasilkan dokumen yang keluar. Tiga kemampuan, tidak lebih:

| Kemampuan | Artinya |
|---|---|
| **Pencatatan** | Event (beserta exhibitor dan agent), Genco, Project, dan job di dalamnya, untuk semua jenis job: TPPB, Local, Road Shipment, Temporary Import, ATA Carnet, Permanent Import. Status, milestone, catatan, lampiran, pihak yang ditagih, dan status tagihan. |
| **Pemrosesan dokumen** | Upload CIPL dan B/L/AWB, dibaca otomatis, diperiksa dan dikoreksi manusia. Cek LARTAS dari HS code. |
| **Generate file** | Dokumen yang selama ini dibuat manual: manifest, surat, dan form untuk setiap langkah alur kerja (daftar di bagian 3). |

### Di luar v1 (fase 2)

- Integrasi CEISA (kirim dokumen BC langsung)
- IT Inventory
- Integrasi email, notifikasi/reminder otomatis (ETA, barang menginap)
- Saran HS dengan AI
- Analisis pendapatan per agent/tahun (butuh nilai tagihan)
- Data job genco atau road shipment otomatis ikut ke manifest event

### Dikeluarkan

- Tiket dan kanban. Diminta di awal, lalu tidak dipakai klien.

---

## 2. Progres sejauh ini

| Area | Status | Isi |
|---|---|---|
| Login, pengguna, peran, ganti password | Selesai | |
| Data induk: venue, EO, agent | Selesai | |
| Event: daftar, detail, exhibitor, akses PIC, surat penunjukan, per hall, per agent | Selesai | |
| Job event: TPPB, Local, Road Shipment, Temporary Import, ATA Carnet, Permanent Import | Sebagian | Sudah ada di kode, belum diuji dari awal sampai akhir dengan data nyata |
| Job turunan (disposal, re-ekspor), tenggat TI/ATA, tagihan | Sebagian | Sama: perlu uji alur nyata |
| Job Genco dan Project | **Belum** | Halaman masih "Under Development". Saat ini setiap job wajib punya event |
| Scan CIPL dan B/L/AWB | Selesai | |
| Cek LARTAS, klasifikasi dokumen | Selesai | |
| Generate: inward manifest, outward manifest, daftar event (Excel) | Selesai | |
| Generate: surat permohonan Kanwil (PDF), form rincian barang TPPB (Excel), workbook BUP | Selesai | |
| Generate: dokumen lain di bagian 3 | **Belum** | |
| Tools (CBM, PDF, HS BTKI) | Selesai | Bonus, dibekukan |

Ringkasnya: **pemrosesan dokumen hampir tuntas, pencatatan sekitar dua pertiga (event ada, genco
dan project belum), generate file baru 6 dari sekitar 14 dokumen.**

---

## 3. Yang belum dikerjakan

### A. Stabilisasi (wajib sebelum dipakai serius)

| # | Pekerjaan | Hari |
|---|---|---|
| A1 | Tutup jalan belakang `/api/operational-records` (ubah/hapus tanpa cek peran) | 0,5 |
| A2 | Rapikan migrasi: timestamp ganda `20261116000000`, migrasi `regime_documents` yang diubah | 0,5 |
| A3 | Sembunyikan Tiket dan IT Inventory dari menu; ganti password default yang pernah dikirim lewat chat | 0,5 |

### B. Pencatatan

| # | Pekerjaan | Hari |
|---|---|---|
| B1 | Uji alur TPPB, Road Shipment, Local dengan data event nyata + perbaikan | 2 |
| B2 | Uji alur Temporary Import, ATA Carnet, Permanent Import + perbaikan | 2 |
| B3 | Job tanpa event: skema konteks Genco/Project, migrasi | 1,5 |
| B4 | Halaman Genco dan Project: daftar, buat, detail (pakai ulang komponen job) | 3 |
| B5 | Export daftar semua job ke Excel (database job setahun) | 1 |

### C. Generate file

Setiap dokumen butuh **contoh/template dari klien** sebelum dikerjakan.

| # | Dokumen | Untuk | Hari |
|---|---|---|---|
| C1 | Paket pengambilan DO: surat kuasa, surat tugas, surat peminjaman container (FCL) | Semua job impor | 2 |
| C2 | Form pemindahan barang bonded → hall dan hall → bonded | TPPB | 1 |
| C3 | Form DO tanda terima Vissasa → peserta di booth | Event | 1 |
| C4 | Form disposal | TPPB | 1 |
| C5 | Surat permohonan re-ekspor (sisa barang awal dikurangi BC 2.5) | TPPB | 1 |
| C6 | Shipping manual per event | Event | 1 |
| C7 | Surat kelengkapan ATA Carnet dan Temporary Import (permit, pemberitahuan re-ekspor) | ATA, TI | 1,5 |
| C8 | Quotation dan invoice | ❓ perlu konfirmasi | (2) |

### D. Serah terima

| # | Pekerjaan | Hari |
|---|---|---|
| D1 | Deploy production, subdomain, akun per pengguna, panduan singkat | 2 |
| D2 | UAT dan perbaikan hasilnya | 3 |

**Total: sekitar 25 hari kerja** (27 bila C8 masuk). Kalender di bawah menyediakan 31 hari, jadi
ada cadangan sekitar 5 hari.

---

## 4. Kalender

Asumsi: 4 hari kerja per minggu (Senin–Kamis), **Jumat untuk cadangan, review, dan antrean
permintaan baru**. Libur 24 Des – 1 Jan.

| Minggu | Tanggal | Pekerjaan | Tonggak |
|---|---|---|---|
| 1 | 23–27 Nov | B1a (mulai 19 Nov), B1b, B6. **Senin: minta semua template dokumen bagian 3 ke Arsya.** | |
| 2 | 30 Nov – 4 Des | B1c, B2, C1 | **M1 (4 Des):** pencatatan event diuji penuh |
| 3 | 7–11 Des | C2, C3, C4 | |
| 4 | 14–18 Des | C5, C6, C7 | **M2 (18 Des):** dokumen event selesai, klien mulai pakai untuk event berjalan |
| 5 | 21–23 Des | B3, mulai B4 | |
| — | 24 Des – 1 Jan | Libur | |
| 6 | 4–8 Jan | B4, B5 (dan C8 bila disetujui) | **M3 (8 Jan):** fitur dibekukan |
| 7 | 11–15 Jan | D1, UAT dimulai | |
| 8 | 18–22 Jan | D2 | **M4 (22 Jan 2027): serah terima v1** |
| — | 25 Jan – 5 Feb | Masa garansi: hanya bug | |

Urutan B3–B5 (Genco/Project) dan C (dokumen) boleh ditukar bila klien lebih butuh genco dulu.

---

## 5. Aturan kerja supaya kalender ini tercapai

1. **Satu item selesai baru pindah.** "Selesai" = bisa dipakai dengan data nyata, tes lulus, `tsc`
   bersih. Bukan "sudah rapi".
2. **Poles dibekukan.** Backlog UI ([docs/ui/job-detail-ui-backlog.md](../docs/ui/job-detail-ui-backlog.md))
   dan perbaikan tampilan hanya dikerjakan bila menghalangi pemakaian. Ide poles ditulis di
   antrean, bukan dikerjakan.
3. **Permintaan baru masuk antrean.** Dibaca tiap Jumat. Yang masuk scope v1 dan kecil (≤ 0,5 hari)
   boleh disisipkan; sisanya fase 2.
4. **Model data tidak dirombak.** Perubahan model hanya bila sebuah item di atas tidak bisa jalan
   tanpanya.
5. **Tiap Jumat kirim update singkat ke Arsya:** apa yang selesai, apa minggu depan, apa yang
   ditunggu dari klien.

---

## 6. Yang ditunggu dari klien

- Template/contoh: surat kuasa DO, surat tugas, surat peminjaman container, form pemindahan
  bonded↔hall, form DO tanda terima booth, form disposal, surat re-ekspor, shipping manual,
  surat kelengkapan ATA dan TI
- Konfirmasi: quotation dan invoice masuk v1 atau fase 2?
- Konfirmasi: Temporary Export dikerjakan Vissasa? Masuk genco?
- Isi data Project (contoh satu project nyata)
- Satu event berjalan untuk uji coba nyata (M2)

## 7. Keputusan teknis yang perlu persetujuan

- **Format surat.** Klien biasa memakai Word (tinggal tempel kop). Membuat `.docx` butuh dependency
  baru. Alternatifnya PDF atau Excel dengan library yang sudah ada.

---

## 8. Status item

Diperbarui oleh agent atau manajer setiap kali sebuah item selesai (lihat `/cek-jadwal`).
Status: `Belum` · `Jalan` · `Selesai (tanggal, commit)` · `Fase 2`.

| ID | Item | Minggu | Status |
|---|---|---|---|
| A1 | Tutup `/api/operational-records` | 1 | Selesai (2026-11-19, commit d51d7bc) |
| A2 | Rapikan migrasi | 1 | Selesai (2026-11-19, commit d51d7bc) |
| A3 | Sembunyikan Tiket/IT Inventory, ganti password default | 1 | Selesai (2026-11-19, commit d51d7bc) |
| B1a | Uji inward TPPB (langkah 1–5): sampai inward manifest dan workbook BUP terunduh benar | 1 | Jalan |
| B1b | Uji input Road Shipment (ditempel ke event) | 1 | Belum |
| B1c | Uji Local + pencatatan TPPB setelah inward (pindah hall, kembali bonded, BC 1.1) | 2 | Belum |
| B6 | Otorisasi job per event: penerima akses PIC hanya buat job dan ubah job miliknya | 1 | Selesai (2026-11-20, commit 0d0e35d); migrasi `20261120000000_role_spesialis_dan_pemilik_job_turunan.sql` diterapkan pengguna lewat SQL editor; tes browser 20 Nov lolos untuk admin, CS-PIC, Spesialis penerima akses (buat + ubah job sendiri), dan Finance (akun uji: Uji Spesialis, Uji Finance) |
| B2 | Uji TI, ATA, PI | 2 | Belum |
| C1 | Paket pengambilan DO | 2 | Belum |
| C2 | Form pemindahan bonded↔hall | 3 | Belum |
| C3 | Form DO tanda terima booth | 3 | Belum |
| C4 | Form disposal | 3 | Belum |
| C5 | Surat permohonan re-ekspor | 4 | Belum |
| C6 | Shipping manual | 4 | Belum |
| C7 | Surat kelengkapan ATA dan TI | 4 | Belum |
| B3 | Skema konteks Genco/Project | 5 | Belum |
| B4 | Halaman Genco dan Project | 5–6 | Belum |
| B5 | Export semua job ke Excel | 6 | Belum |
| C8 | Quotation dan invoice (menunggu konfirmasi) | 6 | Belum |
| D1 | Deploy production, akun, panduan | 7 | Belum |
| D2 | UAT dan perbaikan | 8 | Belum |

### Log progres

| Tanggal | Catatan |
|---|---|
| 2026-11-19 | Scope v1 dan kalender dibuat. Belum ada item dimulai. |
| 2026-11-19 | Cek jadwal sebelum Minggu 1. Belum ada commit baru; draf `docs/specs/alur-tppb/requirements.md` sudah ada (persiapan B1, belum di-commit). Status item tidak berubah. |
| 2026-11-19 | Atas keputusan pengguna: A1–A3 ditarik maju ke 19–20 Nov, update ke Arsya Jumat malam 20 Nov, B1 mulai Senin 23 Nov. |
| 2026-11-19 | A1 selesai: `/api/operational-records` hanya melayani `operational_users` dan `agents`; PUT hanya `agents` (Zod `agentRecordSchema`), DELETE dihapus. Belum di-commit. |
| 2026-11-19 | A2 jalan: `job_stages` di-rename ke `20261116010000` (tak ada timestamp ganda). Cek remote: semua migrasi sampai `regime_documents` sudah berlaku (constraint ada, tak ada job turunan ATA/PI), tapi riwayat migrasi remote hanya mencatat sampai `20261101020000`; 15 versi perlu dicatat (`migration repair`) dengan izin pengguna. A3 jalan: menu Tickets dan tab IT Inventory disembunyikan; ganti password default menunggu pengguna. Belum di-commit. |
| 2026-11-19 | A2 selesai: atas izin pengguna, 15 versi (3 dari 29 Okt + 12 dari 2–17 Nov) dicatat sebagai applied di `supabase_migrations.schema_migrations` remote setelah objeknya dicek ada. Riwayat remote = file lokal (27 migrasi). Rename `job_stages` belum di-commit. |
| 2026-11-19 | A3 selesai: pengguna mengonfirmasi password default yang dikirim di grup (berisi karyawan Vissasa) sudah diminta langsung diganti; tidak perlu tindakan lain. A1–A3 selesai sebelum Minggu 1. |
| 2026-11-19 | Cek jadwal (Kamis, sebelum Minggu 1). Tidak ada commit baru; A1–A3 selesai tapi masih belum di-commit. Lebih cepat dari jadwal. Berikutnya: B1 mulai Senin 23 Nov, minta template dokumen ke Arsya hari yang sama. |
| 2026-11-19 | Atas keputusan pengguna: update ke Arsya Jumat 20 Nov ditunda. Pengguna mencatat B1 bukan sekadar uji karena alur TPPB belum lengkap (cek kode: pencatatan pindah ke hall, kembali ke bonded, BC 1.1 belum ada; dokumen langkah 4, 7, 9–12 = C1–C5). |
| 2026-11-19 | Atas persetujuan pengguna: B1 dipecah (B1a inward TPPB, B1b Road Shipment, B1c Local + TPPB setelah inward ke Minggu 2) dan item baru B6 otorisasi job per event (permintaan klien: pengisi road shipment tidak bisa mengubah job lain). Baca tetap terbuka untuk semua. Cadangan berkurang ±2,5 hari; M1 tetap. B1a mulai 19 Nov dengan data yang ada. |
| 2026-11-19 | B1a uji dengan data yang ada (Plastic & Rubber 2026, 6 job TPPB): inward manifest OK (blok per job, dimensi, berat, hall/booth; remark ETA/SPPB kosong karena milestone belum diisi). Form rincian barang TPPB OK. Surat Kanwil ditolak karena data venue belum lengkap (Kanwil tujuan, penandatangan). **Workbook BUP BC 2.3 gagal untuk semua 17 job:** ia membaca `operational.invoice` yang tidak lagi diisi UI mana pun (data CI sekarang di CIPL). Perlu perbaikan sumber data BUP. |
| 2026-11-20 | Temuan B1a (dari desain UI Dicha, dicek manajer): `JobManifestEditorModal` (satu-satunya UI isi inward: milestone ETA/SPPB/bonded, kontainer, catatan, kepulangan), `CiplLineModal`, dan `EventAccessCard` tidak dipasang di halaman mana pun. Akibatnya remark inward manifest selalu kosong dan PIC belum bisa memberi akses event dari aplikasi. |
| 2026-11-20 | B6 selesai diimplementasi (tsc bersih, domain:test 123 pass, guard:arch, build lolos): peran CS/Spesialis/Finance, penerima akses hanya menulis job miliknya, celah inward/lampiran/agent ditutup, exhibitor lewat job ('SHARED dihapus, opsi b), UI tombol pudar + alasan saat dicoba, kartu Akses event dipasang. Migrasi siap, belum diterapkan; belum di-commit. |
| 2026-11-20 | B6 di-commit (0d0e35d), migrasi diterapkan pengguna lewat SQL editor, tes browser lolos untuk admin, CS-PIC, Spesialis penerima akses (buat + ubah job sendiri), dan Finance. Akun uji Uji Spesialis/Uji Finance dan akses Uji Spesialis ke ISFEX 2026 masih ada (hapus nanti); job uji sudah dihapus. Status A1–A3 dikoreksi: sudah di-commit di d51d7bc. |
