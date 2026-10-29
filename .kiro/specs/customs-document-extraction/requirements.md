# Requirements Document

## Introduction

Fitur **Customs Document Extraction** memungkinkan pengguna mengunggah dokumen pabean sebuah
shipment lalu mengekstrak isinya secara otomatis sehingga pengguna tidak perlu mengetik form secara
manual. Tujuannya mengurangi beban kerja dan potensi kesalahan input.

Ekstraksi berjalan dua lapis. Lapis pertama bersifat **deterministik**: parser Excel, parser teks
PDF, dan OCR untuk PDF hasil pindaian, tanpa memanggil model bahasa. Setiap hasil deterministik
disertai skor keyakinan (confidence). Lapis kedua bersifat **opsional**: pilihan eksplisit untuk
mengekstrak ulang dengan LLM yang **selalu tersedia** sebagai pilihan pengguna untuk dokumen yang
berada dalam lingkup ekstraksi, terlepas dari tinggi atau rendahnya confidence. LLM tidak pernah
dipanggil otomatis — pengguna harus memilihnya. Confidence tidak mengatur kemunculan opsi LLM;
confidence hanya dipakai untuk menandai field dan jenis dokumen yang perlu ditinjau pengguna secara
visual. LLM dipanggil melalui satu **provider LLM terkonfigurasi** (GEMINI, CLAUDE, DEEPSEEK, dll)
memakai kunci API provider tersebut; jika tidak ada provider LLM yang dikonfigurasi, pilihan LLM
dinonaktifkan dengan pesan yang jelas.

Fitur ini menyentuh **pipeline baru** `CIPL → Shipment → CustomsJob`, bukan Legacy Job. Satu
shipment memiliki dua jenis dokumen mandatory yang diketahui pengguna: dokumen **CIPL** dan satu
dokumen transport (**B/L** atau **AWB**). CIPL dapat berupa satu dokumen gabungan, atau dua dokumen
terpisah (Packing List + Commercial Invoice) yang digabung menjadi satu hasil CIPL. Sistem
memvalidasi kelengkapan dokumen mandatory per shipment.

Lingkup ekstraksi saat ini terbatas pada dokumen **CIPL** (CIPL gabungan, Packing List, Commercial
Invoice) dan **Transport_Document** (B/L atau AWB). Dokumen lain bersifat kondisional dan opsional:
diperlakukan sebagai **dokumen pendukung** yang hanya diunggah dan disimpan sebagai attachment,
tanpa ekstraksi deterministik, tanpa klasifikasi ke jenis spesifik, dan tanpa opsi LLM. Jenis
dokumen pendukung tidak dienumerasi sehingga jenis baru di kemudian hari dapat disimpan tanpa
perubahan skema.

Fitur ini membangun di atas kode yang sudah ada: `lib/server/document-extraction.ts`
(`extractDocument`), tipe hasil di `domain/exhibition/source-documents.ts`, dan batas unggah 10 MB.
Jalur ekstraksi LLM-only yang ada saat ini direposisikan menjadi lapis opsional di belakang jalur
deterministik.

Requirement memakai format EARS. Teks untuk pengguna dan pesan error memakai bahasa Indonesia;
identifier, enum, kode error, nama tabel/kolom memakai bahasa Inggris `SCREAMING_SNAKE_CASE`.

## Glossary

- **System**: Fitur ekstraksi dokumen pabean VSS secara keseluruhan.
- **Extraction_Service**: Modul `server-only` yang menjalankan ekstraksi deterministik dan, bila
  diminta, ekstraksi LLM; hidup di `lib/server/`.
- **Route_Handler**: Endpoint `app/api/**/route.ts` yang menjaga otentikasi sendiri dan memvalidasi
  input dengan Zod sebelum memanggil modul server-only.
- **Data_Client**: Modul `'use client'` `lib/data-client.ts`, satu-satunya pintu masuk data dari UI
  ke Route_Handler.
- **Attachment_Store**: Bucket privat `attachments` di Supabase Storage; file dirujuk lewat id
  melalui `/api/attachments`.
- **CIPL**: Combined Invoice & Packing List — kumpulan barang satu exhibitor sebagai dasar shipment.
  Dalam fitur ini merujuk pada hasil gabungan Packing List + Commercial Invoice, baik dari satu
  dokumen gabungan maupun dua dokumen terpisah.
- **Packing_List**: Dokumen yang merinci kemasan, kuantitas, berat, dan deskripsi barang tanpa nilai
  komersial.
- **Commercial_Invoice**: Dokumen yang merinci nilai komersial barang (harga satuan, total, mata
  uang, incoterm, penjual, pembeli).
- **BL**: Bill of Lading — dokumen transport untuk pengangkutan laut; satu shipment memegang tepat
  satu B/L atau satu AWB.
- **AWB**: Air Waybill — dokumen transport untuk pengangkutan udara.
- **Transport_Document**: B/L atau AWB.
- **Extractable_Document**: Dokumen yang berada dalam lingkup ekstraksi — yaitu CIPL (CIPL_COMBINED,
  PACKING_LIST, COMMERCIAL_INVOICE) dan Transport_Document (BILL_OF_LADING, AIR_WAYBILL). Hanya
  dokumen ini yang menjalani Deterministic_Extraction dan berhak atas opsi LLM_Extraction.
- **Supporting_Document**: Dokumen pendukung selain Extractable_Document; bersifat kondisional,
  opsional, dan open-ended. Hanya diunggah dan disimpan sebagai attachment, tanpa ekstraksi,
  klasifikasi ke jenis spesifik, maupun opsi LLM. Jenisnya tidak dienumerasi (label bebas atau
  kategori generik) sehingga jenis baru dapat disimpan tanpa perubahan skema. Bukan bagian dari
  Mandatory_Document_Set.
- **Deterministic_Extraction**: Ekstraksi tanpa LLM — parser Excel (XLSX), parser teks PDF, atau OCR
  untuk PDF hasil pindaian.
- **OCR**: Optical Character Recognition — pengenalan teks dari PDF hasil pindaian yang tidak memuat
  lapisan teks.
- **LLM_Provider**: Penyedia model bahasa yang dikonfigurasi untuk LLM_Extraction, dipilih dari
  himpunan terbuka (mis. `GEMINI | CLAUDE | DEEPSEEK`) melalui variabel `LLM_PROVIDER`, diakses
  memakai kunci API provider tersebut (`LLM_API_KEY`). `GEMINI_API_KEY` lama dapat menjadi salah satu
  sumber kredensial di belakang abstraksi provider ini.
- **LLM_Extraction**: Ekstraksi memakai LLM_Provider yang dikonfigurasi (mis. GEMINI, CLAUDE,
  DEEPSEEK) melalui kunci API provider LLM.
- **Confidence_Score**: Angka 0–1 yang menyatakan tingkat keyakinan hasil ekstraksi, per field dan
  agregat per dokumen.
- **Confidence_Threshold**: Ambang `CONFIDENCE_THRESHOLD` (0–1) yang dipakai hanya untuk menandai
  field dan jenis dokumen yang perlu ditinjau pengguna secara visual; ambang ini TIDAK memicu atau
  mengatur kemunculan opsi LLM_Extraction.
- **Extraction_Result**: Objek hasil ekstraksi berisi klasifikasi dokumen, field invoice/transport
  yang terisi, dan Confidence_Score per field.
- **Document_Classification**: Jenis dokumen terklasifikasi:
  `CIPL_COMBINED | PACKING_LIST | COMMERCIAL_INVOICE | BILL_OF_LADING | AIR_WAYBILL | SUPPORTING_DOCUMENT | UNREADABLE`.
- **Mandatory_Document_Set**: Himpunan dokumen wajib per shipment — satu CIPL (gabungan, atau Packing
  List + Commercial Invoice) dan satu Transport_Document. Supporting_Document tidak termasuk.
- **CurrentUser**: Pemohon terautentikasi `{ id, workspaceId }` yang diturunkan dari sesi via
  `getEventApiContext()`.

## Requirements

### Requirement 1: Unggah Dokumen Pabean ke Shipment

**User Story:** Sebagai staf operasional, saya ingin mengunggah dokumen pabean ke sebuah shipment
atau CIPL version, agar dokumen tersimpan aman dan siap diekstrak.

#### Acceptance Criteria

1. WHEN CurrentUser mengunggah satu file berukuran 1 byte sampai 10 MB bertipe PDF atau Excel untuk
   sebuah shipment dengan `ownerType` bernilai `SHIPMENT` atau `CIPL_VERSION` dan `ownerId` yang
   merujuk entitas yang ada, THE Route_Handler SHALL menyimpan file ke Attachment_Store dan
   mengembalikan respons berisi id attachment dengan status 201.
2. IF permintaan unggah tidak membawa sesi terautentikasi, THEN THE Route_Handler SHALL menolak
   permintaan dengan status 401, kode error `UNAUTHENTICATED`, dan pesan `Autentikasi diperlukan.`,
   tanpa menulis apa pun ke Attachment_Store.
3. IF `ownerType` yang dikirim bukan `SHIPMENT` maupun `CIPL_VERSION`, THEN THE Route_Handler SHALL
   menolak permintaan dengan status 400, kode error `UNSUPPORTED_OWNER_TYPE`, dan pesan `Tipe pemilik
   dokumen tidak didukung.`, tanpa menulis apa pun ke Attachment_Store.
4. IF `ownerId` kosong atau tidak merujuk entitas `SHIPMENT` atau `CIPL_VERSION` yang ada, THEN THE
   Route_Handler SHALL menolak permintaan dengan status 400, kode error `OWNER_NOT_FOUND`, dan pesan
   `Pemilik dokumen tidak ditemukan.`, tanpa menulis apa pun ke Attachment_Store.
5. IF file yang diunggah memiliki tipe MIME selain `application/pdf`, `application/vnd.ms-excel`,
   atau `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, THEN THE Route_Handler
   SHALL menolak permintaan dengan status 400, kode error `UNSUPPORTED_FILE_TYPE`, dan pesan `File
   harus berupa PDF atau Excel.`, tanpa menulis apa pun ke Attachment_Store.
6. IF ukuran file melebihi 10 MB (10.485.760 byte), THEN THE Route_Handler SHALL menolak permintaan
   dengan status 413, kode error `FILE_TOO_LARGE`, dan pesan `Ukuran dokumen melebihi batas 10 MB.`,
   tanpa menulis apa pun ke Attachment_Store.
7. IF permintaan unggah tidak menyertakan file, THEN THE Route_Handler SHALL menolak permintaan
   dengan status 400, kode error `FILE_REQUIRED`, dan pesan `File dokumen wajib diunggah.`, tanpa
   menulis apa pun ke Attachment_Store.
8. THE Route_Handler SHALL memvalidasi tipe MIME file, ukuran file, keberadaan file, nilai
   `ownerType`, dan keberadaan `ownerId` di sisi server sebelum menulis ke Attachment_Store, tanpa
   bergantung pada hasil validasi browser.
9. WHEN sebuah file berhasil tersimpan, THE Data_Client SHALL merujuk file tersebut lewat id
   attachment dan TIDAK menyimpan nilai `Blob` maupun `File` pada entitas domain.
10. IF penulisan ke Attachment_Store gagal, THEN THE Route_Handler SHALL menolak permintaan dengan
    status 503, kode error `ATTACHMENT_STORE_UNAVAILABLE`, dan pesan `Gagal menyimpan dokumen.
    Silakan coba lagi.`, serta TIDAK mempertahankan artefak file parsial di Attachment_Store.
11. WHERE CurrentUser mengunggah sebuah Supporting_Document ke sebuah shipment, THE Route_Handler
    SHALL menerima label atau jenis dokumen sebagai teks bebas atau kategori generik, menyimpan file
    sebagai attachment tanpa menjalankan ekstraksi, dan TIDAK mewajibkan CurrentUser memilih jenis
    dokumen dari daftar tertutup, sehingga jenis dokumen pendukung baru dapat disimpan tanpa
    perubahan skema.

### Requirement 2: Ekstraksi Deterministik dengan Skor Keyakinan

**User Story:** Sebagai staf operasional, saya ingin dokumen diekstrak lebih dulu tanpa LLM, agar
hasil cepat, dapat diprediksi, dan tidak bergantung pada layanan eksternal.

#### Acceptance Criteria

1. WHEN CurrentUser meminta ekstraksi sebuah Extractable_Document, THE Extraction_Service SHALL
   menjalankan Deterministic_Extraction terlebih dahulu sebelum opsi LLM_Extraction manapun.
2. WHERE sebuah dokumen bukan Extractable_Document (yaitu bukan CIPL maupun Transport_Document), THE
   Extraction_Service SHALL memperlakukannya sebagai Supporting_Document, tidak menjalankan
   Deterministic_Extraction maupun LLM_Extraction, dan hanya menyimpannya sebagai attachment.
3. WHERE dokumen berformat Excel, THE Extraction_Service SHALL mengekstrak isi memakai parser XLSX.
4. WHERE dokumen berformat PDF dan memuat lapisan teks, THE Extraction_Service SHALL mengekstrak teks
   dari lapisan teks PDF tersebut.
5. WHERE dokumen berformat PDF hasil pindaian tanpa lapisan teks, THE Extraction_Service SHALL
   menjalankan OCR untuk memperoleh teks dengan batas waktu maksimum 30 detik per dokumen.
6. WHEN Deterministic_Extraction selesai, THE Extraction_Service SHALL menghasilkan Extraction_Result
   yang memuat satu Confidence_Score per field dan satu Confidence_Score agregat per dokumen, dengan
   setiap Confidence_Score bernilai desimal dari 0.00 sampai 1.00.
7. THE Extraction_Service SHALL menjalankan Deterministic_Extraction di modul `server-only` dan TIDAK
   mengekspos pustaka atau kunci apa pun ke bundel browser.
8. IF Deterministic_Extraction tidak menemukan satu pun field yang dapat dibaca, THEN THE
   Extraction_Service SHALL menetapkan Confidence_Score agregat bernilai 0.00 dan menandai dokumen
   dengan status keyakinan LOW_CONFIDENCE.
9. WHEN Extraction_Service menghitung Confidence_Score agregat, THE Extraction_Service SHALL menandai
   dokumen sebagai LOW_CONFIDENCE jika skor agregat kurang dari 0.50, MEDIUM_CONFIDENCE jika skor
   dari 0.50 sampai kurang dari 0.80, dan HIGH_CONFIDENCE jika skor sama dengan atau lebih dari 0.80.
10. IF ukuran dokumen melebihi 10 MB, THEN THE Extraction_Service SHALL menolak permintaan ekstraksi,
    tidak menjalankan Deterministic_Extraction, dan mengembalikan pesan kesalahan dalam bahasa
    Indonesia yang menyatakan ukuran dokumen melebihi batas 10 MB.
11. IF Deterministic_Extraction gagal karena dokumen rusak, OCR gagal, atau batas waktu OCR
    terlampaui, THEN THE Extraction_Service SHALL menghentikan proses tanpa menyimpan
    Extraction_Result parsial dan mengembalikan pesan kesalahan dalam bahasa Indonesia yang
    mengindikasikan ekstraksi gagal beserta penyebabnya.

### Requirement 3: Opsi Ekstraksi LLM (Selalu Tersedia, Opt-in)

**User Story:** Sebagai staf operasional, saya ingin dapat memilih sendiri kapan menggunakan LLM
kapan pun untuk dokumen yang diekstrak, agar saya mengendalikan biaya dan tetap mengontrol kualitas
hasil.

#### Acceptance Criteria

1. WHERE sebuah dokumen merupakan Extractable_Document, THE System SHALL selalu menyediakan pilihan
   eksplisit `Ekstrak ulang dengan LLM` kepada CurrentUser, terlepas dari tinggi atau rendahnya
   Confidence_Score dokumen tersebut.
2. WHERE sebuah dokumen bukan Extractable_Document, THE System SHALL tidak menampilkan pilihan
   `Ekstrak ulang dengan LLM` karena dokumen tersebut tidak berada dalam lingkup ekstraksi.
3. THE System SHALL menjalankan LLM_Extraction hanya WHEN CurrentUser memilih `Ekstrak ulang dengan
   LLM`, dan TIDAK menjalankannya secara otomatis sebagai fallback maupun berdasarkan
   Confidence_Score.
4. IF tidak ada LLM_Provider yang dikonfigurasi, THEN THE System SHALL menonaktifkan pilihan `Ekstrak
   ulang dengan LLM` sehingga tidak dapat dipicu dan menampilkan pesan `Ekstraksi LLM tidak tersedia
   karena belum ada penyedia LLM yang dikonfigurasi.`
5. IF CurrentUser meminta LLM_Extraction sedangkan tidak ada LLM_Provider yang dikonfigurasi, THEN
   THE Route_Handler SHALL menolak permintaan dengan status 503, mengembalikan kode kesalahan
   `LLM_EXTRACTION_UNAVAILABLE` dengan pesan `Ekstraksi LLM tidak tersedia karena belum ada penyedia
   LLM yang dikonfigurasi.`, dan mempertahankan Extraction_Result deterministik yang ada tanpa
   perubahan.
6. WHEN LLM_Extraction selesai dalam batas waktu 30 detik, THE System SHALL menyajikan hasil LLM
   sebagai Extraction_Result yang dapat menggantikan hasil deterministik, disertai Confidence_Score
   (nilai pecahan 0.00 sampai 1.00) untuk setiap field.
7. IF LLM_Extraction gagal atau melampaui batas waktu 30 detik, THEN THE Route_Handler SHALL menolak
   permintaan dengan status 503, mengembalikan kode kesalahan `LLM_EXTRACTION_FAILED` dengan pesan
   yang menyatakan ekstraksi LLM gagal, dan mempertahankan Extraction_Result deterministik yang ada
   tanpa perubahan.

### Requirement 4: Klasifikasi Jenis Dokumen dan Pemetaan ke CIPL vs Shipment

**User Story:** Sebagai staf operasional, saya ingin sistem mengenali jenis dokumen yang saya unggah,
agar hasilnya terpetakan ke tempat yang benar (CIPL atau shipment) tanpa saya pilah manual.

#### Acceptance Criteria

1. WHEN sebuah dokumen selesai diproses, THE Extraction_Service SHALL mengklasifikasikan dokumen ke
   tepat satu nilai Document_Classification dari himpunan tertutup {`CIPL_COMBINED`, `PACKING_LIST`,
   `COMMERCIAL_INVOICE`, `BILL_OF_LADING`, `AIR_WAYBILL`, `SUPPORTING_DOCUMENT`, `UNREADABLE`} dalam
   waktu maksimal 30 detik sejak dokumen diterima.
2. WHERE Document_Classification bernilai `CIPL_COMBINED`, `PACKING_LIST`, atau `COMMERCIAL_INVOICE`,
   THE System SHALL memetakan hasil ekstraksi ke CIPL version.
3. WHERE Document_Classification bernilai `BILL_OF_LADING` atau `AIR_WAYBILL`, THE System SHALL
   memetakan hasil ekstraksi ke shipment sebagai Transport_Document.
4. WHERE sebuah dokumen tidak dikenali sebagai salah satu Extractable_Document (yaitu bukan CIPL
   maupun Transport_Document) dan bukan dokumen yang dimaksudkan CurrentUser sebagai CIPL atau
   Transport_Document, THE System SHALL mengklasifikasikannya sebagai `SUPPORTING_DOCUMENT`,
   menyimpannya sebagai attachment tanpa ekstraksi, dan tidak memetakannya ke CIPL version maupun
   Transport_Document.
5. IF Document_Classification bernilai `UNREADABLE` untuk dokumen yang dimaksudkan CurrentUser sebagai
   CIPL atau Transport_Document, THEN THE System SHALL membatalkan pemetaan, mempertahankan dokumen
   unggahan tanpa perubahan, dan menampilkan pesan `Dokumen tidak dapat dibaca. Unggah ulang dengan
   kualitas lebih baik atau isi form manual.`
6. WHEN klasifikasi sebuah Extractable_Document menghasilkan Confidence_Score di bawah
   Confidence_Threshold senilai 0,70 pada skala 0,00 sampai 1,00, THE System SHALL menandai jenis
   dokumen berstatus `NEEDS_USER_CONFIRMATION` dan menahan pemetaan otomatis sampai CurrentUser
   mengonfirmasi atau mengoreksi jenis dokumen.
7. IF proses klasifikasi sebuah Extractable_Document gagal karena layanan ekstraksi tidak tersedia
   atau melewati batas 30 detik, THEN THE System SHALL membatalkan pemetaan, mempertahankan dokumen
   unggahan tanpa perubahan, dan menampilkan pesan yang menyatakan klasifikasi gagal serta
   menyarankan CurrentUser mencoba ulang atau mengisi form manual.

### Requirement 5: CIPL Gabungan atau Dua Dokumen Terpisah

**User Story:** Sebagai staf operasional, saya ingin memasukkan CIPL baik sebagai satu dokumen
gabungan maupun sebagai Packing List dan Commercial Invoice terpisah, agar sesuai dengan dokumen yang
dikirim exhibitor.

#### Acceptance Criteria

1. WHERE CurrentUser mengunggah satu dokumen berklasifikasi `CIPL_COMBINED`, THE System SHALL
   menghasilkan tepat satu hasil CIPL dari dokumen tunggal tersebut.
2. WHERE CurrentUser mengunggah tepat satu dokumen `PACKING_LIST` dan tepat satu dokumen
   `COMMERCIAL_INVOICE` untuk satu CIPL, THE System SHALL menggabungkan keduanya menjadi tepat satu
   hasil CIPL.
3. WHEN Packing List dan Commercial Invoice digabung, THE System SHALL menggabungkan baris barang
   yang memiliki deskripsi identik (setelah normalisasi spasi berurutan menjadi satu spasi dan huruf
   diperlakukan tanpa membedakan besar-kecil) dan kuantitas sama menjadi satu baris, serta
   mempertahankan nilai komersial dari Commercial Invoice pada baris hasil gabungan.
4. IF baris barang pada Packing List tidak dapat dipadankan dengan baris mana pun pada Commercial
   Invoice berdasarkan deskripsi dan kuantitas, THEN THE System SHALL menolak penggabungan,
   mempertahankan kedua dokumen unggahan tanpa membuat CIPL version, dan menampilkan pesan error yang
   menunjukkan bahwa baris barang tidak dapat dipadankan.
5. IF CurrentUser mengunggah kombinasi dokumen yang bukan salah satu dari (a) tepat satu
   `CIPL_COMBINED`, atau (b) tepat satu `PACKING_LIST` dan tepat satu `COMMERCIAL_INVOICE` untuk satu
   CIPL, THEN THE System SHALL menolak unggahan tanpa membuat CIPL version dan menampilkan pesan
   `CIPL membutuhkan Packing List dan Commercial Invoice, atau satu dokumen CIPL gabungan.`
6. WHEN hasil CIPL terbentuk, THE Route_Handler SHALL mempersist hasil sebagai CIPL version yang
   immutable dan memvalidasi invariant alokasi di sisi server.
7. IF validasi invariant alokasi di sisi server gagal saat persist hasil CIPL, THEN THE Route_Handler
   SHALL membatalkan persist sehingga tidak ada CIPL version yang tersimpan dan menampilkan pesan
   error yang menunjukkan invariant alokasi yang dilanggar.

### Requirement 6: Pre-fill Form dari Hasil Ekstraksi

**User Story:** Sebagai staf operasional, saya ingin form terisi otomatis dari hasil ekstraksi dan
tetap bisa saya koreksi, agar saya tidak mengetik dari nol namun tetap mengontrol kebenaran data.

#### Acceptance Criteria

1. WHEN Extraction_Result tersedia, THE System SHALL mengisi setiap field form yang memiliki field
   bersesuaian di Extraction_Result dari Extraction_Result, dan membiarkan field form tanpa nilai
   bersesuaian dalam keadaan kosong.
2. WHILE form terisi dari Extraction_Result, THE System SHALL mengizinkan CurrentUser menyunting
   setiap field yang terisi maupun kosong sebelum menyimpan.
3. WHERE sebuah field memiliki Confidence_Score di bawah Confidence_Threshold 0,70 (dalam rentang
   0,00 sampai 1,00), THE System SHALL menandai field tersebut secara visual sebagai perlu ditinjau
   dengan indikator yang dapat diakses pembaca layar (aria).
4. THE System SHALL TIDAK mempersist data apa pun ke penyimpanan sebelum CurrentUser menekan tombol
   simpan.
5. WHEN CurrentUser menekan simpan, THE Route_Handler SHALL memvalidasi input dengan Zod sebelum
   mempersist.
6. IF input yang disimpan tidak lolos validasi Zod, THEN THE Route_Handler SHALL menolak permintaan
   dengan status 400, tidak mempersist data apa pun, dan mengembalikan pesan bahasa Indonesia
   spesifik per field yang gagal.
7. WHEN penyimpanan berhasil, THE System SHALL menampilkan notifikasi (toast) sukses di kanan bawah
   viewport dan menutupnya otomatis setelah 4 detik.
8. IF penyimpanan gagal, THEN THE System SHALL menampilkan notifikasi (toast) gagal di kanan bawah
   viewport yang mengindikasikan kegagalan penyimpanan, menutupnya otomatis setelah 4 detik, dan
   mempertahankan nilai form yang sudah diisi CurrentUser tanpa perubahan.

### Requirement 7: Validasi Kelengkapan Dokumen Mandatory per Shipment

**User Story:** Sebagai supervisor, saya ingin sistem memastikan setiap shipment memiliki dokumen
wajibnya, agar tidak ada shipment yang berlanjut ke proses pabean tanpa dokumen lengkap.

#### Acceptance Criteria

1. THE System SHALL memperlakukan Mandatory_Document_Set sebuah shipment sebagai tepat satu dokumen
   CIPL dan tepat satu Transport_Document (B/L atau AWB), dan SHALL menganggap Mandatory_Document_Set
   lengkap hanya ketika kedua dokumen tersebut ada dan tertaut pada shipment tersebut.
2. WHEN CurrentUser membuka sebuah shipment, THE System SHALL menampilkan status kelengkapan
   Mandatory_Document_Set sebagai salah satu dari dua nilai: `COMPLETE` ketika kedua dokumen wajib
   ada, atau `INCOMPLETE` ketika salah satu atau kedua dokumen wajib tidak ada.
3. IF sebuah shipment belum memiliki dokumen CIPL, THEN THE System SHALL menampilkan pesan `Shipment
   ini belum memiliki dokumen CIPL.` dan SHALL menetapkan status kelengkapan menjadi `INCOMPLETE`.
4. IF sebuah shipment belum memiliki Transport_Document, THEN THE System SHALL menampilkan pesan
   `Shipment ini belum memiliki dokumen B/L atau AWB.` dan SHALL menetapkan status kelengkapan
   menjadi `INCOMPLETE`.
5. WHEN CurrentUser mencoba menandai shipment siap untuk pabean sedangkan Mandatory_Document_Set
   belum lengkap, THE Route_Handler SHALL menolak permintaan dengan HTTP status 400, SHALL
   mengembalikan kode error `MANDATORY_DOCUMENTS_INCOMPLETE` beserta pesan `Dokumen wajib shipment
   belum lengkap: CIPL dan B/L atau AWB.`, dan SHALL tidak mengubah status shipment.
6. WHEN CurrentUser mencoba menandai shipment siap untuk pabean sedangkan Mandatory_Document_Set
   lengkap, THE Route_Handler SHALL memvalidasi kelengkapan di sisi server sebelum mengubah status,
   terlepas dari hasil validasi di browser.
7. IF permintaan menandai shipment siap untuk pabean diterima oleh Route_Handler tanpa sesi
   terautentikasi, THEN THE Route_Handler SHALL menolak permintaan dengan HTTP status 401 dan pesan
   `Autentikasi diperlukan.`
8. WHERE sebuah shipment memiliki satu atau lebih Supporting_Document, THE System SHALL
   memperlakukan dokumen tersebut sebagai attachment opsional yang berdampingan dengan
   Mandatory_Document_Set dan TIDAK mengubah status kelengkapan `COMPLETE` atau `INCOMPLETE`
   berdasarkan ada atau tidaknya Supporting_Document.

### Requirement 8: Penanganan Error Ekstraksi dan Unggah

**User Story:** Sebagai staf operasional, saya ingin pesan error yang jelas dalam bahasa Indonesia
ketika ekstraksi atau unggah gagal, agar saya tahu tindakan berikutnya.

#### Acceptance Criteria

1. IF file yang diekstrak tidak dapat dibaca isinya (file kosong 0 byte, terenkripsi/terproteksi kata
   sandi, atau struktur rusak sehingga tidak dapat di-parse), THEN THE Extraction_Service SHALL
   mengembalikan status 400 beserta objek error dengan kode `UNREADABLE_DOCUMENT` dan pesan `Dokumen
   tidak dapat dibaca. Coba unggah ulang atau gunakan dokumen lain.`, DAN SHALL menolak file tanpa
   menyimpan atau memproses sebagian isinya.
2. IF OCR gagal memproses PDF hasil pindaian (tidak ada teks yang dapat diekstrak, atau proses OCR
   melempar galat), THEN THE Extraction_Service SHALL mengembalikan status 502 beserta objek error
   dengan kode `OCR_FAILED` dan pesan `Pemindaian teks dokumen gagal. Coba dokumen dengan kualitas
   lebih baik.`, DAN SHALL mempertahankan file unggahan tanpa perubahan.
3. WHEN LLM_Extraction melebihi batas waktu 30 detik, THE Route_Handler SHALL membatalkan permintaan
   dan mengembalikan status 503 beserta objek error dengan kode `LLM_EXTRACTION_TIMEOUT` dan pesan
   `Ekstraksi LLM gagal. Coba lagi atau gunakan hasil deterministik.`
4. IF LLM_Extraction mengembalikan galat atau respons yang tidak dapat di-parse sebelum batas waktu
   30 detik tercapai, THEN THE Route_Handler SHALL mengembalikan status 503 beserta objek error
   dengan kode `LLM_EXTRACTION_FAILED` dan pesan `Ekstraksi LLM gagal. Coba lagi atau gunakan hasil
   deterministik.`
5. IF ukuran file melebihi 10 MB (10.485.760 byte) saat ekstraksi, THEN THE Extraction_Service SHALL
   menolak file sebelum pemrosesan dan mengembalikan status 413 beserta objek error dengan kode
   `FILE_TOO_LARGE` dan pesan `Ukuran dokumen melebihi batas 10 MB.`
6. IF tipe file tidak termasuk daftar yang didukung (PDF atau varian Excel) saat ekstraksi, THEN THE
   Extraction_Service SHALL mengembalikan status 400 beserta objek error dengan kode
   `UNSUPPORTED_FILE_TYPE` dan pesan `File harus berupa PDF atau Excel.`
7. IF tidak ada LLM_Provider yang dikonfigurasi saat LLM_Extraction diminta, THEN THE Route_Handler
   SHALL mengembalikan status 503 beserta objek error dengan kode `LLM_NOT_CONFIGURED` dan pesan
   `Ekstraksi LLM tidak tersedia karena belum ada penyedia LLM yang dikonfigurasi.`
8. THE Route_Handler SHALL mengembalikan setiap error sebagai objek berbentuk `{ error: '<pesan
   Indonesia>' }` dengan tepat satu kode status dari himpunan {400, 413, 502, 503} dan SHALL tidak
   mengembalikan kode status lain untuk kondisi error yang tercantum di atas.

### Requirement 9: Keamanan, Performa, dan Aksesibilitas

**User Story:** Sebagai pemilik sistem, saya ingin fitur ini aman, cepat, dan dapat diakses, agar
kunci rahasia tidak bocor dan antarmuka tetap nyaman dipakai.

#### Acceptance Criteria

1. THE System SHALL menjalankan seluruh pemanggilan kunci API provider LLM di modul bertanda `import
   'server-only'` dan TIDAK menyertakan nilai kunci tersebut dalam bundel browser mana pun.
2. THE System SHALL TIDAK memberi prefix `NEXT_PUBLIC_` pada variabel rahasia apa pun yang dipakai
   fitur ini (kunci API provider LLM, `SUPABASE_SERVICE_ROLE_KEY`).
3. WHEN System menerima permintaan mengambil dokumen sebuah shipment, THE Route_Handler SHALL
   memfilter query pada sisi server berdasarkan `workspace_id` dan `shipmentId` terkait, dan SHALL
   mengembalikan hanya baris dokumen milik shipment tersebut tanpa membaca seluruh tabel lalu
   memfilter di browser.
4. IF permintaan pengambilan dokumen shipment tiba tanpa sesi terautentikasi, THEN THE Route_Handler
   SHALL menolak permintaan dengan status 401 dan pesan berbahasa Indonesia yang menunjukkan
   autentikasi diperlukan (kode `AUTHENTICATION_REQUIRED`), serta TIDAK mengembalikan data dokumen
   apa pun.
5. THE System SHALL merender komponen unggah dan peninjauan hasil dengan `aria-label` pada setiap
   kontrol interaktif, outline `focus-visible` yang terlihat pada elemen yang menerima fokus
   keyboard, dan menonaktifkan animasi non-esensial ketika `prefers-reduced-motion: reduce` aktif.
6. WHILE ekstraksi dokumen berlangsung, THE System SHALL menampilkan indikator pemuatan memakai pola
   `PageSkeleton`/`finishLoadingAfterMinimum` repo dengan durasi tampil minimum 300 milidetik agar
   tampilan tidak berkedip.
7. WHEN pemanggilan ke LLM_Provider pada layanan ekstraksi gagal atau melampaui batas waktu 30 detik,
   THE Route_Handler SHALL menghentikan operasi, mengembalikan status 503 dengan pesan berbahasa
   Indonesia yang menunjukkan kegagalan layanan ekstraksi (kode `EXTRACTION_SERVICE_UNAVAILABLE`),
   dan TIDAK mengubah data dokumen yang tersimpan.
