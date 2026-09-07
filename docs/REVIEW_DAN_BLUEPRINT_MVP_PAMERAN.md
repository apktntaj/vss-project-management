# Review dan Blueprint Implementasi MVP Pameran

**Status:** Rencana implementasi siap dikerjakan  
**Fokus:** PPJK yang menangani pameran internasional di Indonesia  
**Storage MVP:** IndexedDB pada browser  
**Di luar cakupan:** General Cargo, Projects, redesign visual, klasifikasi HS/LARTAS, dan keputusan resmi kepabeanan

Dokumen ini mencatat ketidaksesuaian logika pada implementasi saat ini dan menetapkan model target untuk iterasi MVP berikutnya. Dokumen ini tidak meminta perubahan terhadap gaya visual yang sudah dibuat. Perubahan UI pada implementasi berikutnya dibatasi pada field, section, atau modal tambahan yang diperlukan untuk menjalankan alur domain.

## 1. Ringkasan keputusan domain

Hierarchy pekerjaan yang menjadi acuan adalah:

```text
Event
└── EventExhibitor
    ├── CoordinationAgent (0..n)
    └── CIPL (0..n)
        ├── CIPLVersion (1..n; tepat satu versi aktif)
        │   └── CIPLItem (1..n)
        └── Shipment (0..n)
            ├── TransportDocument: tepat satu B/L atau AWB
            └── CustomsJob (0..n)
                └── tepat satu dokumen BC 2.3, BC 2.5, atau BC 3.0
```

Keputusan yang sudah dikonfirmasi:

1. Satu CIPL hanya mencakup satu exhibitor.
2. Satu exhibitor dapat memiliki beberapa CIPL.
3. Revisi CIPL tidak menimpa versi lama. Semua versi dipertahankan dan tepat satu versi ditandai aktif.
4. Satu CIPL dapat dipecah menjadi beberapa shipment berupa B/L, AWB, atau gabungan keduanya.
5. Satu Job adalah satu dokumen BC, bukan shipment.
6. Satu Job berasal dari tepat satu shipment, sedangkan satu shipment dapat menghasilkan banyak Job.
7. Beberapa Job dengan jenis BC yang sama pada satu shipment tetap diperbolehkan.
8. Pemecahan barang dilacak per item dan quantity, baik dari CIPL ke shipment maupun dari shipment ke Job.
9. Agent luar negeri merupakan perantara untuk exhibitor dalam konteks event, bukan atribut teks bebas milik Job.

## 2. Temuan pada implementasi saat ini

### P0 — Model `LocalJob` mencampur shipment dan Job

**Evidence kode**

- `LocalJob` menyimpan `awbNumber`, `blNumber`, shipper, consignee, shipping line, cargo, dan status Job dalam record yang sama (`lib/indexeddb.ts`, sekitar baris 22–51).
- Modal event mengunggah B/L atau AWB lalu langsung memanggil `saveJob` (`components/event-job-modal.tsx`, sekitar baris 119–156).
- Halaman detail menamai isi record tersebut “Informasi shipment”, tetapi identitas record-nya tetap nomor Job (`app/(dashboard)/jobs/[id]/page.tsx`).

**Masalah**

Shipment dan Job adalah dua informasi berbeda. Struktur saat ini tidak dapat merepresentasikan satu shipment yang dipecah menjadi beberapa dokumen BC tanpa menggandakan seluruh data shipment atau menimpa data yang sudah ada. CIPL sebagai sumber awal dan lineage antarpecahan juga belum tersedia.

**Keputusan koreksi**

Pisahkan `CIPL`, `CIPLVersion`, `Shipment`, dan `CustomsJob`. `CustomsJob` wajib menunjuk tepat satu `Shipment`.

### P0 — Job dari halaman event tidak pernah terhubung ke exhibitor

**Evidence kode**

- Pembuatan Job dari event selalu mengirim `exhibitorId: null` (`components/event-job-modal.tsx`, sekitar baris 133–154).
- Shipper/exhibitor justru disimpan sebagai teks bebas.
- Halaman detail event mencari Job dengan `job.exhibitorId === exhibitor.id` (`app/(dashboard)/events/[id]/page.tsx`, sekitar baris 189–199).

**Dampak**

Daftar Job di bawah exhibitor tidak akan terisi melalui alur pembuatan Job yang tersedia. Nama yang sama juga dapat ditulis dengan variasi berbeda dan tidak lagi mempunyai identity yang stabil.

**Keputusan koreksi**

Alur pembuatan CIPL dimulai dari `EventExhibitor`. Shipment dan Job memperoleh exhibitor melalui parent chain, bukan melalui nama shipper bebas.

### P0 — Edit Job dapat melepas relasi dan metadata

**Evidence kode**

- `JobForm` memanggil `saveJob` tanpa `eventId`, `exhibitorId`, dan `sourceDocumentName` (`components/job-form.tsx`, sekitar baris 15–21).
- `saveJob` membangun ulang record dan hanya mempertahankan nomor Job, tracking token, serta `createdAt`; input kemudian menggantikan isi record (`lib/indexeddb.ts`, sekitar baris 546–561).

**Dampak**

Setelah diedit, Job yang sebelumnya berada di suatu event dapat hilang dari daftar event. Hubungan exhibitor dan nama dokumen sumber juga dapat terhapus walaupun field tersebut tidak pernah ditampilkan pada form edit.

**Keputusan koreksi**

Operasi update harus melakukan merge terhadap record yang ada atau menggunakan command update yang hanya menerima field yang memang boleh diubah. Parent ID dan metadata sumber tidak boleh berubah kecuali melalui operasi pemindahan yang eksplisit.

### P0 — Penyimpanan exhibitor mengganti seluruh identity

**Evidence kode**

`saveEventExhibitors` menghapus semua exhibitor milik event lalu membuat semuanya kembali dengan ID baru (`lib/indexeddb.ts`, sekitar baris 427–446).

**Dampak**

Mengubah nomor telepon satu exhibitor dapat memutus referensi CIPL, shipment, atau data lama yang menunjuk ID exhibitor sebelumnya. `createdAt` juga kehilangan makna karena seluruh record dianggap baru.

**Keputusan koreksi**

Simpan ID pada state/form, update record yang masih ada, buat ID hanya untuk exhibitor baru, dan hapus exhibitor secara eksplisit setelah pemeriksaan dependency.

### P0 — Hapus event meninggalkan data turunan

**Evidence kode**

- `deleteEvent` hanya menghapus record dari object store `events` (`lib/indexeddb.ts`, sekitar baris 496–505).
- Dialog menyatakan event “dan relasinya” akan dihapus (`app/(dashboard)/events/[id]/page.tsx`, sekitar baris 244–250).

**Dampak**

Exhibitor dan Job tetap berada di IndexedDB sebagai orphan. Sebagian data masih dapat terlihat dari halaman Semua Job, tetapi tidak dapat lagi ditelusuri melalui event.

**Keputusan koreksi**

Untuk MVP, penghapusan event ditolak apabila event masih memiliki exhibitor, CIPL, shipment, atau Job. Tidak dilakukan cascade delete otomatis.

### P1 — Pembuatan Job dan penyimpanan PDF tidak atomik

**Evidence kode**

Modal lebih dahulu menyimpan Job, kemudian menyimpan PDF dalam transaksi lain (`components/event-job-modal.tsx`, sekitar baris 133–156).

**Dampak**

Jika penyimpanan Blob gagal karena quota atau error IndexedDB, Job sudah terbuat tetapi UI melaporkan kegagalan. Percobaan ulang dapat menghasilkan record ganda.

**Keputusan koreksi**

Record dan file yang merupakan satu aksi pengguna harus disimpan dalam satu transaksi IndexedDB. Transaksi gagal seluruhnya apabila salah satu write gagal.

### P1 — Tanggal event menggunakan representasi yang tidak sesuai

**Evidence kode**

- Form menolak `endsAt <= startsAt`, sehingga event satu hari tidak dapat dibuat (`components/event-form.tsx`, sekitar baris 199–205).
- Tanggal kalender diubah menjadi timestamp UTC, sedangkan tampilan membacanya kembali melalui timezone browser.
- Seed tertentu memakai akhir hari UTC sehingga pada WIB dapat tampil sebagai hari berikutnya (`lib/indexeddb.ts`, sekitar baris 227–260).

**Dampak**

Event satu hari menjadi impossible state dan rentang tanggal dapat bergeser satu hari tergantung timezone atau bentuk timestamp sumber.

**Keputusan koreksi**

Tanggal show menggunakan tipe date-only berformat `YYYY-MM-DD`. Event sah apabila `endsOn >= startsOn`. Timestamp tetap digunakan untuk fakta seperti penerimaan dokumen, pengajuan, perubahan, dan eksekusi.

### P1 — Tahapan Job belum merepresentasikan lifecycle dokumen BC

**Evidence kode**

`toggleStage` memindahkan `PENDING` langsung ke `DONE`; jika ditekan lagi menjadi `IN_PROGRESS` (`lib/indexeddb.ts`, sekitar baris 578–583). Stage juga berupa nama bebas dan tidak terikat pada jenis/evidence dokumen.

**Dampak**

Status dapat mundur dengan urutan yang tidak konsisten dan tidak dapat menjelaskan apakah dokumen sedang disiapkan, diajukan, mendapat Nopen, release, atau selesai.

**Keputusan koreksi**

Gunakan lifecycle `CustomsJob` yang eksplisit. Stage bebas boleh dipertahankan sebagai checklist tambahan, tetapi bukan sumber status utama Job.

### P1 — File shipment tersimpan tetapi tidak benar-benar dapat digunakan dari detail

**Evidence kode**

`listJobs` sudah memuat `LocalJobDocument`, tetapi halaman detail menyatakan dokumen akan ditambahkan pada iterasi berikutnya dan tidak menampilkan file yang sudah tersimpan.

**Dampak**

Pengguna berhasil mengunggah dokumen, tetapi tidak dapat memastikan atau membuka kembali dokumen tersebut melalui alur utama.

**Keputusan koreksi**

File B/L/AWB menjadi attachment milik Shipment. File CIPL version dan file dokumen BC ditempatkan pada aggregate masing-masing dan dapat dibuka dari detail parent-nya.

### P2 — Penomoran Job berpotensi tidak unik

**Evidence kode**

Nomor baru dihitung dari jumlah record `jobs` saat ini ditambah satu (`lib/indexeddb.ts`, sekitar baris 546–554).

**Dampak**

Concurrent write, data hasil migrasi, atau penghapusan record dapat menghasilkan nomor yang pernah dipakai.

**Keputusan koreksi**

Gunakan counter tersendiri dalam transaksi yang sama dengan pembuatan `CustomsJob`. Nomor yang pernah diterbitkan tidak digunakan ulang.

## 3. Data definition target

Definisi berikut adalah model informasi domain. Bentuk object store IndexedDB ditetapkan pada bagian implementasi.

### `Event`

```text
Event terdiri dari:
- identity
- official name dan optional alias
- show period berupa startsOn dan endsOn (date-only)
- tepat satu venue
- tepat satu event organizer untuk scope MVP
- createdAt dan updatedAt
```

Invariant:

- `endsOn >= startsOn`.
- Event yang mempunyai data turunan tidak dapat dihapus.

### `EventExhibitor`

```text
EventExhibitor terdiri dari:
- identity yang stabil
- eventId
- legalName dan optional alias
- type: LOCAL atau INTERNATIONAL
- kontak dan alamat
- optional countryCode
- daftar CoordinationAgent
```

`EventExhibitor` merepresentasikan keikutsertaan perusahaan dalam satu event. Perusahaan yang sama pada event berbeda dapat menjadi partisipasi berbeda.

Invariant:

- Exhibitor lokal sah tanpa agent.
- Perubahan atribut tidak mengubah ID.
- Record tidak boleh dihapus selama masih dirujuk CIPL.

### `CoordinationAgent`

```text
CoordinationAgent terdiri dari:
- identity
- eventExhibitorId
- organizationName
- optional contactName, email, phone, address, dan countryCode
- status ACTIVE atau INACTIVE
```

Satu exhibitor dapat mempunyai nol atau lebih agent. Agent bukan shipping line, consignee, PPJK, atau user internal kecuali ada evidence bahwa perannya memang rangkap.

### `CIPL`

```text
CIPL terdiri dari:
- identity
- eventExhibitorId
- optional referenceNumber
- lifecycle status
- daftar versi tidak kosong
- activeVersionId
- createdAt dan updatedAt
```

Lifecycle minimum:

```text
AWAITING_DOCUMENT → RECEIVED → UNDER_REVIEW → READY
                                      └──────→ ON_HOLD
Semua state dapat berakhir pada CANCELLED.
```

Invariant:

- Tepat satu exhibitor.
- Tepat satu versi aktif jika dokumen sudah pernah diterima.
- `activeVersionId` harus menunjuk versi milik CIPL yang sama.
- Revisi tidak menghapus versi lama.

### `CIPLVersion`

```text
CIPLVersion terdiri dari:
- identity
- ciplId
- versionNumber positif dan unik dalam CIPL
- receivedAt dan receivedBy
- source file metadata dan Blob
- daftar item tidak kosong setelah status READY
- optional revisionNote
- createdAt
```

Versi bersifat immutable setelah dipakai sebagai sumber shipment. Koreksi berikutnya dibuat sebagai versi baru.

### `CIPLItem`

```text
CIPLItem terdiri dari:
- identity yang unik dalam versi CIPL
- lineNumber
- description
- quantity positif dan unit
- optional unitValue dan currency
- optional grossWeightKg, netWeightKg, countryOfOrigin
- daftar identifier seperti model atau serial number
- optional intendedUse dan intendedDisposal
```

Uraian HS, LARTAS, intended use, dan disposal boleh belum diketahui. Sistem tidak mengubah ketidaktahuan menjadi default.

### `Shipment`

```text
Shipment terdiri dari:
- identity
- ciplId dan sourceCiplVersionId
- transportDocument: BL atau AWB
- direction: IMPORT atau EXPORT
- shipper, consignee, notify party, carrier/airline/shipping line
- optional ETA/ETD dan origin/destination
- daftar alokasi CIPL item tidak kosong sebelum READY_FOR_CUSTOMS
- attachment dokumen
- lifecycle status
- optional legacyReference
```

`TransportDocument` adalah sum type:

```text
BL(number, shipmentMode: optional FCL/LCL)
atau
AWB(number)
```

Satu Shipment tidak menyimpan B/L dan AWB sekaligus. Apabila satu CIPL mempunyai keduanya, bentuklah dua Shipment.

Lifecycle minimum:

```text
DRAFT | DOCUMENT_RECEIVED | UNDER_REVIEW | READY_FOR_CUSTOMS | ON_HOLD | CANCELLED
```

### `ShipmentAllocation`

```text
ShipmentAllocation terdiri dari:
- shipmentId
- ciplVersionId
- ciplItemId
- quantity positif
- unit yang sama dengan CIPL item
```

Invariant:

- Item harus berasal dari `sourceCiplVersionId` Shipment.
- Total alokasi seluruh Shipment terhadap satu item tidak boleh melebihi quantity item tersebut.
- Rekonsiliasi dilakukan per unit; konversi unit hanya boleh dilakukan jika basis konversi disimpan secara eksplisit.

### `CustomsJob`

```text
CustomsJob terdiri dari:
- identity
- jobNumber unik dan tidak digunakan ulang
- shipmentId
- documentType: BC_2_3, BC_2_5, atau BC_3_0
- optional ajuNumber
- optional registrationNumber (Nopen) dan registrationDate
- optional warehouseId/warehouseName
- optional assignedToId
- billing information
- lifecycle status
- daftar alokasi item
- attachment/evidence
- notes, createdAt, dan updatedAt
```

Lifecycle Job:

```text
DRAFT
→ PREPARING
→ SUBMITTED
→ REGISTERED
→ RELEASED
→ COMPLETED
```

`ON_HOLD` dan `CANCELLED` adalah state eksplisit, bukan nilai kosong. Implementasi tidak boleh menganggap urutan di atas sebagai jaminan persetujuan pabean. Reopening atau koreksi status harus menyimpan alasan dan timestamp perubahan.

### `JobAllocation`

```text
JobAllocation terdiri dari:
- customsJobId
- ciplItemId
- quantity positif
- unit yang sama dengan parent ShipmentAllocation
```

Invariant:

- Job hanya boleh mengambil item yang dialokasikan ke parent Shipment.
- Total quantity seluruh Job untuk item yang sama tidak boleh melebihi quantity pada Shipment.
- Quantity nol, negatif, atau unit berbeda ditolak.

### `BillingInformation`

```text
BillingInformation adalah salah satu dari:
- NOT_APPLICABLE(reason)
- NOT_READY
- READY(amount, currency)
- INVOICED(invoiceReference, amount, currency, invoicedAt)
- PAID(paymentReference, paidAt)
```

Tagihan tidak direpresentasikan sebagai angka default `0.00`, karena nol, belum dihitung, dan tidak berlaku mempunyai arti berbeda.

## 4. Mapping IndexedDB

Naikkan `databaseVersion` dari 4 ke 5 dan pertahankan store lama selama masa migrasi.

Object store baru:

| Store | Key | Index minimum |
|---|---|---|
| `coordinationAgents` | `id` | `eventExhibitorId`, `status` |
| `cipls` | `id` | `eventExhibitorId`, `status`, `activeVersionId` |
| `ciplVersions` | `id` | `ciplId`, gabungan logis `ciplId + versionNumber` |
| `shipmentsV2` | `id` | `ciplId`, `sourceCiplVersionId`, `documentNumber`, `status` |
| `customsJobs` | `id` | `shipmentId`, `jobNumber`, `documentType`, `status` |
| `counters` | `name` | tidak ada |
| `migrationReviewItems` | `id` | `legacyStore`, `legacyId`, `status` |

Alokasi item disimpan sebagai list value object di dalam `Shipment` dan `CustomsJob`. Hal ini cukup untuk skala MVP dan memastikan aggregate beserta alokasinya ditulis atomik. Jika skala data kemudian memerlukan pencarian lintas-alokasi, pemisahan object store dilakukan pada versi database berikutnya tanpa mengubah model domain.

Blob disimpan bersama record versi atau aggregate pemiliknya:

- PDF CIPL pada `CIPLVersion`.
- PDF B/L/AWB pada `Shipment`.
- Dokumen BC dan evidence pada `CustomsJob`.

Semua operasi create/update menggunakan satu transaksi yang mencakup seluruh store yang terlibat.

## 5. Strategi migrasi non-destruktif

Migrasi harus idempotent: setiap legacy ID mempunyai migration marker sehingga menjalankan upgrade atau recovery kembali tidak membuat duplikasi.

### 5.1 Aturan konversi `LocalJob`

1. Jangan menganggap `LocalJob` lama sebagai `CustomsJob`, karena record tersebut berisi data shipment dan tidak mempunyai jenis dokumen BC.
2. Simpan `jobNumber` lama sebagai `legacyReference` pada Shipment hasil migrasi.
3. Jika `eventId` dan `exhibitorId` menunjuk record yang masih ada, gunakan relasi tersebut.
4. Jika exhibitor tidak tersedia tetapi shipper mempunyai nilai, jangan otomatis membuat atau mencocokkan exhibitor berdasarkan nama. Buat `migrationReviewItem` agar pengguna memilih exhibitor yang benar.
5. Jika parent event tidak tersedia, pertahankan legacy record dan buat `migrationReviewItem`; jangan membuat event fiktif.
6. Buat placeholder CIPL berstatus `AWAITING_DOCUMENT` hanya setelah event dan exhibitor telah diketahui. Placeholder diberi metadata bahwa sumber CIPL belum tersedia.
7. Jika hanya `blNumber` yang ada, buat satu Shipment `BL`.
8. Jika hanya `awbNumber` yang ada, buat satu Shipment `AWB`.
9. Jika B/L dan AWB sama-sama ada, buat dua Shipment di bawah placeholder CIPL dan tandai alokasinya `UNRESOLVED`; jangan menggabungkan keduanya dalam satu Shipment.
10. Jika keduanya kosong, jangan membentuk Shipment operasional. Masukkan record ke migration review.
11. Jangan membentuk `CustomsJob` sampai pengguna menentukan jenis BC dan data minimum Job.

### 5.2 File dan stage lama

- `LocalJobDocument` dipindahkan secara logis ke Shipment yang terbentuk. Blob lama tidak dihapus sampai marker migrasi menyatakan copy berhasil.
- Jika dua Shipment terbentuk dari satu legacy record dan jenis file tidak dapat ditentukan, file tetap berada pada legacy record dan dibuat migration review item.
- Stage lama dipertahankan sebagai legacy checklist/read-only history. Stage tidak digunakan untuk menyimpulkan status CustomsJob.

### 5.3 Penyelesaian migrasi

- Store `jobs`, `stages`, dan `jobDocuments` lama tetap ada pada versi 5 untuk rollback dan audit.
- Setelah semua record mempunyai marker `MIGRATED` atau `REVIEW_REQUIRED`, aplikasi baru membaca model v2 dan menampilkan jumlah item yang perlu direkonsiliasi.
- Penghapusan store lama bukan bagian MVP ini.

## 6. Perubahan alur aplikasi yang direncanakan

Visual, warna, layout, serta komponen dasar yang sekarang dipertahankan.

### Event dan exhibitor

- Event detail tetap menjadi entry point.
- Daftar exhibitor menampilkan jumlah CIPL, shipment, dan Job.
- Modal exhibitor mempertahankan ID record lama dan menyediakan agent sebagai daftar opsional.
- Local exhibitor tidak diwajibkan mempunyai country code atau agent luar negeri.

### CIPL

- Tambahkan aksi “Tambah CIPL” pada exhibitor.
- Upload atau input CIPL membuat versi pertama, bukan Job.
- Detail CIPL menampilkan versi aktif, riwayat revisi, item, dan hasil rekonsiliasi alokasi.
- Upload revisi membuat versi berikutnya. Shipment lama tetap menunjuk versi yang digunakan saat dibuat.

### Shipment

- Tambahkan aksi “Buat shipment” dari CIPL aktif.
- Pengguna memilih tepat satu jenis B/L atau AWB dan mengalokasikan item/quantity.
- B/L dan AWB dari CIPL yang sama dibuat sebagai record terpisah.
- Parser PDF yang sudah ada dapat digunakan sebagai smart fill, tetapi hasil parsing selalu dapat dikoreksi sebelum disimpan.

### Job

- Tambahkan aksi “Buat Job” dari detail Shipment.
- Form meminta jenis BC dan alokasi item. Field operasional lain boleh diisi bertahap sesuai lifecycle.
- Detail Job mempertahankan tampilan/status yang ada, tetapi sumber datanya adalah `CustomsJob` dan parent Shipment ditampilkan sebagai konteks.
- Dokumen/evidence dapat dibuka kembali dari detail Job.

## 7. Command dan validasi aplikasi

Interface operasi penyimpanan yang disarankan:

```text
createCipl(eventExhibitorId, initialVersion?) -> CIPL
addCiplVersion(ciplId, versionInput) -> CIPLVersion
activateCiplVersion(ciplId, versionId) -> CIPL
createShipment(ciplId, sourceVersionId, input, allocations) -> Shipment
updateShipment(shipmentId, patch) -> Shipment
createCustomsJob(shipmentId, input, allocations) -> CustomsJob
updateCustomsJob(jobId, patch, changeReason?) -> CustomsJob
saveEventExhibitors(eventId, create/update/delete commands) -> EventExhibitor[]
deleteEvent(eventId) -> success | DEPENDENCIES_EXIST
```

Validation functions:

```text
validateCiplVersionReady(version)
validateShipmentAllocation(ciplVersion, existingShipments, candidate)
validateJobAllocation(shipment, existingJobs, candidate)
validateJobTransition(previousStatus, nextStatus, evidence)
validateEventDeletion(eventId)
```

Aturan error:

- Error validasi menampilkan masalah spesifik dan tidak menulis data.
- Quota/file failure membatalkan seluruh transaksi.
- Missing parent menghasilkan error, bukan record orphan.
- Parser eksternal gagal tidak menghapus file dan tidak menghalangi input manual.
- Perubahan status mundur atau reopening meminta alasan dan mencatat waktu perubahan.

## 8. Urutan implementasi berikutnya

### Tahap 1 — Fondasi data

1. Tambahkan type domain pameran dan validation functions terpisah dari model `domain/v2` yang lebih luas.
2. Tambahkan object store versi 5, index, counter, dan transaction helpers.
3. Implementasikan migrasi idempotent serta migration review queue.
4. Tambahkan unit test hierarchy, allocation, lifecycle, dan migrasi.

### Tahap 2 — Perbaikan integritas yang ada

1. Ubah save exhibitor menjadi create/update/delete berbasis ID stabil.
2. Pastikan update tidak menghapus parent ID atau metadata tersembunyi.
3. Guard penghapusan event yang mempunyai dependency.
4. Gunakan transaksi atomik untuk metadata dan Blob.
5. Ubah tanggal event menjadi date-only dan izinkan event satu hari.

### Tahap 3 — Alur CIPL dan shipment

1. Tambahkan CIPL dan version history pada detail exhibitor.
2. Tambahkan item editor serta rekonsiliasi quantity.
3. Tambahkan pembuatan B/L atau AWB dari versi CIPL aktif.
4. Adaptasikan smart fill PDF ke aggregate Shipment.

### Tahap 4 — CustomsJob

1. Tambahkan pembuatan satu dokumen BC per Job.
2. Tambahkan status, nomor aju, Nopen/tanggal, gudang, PIC, billing, dan evidence.
3. Tambahkan daftar Job pada Shipment dan roll-up count pada exhibitor/event.
4. Pertahankan stage bebas hanya sebagai checklist tambahan.

## 9. Acceptance test

### Domain dan relasi

- Exhibitor lokal dapat disimpan tanpa agent.
- Exhibitor internasional dapat mempunyai nol, satu, atau beberapa agent.
- Edit atau tambah exhibitor tidak mengubah ID exhibitor lain.
- Satu exhibitor dapat mempunyai beberapa CIPL; satu CIPL tidak dapat dipindahkan diam-diam ke exhibitor lain.
- CIPL v1 dan v2 tersimpan, tepat satu aktif, dan Shipment lama tetap menunjuk v1 jika dibuat dari v1.
- Satu CIPL dapat menghasilkan satu B/L dan satu AWB sebagai dua Shipment.
- Satu Shipment dapat menghasilkan BC 2.3, BC 2.5, dan BC 3.0 sebagai tiga Job.
- Dua Job BC 2.3 pada Shipment yang sama diperbolehkan jika nomor Job berbeda.
- Satu Job tidak dapat menunjuk lebih dari satu Shipment.

### Allocation

- Total alokasi Shipment yang sama dengan quantity CIPL diterima.
- Alokasi yang melebihi quantity CIPL ditolak tanpa partial write.
- Job hanya dapat memakai item yang ada pada parent Shipment.
- Total alokasi Job yang melebihi Shipment ditolak.
- Quantity nol/negatif dan unit berbeda ditolak.
- Revisi CIPL tidak mengubah alokasi yang sudah merujuk versi lama.

### Integritas operasi

- Edit Job tidak melepas event, exhibitor, CIPL, Shipment, attachment, atau source metadata.
- Kegagalan penyimpanan Blob tidak meninggalkan CIPL, Shipment, atau Job setengah jadi.
- Event dengan data turunan tidak dapat dihapus.
- Nomor Job tetap unik pada dua create yang terjadi hampir bersamaan.
- Event satu hari dapat disimpan dan tanggalnya sama di timezone WIB maupun timezone browser lain.

### Migrasi

- Migrasi dapat dijalankan ulang tanpa menggandakan CIPL atau Shipment.
- Legacy record dengan B/L saja menjadi satu Shipment B/L.
- Legacy record dengan AWB saja menjadi satu Shipment AWB.
- Legacy record dengan B/L dan AWB menjadi dua Shipment berstatus perlu rekonsiliasi.
- Legacy record tanpa parent atau transport document tetap tersedia dalam migration review queue.
- Tidak ada CustomsJob fiktif yang dibuat dari legacy `LocalJob`.
- Blob dan nomor referensi lama tetap dapat ditelusuri setelah migrasi.

### Verifikasi teknis

```bash
npx tsc --noEmit
npm run domain:test
npm run build
```

Tambahkan test khusus domain pameran dan IndexedDB migration. Gunakan fake IndexedDB untuk unit test transaksi dan browser test untuk memastikan data bertahan setelah reload.

## 10. Batas kepabeanan

Jenis BC, nomor, status, serta hubungan antar dokumen adalah fakta operasional yang boleh direkam aplikasi. Namun aplikasi MVP tidak boleh:

- Menentukan otomatis bahwa suatu barang memenuhi fasilitas tertentu.
- Menyamakan seluruh item dalam shipment jika intended use atau disposal berbeda.
- Menyatakan HS, LARTAS, tarif, jaminan, atau persetujuan sebagai final tanpa verifikasi berwenang.
- Menganggap status `COMPLETED` sebagai bukti seluruh kewajiban pabean selesai tanpa evidence yang ditetapkan PPJK penanggung jawab.

Apabila kelak fitur recommendation ditambahkan, hasilnya harus diberi status `PROVISIONAL`, `READY_FOR_OPERATIONAL_REVIEW`, atau `REQUIRES_AUTHORITY_CONFIRMATION` dan dipisahkan dari fakta dokumen yang telah diterbitkan.
