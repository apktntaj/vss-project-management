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

Job punya dua sumbu yang berbeda: **untuk apa** (konteks) dan **jalur apa** (jenis).

```racket
;; Job adalah (make-job konteks jenis ...)

;; Konteks adalah salah satu dari:
;;  - (make-konteks-event Event)   ; kargo pameran, merujuk satu Event
;;  - 'GENCO                       ; general cargo
;;  - 'PROJECT                     ; project cargo ❓ belum ada informasi dari klien

;; Jenis adalah salah satu dari:
;;  - 'TPPB
;;  - 'TEMPORARY_IMPORT
;;  - 'PERMANENT_IMPORT
;;  - 'ATA_CARNET
;;  - 'ROAD_SHIPMENT
;;  - 'LOCAL
;;  - 'EXPORT
;;  - 'TEMPORARY_EXPORT

;; invariant: jenis 'TPPB hanya boleh bila konteksnya event
```

### Tabel kecocokan (BELUM DIKONFIRMASI)

> Tinjauan Pak Kur 2026-11-18: daftar jenis ini mencampur tiga sumbu, yaitu arah
> (impor/ekspor/domestik), rezim pabean, dan layanan tanpa pabean (LOCAL, ROAD_SHIPMENT).
> Tabel di bawah hanya mencatat jawaban klien sampai bentuk datanya diputuskan.

Sumber: jawaban klien (Andi) di grup WhatsApp, 2026-11-18. Pertanyaannya: "Jenis job itu
bisa masuk di ketiga kategori ya? Kalau TPPB mungkin khas event ya?" Jawaban: "Betul mas".

| Jenis | Event | Genco | Project |
|---|---|---|---|
| TPPB | ✓ | ✗ | ✗ |
| TEMPORARY_IMPORT | ✓ | ✓ | ✓ |
| PERMANENT_IMPORT | ✓ | ✓ | ✓ |
| ATA_CARNET | ✓ | ✓ | ✓ |
| ROAD_SHIPMENT | ✓ | ✓ | ✓ |
| LOCAL | ✓ | ✓ | ✓ |
| EXPORT | ✓ | ✓ | ✓ |
| TEMPORARY_EXPORT | ✓ | ✓ | ✓ |

❓ Jawaban "betul" menjawab dua pertanyaan sekaligus, jadi perlu dikonfirmasi bahwa
**hanya** TPPB yang khas event.

Karena hanya satu pengecualian, cukup satu invariant. Tiap konteks tidak perlu punya
daftar jenisnya sendiri.

### Isi Job

| Bagian | Artinya |
|---|---|
| **Pihak** | Agent, exhibitor (khusus konteks event), atau belum ditentukan |
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

1. **Konfirmasi tabel kecocokan** (§3): apakah hanya TPPB yang khas event?
2. **Project cargo:** selain jenis job, isinya belum ada informasi dari klien.
3. **Tahap dalam satu job:** kode sekarang membuat job turunan untuk disposal dan re-ekspor
   (satu job = satu dokumen BC). Apakah ini tetap, atau tahap menjadi bagian di dalam job?
4. **Exhibitor dari daftar EO:** apakah pintu ketiga ini nyata?
5. **CIPL:** perlu riwayat versi (amandemen), atau cukup diganti utuh?
6. **Hak akses:** cukup satu sistem peran?
7. **IT Inventory, General Cargo/Projects placeholder, email assistant:** dibuang atau disimpan?
8. **Dokumen lama:** `docs/` dibekukan sebagai arsip setelah `docs-v2/` siap?
