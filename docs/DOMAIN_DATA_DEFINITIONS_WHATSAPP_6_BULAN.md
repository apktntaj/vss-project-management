# Domain Data Definitions — Project Management Operasional VSS

**Status:** Draft siap untuk review operasional  
**Periode evidence:** 18 Februari 2026–18 Agustus 2026 (WIB)  
**Satu-satunya sumber fakta proyek:** `docs/whatsapp-operational-vss.txt`  
**Metode:** information analysis dan data definitions ala *How to Design Programs* (HtDP)

Dokumen ini mendefinisikan informasi yang perlu dipahami aplikasi project management. Ini bukan schema database, desain API, atau rancangan layar.

## 1. Tujuan dan batas model

Model harus membantu staf dan supervisor menjawab:

1. Project apa yang sedang berjalan dan siapa PIC-nya?
2. Pekerjaan apa yang harus dilakukan, kapan, di mana, dan untuk barang mana?
3. Informasi, dokumen, approval, atau resource apa yang masih kurang?
4. Siapa dan kendaraan/alat apa yang sudah ditugaskan?
5. Di mana barang berada, berapa jumlahnya, dan bagaimana kondisinya?
6. Apa yang berubah dari rencana awal dan siapa yang mengubahnya?
7. Bukti apa yang menunjukkan pekerjaan benar-benar selesai?
8. Untuk barang MICE lintas batas, item mana yang harus kembali, tetap, diperiksa, atau diselesaikan kewajiban pabeannya?

Dalam periode tersebut terdapat 8.757 pesan bertanggal pada 174 hari aktif. Hitungan kata kunci memperlihatkan pola dominan berupa media/evidence, waktu relatif, cargo, dokumen, perubahan/blocker, delivery, warehouse, resource, event, serta pekerjaan customs. Angka ini hanya petunjuk penemuan pola, bukan jumlah project atau ukuran performa.

### Keterbatasan evidence

- Banyak lampiran hanya tampil sebagai `<Media omitted>`.
- Chat tidak memakai nomor project atau task secara konsisten.
- Instruksi tersebar di beberapa pesan dan sering direvisi.
- Pesan yang diedit atau dihapus tidak menyediakan seluruh sejarah.
- Nama dalam chat belum selalu menunjukkan legal entity atau role resminya.
- Singkatan seperti `FO` dipertahankan sebagai kosakata operasional; kepanjangannya tidak ditebak.
- Ketentuan hukum, HS, LARTAS, tarif, fasilitas, dan prosedur resmi tidak ditetapkan oleh chat ini.

### Status pernyataan

- **Fakta chat:** langsung terlihat dalam sumber.
- **Interpretasi:** kesimpulan information analysis dari pola chat.
- **Proposal konsultan customs:** informasi tambahan yang disarankan agar project MICE dapat dikendalikan dengan aman. Proposal ini bukan keputusan resmi DJBC.

## 2. Information statements

1. Satu `Project` terdiri dari satu atau lebih pekerjaan yang mempunyai tujuan operasional bersama.
2. Satu pesan dapat memengaruhi beberapa pekerjaan; satu pekerjaan dapat dibentuk dan diperbarui oleh beberapa pesan.
3. Informasi dapat diketahui, belum diketahui, tidak berlaku, atau bertentangan. Keempat keadaan itu berbeda.
4. Waktu yang diminta, waktu yang direncanakan, dan waktu aktual dapat berbeda dan harus hidup berdampingan.
5. Ungkapan seperti “besok” hanya bermakna jika waktu pesan dan zona waktunya dipertahankan.
6. Kebutuhan resource berbeda dari assignment resource konkret.
7. Pekerjaan dapat sedang berjalan sekaligus mempunyai blocker aktif.
8. File dokumen berbeda dari status kesiapan dan hasil verifikasi dokumen.
9. Barang yang sama dapat melewati pickup, warehouse, move-in, booth, move-out, dan pengiriman lanjutan tanpa kehilangan identitasnya.
10. Quantity rencana, quantity aktual, dan hasil rekonsiliasi tidak boleh saling menimpa.
11. Perubahan jadwal, tujuan, jumlah, kendaraan, atau instruksi merupakan informasi domain, bukan sekadar edit terakhir.
12. Pekerjaan selesai hanya jika hasil aktual dan evidence yang dibutuhkan tersedia.
13. Satu event mempunyai milestone yang saling bergantung, tetapi pekerjaan dapat berjalan paralel.
14. **Proposal konsultan customs:** treatment harus ditetapkan per item atau kelompok item identik, bukan otomatis per shipment.
15. **Proposal konsultan customs:** perubahan intended disposal—misalnya dari kembali ke luar negeri menjadi dikirim ke pembeli lokal—harus menjadi exception yang memerlukan review.
16. **Proposal konsultan customs:** project temporary goods belum selesai hanya karena move-out selesai; kewajiban close-out juga harus selesai.

## 3. Peta konsep

```text
SourceMessage ───────────────┐
                            ↓
PartyParticipation → Project → Task → Assignment
                         │       ├── DocumentRequirement
                         │       ├── Blocker
                         │       └── Evidence
                         ├── CargoItem → InventoryEvent
                         ├── Milestone
                         ├── ChangeRecord
                         └── CustomsControl (hanya jika relevan)
                                  └── ItemCustomsDecision
                                      └── CustomsCloseOut
```

`Project` bukan customer, event, shipment, atau task. Project adalah wadah pengendalian pekerjaan. Event, shipment, dan warehouse operation adalah konteks project. Satu project MICE dapat mempunyai lebih dari satu konteks sekaligus.

## 4. Data definitions dasar

### `Information<T>`

**Definisi**

```text
Information<T> adalah salah satu dari:
- Known(value, daftar sumber tidak kosong)
- Unknown(reason, owner pencarian informasi)
- NotApplicable(reason)
- Conflicting(daftar kandidat tidak kosong, owner resolusi)
```

**Interpretasi**

Merepresentasikan tingkat pengetahuan tim mengenai satu fakta. `Unknown` bukan nilai kosong dan `Conflicting` bukan perubahan yang sudah diputuskan.

**Contoh**

- `Known(jumlah = 3 package, sumber = pesan 18 Agustus)`.
- `Unknown(FO, owner = CS)` ketika disebut “FO menyusul” (baris 8.604 dan seterusnya).
- `Conflicting(lokasi = Gudang Wira atau Pesa)` sebelum koreksi dikonfirmasi (baris 19.170–19.171).
- `NotApplicable(destination, alasan = task hanya pemeriksaan di lokasi)`.

**Template pemrosesan**

```text
Jika Known → gunakan nilai dan tampilkan sumbernya
Jika Unknown → buat information gap
Jika NotApplicable → jangan meminta nilai; pertahankan alasannya
Jika Conflicting → tahan keputusan terkait sampai ada resolusi
```

**Invariant**

- `Known` mempunyai minimal satu sumber.
- `Conflicting` mempunyai minimal dua kandidat yang dapat dibedakan.
- Nilai hasil resolusi konflik dibuat sebagai fakta baru; kandidat lama tidak dihapus.

### `SourceMessage`

**Definisi**

```text
SourceMessage terdiri dari:
- identitas sumber dan rentang baris
- timestamp dengan zona waktu
- label pengirim
- isi teks dan/atau penanda lampiran
- keadaan pesan: Original, Edited, Deleted, atau System
```

**Interpretasi**

Sumber yang menjelaskan dari mana fakta, instruksi, perubahan, atau evidence berasal. Label pengirim belum otomatis merupakan identitas legal seseorang.

**Contoh**

Instruksi ekspor, tujuan, dimensi, pembagian barang, kendaraan, dan status barang pada baris 19.175–19.213 merupakan beberapa `SourceMessage`, bukan satu record project siap pakai.

**Template pemrosesan**

```text
Klasifikasikan pesan sebagai request, update, correction, decision, evidence, atau noise
Tautkan pesan ke setiap informasi domain yang didukungnya
Jika Edited/Deleted → tandai keterbatasan sejarah
```

**Invariant**

- Timestamp sumber tidak berubah ketika fakta dinormalisasi.
- Media yang tidak tersedia tidak boleh dianggap sebagai evidence yang sudah diverifikasi.

### `RequestedSchedule`

**Definisi**

```text
RequestedSchedule adalah salah satu dari:
- ExactMoment(timestamp berzona waktu)
- BoundedWindow(start, end, zona waktu)
- RelativeExpression(text, anchor timestamp)
```

**Interpretasi**

Cara peminta menyatakan waktu. Waktu ini berbeda dari jadwal yang akhirnya disepakati dan waktu aktual.

**Contoh**

- `RelativeExpression("besok", anchor = 18 Agustus 2026 16:16 WIB)`.
- `ExactMoment(20 Februari 2026 08:00 WIB)`.
- `BoundedWindow(20 Februari 2026 08:00–17:30 WIB)` dari baris 8.591–8.599.

**Template pemrosesan**

```text
Jika ExactMoment → gunakan sebagai permintaan
Jika BoundedWindow → periksa start < end
Jika RelativeExpression → selesaikan terhadap anchor lalu minta konfirmasi
```

**Invariant**

- Jadwal planning-ready tidak berupa `RelativeExpression`.
- Start selalu lebih awal dari end.

### `Quantity`

**Definisi**

```text
Quantity terdiri dari angka positif, unit, dan basis pengukuran.
```

Unit dapat berupa package, koli, pallet, peti, karton, drum, pail, unit barang, kilogram, atau satuan operasional lain yang tertulis pada sumber.

**Interpretasi**

Jumlah barang atau resource beserta satuannya. `3 package`, `3 unit mesin`, dan `3 ton` bukan nilai yang dapat saling menggantikan.

**Contoh**

`10 pail / 200 kg` menyimpan dua quantity berbeda dari pesan 18 Agustus pada baris 19.204–19.211.

**Invariant**

- Angka harus lebih besar dari nol.
- Unit wajib hadir.
- Konversi hanya dilakukan jika basis konversinya diketahui.

## 5. Project dan partisipasi

### `OperationalScope`

**Definisi**

```text
OperationalScope adalah salah satu dari:
- EventScope(event name, venue, kota, milestone event)
- ShipmentScope(direction, moda, origin country, destination country,
                transport references, ETA/ETD)
- WarehouseScope(location, tujuan penyimpanan, periode)
- LocalOperationScope(description)
```

**Interpretasi**

Menjelaskan konteks kerja project. Sebuah project event dapat sekaligus mempunyai import shipment, warehouse staging, move-in, move-out, dan export shipment; karena itu `Project` menyimpan daftar scope, bukan satu pilihan tunggal.

**Contoh**

Project pameran Mei dapat memuat `EventScope`, beberapa `ShipmentScope`, dan `WarehouseScope`, sebagaimana koordinasi technical meeting, BC 2.3, move-in, penyimpanan, dan move-out terlihat pada baris 10.318–13.138.

**Template pemrosesan**

```text
Untuk setiap scope → proses informasi khusus scope
EventScope → periksa venue dan milestone
ShipmentScope → periksa arah, rute, reference, ETA/ETD
WarehouseScope → periksa lokasi, periode, dan inventory
LocalOperationScope → periksa deskripsi dan batas kerja
```

### `PartyParticipation`

**Definisi**

```text
PartyParticipation terdiri dari:
- party reference
- satu atau lebih role dalam project
- periode role
- sumber penetapan role
```

Role yang ditemukan atau diperlukan meliputi customer, agent, exhibitor, organizer, venue, forwarder, vendor, driver, field operations, warehouse, CS, document/customs, finance, dan supervisor.

**Interpretasi**

Role melekat pada partisipasi dalam project, bukan selalu pada party untuk selamanya. Nama exhibitor tidak otomatis menjadi billing customer atau importer/exporter legal.

**Invariant**

- Setiap role yang memegang deadline atau approval mempunyai PIC yang dapat dihubungi sebelum task menjadi ready.
- Role legal customs yang belum dikonfirmasi tetap `Unknown`, bukan ditebak dari nama di chat.

### `Project`

**Definisi**

```text
Project terdiri dari:
- project identity dan nama kerja
- daftar OperationalScope tidak kosong
- periode
- daftar PartyParticipation tidak kosong
- daftar CargoItem, boleh kosong untuk project non-cargo
- daftar Task tidak kosong
- daftar Milestone
- CustomsControl
- daftar ChangeRecord
- daftar SourceMessage tidak kosong
```

**Interpretasi**

Payung pengendalian untuk tujuan operasional yang sama. Batas satu project adalah hipotesis bisnis yang perlu dikonfirmasi pengguna, bukan ditentukan oleh satu chat message.

**Contoh**

- Satu event dengan pekerjaan technical meeting, pre-arrival, clearance, move-in, onsite, move-out, dan export return.
- Satu operasi berulang warehouse dan delivery bahan kimia ke beberapa customer.

**Template pemrosesan**

```text
Proses scope dan pihak
Proses setiap cargo item
Proses milestone dan task
Jika CustomsControl berlaku → proses per item sampai close-out
Proses change record untuk menentukan rencana terkini
```

**Invariant**

- Project mempunyai minimal satu scope, satu participant, satu task, dan satu sumber.
- Dua project tidak disatukan hanya karena memakai kendaraan atau warehouse yang sama.
- Project tidak dinyatakan selesai selama masih ada task wajib atau customs obligation terbuka.

## 6. Cargo dan lokasi

### `CargoItem`

**Definisi**

```text
CargoItem terdiri dari:
- item identity internal
- Information tentang owner
- Information tentang uraian barang
- Information tentang fungsi
- Information tentang material/komposisi
- daftar identifier: marking, lot, model, serial, case, atau package number
- daftar Quantity tidak kosong ketika siap direncanakan
- Information tentang berat dan dimensi
- packaging
- condition
- intended use
- intended disposal
- daftar InventoryEvent
- daftar sumber tidak kosong
```

**Interpretasi**

Barang atau kelompok barang identik yang dapat diberi rencana dan treatment yang sama. Package adalah kemasan fisik; item adalah barang yang keputusan penggunaannya dapat berbeda.

**Contoh**

- Satu additive: lot tertentu, `1 drum / 200 kg`.
- Enam pallet yang masing-masing berdimensi tertentu.
- Mesin display yang harus dapat dicocokkan ketika export kembali.
- Paper bag yang dipisahkan karena isu LARTAS pada baris 13.867 dan seterusnya.

**Template pemrosesan**

```text
Periksa identity, description, quantity, condition, dan current location
Periksa kebutuhan handling dari berat/dimensi/packaging
Periksa intended use dan intended disposal
Jika terkait customs → delegasikan ke ItemCustomsDecision
```

**Invariant**

- Item berbeda dipisahkan jika intended disposal atau customs treatment berbeda.
- Barang returnable mempunyai identifier yang cukup untuk rekonsiliasi sebelum customs plan dinyatakan ready.
- Planned quantity tidak menimpa actual quantity.
- `Unknown condition` berbeda dari `Good condition`.

### `InventoryEvent`

**Definisi**

```text
InventoryEvent adalah salah satu dari:
- Received(location, quantity, condition, time, evidence)
- Moved(from, to, quantity, time, task, evidence)
- Loaded(location, vehicle, quantity, time, evidence)
- Unloaded(location, quantity, condition, time, evidence)
- Adjusted(previous quantity, actual quantity, reason, approver, time)
- Held(location, reason, time)
- Released(location, quantity, time, evidence)
```

**Interpretasi**

Riwayat append-only untuk menghitung posisi, jumlah, dan kondisi terkini. Contohnya barang ekspor yang dilaporkan sudah turun di gudang Bimaruna pada baris 9.124–9.125.

**Template pemrosesan**

```text
Urutkan berdasarkan waktu kejadian
Rekonsiliasi quantity dari event sebelumnya
Hasilkan current location dan current condition
Jika mismatch → buat blocker/exception
```

**Invariant**

- Event tidak dihapus ketika barang berpindah lagi.
- Quantity keluar tidak boleh melebihi quantity tersedia tanpa `Adjusted` yang disetujui.

## 7. Task, readiness, dan execution

### `Task`

**Definisi**

```text
Task adalah salah satu dari:
- MovementTask(base, action, origin, destination, cargo items, resource requirements)
- HandlingTask(base, action, location, cargo items, resource requirements)
- CustomsTask(base, action, customs location, cargo items, document requirements)
- AdministrativeTask(base, action, subject, document requirements)
```

`base` terdiri dari task identity, judul, requester, requested time, planned time, deadline, priority, readiness, execution, blockers, dependencies, evidence requirements, dan sources.

Movement action meliputi pickup, delivery, transfer, move-in, dan move-out. Handling action meliputi loading, unloading, packing, unpacking, repacking, installation, survey, dan warehouse handling. Customs action meliputi document preparation, inspection, release, export, import, dan close-out. Administrative action meliputi quotation, booking, document courier, reporting, dan billing preparation.

**Interpretasi**

Unit kerja konkret yang dapat direncanakan, diberikan kepada PIC, dipantau, dan dibuktikan selesai. Satu request dapat menghasilkan beberapa task jika tujuan atau waktunya berbeda.

**Contoh**

Pesan 18 Agustus mengenai tiga tujuan/keperluan barang menghasilkan minimal tiga movement tasks, bukan satu task dengan catatan panjang (baris 19.204–19.211).

**Template pemrosesan**

```text
Proses base
Jika Movement → periksa origin, destination, cargo, dan transport
Jika Handling → periksa location, action, cargo, dan alat
Jika Customs → periksa customs location, item, dokumen, dan approval
Jika Administrative → periksa subject, output, dan penerima output
```

**Invariant**

- Movement task planning-ready mempunyai origin dan destination yang diketahui.
- Handling task planning-ready mempunyai location yang diketahui.
- Customs task planning-ready mempunyai minimal satu item dan kebutuhan dokumen yang dinyatakan.
- Task completed mempunyai actual completion dan evidence minimum.

### `Readiness`

**Definisi**

```text
Readiness adalah salah satu dari:
- NeedsInformation(daftar InformationGap tidak kosong)
- Ready(confirmedAt, confirmedBy)
```

`InformationGap` terdiri dari informasi yang kurang/konflik, dampak, owner, dan due time.

**Interpretasi**

Menjawab apakah task cukup lengkap untuk direncanakan. Ini terpisah dari execution. FO yang menyusul, dimensi yang belum ada, atau instruksi delivery yang belum pasti adalah gap nyata.

**Contoh**

Pada baris 9.310–9.325, SPPB dan BC 2.3 tersedia tetapi DO masih ditunggu. Task tidak boleh dianggap dokumennya lengkap hanya karena sebagian file sudah ada.

**Invariant**

- `Ready` tidak mempunyai planning-critical gap aktif.
- Override readiness, jika diizinkan bisnis, selalu memuat actor, alasan, waktu, dan risiko yang diterima.

### `ExecutionState`

**Definisi**

```text
ExecutionState adalah salah satu dari:
- NotStarted
- Planned(assignments tidak kosong, planned schedule)
- InProgress(startedAt, latest update)
- Completed(completedAt, outcome, evidence tidak kosong)
- Cancelled(cancelledAt, reason, actor)
- Failed(failedAt, reason, next action)
```

**Interpretasi**

Keadaan pelaksanaan task. Blocker tidak menjadi execution state karena pekerjaan dapat sudah berjalan saat mengalami hambatan.

**Contoh**

- Kendaraan kembali karena container belum stripping: task dapat `Failed` atau dihentikan lalu dibuat rencana ulang (baris 8.584–8.588).
- Shipment 2×40 dibatalkan dan ETA LCL berubah: perubahan tidak menghapus rencana sebelumnya (baris 9.275–9.282).

**Invariant**

- `Planned` mempunyai assignment konkret.
- `Completed` mempunyai outcome aktual dan evidence.
- `Cancelled` mempunyai alasan dan actor.

### `Blocker`

**Definisi**

```text
Blocker adalah salah satu dari:
- OpenBlocker(type, description, openedAt, owner, expectedResolution)
- ResolvedBlocker(seluruh data OpenBlocker, resolvedAt, resolution, evidence)
```

**Interpretasi**

Hambatan seperti barang belum siap, dokumen belum ada, approval belum turun, akses venue belum dibuka, resource tidak tersedia, warehouse penuh, atau kondisi barang bermasalah.

**Contoh**

- DO belum tersedia pada baris 9.310–9.325.
- Pintu loading baru dapat dibuka setelah event sebelah selesai pada baris 12.722–12.728.
- Handlift tidak tersedia pada baris 13.867–13.872.

**Invariant**

- Blocker aktif selalu mempunyai owner.
- Blocker yang selesai tidak dihapus atau dibuka kembali; recurrence menjadi blocker baru.

## 8. Resource dan assignment

### `ResourceRequirement`

**Definisi**

```text
ResourceRequirement adalah salah satu dari:
- PersonRequirement(role, quantity, skill)
- VehicleRequirement(type/capacity, quantity, dimensional constraints)
- EquipmentRequirement(type, quantity, capacity)
- VendorServiceRequirement(service, quantity/period)
```

**Interpretasi**

Menyatakan apa yang dibutuhkan sebelum unit konkretnya dipilih. Pemilihan kendaraan bergantung pada dimensi, berat, akses, dan urutan pekerjaan; bukan hanya preferensi.

**Contoh**

`1 driver + 1 ops + 2 hand pallet kapasitas 3–3,5 ton` pada baris 8.591–8.599.

**Invariant**

- Quantity resource positif.
- Vehicle/equipment capacity harus diketahui atau menjadi gap jika dibutuhkan untuk safety/planning.

### `Assignment`

**Definisi**

```text
Assignment terdiri dari:
- tepat satu task
- tepat satu resource konkret
- assigned time window
- status: Proposed, Confirmed, Acknowledged, Released, atau Cancelled
- assigner dan source
```

**Interpretasi**

Keputusan memakai driver, kendaraan, alat, atau vendor tertentu untuk task tertentu. Daily planning pada baris 10.873–10.893 dan 18.035–18.062 memperlihatkan assignment yang saling bergantung dan sering berubah.

**Template pemrosesan**

```text
Periksa kecocokan requirement
Periksa overlap waktu
Periksa lokasi sebelum dan sesudah assignment
Jika berubah → buat ChangeRecord dan beri tahu pihak terdampak
```

**Invariant**

- Satu assignment tidak menunjuk beberapa resource sekaligus.
- Resource yang sama tidak memiliki waktu overlap tanpa override tercatat.
- Assignment cancelled tidak dianggap memenuhi requirement.

## 9. Dokumen, evidence, dan perubahan

### `DocumentRequirement`

**Definisi**

```text
DocumentRequirement adalah salah satu dari:
- Needed(type, scope, owner, due time)
- Requested(type, scope, requestedAt, requestedFrom)
- Received(type, scope, receivedAt, source/file)
- Verified(type, scope, received data, verifiedAt, verifier, validity)
- Rejected(type, scope, received data, reason, reviewer)
- Used(type, scope, verified data, usedAt, task)
- NotApplicable(type, reason, decider)
```

**Interpretasi**

Checklist kesiapan dokumen yang mempertahankan lifecycle, bukan sekadar file upload. Jenis yang muncul dalam chat antara lain FO, packing list, SPPB, BC 2.3, DO, PEB, surat jalan, surat loading, izin kendaraan, dan dokumen ATA.

**Invariant**

- `Verified` selalu memiliki verifier dan waktu.
- `Used` berasal dari dokumen yang dapat ditelusuri.
- File yang diterima belum otomatis verified.
- Expiry, bila relevan, menghasilkan blocker sebelum lewat masa berlaku.

### `Evidence`

**Definisi**

```text
Evidence terdiri dari:
- subject: task, cargo item, document, atau customs close-out
- evidence type
- source/file reference
- captured/submitted time
- submitter
- location jika relevan
- verification: Pending, Accepted, atau Rejected(reason)
```

**Interpretasi**

Bukti foto kondisi, pickup, loading, unloading, delivery, tanda terima, inspection, atau laporan. Permintaan foto untuk laporan Bea Cukai terlihat pada baris 13.784 dan seterusnya.

**Invariant**

- `<Media omitted>` tanpa file asli hanya menjadi referensi sumber, bukan evidence terverifikasi.
- Evidence rejected tidak memenuhi completion requirement.

### `ChangeRecord`

**Definisi**

```text
ChangeRecord terdiri dari:
- subject
- previous information
- new information
- change type
- reason
- actor
- occurredAt
- source
- pihak yang harus diberi tahu
```

**Interpretasi**

Riwayat append-only untuk perubahan rencana. Contoh mencakup perubahan vessel/BL, kendaraan, alamat gudang, waktu move-in, dan tujuan barang.

**Invariant**

- Change record tidak menghapus nilai sebelumnya.
- Pesan koreksi baru menjadi current plan setelah otoritas operasional yang sesuai mengonfirmasi.

## 10. Kontrol kepabeanan MICE

Bagian ini adalah **proposal konsultan customs** yang diturunkan dari pola ATA, BC 2.3, inspection, export return, LARTAS, dan perubahan tujuan dalam chat. Ia tidak menetapkan HS, tarif, izin, atau prosedur resmi.

### `CustomsControl`

**Definisi**

```text
CustomsControl adalah salah satu dari:
- NotRelevant(reason)
- CustomsCase(
    movement context,
    responsible parties,
    daftar ItemCustomsDecision tidak kosong,
    daftar DocumentRequirement,
    daftar customs deadline,
    recommendation status)
```

Recommendation status adalah `Provisional`, `ReadyForOperationalReview`, atau `RequiresAuthorityConfirmation`.

**Interpretasi**

Kontrol tambahan untuk project yang menyentuh impor, ekspor, temporary goods, ATA Carnet, TPPB, LARTAS, atau penyelesaian kepabeanan lain.

**Invariant**

- Customs case mempunyai PIC pemilik close-out.
- Fakta regulatif yang belum diverifikasi tidak diberi status confirmed.

### `ItemCustomsDecision`

**Definisi**

```text
ItemCustomsDecision terdiri dari:
- tepat satu CargoItem
- intended use
- intended disposal
- technical description readiness
- classification assessment
- restriction assessment
- CustomsTreatment
- CustomsCloseOut
- open issues
```

`IntendedDisposal` adalah salah satu dari ReturnAbroad, ReturnToIndonesia, RemainInIndonesia, Consumed, Distributed, SoldOrTransferred, Destroyed, atau Undecided.

`CustomsTreatment` adalah salah satu dari:

```text
- Undecided(missing information)
- ProvisionalRoute(route, basis, confirmation needed)
- ConfirmedRoute(route, authority/source, obligations)
```

Route yang perlu dapat direpresentasikan adalah ordinary temporary import, ATA Carnet, TPPB, import for use, temporary export and re-import, serta domestic-only. Split treatment direpresentasikan oleh keputusan berbeda pada item berbeda, bukan satu route shipment bernama “split”.

**Interpretasi**

Keputusan operasional per barang. Chat memperlihatkan kebutuhan membedakan ATA return, barang permanent/lokal, barang yang disimpan untuk show berikutnya, serta barang yang dipisahkan karena LARTAS—misalnya baris 12.449–12.502, 13.116–13.138, dan 13.867–13.872.

**Template pemrosesan**

```text
Periksa deskripsi teknis, identity, quantity, value/origin jika tersedia
Periksa intended use dan intended disposal
Jika Undecided → hasilkan pertanyaan prioritas
Jika ProvisionalRoute → pantau confirmation needed
Jika ConfirmedRoute → turunkan dokumen, deadline, dan close-out obligations
```

**Invariant**

- Barang dengan intended disposal berbeda tidak berbagi satu decision.
- Returnable item mempunyai identifier yang dapat direkonsiliasi.
- Rencana jual/alih, barang hilang/rusak, mismatch quantity, atau perubahan penggunaan menghasilkan exception dan authority review.
- HS/LARTAS selalu mempunyai status pemeriksaan dan sumber; bukan sekadar kode bebas.

### `CustomsCloseOut`

**Definisi**

```text
CustomsCloseOut adalah salah satu dari:
- NotYetDue(due date, obligations)
- Due(due date, remaining obligations)
- ExceptionOpen(type, quantity affected, owner, authority question)
- Completed(outcome per item, reconciliation, evidence tidak kosong,
            completedAt, reviewer)
```

**Interpretasi**

Membuktikan bahwa quantity inbound sudah direkonsiliasi dengan re-export, re-import, import for use, atau penyelesaian lain yang dikonfirmasi. Foto move-out saja tidak otomatis menutup kewajiban customs.

**Invariant**

- `Completed` mempunyai rekonsiliasi quantity per item.
- Total outcome tidak melebihi inbound quantity.
- Selisih, kehilangan, kerusakan, atau barang tertinggal tetap `ExceptionOpen` sampai diselesaikan.

## 11. Milestone

### `Milestone`

**Definisi**

```text
Milestone terdiri dari:
- type
- planned schedule
- actual schedule
- owner
- entry criteria
- exit evidence
- state: Pending, Ready, InProgress, Completed, atau Missed
```

Type yang relevan: technical meeting, pre-alert, pre-arrival, arrival, clearance, delivery/move-in, show, move-out, re-export/re-import, dan close-out.

**Interpretasi**

Titik kendali project, bukan pengganti task. Technical meeting dapat selesai sementara data kendaraan, booth, atau loading access masih menjadi task/gap.

**Invariant**

- Milestone completed mempunyai exit evidence.
- Milestone customs close-out tidak selesai jika ada `CustomsCloseOut` terbuka.

## 12. Invariant lintas konsep

1. Semua fakta ternormalisasi dapat ditelusuri ke minimal satu `SourceMessage`.
2. Current plan dihitung dari fakta dan change record; sejarah tidak ditimpa.
3. Task planning-ready tidak mempunyai information gap yang memengaruhi feasibility atau compliance.
4. Planned time dan actual time disimpan terpisah.
5. Cargo quantity dan condition direkonsiliasi pada setiap handover penting.
6. Assignment hanya memenuhi requirement jika resource cocok, tersedia, dan belum cancelled.
7. Task completed memenuhi evidence requirement yang sesuai dengan jenis task.
8. Project completed berarti seluruh mandatory task dan milestone selesai.
9. Project dengan customs case juga mensyaratkan seluruh close-out selesai.
10. Keputusan per item tidak boleh diwariskan ke seluruh shipment jika intended use/disposal berbeda.

## 13. Fungsi atau pertanyaan turunan

```text
extractProjectCandidates : List<SourceMessage> -> List<ProjectCandidate>
identifyInformationGaps  : Project -> List<InformationGap>
validateTaskForPlanning  : Task -> ValidationResult<ReadyTask>
buildDailyPlan           : List<Project> x Date -> List<PlannedTask>
detectResourceConflicts  : List<Assignment> -> List<Conflict>
currentCargoPosition     : CargoItem -> Information<Location>
reconcileCargoQuantity   : CargoItem -> ReconciliationResult
requiredTaskEvidence     : Task -> NonEmptyList<EvidenceRequirement>
applyProjectChange       : Project x Change -> Project x ChangeRecord
projectsAtRisk           : List<Project> x Time -> List<RiskSignal>
assessCustomsReadiness   : CustomsCase -> CustomsReadinessResult
customsCloseOutGaps      : CustomsCase -> List<CloseOutGap>
```

Fungsi tersebut adalah pertanyaan program, bukan keputusan implementasi database.

## 14. Validasi terhadap skenario chat

| Skenario | Bentuk data | Dapat direpresentasikan? | Gap tersisa |
|---|---|---:|---|
| Delivery diminta untuk besok tetapi FO menyusul | MovementTask + RelativeExpression + DocumentRequirement | Ya | Waktu absolut dan FO |
| Container belum stripping sehingga kendaraan kembali | Blocker + Failed/Changed task | Ya | Keputusan re-plan |
| Shipment dibatalkan, vessel/BL mungkin berubah | ChangeRecord + Conflicting/Unknown information | Ya | Konfirmasi shipment terbaru |
| Dokumen SPPB/BC 2.3 ada tetapi DO belum ada | DocumentRequirement per dokumen | Ya | DO dan readiness final |
| Barang damage on arrival dan dilaporkan ke agent | Cargo condition + Evidence + PartyParticipation | Ya | Hasil review/claim |
| Customs inspection di booth lalu re-strapping dan foto | CustomsTask + HandlingTask + Evidence | Ya | Authority/inspection result |
| Driver/kendaraan dialihkan antarjob pada hari yang sama | Assignment + ChangeRecord + conflict detection | Ya | Jadwal pasti tiap leg |
| Case ATA ditandai agar cocok saat export | Cargo identifier + ItemCustomsDecision | Ya | Identifier dan general-list reconciliation |
| Barang temporary berubah menjadi permanent/local delivery | IntendedDisposal + ExceptionOpen | Ya | Authority confirmation dan treatment baru |
| Paper bag dipisahkan karena LARTAS | Restriction assessment + Held inventory | Ya | Dasar dan keputusan resmi |
| Satu pesan berisi tiga tujuan/pickup berbeda | Tiga MovementTask dengan satu source | Ya | Identitas project/cargo tertentu |

## 15. Pertanyaan terbuka untuk pengguna operasional

1. Apa batas satu project: per event, per customer order, per shipment, atau kombinasi yang diberi nomor oleh supervisor?
2. Siapa yang berwenang membuat project, menyatakan task `Ready`, dan menutup project?
3. Apakah setiap task harus mempunyai satu PIC, atau boleh team assignment?
4. Evidence minimum apa yang wajib untuk pickup, delivery, warehouse handover, move-in, move-out, dan customs inspection?
5. Apakah package perlu identity individual atau cukup kelompok/marking pada kondisi tertentu?
6. Kapan perubahan chat dianggap instruksi final dan siapa yang wajib diberi notifikasi?
7. Bagaimana hubungan project operasional dengan quotation, additional charge, dan invoice?
8. Untuk customs, siapa importer/exporter legal dan siapa pemilik kewajiban close-out per project?
9. Apakah VSS ingin sistem hanya mencatat hasil HS/LARTAS dari PIC customs, atau juga mengelola workflow pemeriksaannya?

Pertanyaan tersebut adalah langkah validasi berikutnya. Jawabannya diperlukan sebelum model dipetakan ke schema database atau UI.
