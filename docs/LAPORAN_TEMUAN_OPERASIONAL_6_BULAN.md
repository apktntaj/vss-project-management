# Laporan Temuan Operasional VSS — Analisis Percakapan Enam Bulan

**Periode analisis:** 18 Februari–18 Agustus 2026  
**Sumber:** Ekspor percakapan WhatsApp operasional VSS  
**Tanggal laporan:** 3 September 2026  
**Pendekatan:** Data-first discovery  

## 1. Ringkasan Eksekutif

Percakapan operasional VSS menunjukkan bahwa masalah utama yang perlu diselesaikan bukan sekadar pelacakan status shipment. WhatsApp saat ini berfungsi sebagai pusat kendali operasional untuk menerima permintaan, menyusun jadwal, memilih kendaraan, menugaskan driver dan tenaga operasional, memastikan kesiapan dokumen, mengarahkan perpindahan barang, menangani perubahan, dan mengumpulkan bukti pekerjaan.

Satu pekerjaan biasanya tidak berjalan sebagai daftar tahapan linear. Pekerjaan dapat memiliki beberapa perjalanan, lokasi, barang, personel, dokumen, dan ketergantungan yang berlangsung paralel. Rencana juga sering berubah ketika barang belum siap, dokumen belum terbit, kendaraan tidak sesuai, gudang penuh, atau jadwal pihak eksternal bergeser.

Kesimpulan utama laporan ini adalah bahwa fondasi produk sebaiknya berupa **data operasional terstruktur dan riwayat kejadian**, bukan sekadar halaman job dan kolom status. Produk yang lebih sesuai adalah sebuah **Operational Control Tower** yang memberikan satu sumber kebenaran untuk permintaan kerja, barang, jadwal, sumber daya, dokumen, eksekusi, dan bukti penyelesaian.

## 2. Tujuan Analisis

Analisis ini bertujuan untuk:

1. Memahami pekerjaan nyata yang dikoordinasikan melalui WhatsApp.
2. Mengidentifikasi informasi yang dibutuhkan untuk menjalankan pekerjaan.
3. Menemukan sumber keterlambatan, salah komunikasi, dan pengerjaan ulang.
4. Menentukan data minimum yang harus disimpan oleh sistem.
5. Menjadi dasar revisi PRD, arsitektur, dan prioritas implementasi.

Analisis ini tidak dimaksudkan untuk menilai performa individu. Nama, nomor telepon, dan informasi pribadi tidak direproduksi dalam laporan.

## 3. Cakupan dan Metode

Enam bulan dihitung mundur dari tanggal terakhir dalam ekspor percakapan, yaitu 18 Agustus 2026. Dengan demikian, periode analisis dimulai pada 18 Februari 2026.

### 3.1 Profil data

| Metrik | Nilai |
|---|---:|
| Entri pesan bertanggal | 8.757 |
| Baris konten, termasuk kelanjutan pesan multiline | 10.644 |
| Hari aktif | 174 dari 182 hari kalender |
| Identitas pengirim yang terdeteksi | 62 |
| Penanda media yang tidak disertakan dalam ekspor | 2.945 |
| Pesan bertanda diedit | 60 |
| Pesan bertanda dihapus | 117 |
| Baris yang memuat tautan | 31 |

### 3.2 Indikasi tema berdasarkan kata kunci

Penghitungan berikut bersifat indikatif. Variasi ejaan, singkatan, pesan multiline, dan konteks percakapan membuat angka ini tidak dapat diperlakukan sebagai jumlah pekerjaan unik.

| Tema | Perkiraan kemunculan |
|---|---:|
| Foto/media | 2.900+ |
| Rencana untuk “besok” | 350 |
| Mobil/truk/fuso dan kendaraan sejenis | 290 |
| Muat/loading | 270 |
| Ambil/pickup | 220 |
| Driver/supir | 150 |
| Gudang | 150 |
| Informasi belum tersedia | 148 |
| PIC/kontak | 146 |
| Menunggu suatu prasyarat | 89 |
| Dimensi/ukuran/berat | 75 |
| Alamat/lokasi/peta | 67 |
| Dokumen/surat jalan | 52 |
| FO | 51 |
| Perubahan/revisi/pengunduran | 46 |
| Pembatalan/tidak jadi | 41 |

### 3.3 Keterbatasan data

- Lampiran asli tidak tersedia; ekspor hanya menampilkan `<Media omitted>`.
- Satu pekerjaan dapat dibahas di banyak pesan dan oleh banyak pengirim.
- Tidak ada ID pekerjaan konsisten yang menghubungkan seluruh percakapan.
- Nama klien, event, shipment, dan lokasi ditulis dengan banyak variasi.
- Pesan dapat diedit atau dihapus sehingga kondisi historis tidak selalu lengkap.
- Sebagian instruksi dikirim melalui chat pribadi, telepon, atau lampiran di luar sumber data.
- Frekuensi kata tidak identik dengan jumlah kasus atau tingkat dampaknya.

## 4. Cara Kerja Operasional Saat Ini

Alur yang berulang dari percakapan dapat diringkas sebagai berikut:

```text
Permintaan masuk
  → detail barang dan jadwal dikumpulkan
  → dokumen dan izin diperiksa
  → kendaraan, driver, manpower, dan alat dicari
  → rute atau urutan perjalanan disusun
  → barang disiapkan dan dimuat
  → pekerjaan dijalankan di lapangan
  → status dilaporkan melalui chat
  → foto/surat jalan/tanda terima dikirim
  → bukti dipakai untuk konfirmasi dan penagihan
```

Alur tersebut jarang sepenuhnya berurutan. Penjadwalan sering dimulai ketika FO, dimensi, alamat, atau dokumen belum lengkap. Akibatnya, dispatcher harus terus mengoreksi rencana selama pekerjaan berlangsung.

## 5. Temuan Utama

### 5.1 WhatsApp menjadi database sekaligus dispatch board

Informasi master, instruksi, perubahan, diskusi, status lapangan, foto, dan keputusan bercampur dalam satu aliran kronologis. Informasi lama cepat tertutup oleh pesan baru dan tidak ada tampilan kondisi operasional terkini.

Konsekuensinya:

- Dispatcher mengandalkan ingatan dan membaca ulang chat.
- Anggota tim dapat mengambil instruksi dari versi yang sudah tidak berlaku.
- Sulit menjawab pertanyaan sederhana seperti “barang ini sekarang ada di mana?” atau “siapa yang sedang membawa kendaraan ini?”.
- Serah terima pekerjaan antarshift atau antarpegawai menjadi rapuh.

### 5.2 Permintaan kerja masuk dalam keadaan belum lengkap

Permintaan driver sering muncul sebelum FO, alamat, jumlah barang, dimensi, atau jadwal pasti tersedia. Informasi tambahan kemudian dikirim dalam pesan terpisah.

Data yang paling sering terpisah meliputi:

- Klien, project, atau event terkait.
- Jenis aktivitas.
- Waktu pickup dan batas waktu tiba.
- Lokasi asal, tujuan, PIC, dan nomor kontak.
- Jumlah koli, berat, dimensi, serta kondisi kemasan.
- Kebutuhan kendaraan, forklift, hand pallet, dan manpower.
- Dokumen atau izin yang wajib tersedia.

Tanpa struktur request, tim tidak dapat membedakan antara permintaan baru, informasi tambahan, koreksi, dan percakapan biasa.

### 5.3 Penjadwalan sumber daya merupakan pusat masalah

Operasional bergantung pada kombinasi sumber daya:

- Driver.
- Kendaraan dengan tipe dan kapasitas berbeda.
- Tenaga bongkar muat.
- Forklift dan hand pallet.
- Petugas dokumen atau customs.
- Petugas gudang dan onsite.

Satu kendaraan atau driver sering melaksanakan beberapa aktivitas berantai pada hari yang sama. Ketika satu aktivitas terlambat, seluruh rangkaian berikutnya ikut berubah. Sistem saat ini belum memiliki kalender kapasitas atau peringatan konflik.

### 5.4 Data barang menentukan keputusan, tetapi sering terlambat

Pemilihan kendaraan dan tenaga kerja bergantung pada jumlah package, berat, dimensi, jenis barang, kemasan, dan akses lokasi. Percakapan memperlihatkan koreksi jumlah barang serta kebutuhan tambahan manpower setelah kondisi sebenarnya diketahui.

Implikasinya, cargo detail tidak boleh menjadi catatan bebas semata. Data ini harus terstruktur dan divalidasi sebelum request dinyatakan siap dijadwalkan.

### 5.5 Rencana berubah dengan frekuensi tinggi

Tujuan, jadwal, jumlah barang, kendaraan, dan personel dapat berubah setelah penugasan dibuat. Ada pula pekerjaan yang dibatalkan setelah sumber daya disiapkan.

Sistem harus menyimpan:

- Versi rencana terkini.
- Siapa yang mengubahnya.
- Waktu perubahan.
- Nilai sebelum dan sesudah perubahan.
- Alasan perubahan.
- Pihak yang perlu diberi tahu.

Mengubah satu kolom status tanpa audit trail tidak cukup untuk kondisi ini.

### 5.6 Kesiapan dokumen adalah dependency operasional

SPPB, PEB, DO, FO, surat jalan, surat loading, gate pass, izin venue, dan bukti pembayaran gudang muncul sebagai prasyarat pekerjaan. Kendaraan dapat tertahan atau perjalanan gagal apabila dokumen belum siap.

Dokumen perlu dimodelkan sebagai checklist kesiapan dengan status, bukan hanya file upload:

```text
REQUIRED → REQUESTED → RECEIVED → VERIFIED → USED
```

Dokumen juga dapat berstatus `REJECTED`, `EXPIRED`, atau `NOT_APPLICABLE`.

### 5.7 Lokasi dan kapasitas gudang memengaruhi dispatch

Percakapan berulang kali menyebut gudang padat atau penuh. Barang berpindah antara beberapa gudang, venue, bandara, pelabuhan, lokasi klien, dan fasilitas pihak ketiga.

Sistem perlu mengetahui:

- Lokasi aktual setiap cargo/package.
- Tanggal dan waktu masuk.
- Area atau zona penyimpanan.
- Rencana keluar.
- Kapasitas lokasi.
- Penanggung jawab perpindahan.

Tanpa data lokasi aktual, tim berisiko mengirim kendaraan ke gudang yang salah atau mencari barang pada saat loading.

### 5.8 Bukti pekerjaan tidak terhubung dengan aktivitas

Foto, tanda terima, surat jalan bertanda tangan, dan dokumentasi loading dikirim sebagai media di grup. Bukti tersebut tidak otomatis terkait dengan pekerjaan, perjalanan, barang, atau kebutuhan penagihan.

Setiap bukti sebaiknya memiliki relasi terhadap aktivitas tertentu, tipe bukti, pembuat, waktu, lokasi, dan status verifikasi.

### 5.9 Status tunggal tidak menggambarkan kondisi nyata

Status generik seperti `IN_PROGRESS` tidak dapat menjelaskan apakah pekerjaan sedang menunggu dokumen, mencari kendaraan, menuju lokasi, loading, atau tertahan di gudang.

Operasional memerlukan dua dimensi yang dipisahkan:

1. **Execution status:** posisi pekerjaan dalam proses pelaksanaan.
2. **Readiness/blocker status:** apakah pekerjaan dapat maju dan apa penghambatnya.

## 6. Rumusan Masalah Produk

VSS membutuhkan satu sumber data operasional yang mampu mengubah permintaan tidak terstruktur menjadi rencana kerja yang dapat dijalankan, mengalokasikan sumber daya tanpa konflik, menunjukkan lokasi dan kondisi barang, mengelola dependency dokumen, menyebarkan perubahan secara jelas, serta mengikat bukti pelaksanaan dengan pekerjaan dan penagihan.

Keberhasilan produk tidak cukup diukur dari banyaknya job yang tercatat. Produk harus mengurangi:

- Waktu mencari informasi di chat.
- Penugasan kendaraan atau driver yang bentrok.
- Perjalanan yang sia-sia akibat barang/dokumen belum siap.
- Kesalahan tujuan, jumlah, atau jenis kendaraan.
- Bukti pekerjaan yang hilang.
- Pekerjaan selesai tetapi belum dapat ditagihkan.

## 7. Model Data Konseptual yang Disarankan

### 7.1 Struktur tingkat atas

```text
Customer / Agent
└── Job
    ├── Sub-job (opsional untuk job project)
    ├── Cargo
    │   └── Packages
    ├── Work Orders
    │   └── Activities / Movement Legs
    ├── Required Documents
    ├── Resource Assignments
    ├── Status Events and Blockers
    ├── Attachments / Evidence
    └── Chargeable Items
```

### 7.2 Entitas inti

#### Customer

Menyimpan pihak yang meminta atau membayar pekerjaan.

Data minimum:

- ID customer.
- Nama legal dan nama singkat.
- Tipe: client, agent, exhibitor, vendor, atau internal.
- PIC dan kanal kontak.
- Alamat tersimpan.
- Status aktif.

#### Job

Payung komersial dan operasional. Sebagian job bersifat project besar, sementara lainnya berupa shipment, pekerjaan rutin dalam kontrak, atau pekerjaan ad hoc. Customer adalah entitas terpisah dan dapat memiliki banyak job.

Data minimum:

- Nomor job.
- Parent job untuk sub-job opsional.
- Nama job/event/shipment.
- Job type: event project, shipment, contract operation, local distribution, warehousing, customs, installation, general project, atau ad hoc.
- Customer utama.
- Jenis layanan.
- PIC internal.
- Periode mulai dan selesai.
- Venue atau lokasi utama.
- Referensi eksternal: AWB, BL, container, ATA Carnet, dan sebagainya.

#### Work Order

Unit permintaan kerja konkret di dalam job yang datang dari CS, customer, agent, atau tim internal.

Data minimum:

- Nomor work order.
- Job terkait.
- Peminta dan waktu permintaan.
- Jenis aktivitas.
- Prioritas.
- Requested time window.
- Deadline.
- Instruksi.
- Status kelengkapan data.
- Status persetujuan.
- Status eksekusi.

Jenis aktivitas awal:

- Pickup.
- Delivery.
- Transfer antargudang.
- Move-in venue.
- Move-out venue.
- Customs pickup/release.
- Packing/unpacking/repacking.
- Loading/unloading.
- Warehousing.
- Survey.
- Installation.
- Document/courier task.

#### Cargo dan Package

Cargo adalah kelompok barang; package adalah unit fisiknya.

Data minimum:

- Deskripsi barang.
- Owner/customer.
- Jumlah package.
- Package type.
- Berat bruto.
- Panjang, lebar, dan tinggi.
- Volume.
- Jenis kemasan.
- Dangerous goods flag.
- Fragile/stackable flags.
- Current location.
- Foto kondisi.
- Marking atau label.

#### Location

Data minimum:

- Nama lokasi.
- Tipe: gudang, venue, airport, port, customer, vendor, atau temporary site.
- Alamat terstruktur.
- Koordinat/peta.
- PIC dan kontak.
- Jam operasional.
- Batas kendaraan.
- Loading access.
- Safety requirements.
- Kapasitas atau zona penyimpanan.

#### Activity / Movement Leg

Satu work order dapat memiliki beberapa activity atau perjalanan berurutan.

Contoh:

```text
Pickup dari bandara
→ drop sementara di gudang
→ repacking
→ delivery ke venue
→ move-out
→ return ke gudang
```

Data minimum:

- Urutan aktivitas.
- Asal dan tujuan.
- Jadwal rencana dan aktual.
- Cargo yang dibawa.
- Kebutuhan sumber daya.
- Status.
- Dependency.
- Instruksi lapangan.
- Hasil dan exception.

#### Resource

Resource mencakup kendaraan, personel, dan alat.

Data kendaraan:

- Nomor kendaraan.
- Tipe kendaraan.
- Kapasitas berat dan dimensi.
- Status availability.
- Lokasi terakhir.
- Masa berlaku dokumen.

Data personel:

- Nama dan peran.
- Kemampuan/izin, misalnya tipe SIM atau operator forklift.
- Jadwal kerja, cuti, dan availability.
- Kontak operasional.

Data alat:

- Jenis alat.
- Kapasitas.
- Kepemilikan internal/sewa.
- Lokasi.
- Availability.

#### Assignment

Menghubungkan resource dengan activity pada rentang waktu tertentu. Assignment harus dapat mendeteksi benturan jadwal dan ketidaksesuaian kapasitas.

#### Document Requirement

Data minimum:

- Jenis dokumen.
- Wajib/tidak wajib.
- Status kesiapan.
- Nomor dan tanggal dokumen.
- File.
- Penerbit/pemberi.
- Waktu verifikasi.
- Verified by.
- Masa berlaku.

#### Status Event

Setiap perubahan penting disimpan sebagai event append-only:

- Waktu kejadian.
- Entity terkait.
- Jenis event.
- Status lama dan baru.
- Aktor.
- Catatan/alasan.
- Lokasi jika tersedia.
- Sumber: web, mobile, API, atau WhatsApp.

#### Evidence

Data minimum:

- Activity terkait.
- Tipe: pickup photo, loading photo, condition photo, signed delivery order, POD, atau receipt.
- File.
- Waktu pengambilan/upload.
- Pengunggah.
- Lokasi.
- Verification status.

#### Chargeable Item

Dicatat sejak aktivitas berlangsung agar pekerjaan tidak selesai secara operasional tetapi hilang dari penagihan.

Contoh:

- Rit kendaraan.
- Overtime.
- Sewa forklift.
- Manpower tambahan.
- Storage.
- Waiting time.
- Packing material.
- Cancellation charge.

## 8. Status dan Aturan Data

### 8.1 Status work order

```text
DRAFT
NEEDS_INFORMATION
READY_TO_PLAN
PLANNED
DISPATCHED
IN_EXECUTION
COMPLETED
CANCELLED
```

### 8.2 Status activity

```text
UNASSIGNED
ASSIGNED
EN_ROUTE
ARRIVED
LOADING
IN_TRANSIT
UNLOADING
DELIVERED
POD_RECEIVED
CANCELLED
```

### 8.3 Status blocker

Blocker terpisah dari execution status dan dapat berjumlah lebih dari satu:

```text
MISSING_CARGO_DATA
CARGO_NOT_READY
WAITING_FOR_DOCUMENT
WAITING_FOR_CUSTOMS_RELEASE
WAITING_FOR_PAYMENT
WAITING_FOR_CLIENT_CONFIRMATION
WAITING_FOR_VENUE_APPROVAL
NO_DRIVER
NO_SUITABLE_VEHICLE
NO_MANPOWER
NO_EQUIPMENT
WAREHOUSE_FULL
LOCATION_CLOSED
```

### 8.4 Validasi minimum sebelum `READY_TO_PLAN`

Sebuah work order tidak boleh dianggap siap dijadwalkan jika belum memiliki:

- Peminta, job, dan customer.
- Jenis aktivitas.
- Cargo dan jumlah package.
- Berat/dimensi atau alasan resmi mengapa belum tersedia.
- Lokasi asal dan tujuan.
- Requested time window.
- PIC lokasi.
- Daftar dokumen wajib.
- Kebutuhan resource.

Pengecualian harus dapat dilakukan oleh role tertentu dan wajib mencatat alasan.

## 9. Prinsip Data yang Direkomendasikan

1. **Satu identitas untuk satu work order.** Semua chat, file, status, dan assignment harus merujuk ke nomor work order yang sama.
2. **Current state berasal dari event history.** Sistem menyimpan keadaan terkini sekaligus riwayat perubahan.
3. **Rencana dan aktual dipisahkan.** Waktu, lokasi, resource, dan jumlah rencana tidak boleh menimpa data aktual.
4. **Data yang belum diketahui dinyatakan eksplisit.** Bedakan `unknown`, `not applicable`, dan nilai kosong akibat kelalaian.
5. **Lampiran memiliki konteks.** File tidak disimpan sebagai kumpulan dokumen tanpa relasi ke work order/activity/cargo.
6. **Master data digunakan ulang.** Customer, lokasi, kendaraan, personel, dan jenis dokumen tidak diketik ulang setiap pekerjaan.
7. **Perubahan tidak menghapus sejarah.** Koreksi dan pembatalan dicatat sebagai event.
8. **Akses mengikuti kebutuhan kerja.** Data pribadi, customs, dan keuangan dibatasi berdasarkan role.
9. **Mobile-first untuk eksekusi.** Input status dan bukti harus mudah dilakukan driver dan tim lapangan.
10. **WhatsApp menjadi kanal, bukan database utama.** Pesan dapat tetap digunakan untuk notifikasi dan intake, tetapi sistem menjadi sumber kebenaran.

## 10. Prioritas Data-First

### Tahap 1 — Kamus data dan contoh nyata

- Ambil sampel 30–50 pekerjaan representatif.
- Kelompokkan pesan-pesan yang merujuk ke pekerjaan yang sama.
- Buat kamus istilah dan alias nama job, customer, lokasi, kendaraan, dan dokumen.
- Identifikasi field yang selalu tersedia, sering terlambat, dan benar-benar opsional.
- Validasi istilah bersama dispatcher, CS, gudang, dan finance.

**Output:** data dictionary, annotated sample, dan definisi satu work order.

### Tahap 2 — Master data

- Customer dan contact.
- Location dan warehouse zone.
- Personel dan capability.
- Vehicle dan equipment.
- Activity type.
- Document type.
- Job/event/shipment.

**Output:** dataset master yang bersih dan aturan deduplikasi.

### Tahap 3 — Transactional model

- Job dan work order.
- Cargo/package.
- Activity/movement leg.
- Assignment.
- Readiness requirement dan blocker.
- Event history.
- Evidence.
- Chargeable item.

**Output:** ERD, schema database, status transition, dan validation rules.

### Tahap 4 — Migrasi terbatas dan evaluasi

- Masukkan sampel pekerjaan historis secara manual atau semiotomatis.
- Uji apakah sistem dapat merekonstruksi rencana, perubahan, dan hasil aktual.
- Bandingkan informasi yang hilang dengan sumber WhatsApp.
- Perbaiki model sebelum UI operasional dibangun lebih jauh.

**Output:** seed dataset realistis dan daftar gap data.

### Tahap 5 — Intake dan operasi harian

- Form work order terstruktur.
- Board dispatcher.
- Mobile execution update.
- Reminder untuk data dan dokumen yang belum lengkap.
- Notifikasi perubahan kepada resource yang terdampak.

## 11. Pertanyaan yang Perlu Divalidasi dengan Tim

1. Apa unit kerja yang dianggap satu job untuk kebutuhan operasional dan penagihan?
2. Siapa yang berwenang menyatakan work order `READY_TO_PLAN`?
3. Apakah satu work order dapat ditagihkan ke lebih dari satu pihak?
4. Bagaimana cara tim menamai job/event dan cargo saat ini?
5. Apakah package perlu dilacak satu per satu atau cukup per kelompok cargo?
6. Seberapa detail lokasi gudang perlu dicatat: gudang, blok, zona, atau posisi rak?
7. Siapa yang mengonfirmasi barang siap, dokumen siap, dan kendaraan siap?
8. Bukti apa yang wajib sebelum activity dianggap selesai?
9. Perubahan apa yang wajib menghasilkan notifikasi?
10. Kapan waiting time, cancellation, overtime, dan resource tambahan menjadi chargeable?

## 12. Rekomendasi Keputusan

Pengembangan fitur pada model lama sebaiknya tidak diteruskan sebelum model data baru disepakati. Kode yang sudah ada dapat dipertahankan sebagai prototype antarmuka dan autentikasi, tetapi entitas `Job`, `JobStage`, dan satu `assignedTo` belum cukup untuk operasional nyata.

Data dictionary, ERD v2, dan pilot data relasional telah dibuat dari 40 sampel pekerjaan. Tahap berikutnya adalah memvalidasi kandidat master data bersama tim, menyelesaikan keputusan terbuka, lalu menerjemahkan model yang disetujui menjadi schema database v2. Setelah itu baru ditentukan MVP UI, API, dan strategi integrasi WhatsApp.
