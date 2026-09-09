# Rencana Implementasi MVP Ticket

**Status:** Rencana awal untuk dieksekusi bertahap

**Batas saat ini:** Dokumen perencanaan; belum ada implementasi fitur

## 1. Tujuan

Menyediakan ruang kerja per topik agar pekerjaan dan percakapan tidak menumpuk dalam satu kanal umum. Ticket menjadi unit koordinasi yang dapat dibuat sebelum konteks operasional lengkap tersedia, ditugaskan kepada satu user, dikerjakan melalui kanban personal, serta mempunyai komentar dan riwayat aktivitas.

Implementasi harus dilakukan satu tahap pada satu waktu. Setiap tahap harus divalidasi dan disepakati selesai sebelum tahap berikutnya dimulai.

## 2. Batas konsep

### Ticket

Ticket adalah topik koordinasi, masalah, atau tindak lanjut yang perlu diselesaikan.

Contoh:

- Meminta packing list dari exhibitor.
- Mengonfirmasi jadwal move-in dengan venue.
- Memperbaiki data consignee.
- Menindaklanjuti persetujuan customer.

### Task atau Work Order

Dokumen analisis domain proyek sebelumnya memakai istilah `Task` atau `Work Order` untuk permintaan kerja operasional formal, misalnya pickup, delivery, customs clearance, loading, atau instalasi. Konsep tersebut biasanya mempunyai jadwal, lokasi, cargo, kebutuhan resource, dan bukti penyelesaian.

Untuk MVP ini:

- Ticket tidak menggantikan Job.
- Ticket tidak menjadi Activity atau Movement operasional.
- Ticket tidak mengimplementasikan Task atau Work Order.
- Hubungan Ticket dengan Task atau Work Order dapat dipertimbangkan kemudian jika konsep operasional tersebut diimplementasikan.

Dengan batas ini, Ticket berfungsi sebagai alat koordinasi pekerjaan, sedangkan Job tetap menjadi konteks pekerjaan operasional.

## 3. Keputusan requirement

### 3.1 Konteks ticket

Ticket mempunyai tepat satu dari tiga bentuk konteks:

```text
TicketContext adalah salah satu dari:
- GeneralContext
- EventContext(eventId)
- JobContext(jobId)
```

Interpretasi:

- `GeneralContext` dipakai untuk pekerjaan yang belum mempunyai event/job atau memang berada di luar keduanya.
- `EventContext` dipakai ketika pekerjaan sudah diketahui terkait event, tetapi shipment/job belum tersedia.
- `JobContext` dipakai ketika pekerjaan sudah dapat dikaitkan ke job tertentu.

Aturan:

- Ticket dapat dibuat sebelum berkas shipment diterima dengan `GeneralContext` atau `EventContext`.
- Konteks ticket dapat diubah kemudian, misalnya dari general ke event atau dari event ke job.
- Jika sebuah job sudah terkait dengan event, ticket hanya menyimpan `JobContext`; event terkait diturunkan dari job tersebut.
- Ticket tidak menyimpan `eventId` dan `jobId` secara bersamaan sehingga kombinasi yang bertentangan tidak dapat terbentuk.

### 3.2 Status kanban

```text
TicketStatus adalah salah satu dari:
- TODO
- IN_PROGRESS
- DONE
- CANCELLED
```

Label UI yang digunakan:

```text
TODO        -> Todo
IN_PROGRESS -> Progress
DONE        -> Done
CANCELLED   -> Cancel
```

Aturan awal:

- Ticket baru selalu berstatus `TODO`.
- Status ticket berlaku global, bukan berbeda untuk setiap user.
- Ticket dapat dipindahkan ke semua status oleh user aktif.
- Ticket `DONE` dan `CANCELLED` dapat dibuka kembali ke `TODO` untuk MVP.
- Perubahan status selalu menghasilkan activity log.

### 3.3 Prioritas urgent

```text
TicketPriority adalah salah satu dari:
- NORMAL
- URGENT
```

`URGENT` ditampilkan sebagai label visual, tetapi secara domain merupakan prioritas agar tidak bercampur dengan label kategori bebas yang mungkin ditambahkan kemudian.

### 3.4 Assignment

```text
TicketAssignee adalah salah satu dari:
- Unassigned
- Assigned(userId)
```

Aturan:

- Satu ticket mempunyai paling banyak satu assignee.
- Semua user aktif boleh melakukan assign, self-assign, reassign, mengambil ticket unassigned, dan mengembalikan ticket menjadi unassigned.
- Mengambil ticket adalah perubahan assignment dari `Unassigned` menjadi user yang sedang aktif.
- Setiap perubahan assignment menghasilkan activity log.
- Ticket yang diassign muncul pada board personal assignee.
- Ticket tidak disalin ke board; board adalah tampilan turunan dari kumpulan ticket berdasarkan assignee dan status.
- Ticket unassigned ditampilkan dalam antrean bersama agar dapat diambil oleh siapa pun.

### 3.5 Komentar dan activity log

Komentar adalah pesan yang sengaja ditulis user untuk berkomunikasi dalam konteks ticket.

Activity log adalah catatan sistem atas perubahan lifecycle ticket. Gunakan nama domain `TicketActivity` agar tidak bertabrakan dengan Activity/Movement operasional.

Activity minimum yang dicatat:

- ticket dibuat;
- judul, deskripsi, prioritas, atau konteks diubah;
- ticket diassign, di-reassign, diambil, atau di-unassign;
- status berubah;
- komentar dibuat.

Setiap activity terdiri dari jenis perubahan, aktor, waktu kejadian, dan ringkasan perubahan. Activity disajikan bersama komentar dalam satu timeline berurutan, tetapi komentar dan activity tetap merupakan dua jenis informasi berbeda.

### 3.6 Penghapusan

- Ticket boleh dihapus pada MVP.
- Penghapusan memerlukan konfirmasi eksplisit.
- Karena penyimpanan MVP hanya in-memory, penghapusan menghilangkan ticket beserta komentar dan activity-nya dari sesi berjalan.
- Activity penghapusan tidak dapat dipertahankan setelah keseluruhan ticket dihapus. Ini merupakan keterbatasan MVP yang harus terlihat dalam acceptance criteria.

## 4. Model informasi konseptual

### `Ticket`

```text
Ticket terdiri dari:
- identity
- title
- description
- context
- priority
- status
- assignee
- creator
- created time
- updated time
```

Interpretasi:

Satu ticket merepresentasikan satu topik kerja yang mempunyai identitas stabil walaupun isi, konteks, status, atau assignee berubah.

Invariant:

- Judul tidak boleh kosong setelah whitespace dinormalisasi.
- Ticket selalu mempunyai tepat satu context, priority, dan status.
- Ticket mempunyai nol atau satu assignee.
- Creator dan assignee, jika ada, harus merujuk user yang dikenal aplikasi.

### `TicketComment`

```text
TicketComment terdiri dari:
- identity
- ticket identity
- author
- body
- created time
```

Invariant:

- Isi komentar tidak boleh kosong setelah whitespace dinormalisasi.
- Komentar selalu dimiliki tepat satu ticket dan satu author.

### `TicketActivity`

```text
TicketActivity terdiri dari:
- identity
- ticket identity
- activity kind
- actor
- occurred time
- change summary
```

Invariant:

- Activity bersifat append-only selama ticket masih ada.
- Activity tidak dapat diedit melalui UI.
- Urutan timeline ditentukan oleh waktu kejadian dan identity sebagai tie-breaker.

## 5. Arsitektur penyimpanan MVP

Fitur Ticket tidak boleh menggunakan IndexedDB, `localStorage`, database, atau bentuk persistensi browser lainnya.

Gunakan struktur data in-memory di balik façade khusus Ticket:

```text
TicketStore
- tickets
- comments
- activities
- operasi baca dan mutasi
- subscription atau mekanisme pembaruan UI
```

Konsekuensi yang diterima:

- Semua ticket, komentar, assignment, dan activity hilang saat halaman di-refresh atau aplikasi dimulai ulang.
- Data tidak dibagikan antar-tab, browser, perangkat, atau user nyata.
- Identitas user yang tersedia masih berasal dari data demo aplikasi.
- Board masing-masing user merupakan simulasi berdasarkan pemilihan/current user yang tersedia pada aplikasi.

Batas arsitektur:

- Komponen dalam `app/` dan `components/` tidak mengakses struktur koleksi secara langsung.
- Akses dilakukan melalui façade Ticket agar penyimpanan dapat diganti pada versi berikutnya tanpa mengubah seluruh UI.
- Façade Ticket tidak mengimpor `@/lib/indexeddb`.
- Domain Ticket tidak boleh mengandung `Blob`, `File`, atau tipe penyimpanan.
- Attachment ticket tidak termasuk MVP.

## 6. Tahap implementasi

### Tahap 1 — Fondasi domain dan store in-memory

Tujuan: menyediakan model Ticket dan satu sumber data runtime tanpa membuat UI lengkap.

Ruang lingkup:

- Definisikan Ticket, TicketContext, TicketPriority, TicketStatus, TicketAssignee, TicketComment, dan TicketActivity.
- Buat façade Ticket dan store in-memory.
- Sediakan operasi create, read, update, delete, assignment, transition status, komentar, dan query board.
- Catat activity secara otomatis dalam operasi mutasi yang relevan.
- Tambahkan data demo secukupnya untuk seluruh bentuk konteks dan status.
- Tambahkan unit test untuk invariant dan operasi store.

Acceptance criteria:

- Tidak ada kode Ticket yang mengakses IndexedDB atau persistensi lain.
- Refresh halaman mengembalikan store ke data awal runtime.
- Ticket general, event, dan job dapat direpresentasikan.
- Ticket hanya dapat mempunyai nol atau satu assignee.
- Operasi mutasi menghasilkan activity yang sesuai.
- Unit test tahap ini lulus.

### Tahap 2 — Daftar, detail, pembuatan, dan penyuntingan ticket

Tujuan: user dapat membuat ruang kerja per topik dan melihat seluruh informasinya.

Ruang lingkup:

- Tambahkan navigasi Ticket.
- Buat daftar ticket dengan status, priority, assignee, dan context.
- Buat form ticket dengan pilihan General, Event, atau Job.
- Buat halaman detail ticket.
- Sediakan penyuntingan judul, deskripsi, priority, dan context.
- Sediakan filter dasar berdasarkan status, priority, context, dan assignee.

Acceptance criteria:

- Ticket dapat dibuat tanpa event atau job.
- Ticket dapat dibuat untuk event sebelum job tersedia.
- Ticket dapat dipindahkan konteksnya ke job setelah job tersedia.
- Memilih job yang terkait event tidak menghasilkan relasi event duplikat pada ticket.
- Perubahan terlihat segera selama sesi berjalan.
- Refresh menghapus perubahan sesuai batas non-persisten MVP.

### Tahap 3 — Assignment dan kanban board

Tujuan: ticket masuk ke board personal secara otomatis berdasarkan assignment.

Ruang lingkup:

- Buat antrean ticket unassigned.
- Buat board personal dengan kolom Todo, Progress, Done, dan Cancel.
- Sediakan assign, self-assign/take, reassign, dan unassign.
- Sediakan perpindahan status antar-kolom.
- Pastikan board dihitung dari ticket, bukan menyimpan salinan ticket.

Acceptance criteria:

- Ticket unassigned dapat diambil oleh user aktif.
- Setelah diambil, ticket hilang dari antrean unassigned dan muncul di board user tersebut.
- Reassign memindahkan visibilitas ticket dari board user lama ke board user baru.
- Unassign menghapus ticket dari board personal dan mengembalikannya ke antrean bersama.
- Status ticket menentukan tepat satu kolom board.
- Ticket urgent mudah dibedakan secara visual.

### Tahap 4 — Komentar dan timeline activity

Tujuan: komunikasi dan riwayat perubahan terpusat di dalam ticket.

Ruang lingkup:

- Tambahkan pembuatan komentar.
- Tampilkan komentar dan activity dalam satu timeline kronologis.
- Tampilkan aktor, waktu, serta ringkasan perubahan.
- Pastikan activity sistem tidak dapat diedit.

Acceptance criteria:

- User aktif dapat mengomentari ticket.
- Komentar kosong ditolak.
- Assignment, perubahan status, prioritas, dan konteks terlihat pada timeline.
- Urutan timeline konsisten jika beberapa item mempunyai timestamp yang sama.

### Tahap 5 — Penghapusan dan hardening alur

Tujuan: melengkapi lifecycle MVP dan menangani keadaan tepi secara konsisten.

Ruang lingkup:

- Tambahkan penghapusan ticket dengan dialog konfirmasi.
- Tangani referensi event, job, atau user yang tidak lagi tersedia.
- Tangani akses ke ticket yang sudah dihapus.
- Tinjau empty state, error state, dan perilaku mobile.
- Pastikan seluruh operasi hanya memengaruhi state in-memory.

Acceptance criteria:

- Penghapusan tidak terjadi tanpa konfirmasi.
- Ticket yang dihapus tidak muncul pada daftar, antrean, board, atau detail.
- Komentar dan activity milik ticket ikut hilang.
- Referensi context atau assignee yang tidak tersedia tidak membuat halaman crash.

### Tahap 6 — Validasi menyeluruh dan dokumentasi

Tujuan: memastikan seluruh alur MVP bekerja sebagai satu kesatuan.

Ruang lingkup:

- Uji alur general ticket menjadi event ticket lalu job ticket.
- Uji create, edit, assign, take, reassign, unassign, perubahan status, komentar, dan delete.
- Jalankan type-check, test, lint jika tersedia, dan production build.
- Perbarui README untuk menjelaskan sifat non-persisten fitur Ticket.

Acceptance criteria:

- Seluruh acceptance criteria tahap 1–5 terverifikasi.
- Tidak ada regresi pada fitur Event dan Job yang sudah ada.
- Build produksi berhasil.
- Dokumentasi menyatakan dengan jelas bahwa data Ticket hilang saat refresh.

## 7. Urutan eksekusi dan kontrol perubahan

Untuk setiap tahap:

1. Buat issue terpisah dengan scope dan acceptance criteria tahap tersebut.
2. Implementasikan hanya scope tahap aktif.
3. Jalankan validasi yang relevan.
4. Commit dengan referensi issue.
5. Tutup issue hanya setelah validasi berhasil.
6. Laporkan URL issue, hasil validasi, dan hash commit sebelum melanjutkan ke tahap berikutnya.

Perubahan menuju persistensi, attachment, multi-assignee, label bebas, notifikasi, mention, due date, atau integrasi Task/Work Order harus dibuat sebagai scope lanjutan dan tidak dimasukkan diam-diam ke salah satu tahap MVP.

## 8. Skenario validasi utama

| Skenario | Hasil yang diharapkan |
|---|---|
| Dokumen shipment belum diterima | Ticket dapat dibuat dengan context general atau event |
| Job kemudian tersedia | Context ticket dapat diubah menjadi job |
| Ticket tidak mempunyai assignee | Ticket terlihat di antrean bersama dan tidak ada di board personal |
| User mengambil ticket | User menjadi satu-satunya assignee dan ticket muncul di board-nya |
| Ticket di-reassign | Ticket berpindah dari board assignee lama ke assignee baru |
| Ticket dipindah ke Progress | Status global menjadi `IN_PROGRESS` dan activity tercatat |
| Ticket dibatalkan lalu dibuka kembali | Status berubah dari `CANCELLED` ke `TODO`, keduanya tercatat |
| User menulis komentar | Komentar muncul dalam timeline bersama activity |
| Ticket dihapus | Ticket, komentar, dan activity hilang dari state runtime setelah konfirmasi |
| Halaman di-refresh | Seluruh perubahan runtime hilang dan data kembali ke initial state |

## 9. Keputusan yang masih perlu dikonfirmasi sebelum tahap terkait

Keputusan berikut tidak menghalangi Tahap 1, tetapi harus dikonfirmasi sebelum implementasi yang bersangkutan:

1. Apakah semua user aktif boleh menghapus semua ticket, atau penghapusan dibatasi kepada creator/role tertentu?
2. Apakah komentar perlu dapat dihapus pada MVP; jika ya, apakah hanya oleh author atau oleh semua user aktif?
3. Apakah ticket yang di-unassign ketika berstatus `IN_PROGRESS` mempertahankan statusnya atau otomatis kembali ke `TODO`?
