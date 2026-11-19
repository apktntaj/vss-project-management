# Definisi Program: Workspace

Status: **DRAF** · revisi 2 · 2026-11-18
Riwayat dan hutang teknis: [napak-tilas.md](napak-tilas.md).
Bagian bertanda **❓** belum diputuskan. Daftarnya ada di bagian terakhir.

---

## 1. Tujuan

> **Workspace** adalah tempat kerja satu PPJK. PPJK ini menangani berbagai kargo dan
> kebetulan sering mendapatkan job pameran.

Workspace hanya berubah karena **pengguna melakukan sesuatu**. Waktu tidak mengubahnya.
Dokumen dari luar pun baru masuk setelah ada pengguna yang menyimpannya.

```racket
;; workspace : Workspace Pengguna Aksi -> Workspace
;; tujuan: menjalankan satu aksi pengguna terhadap Workspace
```

Boleh tidaknya seorang pengguna menjalankan aksi adalah **logika di dalam tiap aksi**,
bukan bagian dari bentuk program.

---

## 2. Susunan

```
Workspace
│
├─ Job                ← inti
├─ Data induk         Venue, EO, Event (berisi Exhibitor), Agent
└─ Pengguna

Di luar Workspace
├─ Tampilan           Dashboard, daftar, detail     (Workspace -> Tampilan)
└─ Tool               kalkulator dan konversi        (tidak menyentuh Workspace)

Diarsipkan
└─ Tiket
```

Urutan data, dari yang harus ada lebih dulu:

```
Venue, EO  →  Event  →  Exhibitor
                 ↘
Agent  ───────→  Job
```

---

## 3. Job

> **Status: USULAN, menunggu persetujuan Anda.** Disusun Pak Kur 2026-11-18 dari dua
> putaran jawaban klien (Andi) di WhatsApp. Bagian ❓ menunggu pertanyaan susulan.

Pola dari jawaban klien: semua yang khas pameran (TPPB, Local, Road Shipment) berkumpul di
job event, sedangkan genco dan project hanya mengenal impor biasa. Karena itu Job dipecah
**menurut konteksnya**, supaya kombinasi yang tidak sah tidak mungkin ditulis.

```racket
;; Job adalah salah satu dari:
;;  - (make-job-event Event LayananEvent Pihak ...)
;;  - (make-job-kargo Kargo RezimImpor Pihak ...)
;; interpretasi: job event melayani satu pameran; job kargo melayani genco atau satu project

;; Kargo adalah salah satu dari:
;;  - 'GENCO
;;  - (make-kargo-project Project)   ; Project = pengelompok banyak job, seperti Event
;;                                    ; ❓ isi Project belum ada informasi

;; LayananEvent adalah salah satu dari:
;;  - 'LOCAL           ; exhibitor domestik, VSS mengangkut barangnya; tanpa dokumen pabean
;;  - 'ROAD_SHIPMENT   ; clearance diurus PPJK lain; VSS menerima di gudang lalu antar ke booth
;;                     ; ❓ apakah VSS juga membawa barangnya pulang
;;  - 'TPPB            ; BC 2.3, ditutup BC 2.5 (tinggal) atau BC 3.0 (re-ekspor)
;;  - RezimImpor

;; RezimImpor adalah salah satu dari:
;;  - 'TEMPORARY_IMPORT  ; ditutup re-ekspor, atau jadi permanen dengan bayar bea/pajak; ada jaminan dan tenggat
;;  - 'ATA_CARNET        ; ditutup re-ekspor saja. ❓ boleh di job kargo (konser, penelitian)?
;;  - 'PERMANENT_IMPORT  ; definitif, tanpa penutup

;; Pihak adalah salah satu dari:
;;  - (make-pihak-agent Agent)       ; agent yang mengatur pengiriman, maka agent yang ditagih
;;  - (make-pihak-pemilik Pemilik)   ; pemilik barang ditagih langsung
;;  - 'BELUM_DITENTUKAN
;; Pemilik: di job event = Exhibitor; di job kargo = Customer   ❓ Customer jadi data induk?

;; invariant: Pemilik di job event adalah Exhibitor milik Event yang sama
;; invariant: LOCAL dan ROAD_SHIPMENT tidak punya dokumen pabean, jaminan, carnet, atau tahap penutup
;; invariant: tahap penutup hanya ada pada TPPB, TEMPORARY_IMPORT, ATA_CARNET; ATA tanpa disposal
;; invariant: re-ekspor selalu turunan dari job induk, tidak pernah dibuat berdiri sendiri
;; peringatan (bukan blokir): TPPB pada event yang venue-nya belum punya profil TPPB
```

**EXPORT dan TEMPORARY_EXPORT belum masuk model** sampai klien menjawab apakah VSS pernah
mengirim barang dari Indonesia ke luar negeri. Re-ekspor barang pameran tetap job turunan,
bukan EXPORT.

### Tabel kecocokan

Y = yakin · R = ragu · X = tidak · ❓ = belum diketahui

| Jenis | Event | Genco | Project | Dasar |
|---|---|---|---|---|
| TPPB | Y | X | X | aturan pabean dan klien |
| LOCAL | Y | X | X | klien: "local hanya untuk pameran" |
| ROAD_SHIPMENT | Y | X | X | klien: diantar ke booth pameran |
| TEMPORARY_IMPORT | Y | R | R | aturan pabean; klien belum memberi contoh |
| PERMANENT_IMPORT | Y | Y | Y | aturan pabean |
| ATA_CARNET | Y | R | X | klien: juga konser dan penelitian, praktik VSS belum jelas |
| EXPORT, TEMPORARY_EXPORT | ❓ | ❓ | ❓ | belum terjawab |

### Alternatif yang tidak dipilih

Satu struktur datar `(make-job konteks jenis pihak)` dengan invariant "TPPB, LOCAL, ROAD
hanya event". Lebih sederhana, tapi kombinasi yang salah baru tertolak saat validasi.
Di database, kedua bentuk tetap bisa disimpan di satu tabel.

### Isi Job

| Bagian | Artinya |
|---|---|
| **Pihak** | Agent (bila agent yang mengatur pengiriman), pemilik barang (Exhibitor di event, Customer di kargo), atau belum ditentukan |
| **CIPL** | Isi dokumen sumber barang. Pada job event, tiap baris mencatat nama exhibitor **persis seperti tertulis**, lalu boleh ditautkan ke Exhibitor |
| **Dokumen angkut** | B/L atau AWB |
| **Dokumen pabean** | Status dan nomor dokumen BC atau Carnet, termasuk jaminan |
| **Inward / kepulangan** | Data barang datang dan barang pulang |
| **Tagihan** | Status tagihan jasa (belum siap, siap, terkirim, lunas) |
| **Catatan, instruksi khusus, lampiran** | Pendukung kerja |
| **Pembatalan** | Job yang dibatalkan tidak bisa diubah lagi |

---

## 4. Data induk

| Data | Artinya | Butuh |
|---|---|---|
| **Venue** | Tempat pameran, beserta profil TPPB-nya | |
| **EO** | Penyelenggara pameran | |
| **Event** | Satu pameran yang ditangani PPJK | Venue dan EO (**wajib**) |
| **Exhibitor** | Perusahaan peserta pameran. **Khas event**: selalu milik satu Event | Event |
| **Agent** | Forwarder luar negeri yang mengatur pengiriman. Berlaku lintas event dan konteks | |

Isi Event selain Venue dan EO: PIC, pengguna lain yang diberi akses, surat penunjukan
dari EO, agent yang ikut, dan daftar Exhibitor.

### Aturan Exhibitor

> **Nama di CIPL adalah bukti. Exhibitor adalah tautan.**
> Nama dicatat apa adanya dan tidak pernah diubah. Tautan ke Exhibitor dibuat setelah
> dikonfirmasi orang.

Exhibitor lahir dari:
1. Hasil menautkan nama di CIPL
2. Didaftarkan manual (job Local, atau exhibitor sebagai pihak yang ditagih sebelum CIPL datang)
3. ❓ Dari daftar exhibitor yang diberikan EO

---

## 5. Aksi

| Kelompok | Aksi |
|---|---|
| **Venue, EO** | daftarkan, ubah, hapus, isi profil TPPB venue |
| **Event** | buat (butuh venue dan EO), ubah, hapus (hanya bila belum punya job), arsipkan, unggah atau hapus surat penunjukan, beri atau cabut akses, ikutsertakan agent |
| **Exhibitor** | daftarkan, ubah, tautkan nama di CIPL ke exhibitor |
| **Agent** | simpan agent |
| **Job** | buat, ubah data utama, batalkan, simpan CIPL, catat dokumen pabean, simpan inward, simpan kepulangan, ubah status tagihan, unggah lampiran |
| **Pengguna** | tambah, ubah, hapus; ganti password; masuk; keluar |
| **CEISA** | simpan kredensial, tes koneksi |

---

## 6. Waktu

> **Waktu tidak pernah mengubah Workspace. Waktu hanya mengubah apa yang ditampilkan.**

Yang bergantung pada hari ini: status event (segera, berlangsung, lewat), jadwal move-in
dan move-out, event dekat yang belum punya job, tenggat jaminan Temporary Import dan masa
berlaku Carnet ATA, serta kesiapan kedatangan barang.

## 7. Dunia luar

**Masuk** (lewat pengguna yang mengunggah; hasil baca otomatis hanya berupa usulan isian):
CIPL, B/L, AWB, manifest inward, data LARTAS dari INSW, referensi dari CEISA.

**Keluar:** Excel manifest inward dan outward, Excel daftar event, workbook BUP, surat
permohonan ke Kanwil, form rincian barang TPPB, draf BC 2.3 ke CEISA (percobaan).
Tagihan belum keluar sebagai dokumen.

## 8. Tampilan

```racket
;; tampil : Workspace Pengguna HariIni -> Tampilan
```

- **Dashboard:** kesiapan kedatangan barang dan kalender venue
- **Event:** daftar, detail (per hall, per agent)
- **Job:** daftar, detail (CIPL, pabean, transport, tagihan, peringatan tenggat)
- **Pengaturan**

## 9. Tool

Fungsi lepas yang tidak membaca maupun mengubah Workspace: CBM, PDF, HS/BTKI, LARTAS.
❓ IT Inventory (demo tanpa penyimpanan) masuk ke sini atau dibuang.

## 10. Diarsipkan

- **Tiket.** Awalnya diminta klien, lalu dalam perkembangannya cenderung tidak dipakai.
  Diarsipkan sementara; tidak termasuk definisi Workspace.

---

## Keputusan yang sudah diambil

| Tanggal | Keputusan |
|---|---|
| 2026-11-18 | Workspace hanya berubah karena aksi pengguna; hak akses adalah logika di dalam aksi |
| 2026-11-18 | Job adalah inti; konteksnya event, genco, atau project |
| 2026-11-18 | Dashboard adalah tampilan dan Tool adalah fungsi lepas, keduanya bukan subdomain |
| 2026-11-18 | Event wajib punya Venue dan EO (membalik keputusan sebelumnya yang membuatnya opsional) |
| 2026-11-18 | Exhibitor khas event |
| 2026-11-18 | Tiket diarsipkan sementara |

## Yang belum diputuskan

1. **Bentuk Job** (§3): setuju dipecah menurut konteks (job event dan job kargo)?
2. **Customer:** jadi data induk baru, seperti Agent?
3. **Project:** isinya belum ada informasi dari klien.
4. **Pertanyaan susulan ke klien:** ekspor, pemakaian di luar pameran, ATA untuk konser/penelitian, kepulangan Road Shipment, contoh project.
5. **Tahap dalam satu job:** kode sekarang membuat job turunan untuk disposal dan re-ekspor
   (satu job = satu dokumen BC). Apakah ini tetap, atau tahap menjadi bagian di dalam job?
6. **Exhibitor dari daftar EO:** apakah pintu ketiga ini nyata?
7. **CIPL:** perlu riwayat versi (amandemen), atau cukup diganti utuh?
8. **Hak akses:** cukup satu sistem peran?
9. **IT Inventory, General Cargo/Projects placeholder, email assistant:** dibuang atau disimpan?
10. **Dokumen lama:** `docs/` dibekukan sebagai arsip setelah `docs-v2/` siap?
