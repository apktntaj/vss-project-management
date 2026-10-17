# Requirements Document

## Introduction

Dokumen ini mendokumentasikan perilaku **as-built** (sebagaimana berjalan di kode saat ini) dari
inti fitur **Event Management** di workspace operasional VSS. Ini adalah penerapan SDD secara
retroaktif: fitur sudah berjalan, dan requirement di sini merekam apa yang **benar-benar dilakukan
sistem sekarang**, bukan desain target. Bila perilaku kode menyimpang dari dokumen reverse-engineering
lama, penyimpangan itu dicatat eksplisit di bagian "Temuan / Deviasi dari dokumen lama" — bukan
diam-diam diperbaiki.

**Cakupan (in scope):** pembuatan dan penyuntingan event, siklus hidup/status event, penanganan
pembatalan (cancellation), penghapusan event beserta otorisasinya, serta halaman daftar/dashboard
event (kartu ringkasan, panel perhatian, pencarian, filter status). Venue dan Event Organizer (EO)
dibahas hanya sebagai data referensi yang dipilih atau dibuat inline lalu dirujuk lewat id.

**Di luar cakupan (out of scope):** internal pengelolaan exhibitor, CIPL, shipment, customs job, dan
legacy job. Entitas-entitas itu disebut hanya sebagai "data turunan" pada bagian penghapusan, karena
penghapusan event menyentuh mereka secara cascade.

## Glossary

- **Event**: Entitas pameran (MICE) yang menjadi pusat operasional. Memiliki nama, venue, EO, PIC,
  tanggal mulai, dan tanggal selesai.
- **Event_Service**: Lapisan route handler server yang menangani pembuatan, penyuntingan, pembacaan,
  dan penghapusan event beserta validasi dan otorisasinya.
- **Event_Listing**: Halaman daftar/dashboard event yang menampilkan ringkasan, panel perhatian,
  pencarian, dan filter status.
- **Venue**: Lokasi penyelenggaraan event. Data referensi yang dipilih dari data yang ada atau dibuat
  inline lalu dirujuk lewat id.
- **Event_Organizer** (EO): Penyelenggara event. Data referensi yang dipilih atau dibuat inline lalu
  dirujuk lewat id.
- **PIC**: Penanggung jawab event; satu-satunya pihak yang berwenang menghapus event tersebut.
- **EventCancellation**: Objek yang menandai event sebagai dibatalkan. Berisi `eventId`, `reason`,
  `cancelledAt`, dan `cancelledById`.
- **Status turunan (ACTIVE/CANCELLED)**: Status yang tidak disimpan sebagai enum; diturunkan dari ada
  atau tidaknya objek `EventCancellation`.
- **Status tampilan (soon/ongoing/done)**: Status yang dihitung di halaman daftar dari `startsOn`/
  `endsOn` dibandingkan tanggal hari ini; tidak disimpan.
- **Data turunan**: Rekam operasional yang terikat pada event — exhibitor, CIPL, CIPL version,
  shipment, customs job, legacy job beserta stage dan dokumennya, serta ticket berkonteks event dan
  job. Dalam dokumen ini hanya relevan untuk perilaku penghapusan.

## Requirements

### Requirement 1: Membuat Event

**User Story:** Sebagai staf operasional, saya ingin membuat event baru dengan data wajibnya, agar
event dapat menjadi pusat operasional pameran.

#### Acceptance Criteria

1. WHEN permintaan pembuatan event diterima dengan seluruh field wajib valid, THE Event_Service SHALL menyimpan tepat satu event baru pada workspace default dengan `name`, `venueId`, `eventOrganizerId`, `picId`, `startsOn`, dan `endsOn`, menetapkan `createdById` dari pengguna terautentikasi dan `createdAt` sebagai waktu pembuatan, lalu mengembalikan event tersimpan beserta `id` dan `cancellation` bernilai null.
2. IF `name` kosong atau hanya berisi spasi, THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "Nama event wajib diisi.".
3. IF `venueId` kosong, THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "Venue wajib dipilih.".
4. IF `eventOrganizerId` kosong, THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "Event organizer wajib dipilih.".
5. IF `picId` bukan UUID valid, THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "PIC wajib dipilih.".
6. IF `startsOn` atau `endsOn` tidak sesuai pola `YYYY-MM-DD` (empat digit tahun, dua digit bulan, dua digit tanggal, dipisah tanda hubung), THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "Gunakan tanggal YYYY-MM-DD.".
7. IF `endsOn` lebih awal dari `startsOn`, THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "Tanggal akhir harus sama dengan atau setelah tanggal mulai." pada field `endsOn`.
8. THE Event_Service SHALL memvalidasi seluruh aturan field dan antar-field di sisi server pada route handler, dan mengumpulkan serta mengembalikan pesan penolakan untuk setiap field wajib yang tidak valid.
9. IF permintaan pembuatan event diterima tanpa sesi pengguna terautentikasi, THEN THE Event_Service SHALL menolak permintaan tanpa menyimpan event dengan pesan "Autentikasi diperlukan.".

### Requirement 2: Menyunting Event

**User Story:** Sebagai staf operasional, saya ingin menyunting data event yang sudah ada, agar
perubahan jadwal atau penanggung jawab tercatat.

#### Acceptance Criteria

1. WHEN permintaan penyuntingan event diterima dengan seluruh field wajib valid, THE Event_Service SHALL memperbarui `name`, `venueId`, `eventOrganizerId`, `picId`, `startsOn`, dan `endsOn` pada event yang ditunjuk di dalam workspace aktif, lalu mengembalikan data event yang diperbarui beserta `id`-nya.
2. IF permintaan penyuntingan tidak menyertakan sesi pengguna terautentikasi, THEN THE Event_Service SHALL menolak permintaan dengan pesan "Autentikasi diperlukan." tanpa mengubah data event.
3. IF salah satu field wajib gagal validasi field tunggal (`name` kosong "Nama event wajib diisi.", `venueId` kosong "Venue wajib dipilih.", `eventOrganizerId` kosong "Event organizer wajib dipilih.", `picId` bukan UUID "PIC wajib dipilih.", `startsOn` atau `endsOn` bukan format YYYY-MM-DD "Gunakan tanggal YYYY-MM-DD."), THEN THE Event_Service SHALL menolak permintaan dengan pesan validasi field terkait tanpa mengubah data event.
4. IF `endsOn` lebih awal dari `startsOn`, THEN THE Event_Service SHALL menolak permintaan dengan pesan "Tanggal akhir harus sama dengan atau setelah tanggal mulai." tanpa mengubah data event.
5. IF event yang ditunjuk tidak ditemukan di dalam workspace aktif, THEN THE Event_Service SHALL menolak permintaan dengan pesan "Event tidak ditemukan." tanpa mengubah data event.

### Requirement 3: Referensi Venue dan Event Organizer

**User Story:** Sebagai staf operasional, saya ingin memilih venue dan EO dari data yang ada atau
membuatnya langsung saat mengisi event, agar tidak perlu berpindah halaman.

#### Acceptance Criteria

1. WHERE venue yang diinginkan sudah ada, THE Event_Service SHALL menerima event yang merujuk venue
   tersebut lewat `venueId`.
2. WHERE venue yang diinginkan belum ada, THE Event_Service SHALL mengizinkan pembuatan venue baru
   lewat resource data referensi, lalu event merujuknya lewat `venueId`.
3. WHERE event organizer yang diinginkan sudah ada, THE Event_Service SHALL menerima event yang
   merujuk EO tersebut lewat `eventOrganizerId`.
4. WHERE event organizer yang diinginkan belum ada, THE Event_Service SHALL mengizinkan pembuatan EO
   baru lewat resource data referensi, lalu event merujuknya lewat `eventOrganizerId`.

### Requirement 4: Status dan Siklus Hidup Event

**User Story:** Sebagai staf operasional, saya ingin mengetahui status event, agar bisa membedakan
event aktif, dibatalkan, akan datang, berlangsung, dan selesai.

#### Acceptance Criteria

1. THE Event SHALL tidak menyimpan enum status siklus hidup; siklus hidup diwakili semata-mata oleh ada atau tidaknya objek `EventCancellation`.
2. WHERE sebuah event memiliki objek `EventCancellation`, THE Event_Listing SHALL menurunkan status siklus hidup event tersebut sebagai `CANCELLED`.
3. WHERE sebuah event tidak memiliki objek `EventCancellation`, THE Event_Listing SHALL menurunkan status siklus hidup event tersebut sebagai `ACTIVE`.
4. WHEN tanggal hari ini lebih awal dari `startsOn` (hari ini < `startsOn`), THE Event_Listing SHALL menghitung status tampilan event sebagai `soon`.
5. WHILE tanggal hari ini berada di antara `startsOn` dan `endsOn` inklusif (`startsOn` ≤ hari ini ≤ `endsOn`, sehingga hari ini sama dengan `startsOn` atau sama dengan `endsOn` termasuk `ongoing`), THE Event_Listing SHALL menghitung status tampilan event sebagai `ongoing`.
6. WHEN tanggal hari ini lebih akhir dari `endsOn` (hari ini > `endsOn`), THE Event_Listing SHALL menghitung status tampilan event sebagai `done`.
7. THE Event_Listing SHALL menghitung status tampilan `soon`/`ongoing`/`done` pada saat render tanpa menyimpannya.
8. THE Event_Listing SHALL menurunkan status siklus hidup (`CANCELLED`/`ACTIVE`) secara independen dari status tampilan (`soon`/`ongoing`/`done`), sehingga kedua status dihitung dan ditampilkan bersamaan untuk setiap event.

### Requirement 5: Menghapus Event dan Otorisasinya

**User Story:** Sebagai PIC event, saya ingin menghapus event yang saya tanggung jawabi beserta data
turunannya, agar data yang keliru atau batal dapat dibersihkan secara permanen.

#### Acceptance Criteria

1. IF permintaan penghapusan event diterima tanpa sesi pengguna terautentikasi, THEN THE Event_Service SHALL menolak permintaan dengan pesan "Autentikasi diperlukan." dan status 401.
2. WHEN permintaan penghapusan event diterima dari pengguna terautentikasi dan baris event dengan id tersebut ada serta kolom `pic_id` event sama persis dengan id pengguna saat ini, THE Event_Service SHALL melanjutkan penghapusan event.
3. IF baris event memiliki `pic_id` yang tidak kosong dan nilainya berbeda dari id pengguna saat ini, THEN THE Event_Service SHALL menolak permintaan tanpa menghapus data apa pun, dengan pesan "Hanya PIC event yang dapat menghapus event ini." dan status 403.
4. WHERE baris event memiliki `pic_id` kosong (null, data lama), THE Event_Service SHALL mengizinkan penghapusan oleh pengguna terautentikasi mana pun.
5. WHEN penghapusan event dilanjutkan, THE Event_Service SHALL menghapus permanen seluruh data turunan dalam urutan tetap berikut sebelum menghapus baris event: (1) job stage milik job event, (2) job document milik job event, (3) shipment milik job event, (4) customs job milik job event, (5) legacy job milik event, (6) CIPL version milik CIPL event, (7) CIPL milik exhibitor event, (8) ticket berkonteks EVENT untuk event tersebut, (9) ticket berkonteks JOB untuk job event, (10) exhibitor milik event, (11) event cancellation milik event, (12) event agent milik event, lalu (13) baris event itu sendiri.
6. WHEN seluruh data turunan dan baris event telah dihapus, THE Event_Service SHALL mengembalikan respons sukses tanpa isi dengan status 204.
7. THE Event_Service SHALL melakukan penghapusan event secara cascade tanpa memblokir atau menggagalkan penghapusan karena keberadaan data turunan.
8. IF event dengan id yang ditunjuk tidak ditemukan pada workspace saat ini, THEN THE Event_Service SHALL menolak permintaan tanpa menghapus data apa pun, dengan pesan "Event tidak ditemukan.".
9. WHEN pengguna memicu aksi hapus pada daftar event, THE Event_Listing SHALL menampilkan dialog konfirmasi berjudul "Hapus event?" yang menyatakan bahwa event beserta exhibitor, job, CIPL, dokumen shipment, dan ticket yang terikat padanya akan dihapus permanen dan tindakan tidak dapat dibatalkan, dan SHALL menunda eksekusi penghapusan sampai pengguna menekan tombol konfirmasi "Hapus permanen".
10. WHEN permintaan penghapusan event mengembalikan respons sukses 204, THE Event_Listing SHALL menampilkan notifikasi sukses bertuliskan "Event dihapus permanen." dan memuat ulang daftar event.

### Requirement 6: Kartu Ringkasan Daftar Event

**User Story:** Sebagai staf operasional, saya ingin melihat ringkasan angka di halaman event, agar
cepat memahami beban kerja.

#### Acceptance Criteria

1. THE Event_Listing SHALL menampilkan jumlah total event.
2. THE Event_Listing SHALL menampilkan jumlah event berstatus tampilan `ongoing` (berlangsung).
3. THE Event_Listing SHALL menampilkan jumlah exhibitor.
4. THE Event_Listing SHALL menampilkan beban item CIPL.

### Requirement 7: Panel Perhatian

**User Story:** Sebagai staf operasional, saya ingin panel perhatian menyorot hal yang perlu
ditindaklanjuti, agar risiko jadwal dan dokumen tidak terlewat.

#### Acceptance Criteria

1. WHERE terdapat dua atau lebih event yang rentang tanggalnya saling tumpang tindih pada minggu berjalan (Senin 00:00 sampai Minggu 23:59 waktu lokal), THE Event_Listing SHALL menyorot setiap event yang terlibat dalam tumpang tindih tersebut sebagai item perhatian.
2. WHERE dua atau lebih event memiliki venue yang sama DAN rentang tanggalnya saling tumpang tindih pada minggu berjalan, THE Event_Listing SHALL menyorot konflik venue tersebut sebagai item perhatian yang berbeda dari penyorotan tumpang tindih jadwal.
3. WHERE terdapat CIPL yang statusnya bukan READY DAN bukan CANCELLED, THE Event_Listing SHALL menyorot CIPL tersebut sebagai item perhatian.
4. WHERE terdapat event yang berstatus dibatalkan (memiliki objek pembatalan), THE Event_Listing SHALL menyorotnya sebagai event yang memerlukan tindak lanjut.
5. IF tidak terdapat satu pun item yang memenuhi kriteria 1 sampai 4, THEN THE Event_Listing SHALL menampilkan panel perhatian dalam keadaan kosong tanpa item yang disorot.

### Requirement 8: Pencarian dan Filter Status

**User Story:** Sebagai staf operasional, saya ingin mencari dan memfilter event, agar menemukan
event yang relevan dengan cepat.

#### Acceptance Criteria

1. WHEN pengguna memasukkan kata kunci pencarian yang tidak kosong (setelah spasi di awal dan akhir dipangkas), THE Event_Listing SHALL menampilkan hanya event yang teks gabungan atributnya memuat kata kunci tersebut sebagai substring tanpa membedakan huruf besar/kecil.
2. THE Event_Listing SHALL membentuk teks gabungan pencarian setiap event dari atribut berikut jika nilainya ada: nama resmi event, alias event, nama resmi venue, nama alias venue, nama legal EO, nama PIC, serta nama legal dan nama alias setiap exhibitor pada event tersebut.
3. IF kata kunci pencarian kosong atau hanya berisi spasi setelah dipangkas, THEN THE Event_Listing SHALL memperlakukan pencarian sebagai cocok untuk semua event.
4. THE Event_Listing SHALL menampilkan hanya event yang memenuhi kriteria pencarian DAN kriteria filter status secara bersamaan.
5. WHEN filter status `active` dipilih, THE Event_Listing SHALL menampilkan hanya event yang tidak dibatalkan dan status tampilannya bukan `done`.
6. WHEN filter status `all` dipilih, THE Event_Listing SHALL menampilkan seluruh event tanpa penyaringan status.
7. WHEN filter status `soon`, `ongoing`, atau `done` dipilih, THE Event_Listing SHALL menampilkan hanya event yang status tampilannya sama persis dengan nilai filter yang dipilih.

### Requirement 9: Pembacaan Data Daftar Event

**User Story:** Sebagai staf operasional, saya ingin halaman event selalu menampilkan data terbaru,
agar keputusan dibuat atas data yang mutakhir.

#### Acceptance Criteria

1. WHEN daftar event diminta, THE Event_Service SHALL mengembalikan payload gabungan berisi event
   beserta venue, event organizer, cancellation, exhibitor, dan pengguna PIC terkait.
2. THE Event_Service SHALL mengembalikan daftar event dengan header yang mencegah caching
   (`Cache-Control: no-store`).

### Requirement 10: Otentikasi dan Umpan Balik Mutasi

**User Story:** Sebagai pengguna, saya ingin operasi event dijaga otentikasi dan memberi umpan balik
jelas, agar aman dan jelas hasilnya.

#### Acceptance Criteria

1. IF permintaan ke operasi event tidak terautentikasi, THEN THE Event_Service SHALL menolak dengan
   pesan "Autentikasi diperlukan." dan status 401.
2. WHEN sebuah mutasi event (buat, sunting, atau hapus) berhasil, THE Event_Listing SHALL menampilkan
   umpan balik sukses.
3. IF sebuah mutasi event gagal, THEN THE Event_Listing SHALL menampilkan umpan balik kegagalan yang
   memuat pesan error dari server.
4. IF input permintaan tidak valid, THEN THE Event_Service SHALL mengembalikan error berbentuk
   `{ error: '<pesan Indonesia>' }` dengan status 400.

## Temuan / Deviasi dari dokumen lama

Bagian ini mencatat perbedaan antara perilaku yang berjalan sekarang dan dokumen reverse-engineering
lama. Ini adalah temuan yang didokumentasikan, bukan daftar perbaikan.

### T-1: Alias event tidak dipersist

Antarmuka menyediakan slot "alias" untuk event, tetapi adaptor tampilan selalu menetapkan
`alias: null`. Alias **tidak disimpan di server** dan tidak pernah dimuat kembali. Akibatnya,
pencarian "alias" (Requirement 8.1) secara praktis selalu mencocokkan nilai null untuk field ini.
**As-built:** alias bersifat tampilan semu dan tidak persisten.

### T-2: Pembuatan pembatalan (cancel) baru sudah dihapus

Pada dokumen lama, "pengguna dapat membatalkan event" (requirement lama E-6) dianggap berlaku. Pada
kode saat ini, pembuatan `EventCancellation` baru **telah dihapus** dari alur UI dan data-client
(ditandai komentar "pembuatan cancel baru sudah dihapus"). Status `CANCELLED` kini **hanya**
mencerminkan baris lama (legacy) yang masih membawa objek cancellation. **As-built:** status event
dapat bernilai `CANCELLED` untuk data historis, tetapi tidak ada jalur untuk membuat pembatalan baru.
**Temuan:** kemampuan "membatalkan event" tidak lagi dapat dipicu.

### T-3: Penghapusan bersifat cascade, bukan diblokir

Dokumen lama (requirement E-8 / B-1) menyatakan event hanya boleh dihapus bila tidak ada data
turunan. Kode saat ini **berlawanan**: penghapusan **tidak memblokir** keberadaan data turunan dan
justru **menghapus permanen secara cascade** seluruh data turunan (job stage, job document, shipment,
customs job, legacy job, CIPL version, CIPL, exhibitor, ticket event dan job, event cancellation,
event agent) sebelum menghapus event. **As-built:** cascade delete. **Temuan:** kontradiksi langsung
dengan dokumen lama yang menjanjikan blokir.

### T-4: Bypass penghapusan untuk event tanpa PIC (data lama)

Otorisasi penghapusan membatasi aksi hanya pada PIC event (`picId === userId`). Namun event **tanpa**
`picId` (data lama) dapat dihapus oleh **pengguna mana pun** yang terautentikasi. **As-built:** ini
celah yang disengaja untuk data legacy dan merupakan satu-satunya aturan otorisasi per-objek yang
benar-benar dijalankan di sistem. **Temuan:** event legacy tanpa PIC tidak terlindungi aturan
PIC-only.
