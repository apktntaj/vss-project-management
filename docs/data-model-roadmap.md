# Rencana model data

## Workspace organisasi

- Nama organisasi/wadah kerja: **Vissasa**.
- Workspace aktif masih memakai slug teknis `default`.
- Perubahan slug menjadi `vissasa` ditunda sampai repository tidak lagi mengandalkan nilai yang di-hardcode.

## Event Organizer (EO)

Perubahan berikut disepakati sebagai rencana dan **belum diimplementasikan**:

- Hapus `aliasName`.
- Ganti `legalName` menjadi `name` sebagai identitas utama EO.
- Tambahkan `npwp` sebagai nilai opsional.
- Ganti satu field kontak bebas dengan `contacts[]` untuk beberapa PIC.
- Setiap contact direncanakan memiliki `name`, `role`/jabatan opsional, `email` opsional, `phone` opsional, dan `isPrimary`.
- Tambahkan `address` dan `website` sebagai data EO terstruktur bila diperlukan.

`status` dan `notes` ditunda; keduanya bukan bagian dari perubahan berikutnya.

## Venue

Perubahan Venue juga ditunda dan akan diterapkan bersama perubahan EO:

- Ganti `officialName` menjadi `name` sebagai identitas utama Venue.
- Hapus `aliasName`, `latitude`, `longitude`, dan `contactInfo` tunggal.
- Gunakan `address` opsional, `contacts[]`, `website` opsional, serta `loadingAccessNotes` opsional.
- Tidak menyimpan lokasi GPS pada tahap awal.

Perubahan EO akan dilakukan sebagai satu paket: migration Supabase, domain type dan validasi, form UI, repository data, serta seed data.

## Event

Event dirancang sebagai record immutable setelah dibuat. Kesalahan input tidak diperbaiki dengan mengubah atau menghapus Event; Event lama dibatalkan dan koreksinya dibuat sebagai Event baru.

Struktur rencana `events`:

- `id`
- `name`
- `venueId`
- `eventOrganizerId`
- `startsOn`
- `endsOn`
- `createdAt`
- `createdById`

Event tidak memiliki `updatedAt` karena baris Event tidak boleh diedit. Event juga tidak menyimpan field status yang dapat diubah langsung.

Pembatalan disimpan sebagai record terpisah dalam `event_cancellations`:

- `eventId`, sebagai primary key sekaligus foreign key ke Event
- `reason`
- `cancelledAt`
- `cancelledById`

Status Event diturunkan dari keberadaan record pembatalan:

- Tanpa `event_cancellations`: `ACTIVE`
- Memiliki `event_cancellations`: `CANCELLED`

Event tidak boleh dihapus. Pemisahan daftar aktif dan batal dilakukan melalui query atau view, bukan dengan memindahkan Event ke tabel lain.

Relasi Event:

- Satu Venue memiliki banyak Event; Event menyimpan `venueId`.
- Satu EO memiliki banyak Event; Event menyimpan `eventOrganizerId`.
- Satu Event memiliki banyak Exhibitor; Exhibitor menyimpan `eventId`.
- Event tidak menyimpan array `exhibitorIds`.

Navigasi utama aplikasi mengikuti `Venue → Event → Exhibitor`.

## User

Model User memisahkan peran seseorang dalam organisasi dari hak aksesnya di aplikasi.

Struktur rencana `users`:

- `id`
- `name`
- `email`
- `jobRole`
- `accessLevel`
- `isActive`
- `createdAt`
- `updatedAt`

`jobRole` merepresentasikan peran dalam organisasi dan, berdasarkan informasi yang tersedia saat ini, memiliki empat nilai:

- `STAFF`
- `SUPERVISOR`
- `CUSTOMER_SERVICE`
- `DOCUMENT_ASSISTANT`

`accessLevel` merepresentasikan kewenangan di aplikasi dan terpisah dari `jobRole`:

- `ADMIN`
- `MEMBER`

Pemisahan tersebut memungkinkan, misalnya, seorang Supervisor menjadi Member biasa atau seorang Staff diberi kewenangan Admin tanpa mengubah peran organisasinya.

User yang sudah mempunyai histori aktivitas tidak dihapus. `isActive = false` menonaktifkan akses login sambil mempertahankan referensi audit seperti `createdById` dan `cancelledById`.

Kredensial autentikasi, termasuk password hash, bukan bagian dari profil bisnis User dan tidak boleh dikirim ke UI.

Keputusan mengenai apakah keanggotaan User dalam Vissasa perlu disimpan dalam tabel relasi tersendiri atau dianggap otomatis karena hanya ada satu organisasi masih ditunda.

## Exhibitor

Exhibitor adalah data minimal dalam suatu Event yang digunakan untuk menginisiasi Job. Tidak ada status kelengkapan profil.

Secara konseptual, Exhibitor adalah salah satu dari:

- `LocalExhibitor`
- `InternationalExhibitor`

Keduanya memiliki informasi bersama:

- `id`
- `eventId`
- `name`
- `contact`
- `agentId`, opsional
- `createdAt`
- `createdById`
- `updatedAt`

`LocalExhibitor` dapat memiliki `npwp` opsional setelah informasinya tersedia. `InternationalExhibitor` tidak memiliki NPWP.

Pada penyimpanan relasional, identitas dan data bersama direncanakan berada dalam `exhibitors`, sedangkan informasi khusus lokal berada dalam `local_exhibitor_details`. Dengan demikian, Job dapat selalu mereferensikan satu `exhibitorId` tanpa membedakan tabel tujuan.

Form awal Exhibitor cukup meminta nama, kontak, jenis LOCAL atau INTERNATIONAL, serta Agent bila Exhibitor menggunakannya. Data khusus dokumen pekerjaan tetap menjadi milik Job, Shipment, atau CIPL dan tidak dipindahkan ke profil Exhibitor.

Relasi utama:

- Satu Event memiliki banyak Exhibitor.
- Satu Exhibitor berada dalam tepat satu Event.
- Satu Exhibitor dapat memiliki banyak Job.

## Agent

Agent adalah entitas terpisah yang dapat mewakili beberapa Exhibitor dan mempunyai identitas serta kontaknya sendiri.

Struktur rencana `agents`:

- `id`
- `name`
- `contact`
- `createdAt`
- `updatedAt`

Relasi Agent dan Exhibitor:

- Satu Agent dapat mewakili nol atau banyak Exhibitor.
- Satu Exhibitor dapat ditangani langsung atau diwakili maksimal satu Agent dalam satu Event.
- `exhibitors.agentId` bersifat opsional dan mereferensikan `agents.id`.
- `agentId` kosong berarti Exhibitor ditangani langsung; tidak diperlukan field `usesAgent`.
- Kontak Exhibitor dan kontak Agent merupakan informasi yang berbeda.

Tabel penghubung `exhibitor_agents` belum diperlukan. Tabel tersebut baru dipertimbangkan jika satu Exhibitor dapat diwakili beberapa Agent sekaligus atau riwayat pergantian Agent perlu disimpan.

## Job

Job adalah rencana atau pekerjaan operasional untuk satu Exhibitor. Ketika Exhibitor dibuat, satu Job awal juga dibuat meskipun dokumen belum tersedia. Pembuatan Exhibitor dan Job awal harus menjadi satu operasi agar tidak menghasilkan Exhibitor baru tanpa Job awal.

Struktur inti rencana `jobs`:

- `id`
- `jobNumber`
- `exhibitorId`
- `phase`
- `assignedToId`, opsional
- `createdAt`
- `createdById`
- `updatedAt`

Job tidak menyalin `eventId`, nama, kontak, atau Agent karena informasi tersebut diperoleh melalui `exhibitorId`.

Satu Job pada akhirnya harus mempunyai satu CIPL dan tepat satu dokumen transportasi, yaitu B/L atau AWB. Ketika baru dibuat, keduanya boleh belum tersedia. Job tidak boleh mempunyai B/L dan AWB sekaligus. Jika Exhibitor mempunyai B/L atau AWB tambahan, dibuat Job lain untuk Exhibitor yang sama.

Fase Job internasional direncanakan sebagai:

- `INITIATION`
- `DOCUMENT_PREPARATION`
- `READY_FOR_CUSTOMS`
- `CUSTOMS_PROCESSING`
- `COMPLETED`

Makna fase:

- `INITIATION`: Job baru dibuat berdasarkan Exhibitor.
- `DOCUMENT_PREPARATION`: CIPL dan B/L/AWB sedang diterima, diperiksa, atau dikoreksi.
- `READY_FOR_CUSTOMS`: versi aktif CIPL dan tepat satu B/L/AWB sama-sama telah diterima dan disetujui tanpa kesalahan.
- `CUSTOMS_PROCESSING`: satu atau beberapa pemberitahuan pabean yang relevan sedang diproses.
- `COMPLETED`: seluruh proses yang diwajibkan untuk Job telah selesai.

Perubahan fase disimpan sebagai histori dalam `job_phase_history` dengan `jobId`, `fromPhase`, `toPhase`, `changedAt`, dan `changedById`.

Job yang tidak dilanjutkan tidak dihapus. Pembatalannya disimpan dalam `job_cancellations` dengan `jobId`, `reason`, `cancelledAt`, dan `cancelledById`, sehingga fase terakhir sebelum pembatalan tetap dapat diketahui.

Workflow Job lokal setelah persiapan dokumen belum diketahui dan tidak akan dipaksakan mengikuti customs workflow. Bagian tersebut tetap ditunda sampai informasi domain tersedia.

## Dokumen Job dan versinya

Dokumen bisnis dipisahkan dari file fisik. Identitas dokumen Job direncanakan dalam `job_documents`:

- `id`
- `kind`: `CIPL`, `BILL_OF_LADING`, `AIR_WAYBILL`, atau `SUPPORTING`
- `currentVersionId`
- `createdAt`

`job_documents` hanya menjadi identitas dan klasifikasi dokumen, bukan satu tabel besar yang mencampur seluruh field khusus CIPL, dokumen transportasi, dan pemberitahuan pabean.

Relasi dokumen ke Job disimpan dalam `job_document_links`:

- `jobId`
- `documentId`
- `role`: `PRIMARY` atau `SUPPORTING`

Pemisahan ini memungkinkan sebuah dokumen konsolidasi seperti Master B/L atau Master AWB menjadi dokumen pendukung bagi beberapa Job. Setiap Job hanya boleh memiliki satu CIPL utama dan satu dokumen transportasi utama, tetapi boleh memiliki beberapa dokumen pendukung.

Setiap file yang benar-benar diterima dan diperiksa disimpan sebagai versi immutable dalam `document_versions`:

- `id`
- `documentId`
- `versionNumber`
- `attachmentId`
- `receivedAt`
- `receivedById`
- `receivedFrom`
- `createdAt`

Versi baru selalu membuat record dan objek Storage baru. File versi lama tidak ditimpa atau dihapus karena merupakan bagian dari audit trail.

Hasil pemeriksaan setiap versi disimpan dalam `document_reviews`:

- `id`
- `documentVersionId`
- `result`: `ACCEPTED` atau `REVISION_REQUIRED`
- `notes`
- `reviewedAt`
- `reviewedById`

Versi dengan hasil `REVISION_REQUIRED` tetap dipertahankan. Versi revisi berikutnya diunggah sebagai `versionNumber` baru. Hanya versi `ACCEPTED` yang dapat menjadi `currentVersionId` dan digunakan untuk submission. Job hanya dapat memasuki `READY_FOR_CUSTOMS` jika versi aktif CIPL dan B/L/AWB sama-sama `ACCEPTED`.

Data yang diekstraksi dari dokumen terikat pada versinya agar perubahan antarversi dapat dibandingkan. Item CIPL disimpan dalam `cipl_version_items`; data pihak dan perjalanan B/L/AWB disimpan terhadap versi dokumen transportasi.

Setiap revisi CIPL mempunyai kumpulan item baru. Item tidak mempertahankan `id` yang sama antarversi, meskipun nomor baris atau isinya tampak sama. Item versi lama tidak diperbarui atau dihapus. Perbandingan antarversi dilakukan berdasarkan isi seperti nomor baris, kode item, deskripsi, dan jumlah, bukan melalui identitas item yang diwariskan. Customs declaration harus mereferensikan versi CIPL dan item versi tertentu yang menjadi dasar submission.

Shipper, consignee, notify party, seller, dan buyer adalah peran di dalam dokumen, bukan tabel perusahaan yang terpisah. Nilai nama, alamat, negara, dan tax ID disimpan sebagai snapshot sesuai versi dokumennya. Perusahaan yang sama dapat memegang peran berbeda pada Job yang berbeda.

Informasi negara disimpan sesuai maknanya, misalnya negara alamat pihak, negara asal per item, port of loading, dan port of discharge. Job tidak mempunyai satu field `country` umum.

Dokumen pendukung memakai `kind = SUPPORTING` dan dapat memiliki `category`, `title`, serta `description`. Surat kuasa, izin, katalog, foto, insurance, kontrak event, atau korespondensi yang menjadi dasar keputusan dapat disimpan sebagai dokumen pendukung. Permintaan revisi tanpa file cukup dicatat pada `document_reviews.notes`.

File fisik berada dalam bucket private Supabase Storage. Tabel `attachments` hanya menyimpan metadata seperti `storagePath`, `fileName`, `mimeType`, `fileSize`, `uploadedAt`, dan `uploadedById`; `document_versions.attachmentId` mereferensikan metadata tersebut.

## B/L dan AWB

B/L dan AWB merupakan dua varian dokumen transportasi. Keduanya memiliki sebagian informasi bersama, tetapi data perjalanan laut dan udara tidak digabung ke dalam field generik seperti `vesselOrFlight`. Seluruh data hasil pembacaan dokumen melekat pada `document_versions`, sehingga revisi dokumen menghasilkan snapshot baru tanpa mengubah versi sebelumnya.

### Informasi bersama

Setiap versi B/L atau AWB dapat memuat:

- `documentNumber`
- `documentDate`
- `shipper`
- `consignee`
- `notifyParty`, opsional
- `carrier`
- `bookingNumber`, opsional
- `packageCount`, opsional
- `packageType`, opsional
- `goodsDescription`, opsional; ringkasan sebagaimana tercetak pada dokumen dan bukan pengganti item CIPL
- `marksAndNumbers`, opsional
- `grossWeightKg`, opsional
- `netWeightKg`, opsional
- `volumeM3`, opsional
- `freightTerms`, opsional; mempertahankan keterangan yang tercetak tanpa memaksakan enumeration sebelum istilah klien dikonfirmasi

`shipper`, `consignee`, dan `notifyParty` menggunakan snapshot pihak dokumen yang terdiri dari `name`, `address`, `countryCode`, dan `taxId`. Nilai selain nama boleh kosong bila memang tidak tercantum. Snapshot ini bukan referensi ke profil Exhibitor, Agent, atau tabel perusahaan.

Jumlah, berat, dan volume harus bernilai positif ketika tersedia. Nilai kosong berarti belum tercantum atau belum berhasil dibaca, bukan nol. Kelengkapan minimum untuk menerima suatu versi sebagai `ACCEPTED` masih harus dikonfirmasi dengan klien; aplikasi tidak boleh mengarang nilai yang tidak ada pada dokumen.

### Data khusus B/L

Versi `BILL_OF_LADING` dapat memuat:

- `vesselName`, opsional
- `voyageNumber`, opsional
- `portOfLoading`, opsional
- `portOfDischarge`, opsional
- `placeOfReceipt`, opsional
- `placeOfDelivery`, opsional
- `shippedOnBoardDate`, opsional
- `etd`, opsional
- `eta`, opsional
- `originalBillCount`, opsional
- `containers`, daftar yang boleh kosong

Setiap container merupakan snapshot yang terdiri dari `containerNumber`, `size`, `type`, dan `sealNumber`; masing-masing boleh kosong bila tidak terbaca, tetapi record container tidak dibuat apabila seluruh komponennya kosong. Daftar kosong sah untuk LCL, breakbulk, atau dokumen yang memang tidak mencantumkan detail container.

### Data khusus AWB

Versi `AIR_WAYBILL` dapat memuat:

- `departureAirport`, opsional
- `destinationAirport`, opsional
- `issuingCarrierName`, opsional
- `issuingCarrierAgent`, opsional, sebagai snapshot nama dan alamat yang tercetak
- `chargeableWeightKg`, opsional
- `routing`, daftar segmen penerbangan yang boleh kosong

Setiap segmen `routing` terdiri dari `sequence`, `originAirport`, `destinationAirport`, `carrier`, `flightNumber`, `flightDate`, `etd`, dan `eta`. Selain `sequence`, komponennya boleh kosong bila belum tercantum atau belum terbaca. Urutan segmen bermakna dan harus dipertahankan. Bentuk ini memungkinkan penerbangan langsung maupun transit tanpa menambah sejumlah field transit yang tetap.

Nama pelabuhan, bandara, place of receipt, dan place of delivery disimpan sebagai teks snapshot sesuai dokumen. Tabel master lokasi belum diperlukan. Kode lokasi dapat ditambahkan kemudian sebagai hasil normalisasi tanpa mengganti nilai asli yang tercetak.

### Level House dan Master

Level House atau Master tidak wajib diketahui ketika dokumen pertama kali diterima.

Metadata dokumen transportasi direncanakan dalam `transport_documents`:

- `documentId`, mereferensikan `job_documents.id`
- `level`: `UNKNOWN`, `HOUSE`, atau `MASTER`
- `masterDocumentId`, opsional

Jenis B/L atau AWB tetap berasal dari `job_documents.kind`. `UNKNOWN` berarti level dokumen belum diketahui, bukan bahwa House/Master tidak berlaku. User dapat mengklasifikasikannya kemudian tanpa mengganti identitas atau mengunggah ulang dokumen.

Aturan relasi transportasi:

- Dokumen House dapat mereferensikan satu `masterDocumentId`.
- Dokumen Master tidak memiliki `masterDocumentId`.
- Satu dokumen Master dapat menjadi induk beberapa dokumen House.
- Satu Job mempunyai tepat satu B/L atau AWB dengan `job_document_links.role = PRIMARY`.
- Job boleh mempunyai B/L atau AWB lain dengan role `SUPPORTING`.
- Jika hanya Master document yang tersedia, dokumen tersebut boleh menjadi `PRIMARY`.
- Jika House dan Master tersedia, House menjadi `PRIMARY` dan Master menjadi `SUPPORTING`.
- Satu Master B/L atau Master AWB dapat menjadi dokumen pendukung bagi beberapa Job.

Form upload awal cukup meminta jenis B/L atau AWB, file, dan nomor dokumen bila sudah diketahui. Pemilihan House atau Master tidak diwajibkan pada saat upload.

### Aturan pemeriksaan

- `BILL_OF_LADING` menggunakan data khusus laut dan tidak membawa routing penerbangan.
- `AIR_WAYBILL` menggunakan data khusus udara dan tidak membawa vessel, voyage, atau container.
- House dan Master memakai bentuk data versi yang sama; perbedaannya berada pada `transport_documents.level` dan relasi `masterDocumentId`.
- Detail barang tetap berasal dari versi CIPL. `goodsDescription` pada B/L atau AWB hanya menjadi ringkasan untuk pemeriksaan silang.
- Ketika versi aktif CIPL atau B/L/AWB berubah, aplikasi menghitung ulang ketidaksesuaian pada field yang sama-sama tersedia, termasuk pihak, jumlah/jenis kemasan, berat, dan ringkasan barang yang relevan.
- Ketidaksesuaian tersebut merupakan hasil validasi turunan: aplikasi menampilkan pemberitahuan dan tidak mengizinkan Job masuk ke `READY_FOR_CUSTOMS`. Hasilnya tidak disimpan dalam tabel rekonsiliasi tersendiri.
- Versi dokumen, hasil review manusia, dan catatan permintaan revisi tetap disimpan sebagai audit trail.

Field hasil ekstraksi merupakan bantuan untuk pemeriksaan, bukan pengganti dokumen sumber. Daftar field minimum yang wajib cocok sebelum masuk ke `READY_FOR_CUSTOMS` tetap menjadi pertanyaan terbuka sampai workflow nyata klien dikonfirmasi.

## Pemberitahuan pabean Job

Pemberitahuan pabean merupakan entitas tersendiri dalam `customs_declarations`, bukan kolom pada `jobs` dan bukan versi dari CIPL atau B/L/AWB:

- `id`
- `jobId`
- `documentType`: `BC_2_3`, `BC_2_5`, atau `BC_3_0`
- `status`
- `submissionNumber`
- `registrationNumber`
- `submittedAt`
- `registeredAt`
- `completedAt`
- `createdAt`
- `updatedAt`

BC 2.3, BC 2.5, dan BC 3.0 bukan tiga fase berurutan yang otomatis wajib untuk setiap Job. Satu Job internasional dapat mempunyai nol atau beberapa pemberitahuan pabean sesuai jalur yang benar-benar relevan. Pemilihannya bersifat provisional dan harus dikonfirmasi melalui workflow PPJK serta ketentuan yang berlaku untuk kasus tersebut.

Lifecycle awal setiap pemberitahuan pabean direncanakan sebagai `PREPARING`, `READY_TO_SUBMIT`, `SUBMITTED`, `REGISTERED`, dan `COMPLETED`, dengan kemungkinan `CORRECTION_REQUIRED`, `ON_HOLD`, atau `CANCELLED`. Nama dan transisi status final masih harus diselaraskan dengan proses nyata klien.
