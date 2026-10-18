# Requirements Document

IT Inventory Kawasan Berikat (TPPB) — Buku Besar Mutasi Barang Bea Cukai

## Introduction

Fitur **IT Inventory Kawasan Berikat** adalah buku besar mutasi (running ledger) barang di dalam
Tempat Penimbunan Berikat (TPPB / kawasan berikat) yang dikelola VSS. "IT Inventory" di sini
mengikuti istilah Bea Cukai untuk kewajiban **Input IT Inventory**: pencatatan berjalan atas barang
yang bea masuk dan pajaknya masih **ditangguhkan** (suspended) selama berada di kawasan berikat.
Istilah ini **tidak** berkaitan dengan aset TI/komputer; "IT" di sini adalah penamaan sistem Bea
Cukai, bukan kategori barang.

Dalam konteks MICE, barang pameran impor masuk ke kawasan berikat dengan bea masuk ditangguhkan dan
pada umumnya ditujukan untuk **diekspor kembali** (re-ekspor) setelah pameran selesai. Sebagian kecil
barang dapat dikeluarkan untuk digunakan di dalam negeri (consumables, ATK) sehingga bea masuknya
menjadi terutang.

Fitur ini adalah **buku stok berbasis kuantitas** (quantity-based), bukan pelacakan per unit dengan
nomor seri. Setiap item inventory adalah satu baris barang (deskripsi, HS code, satuan) yang dilacak
berdasarkan jumlah, dengan **saldo berjalan** (running balance). Invariant saldo:

```
saldo = Σ pemasukan − Σ pengeluaran ± Σ penyesuaian
```

dan saldo setiap item **tidak boleh negatif**. Invariant ini ditegakkan di route handler (server-side),
bukan hanya di browser.

Dokumen pabean yang menggerakkan stok (domain facts):

- **BC 2.3** — Pemberitahuan Impor Barang Untuk Ditimbun di TPB. Ini **PEMASUKAN** (INBOUND): barang
  masuk ke kawasan berikat dengan bea masuk ditangguhkan. Ini sumber yang membuat/menambah inventory.
- **BC 3.0** — PEB (Pemberitahuan Ekspor Barang). Ini **PENGELUARAN** sebagai ekspor/re-ekspor —
  barang pameran meninggalkan daerah pabean kembali.
- **BC 2.5** — PENGELUARAN untuk barang yang digunakan/dikonsumsi di dalam negeri (mis. ATK,
  consumables). Bea masuk menjadi terutang saat keluar.
- **PENYESUAIAN** — koreksi stock opname, kerusakan, kehilangan, atau rekonsiliasi lain. Dapat
  bernilai menambah (positif) atau mengurangi (negatif) saldo.

Konvensi arsitektur yang berlaku (mengikuti steering repo):

- Teks yang dilihat pengguna berbahasa Indonesia; identifier, enum, dan kode error bahasa Inggris
  `SCREAMING_SNAKE_CASE`.
- Nama field pabean memakai istilah Bea Cukai asli sesuai konvensi CEISA (`nomorAju`, `jenisDokumen`,
  `tanggalDokumen`) dan tidak diterjemahkan.
- Alur data satu arah: komponen UI → `@/lib/data-client` → `fetch('/api/...')` → route handler →
  `lib/supabase/*` (`server-only`) → Postgres. Mutasi memakai route handler, **bukan** Server Action.
- Tidak ada `middleware.ts`; setiap route handler menjaga autentikasinya sendiri.
- Input pengguna divalidasi dengan Zod di batas API (`domain/it-inventory/validation.ts`); invariant
  bisnis (termasuk saldo tidak negatif) divalidasi dengan validator murni yang mengembalikan
  `Validation<T>` dan ditegakkan di route handler.
- Setiap mutasi menghasilkan toast sukses atau gagal di kanan bawah viewport.
- Seluruh query menyaring `workspace_id` dari workspace dengan slug `default`.

## Glossary

- **IT_Inventory_System**: Subsistem VSS yang mencatat buku besar mutasi barang di kawasan berikat,
  saldo berjalan per item, dan dokumen pabean terkait.
- **Inventory_Item** (Item Inventory): Satu baris barang di buku stok kawasan berikat, diidentifikasi
  oleh deskripsi barang, HS code, dan satuan, dilacak berdasarkan kuantitas dengan saldo berjalan.
- **Bonded_Zone** (Kawasan Berikat / TPPB): Area penimbunan di bawah pengawasan pabean tempat barang
  disimpan dengan bea masuk ditangguhkan.
- **Stock_Movement** (Mutasi / Pergerakan Stok): Satu kejadian yang mengubah saldo sebuah Item
  Inventory — bertipe `PEMASUKAN`, `PENGELUARAN`, atau `PENYESUAIAN` — disertai referensi dokumen
  pabean, tanggal, kuantitas, dan alasan/catatan.
- **Saldo** (Balance): Jumlah kuantitas berjalan sebuah Item Inventory, dihitung
  `Σ pemasukan − Σ pengeluaran ± Σ penyesuaian`, tidak boleh negatif.
- **Movement_Type** (Tipe Mutasi): `PEMASUKAN` (INBOUND), `PENGELUARAN` (OUTBOUND), atau
  `PENYESUAIAN` (adjustment).
- **Jenis_Dokumen** (Jenis Dokumen Pabean): `BC_2_3` (impor untuk ditimbun — pemasukan),
  `BC_2_5` (pengeluaran untuk digunakan), `BC_3_0` (PEB ekspor/re-ekspor — pengeluaran), atau
  `PENYESUAIAN` (dokumen koreksi internal/stock opname).
- **HS_Code**: Harmonized System code klasifikasi barang.
- **Satuan** (Unit of Measure): Satuan ukur kuantitas barang (mis. `UNIT`, `PCS`, `SET`, `KGM`,
  `CTN`, `BOX`).
- **nomorAju**: Nomor pengajuan dokumen pabean (istilah Bea Cukai, tidak diterjemahkan).
- **Kartu_Stok** (Stock Card): Rekapitulasi per item yang memuat saldo awal, pemasukan, pengeluaran,
  penyesuaian, dan saldo akhir untuk suatu periode.
- **Stock_Opname**: Kegiatan pencocokan catatan inventory dengan kondisi fisik di kawasan berikat.
- **Operator**: Pengguna VSS yang sudah login dan dapat melihat serta mengelola inventory.
- **Admin**: Pengguna dengan flag `isAdmin` aktif pada sesi.

## Requirements

### Requirement 1: Mencatat item inventory (baris barang)

**User Story:** Sebagai Operator, saya ingin mencatat satu baris barang yang masuk ke kawasan berikat melalui dokumen BC 2.3, agar barang tersebut terlacak di buku stok di bawah pengawasan pabean sejak pemasukan pertama.

#### Acceptance Criteria

1. WHEN Operator mengirim data Item Inventory baru yang lolos seluruh validasi beserta mutasi pemasukan awal bertipe `PEMASUKAN`, THE IT_Inventory_System SHALL menyimpan Item Inventory dengan `goodsDescription`, `hsCode`, `satuan`, dan mencatat mutasi `PEMASUKAN` pertamanya sehingga saldo awal item sama dengan kuantitas pemasukan tersebut, lalu menampilkan toast sukses berbahasa Indonesia di kanan bawah viewport.
2. THE IT_Inventory_System SHALL mewajibkan `goodsDescription` terisi dengan panjang 1 sampai 500 karakter setelah dipangkas spasi untuk setiap Item Inventory baru.
3. THE IT_Inventory_System SHALL mewajibkan `satuan` terisi dengan panjang 1 sampai 20 karakter setelah dipangkas spasi untuk setiap Item Inventory baru.
4. THE IT_Inventory_System SHALL mewajibkan kuantitas pemasukan awal berupa angka lebih besar dari 0 untuk setiap Item Inventory baru.
5. WHERE `hsCode` disediakan, THE IT_Inventory_System SHALL mewajibkan `hsCode` berupa string maksimal 20 karakter berisi hanya digit dan titik.
6. THE IT_Inventory_System SHALL mewajibkan mutasi pemasukan awal menyertakan `jenisDokumen` bernilai `BC_2_3`, `nomorDokumen` (1–100 karakter), dan `tanggalDokumen` dengan format `YYYY-MM-DD`.
7. IF salah satu field wajib kosong atau melanggar batas panjang, daftar nilai, atau format yang ditetapkan, THEN THE IT_Inventory_System SHALL menolak penyimpanan dengan status 400 dan kode error `REQUIRED_FIELD_MISSING` atau `INVALID_FIELD_FORMAT`, tanpa membuat Item Inventory maupun mutasi, dan menampilkan pesan error berbahasa Indonesia di dekat field terkait.
8. IF penyimpanan ke penyimpanan data gagal karena kegagalan dependensi backend, THEN THE IT_Inventory_System SHALL membatalkan penyimpanan tanpa membuat Item Inventory atau mutasi parsial dan menampilkan toast error berbahasa Indonesia di kanan bawah viewport.
9. THE IT_Inventory_System SHALL menetapkan identifier Item Inventory menggunakan `crypto.randomUUID()`.

### Requirement 2: Atribut item dan dokumen pabean

**User Story:** Sebagai Operator, saya ingin menyimpan atribut barang dan referensi dokumen pabean pada setiap item dan mutasi, agar data buku stok cukup untuk rekonsiliasi dan audit Bea Cukai.

#### Acceptance Criteria

1. THE IT_Inventory_System SHALL menyimpan atribut berikut untuk setiap Item Inventory: `goodsDescription` (wajib, 1–500 karakter), `hsCode` (opsional, maksimal 20 karakter), `satuan` (wajib, 1–20 karakter), `countryOfOrigin` (opsional, maksimal 100 karakter), dan `notes` (opsional, maksimal 2000 karakter).
2. WHERE nilai pabean disediakan, THE IT_Inventory_System SHALL menyimpan `nilaiPabean` (opsional, angka 0 sampai 999.999.999.999,99) dan `currency` (opsional, kode mata uang 3 huruf, default `USD`).
3. THE IT_Inventory_System SHALL menyimpan referensi dokumen pabean pada setiap mutasi: `jenisDokumen` (wajib), `nomorDokumen` (wajib, 1–100 karakter), `tanggalDokumen` (wajib, format `YYYY-MM-DD`), dan `nomorAju` (opsional, maksimal 100 karakter).
4. THE IT_Inventory_System SHALL membatasi `jenisDokumen` pada nilai `BC_2_3`, `BC_2_5`, `BC_3_0`, atau `PENYESUAIAN`.
5. IF `jenisDokumen` bukan salah satu nilai yang diizinkan, atau `tanggalDokumen` tidak sesuai format `YYYY-MM-DD`, THEN THE IT_Inventory_System SHALL menolak penyimpanan dengan kode error `INVALID_FIELD_FORMAT` tanpa mengubah data tersimpan.
6. IF `nilaiPabean` berada di luar rentang 0 sampai 999.999.999.999,99, atau `currency` bukan kode 3 huruf, THEN THE IT_Inventory_System SHALL menolak penyimpanan dengan kode error `INVALID_FIELD_FORMAT` tanpa mengubah data tersimpan.
7. WHERE `hsCode` terisi, THE IT_Inventory_System SHALL menyimpan nilai tersebut apa adanya tanpa menerjemahkan atau mengubah formatnya.

### Requirement 3: Mencatat mutasi / pergerakan stok

**User Story:** Sebagai Operator, saya ingin mencatat pemasukan, pengeluaran, dan penyesuaian stok untuk sebuah item, agar saldo buku stok selalu mencerminkan kejadian pabean terakhir.

#### Acceptance Criteria

1. WHEN Operator mencatat mutasi bertipe `PEMASUKAN`, `PENGELUARAN`, atau `PENYESUAIAN` yang lolos validasi, THE IT_Inventory_System SHALL menyimpan mutasi dengan `movementType`, `quantity`, `movementDate` (`YYYY-MM-DD`), `jenisDokumen`, `nomorDokumen`, dan `reason` opsional, lalu menampilkan toast sukses berbahasa Indonesia di kanan bawah viewport.
2. WHEN sebuah mutasi tersimpan, THE IT_Inventory_System SHALL memperbarui saldo Item Inventory terkait sesuai aturan: `PEMASUKAN` menambah saldo, `PENGELUARAN` mengurangi saldo, dan `PENYESUAIAN` menambah atau mengurangi saldo sesuai tanda kuantitas penyesuaian.
3. THE IT_Inventory_System SHALL mewajibkan `jenisDokumen` konsisten dengan `movementType`: `PEMASUKAN` memakai `BC_2_3`; `PENGELUARAN` memakai `BC_2_5` atau `BC_3_0`; `PENYESUAIAN` memakai `PENYESUAIAN`.
4. IF `jenisDokumen` tidak konsisten dengan `movementType` menurut aturan di atas, THEN THE IT_Inventory_System SHALL menolak pencatatan dengan kode error `DOCUMENT_TYPE_MISMATCH` tanpa mengubah saldo tersimpan.
5. IF `movementType`, `quantity`, `movementDate`, `jenisDokumen`, atau `nomorDokumen` kosong, THEN THE IT_Inventory_System SHALL menolak pencatatan dengan kode error `REQUIRED_FIELD_MISSING`, mempertahankan input Operator, tanpa mengubah Item Inventory terkait.
6. IF `movementType` di luar nilai yang diizinkan, `quantity` bukan angka bukan nol (untuk `PEMASUKAN`/`PENGELUARAN` harus lebih besar dari 0), atau `movementDate` bukan `YYYY-MM-DD` yang valid atau berada di masa depan, THEN THE IT_Inventory_System SHALL menolak pencatatan dengan kode error `INVALID_FIELD_VALUE` tanpa mengubah Item Inventory terkait.
7. WHERE `movementType` bernilai `PENGELUARAN`, THE IT_Inventory_System SHALL mewajibkan `nomorDokumen` (1–100 karakter) dan minimal satu lampiran dokumen sebagai bukti pengeluaran; bila tidak terpenuhi, THE IT_Inventory_System SHALL menolak dengan kode error `OUTBOUND_EVIDENCE_REQUIRED`.

### Requirement 4: Invariant saldo (balance) tidak negatif

**User Story:** Sebagai Admin, saya ingin memastikan saldo setiap item tidak pernah negatif, agar buku stok kawasan berikat selalu dapat dipertanggungjawabkan saat audit dan tidak mencatat pengeluaran melebihi barang yang tersedia.

#### Acceptance Criteria

1. THE IT_Inventory_System SHALL menghitung saldo setiap Item Inventory sebagai `Σ quantity PEMASUKAN − Σ quantity PENGELUARAN + Σ quantity bertanda PENYESUAIAN`.
2. IF sebuah mutasi `PENGELUARAN` akan membuat saldo Item Inventory menjadi kurang dari 0, THEN THE IT_Inventory_System SHALL menolak mutasi tersebut dengan status 400 dan kode error `BALANCE_WOULD_GO_NEGATIVE`, tanpa mengubah saldo tersimpan, dan menampilkan toast gagal berbahasa Indonesia yang menyebutkan saldo tidak mencukupi.
3. IF sebuah mutasi `PENYESUAIAN` bertanda negatif akan membuat saldo Item Inventory menjadi kurang dari 0, THEN THE IT_Inventory_System SHALL menolak mutasi tersebut dengan status 400 dan kode error `BALANCE_WOULD_GO_NEGATIVE`, tanpa mengubah saldo tersimpan.
4. THE IT_Inventory_System SHALL menegakkan invariant saldo tidak negatif di route handler menggunakan validator murni yang mengembalikan `Validation<T>`, bukan hanya di `@/lib/data-client` di browser.
5. IF sebuah permintaan mutasi dikirim langsung ke route handler tanpa melalui validasi browser, THEN THE IT_Inventory_System SHALL tetap menjalankan validasi invariant saldo sebelum menyimpan dan menolak mutasi yang melanggar dengan kode error `BALANCE_WOULD_GO_NEGATIVE`.
6. WHILE menghitung dampak sebuah mutasi `PENGELUARAN` atau `PENYESUAIAN` terhadap saldo, THE IT_Inventory_System SHALL mempertimbangkan seluruh mutasi tersimpan untuk Item Inventory tersebut di workspace aktif.

### Requirement 5: Melihat dan menelusuri inventory

**User Story:** Sebagai Operator, saya ingin melihat dan menyaring daftar item inventory beserta saldonya serta menelusuri riwayat mutasi tiap item, agar dapat menemukan dan merekonsiliasi barang tertentu saat operasional dan stock opname.

#### Acceptance Criteria

1. WHEN Operator membuka halaman inventory, THE IT_Inventory_System SHALL menampilkan daftar Item Inventory di workspace aktif beserta `goodsDescription`, `hsCode`, `satuan`, dan saldo berjalan tiap item, diurutkan menaik berdasarkan `goodsDescription`.
2. WHEN Operator memasukkan kata kunci pencarian minimal 1 karakter dan maksimum 100 karakter, THE IT_Inventory_System SHALL menampilkan Item Inventory yang `goodsDescription` atau `hsCode`-nya mengandung kata kunci tersebut tanpa membedakan huruf besar dan kecil.
3. WHERE Operator memilih satu atau lebih filter `jenisDokumen`, `hsCode`, atau status saldo (`POSITIF` atau `NOL`), THE IT_Inventory_System SHALL menampilkan hanya Item Inventory yang memenuhi seluruh filter yang dipilih secara bersamaan.
4. IF kata kunci atau filter tidak cocok dengan Item Inventory mana pun, THEN THE IT_Inventory_System SHALL menampilkan daftar kosong beserta pesan dalam Bahasa Indonesia yang menyatakan tidak ada item yang cocok dan mempertahankan kata kunci serta filter aktif.
5. WHEN Operator membuka satu Item Inventory, THE IT_Inventory_System SHALL menampilkan seluruh atribut item beserta riwayat mutasinya (kartu stok) yang diurutkan secara kronologis dari yang terbaru ke yang terlama, dengan kolom kuantitas masuk, keluar, penyesuaian, dan saldo berjalan.
6. IF riwayat mutasi sebuah Item Inventory hanya berisi pemasukan awal, THEN THE IT_Inventory_System SHALL tetap menampilkan baris pemasukan awal tersebut beserta saldo yang dihasilkannya.
7. WHILE data inventory sedang dimuat, THE IT_Inventory_System SHALL menampilkan skeleton pemuatan.
8. IF pemuatan data inventory gagal, THEN THE IT_Inventory_System SHALL menampilkan pesan kesalahan dalam Bahasa Indonesia yang menyatakan pemuatan gagal dan menyediakan aksi untuk memuat ulang daftar.

### Requirement 6: Kartu stok dan pelaporan saldo

**User Story:** Sebagai Operator, saya ingin melihat dan mengekspor kartu stok dan laporan saldo per item dan per periode, agar dapat menyerahkan laporan pertanggungjawaban mutasi kepada Bea Cukai saat audit dan stock opname.

#### Acceptance Criteria

1. WHEN Operator meminta kartu stok sebuah Item Inventory untuk suatu periode (`periodStart` dan `periodEnd`, format `YYYY-MM-DD`), THE IT_Inventory_System SHALL menampilkan saldo awal pada awal periode, seluruh mutasi di dalam periode, dan saldo akhir pada akhir periode.
2. WHEN Operator meminta ekspor laporan saldo, THE IT_Inventory_System SHALL menghasilkan satu workbook Excel (xlsx) yang memuat setiap Item Inventory pada satu baris dengan kolom saldo awal, total pemasukan, total pengeluaran, total penyesuaian, dan saldo akhir untuk periode yang dipilih.
3. WHERE satu atau lebih filter sedang diterapkan di daftar inventory, THE IT_Inventory_System SHALL mengekspor hanya Item Inventory yang memenuhi seluruh filter aktif, dan jumlah baris item dalam workbook SHALL sama dengan jumlah Item Inventory yang ditampilkan di daftar setelah filter diterapkan.
4. IF `periodEnd` lebih awal dari `periodStart`, THEN THE IT_Inventory_System SHALL menolak permintaan dengan kode error `INVALID_PERIOD_RANGE` dan pesan berbahasa Indonesia tanpa menghasilkan laporan.
5. IF tidak ada Item Inventory yang memenuhi filter aktif saat ekspor diminta, THEN THE IT_Inventory_System SHALL menghasilkan workbook berisi baris header kolom tanpa baris item dan menampilkan toast informasi berbahasa Indonesia yang menyatakan tidak ada data untuk diekspor.
6. IF pembuatan workbook gagal, THEN THE IT_Inventory_System SHALL membatalkan proses ekspor tanpa menghasilkan file unduhan, mempertahankan data inventory tanpa perubahan, dan menampilkan toast gagal berisi pesan berbahasa Indonesia yang mengindikasikan ekspor gagal.

### Requirement 7: Lampiran dokumen pabean

**User Story:** Sebagai Operator, saya ingin melampirkan dokumen pabean asli pada item dan mutasinya, agar bukti pendukung tersedia saat audit dan rekonsiliasi.

#### Acceptance Criteria

1. WHEN Operator mengunggah lampiran untuk Item Inventory atau Mutasi Stok, THE IT_Inventory_System SHALL menyimpan berkas melalui endpoint lampiran dengan `ownerType` bernilai `INVENTORY_ITEM` atau `INVENTORY_MOVEMENT` dan mengaitkannya ke entitas pemilik melalui identifier pemilik yang disertakan.
2. IF `ownerType` yang dikirim bukan salah satu dari nilai allowlist (`INVENTORY_ITEM`, `INVENTORY_MOVEMENT`), atau identifier pemilik tidak merujuk entitas yang ada di workspace aktif, THEN THE IT_Inventory_System SHALL menolak unggahan, tidak menyimpan berkas, dan mengembalikan pesan kesalahan berbahasa Indonesia yang menyatakan pemilik lampiran tidak valid.
3. WHEN Operator mengunggah berkas lampiran bertipe PDF, Excel (.xls atau .xlsx), atau gambar (JPEG atau PNG) dengan ukuran lebih besar dari 0 byte dan tidak melebihi 10 MB (10.485.760 byte), THE IT_Inventory_System SHALL menerima dan menyimpan berkas tersebut.
4. IF berkas yang diunggah berukuran 0 byte, melebihi 10 MB (10.485.760 byte), atau bertipe selain yang diizinkan, THEN THE IT_Inventory_System SHALL menolak unggahan, tidak menyimpan berkas, dan mengembalikan pesan kesalahan berbahasa Indonesia yang menyebutkan batas ukuran 10 MB atau jenis berkas yang diizinkan.
5. WHEN Operator membuka lampiran yang ada, THE IT_Inventory_System SHALL mengembalikan byte berkas melalui proxy lampiran dengan header kontrol cache yang mencegah penyimpanan di cache (`private, no-store`).

### Requirement 8: Autentikasi dan otorisasi

**User Story:** Sebagai Admin, saya ingin memastikan hanya pengguna berwenang yang dapat mengakses dan mengubah buku stok, agar catatan pabean tidak diakses atau diubah pihak yang tidak berhak.

#### Acceptance Criteria

1. IF permintaan ke endpoint inventory dibuat tanpa sesi aktif yang valid, THEN THE IT_Inventory_System SHALL menolak permintaan dengan status 401, mengembalikan pesan `Autentikasi diperlukan.`, dan tidak membaca maupun mengubah data inventory apa pun.
2. WHEN endpoint inventory menerima permintaan dengan sesi aktif, THE IT_Inventory_System SHALL menyaring seluruh operasi baca dan tulis inventory berdasarkan `workspace_id` dari workspace dengan slug `default`.
3. IF permintaan menyertakan `workspace_id` selain workspace aktif, THEN THE IT_Inventory_System SHALL menolak permintaan dengan status 403, mengembalikan kode error `WORKSPACE_FORBIDDEN`, dan tidak mengembalikan maupun mengubah data inventory dari workspace lain.
4. WHEN route handler inventory menerima permintaan, THE IT_Inventory_System SHALL melakukan pemeriksaan autentikasi dan otorisasi di dalam route handler itu sendiri sebelum mengakses data, karena tidak ada layer otorisasi global (`middleware.ts`) yang berjalan.
5. WHILE kebijakan peran tulis belum ditegakkan secara granular di repo (gap G-1), THE IT_Inventory_System SHALL mengizinkan seluruh pengguna sesi aktif melakukan operasi baca dan tulis inventory, dengan struktur guard route handler yang siap diperketat ke pembatasan berbasis peran bila kebijakan tersebut diaktifkan.

## Asumsi & Pertanyaan Terbuka

Keputusan berikut diambil agar dokumen dapat diselesaikan; mohon dikonfirmasi atau dikoreksi:

- **A-1 (Sumber item — manual vs turunan pipeline):** Masih terbuka. Ketika ditanya, jawaban yang
  diberikan berfokus pada dokumen BC penggerak stok, belum menegaskan apakah Item Inventory dibuat
  manual atau diturunkan otomatis dari data CIPL/Shipment/Customs Job yang sudah ada. Dokumen ini
  mengasumsikan **input manual** pada iterasi pertama, dengan kemungkinan ditautkan ke entitas
  pipeline yang ada belakangan. Konfirmasikan arah yang diinginkan.
- **A-2 (Basis pelacakan — kuantitas vs nilai):** Diasumsikan saldo dilacak murni berdasarkan
  **kuantitas** per item; `nilaiPabean` disimpan sebagai atribut referensi, bukan sebagai saldo
  terpisah. Konfirmasikan bila Bea Cukai juga mewajibkan rekonsiliasi saldo berbasis nilai pabean
  untuk perhitungan bea masuk terutang.
- **A-3 (Kategori/alasan penyesuaian):** Diasumsikan `PENYESUAIAN` memakai `reason` teks bebas.
  Konfirmasikan daftar kategori penyesuaian baku yang diharapkan Bea Cukai (mis. selisih stock
  opname, kerusakan, kehilangan, pemusnahan).
- **A-4 (Format periode & layout laporan resmi):** Diasumsikan laporan saldo memakai periode
  `periodStart`–`periodEnd` bebas dan layout kolom standar (saldo awal, masuk, keluar, penyesuaian,
  saldo akhir). Konfirmasikan bila layout laporan resmi tertentu — mis. laporan pertanggungjawaban /
  WIP mutasi gaya **BCL 1.2** — harus dicocokkan persis.
- **A-5 (Jenis dokumen pengeluaran):** Diasumsikan pengeluaran hanya melalui `BC_2_5` (barang
  digunakan) dan `BC_3_0` (ekspor/re-ekspor). Konfirmasikan bila ada jenis dokumen pengeluaran lain
  yang berlaku (mis. BC 2.7 pemindahan antar-TPB, BC 4.0, pemusnahan).
- **A-6 (Otorisasi peran):** Saat ini hanya `isAdmin` yang ditegakkan secara global (gap G-1).
  Requirement 8.5 mengasumsikan semua pengguna login boleh menulis seperti fitur lain. Konfirmasikan
  bila buku stok kawasan berikat perlu pembatasan peran khusus (mis. hanya peran tertentu yang boleh
  mencatat pengeluaran atau penyesuaian).
