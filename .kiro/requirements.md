# Requirements — VSS Project Management

> Dokumen ini direkonstruksi dari kode yang sudah berjalan (reverse-engineering dari MVP).
> Tujuannya bukan mendikte apa yang harus dibangun, melainkan mendokumentasikan apa yang sudah ada,
> mengekspos asumsi implisit, dan menandai celah bisnis logic yang perlu ditinjau.

---

## 1. Konteks Sistem

VSS Project Management adalah sistem operasional internal untuk perusahaan freight-forwarding/logistik
yang menangani pengiriman barang pameran (MICE — Meetings, Incentives, Conferences, Exhibitions) di Indonesia.

Operasional inti yang didukung sistem:

1. Merekam dan memantau event/pameran beserta daftar exhibitornya.
2. Mengelola dokumen CIPL (Commercial Invoice Packing List) dari setiap exhibitor.
3. Menelusuri shipment (satu B/L atau satu AWB) yang berasal dari CIPL.
4. Memproses pengurusan kepabeanan (dokumen BC) per shipment.
5. Manajemen pekerjaan harian tim via personal Kanban board.

---

## 2. Pengguna dan Peran

| Peran | Kode | Hak Akses |
|-------|------|-----------|
| Supervisor | `SUPERVISOR` | Akses penuh termasuk manajemen user (`/settings`) dan semua operasi |
| Staff Operasional | `STAFF` | Akses operasional penuh kecuali manajemen user |
| Customer Service | `CUSTOMER_SERVICE` | Akses lihat dan input terbatas |
| Document Assistant | `DOCUMENT_ASSISTANT` | (Peran ada di kode, belum ada UI pembatasan eksplisit — **gap**) |

**Catatan gap:** Otorisasi per fitur belum diimplementasikan secara menyeluruh. Saat ini pembatasan hanya pada halaman `/settings` (admin flag). Operasi data lain tidak memvalidasi peran di layer business logic.

---

## 3. Autentikasi

- Login menggunakan email dan password.
- Sistem saat ini menggunakan daftar user yang tersimpan di database (tabel `app_records`, store `users`).
- Session berbasis JWT, expired per browser session.
- Semua halaman dashboard memerlukan session aktif; akses tanpa login diredirect ke `/login`.
- Flag `isAdmin` di token JWT mengontrol akses ke fitur admin.

**Catatan gap:** Password disimpan secara hardcoded di `lib/demo-users.ts` (pola demo). Untuk production, diperlukan mekanisme hashing password yang proper.

---

## 4. Entitas Bisnis dan Hierarki

```
Event (Pameran)
  ├── Venue (Lokasi)
  ├── Event Organizer / EO (Penyelenggara)
  └── Exhibitor (Peserta)
        ├── Coordination Agent (Agen koordinasi dari pihak exhibitor)
        ├── Legacy Job (jalur lama — satu job per exhibitor)
        └── CIPL (Commercial Invoice Packing List)
              └── CIPL Version (versi dokumen, immutable)
                    └── Shipment (satu B/L atau satu AWB)
                          └── Customs Job (satu dokumen BC)

User
  └── Ticket (work item personal, diikat ke Event atau Legacy Job)
```

---

## 5. Fitur per Domain

### 5.1 Event

**Tujuan:** Merekam pameran/event yang sedang atau akan ditangani VSS.

| # | Requirement |
|---|-------------|
| E-1 | User dapat membuat event baru dengan mengisi nama resmi, alias, tanggal mulai, tanggal selesai, venue, dan event organizer. |
| E-2 | Tanggal selesai tidak boleh lebih awal dari tanggal mulai. |
| E-3 | User dapat memilih venue yang sudah ada atau menginput venue baru dalam satu form yang sama. |
| E-4 | User dapat memilih event organizer yang sudah ada atau menginput EO baru dalam satu form yang sama. |
| E-5 | User dapat mengedit semua field event yang sudah ada. |
| E-6 | User dapat membatalkan (cancel) event dengan wajib mengisi alasan pembatalan. |
| E-7 | Event yang dibatalkan tidak dapat dioperasikan lebih lanjut (tidak bisa tambah exhibitor, CIPL, shipment, job). |
| E-8 | User dapat menghapus event **hanya jika** tidak ada data turunan (exhibitor, CIPL, shipment, customs job, legacy job). |
| E-9 | Status event: `ACTIVE` atau `CANCELLED`. |
| E-10 | Dashboard menampilkan timeline event aktif secara kronologis. |

### 5.2 Exhibitor

**Tujuan:** Merekam daftar peserta dari setiap pameran.

| # | Requirement |
|---|-------------|
| X-1 | User dapat menambah daftar exhibitor ke event aktif melalui modal manajemen exhibitor. |
| X-2 | Setiap exhibitor memiliki: nama legal, nama alias (opsional), tipe (`LOCAL` / `INTERNATIONAL`), email, telepon, agen, alamat, kode negara. |
| X-3 | Ketika exhibitor baru ditambahkan, sistem otomatis membuat satu **Legacy Job** untuknya dengan status `DRAFT`. |
| X-4 | Ketika data exhibitor diperbarui (nama, agen), Legacy Job yang terkait ikut diperbarui (clientName, shipper, agent). |
| X-5 | Exhibitor dapat dihapus hanya jika tidak memiliki data turunan aktif. |
| X-6 | User dapat menambah **Coordination Agent** (agen koordinasi pihak exhibitor) ke exhibitor. |

### 5.3 CIPL (Commercial Invoice Packing List)

**Tujuan:** Menelusuri dokumen komersial yang diterima dari exhibitor sebagai dasar pengurusan kepabeanan.

| # | Requirement |
|---|-------------|
| C-1 | Setiap exhibitor dapat memiliki satu CIPL aktif. |
| C-2 | CIPL memiliki nomor referensi (opsional) dan status. |
| C-3 | Status CIPL: `AWAITING_DOCUMENT` → `RECEIVED` → `UNDER_REVIEW` → `READY` (dengan kemungkinan `ON_HOLD` atau `CANCELLED`). |
| C-4 | CIPL dapat ditandai `sourceDocumentUnavailable` jika dokumen fisik tidak tersedia. |
| C-5 | User dapat menambah **CIPL Version** ke CIPL yang ada. Setiap versi bersifat immutable setelah dibuat. |
| C-6 | Satu CIPL Version terdiri dari: tanggal diterima, nama penerima, nama dokumen sumber, file lampiran PDF (opsional), catatan revisi, dan daftar item. |
| C-7 | Setiap item CIPL Version memiliki: nomor baris, deskripsi (wajib), quantity (wajib, > 0), unit (wajib), nilai satuan, mata uang, berat kotor (kg), berat bersih (kg), negara asal, identifiers, intended use, intended disposal. |
| C-8 | CIPL Version **READY** wajib memiliki minimal satu item; setiap item wajib memiliki deskripsi, quantity > 0, dan unit. |
| C-9 | User dapat mengaktifkan satu versi sebagai versi aktif CIPL. |
| C-10 | Versi CIPL yang sudah digunakan oleh Shipment tidak dapat diubah atau dihapus. |

### 5.4 Shipment

**Tujuan:** Mewakili satu pengiriman fisik (satu B/L atau satu AWB) yang barang-barangnya berasal dari CIPL.

| # | Requirement |
|---|-------------|
| S-1 | Shipment dibuat dari versi aktif sebuah CIPL. |
| S-2 | Setiap shipment memiliki: tipe dokumen (`BL` / `AWB`), nomor dokumen, moda (`FCL` / `LCL` / null), arah (`IMPORT` / `EXPORT`), shipper, consignee, notify party, carrier, ETA/ETD, origin, destination. |
| S-3 | Shipment memiliki daftar **alokasi item** dari CIPL Version sumber. Total alokasi per item tidak boleh melebihi quantity di CIPL Version. |
| S-4 | Unit alokasi harus sama dengan unit item di CIPL Version. |
| S-5 | Shipment dapat memiliki satu file lampiran (B/L atau AWB dokumen, PDF). |
| S-6 | Status shipment: `DRAFT` → `DOCUMENT_RECEIVED` → `UNDER_REVIEW` → `READY_FOR_CUSTOMS` (dengan kemungkinan `ON_HOLD` atau `CANCELLED`). |
| S-7 | Satu CIPL dapat memiliki lebih dari satu shipment (barang terpecah di beberapa pengiriman). |
| S-8 | Alokasi item mempertimbangkan semua shipment aktif dari versi CIPL yang sama; total di semua shipment tidak boleh melebihi quantity CIPL. |

### 5.5 Customs Job

**Tujuan:** Mengelola pengurusan dokumen kepabeanan Indonesia (BC) untuk satu shipment.

| # | Requirement |
|---|-------------|
| J-1 | Customs Job dibuat dari sebuah Shipment. |
| J-2 | Setiap Customs Job memiliki tipe dokumen BC: `BC_2_3` (impor sementara), `BC_2_5` (re-ekspor), atau `BC_3_0` (impor permanen/dijual). |
| J-3 | Nomor job otomatis dihasilkan sistem dengan format `VSS-XXXXX` (urutan 5 digit). |
| J-4 | Customs Job memiliki: nomor AJU, nomor registrasi, tanggal registrasi, nama gudang, assignee. |
| J-5 | Customs Job memiliki daftar **alokasi item** dari Shipment induk. Total alokasi tidak boleh melebihi alokasi di Shipment. |
| J-6 | Unit alokasi harus sama dengan unit alokasi di Shipment. |
| J-7 | Status Customs Job: `DRAFT` → `PREPARING` → `SUBMITTED` → `REGISTERED` → `RELEASED` → `COMPLETED`. |
| J-8 | Customs Job dapat masuk ke status `ON_HOLD` atau `CANCELLED` dari status mana saja. |
| J-9 | Transisi status maju satu langkah (misal `DRAFT` → `PREPARING`) tidak memerlukan alasan. |
| J-10 | Transisi status mundur atau loncat memerlukan: alasan (`reason`) **dan** minimal satu attachment sebagai evidence. |
| J-11 | Customs Job memiliki informasi billing: `NOT_READY` / `NOT_APPLICABLE` / `READY` (dengan nominal) / `INVOICED` (dengan nomor invoice) / `PAID` (dengan referensi pembayaran). |
| J-12 | Customs Job dapat memiliki beberapa file lampiran. |
| J-13 | Customs Job memiliki catatan (notes) dan riwayat perubahan status. |
| J-14 | Customs Job dapat di-assign ke seorang user. |

### 5.6 Legacy Job (Jalur Lama)

**Tujuan:** Sistem manajemen job lama yang masih aktif digunakan, berbasis satu job per exhibitor.

| # | Requirement |
|---|-------------|
| L-1 | Setiap exhibitor memiliki satu Legacy Job yang dibuat otomatis saat exhibitor ditambahkan. |
| L-2 | Job memiliki: nomor AWB, nomor B/L, shipper, consignee, notify party, agen, shipping line, deskripsi kargo, moda pengiriman, tipe (`IMPORT` / `EXPORT`), nama klien. |
| L-3 | Job memiliki detail operasional (`operational`): inbound leg, outbound leg, status CIPL, dan status per jenis BC (BC 2.3, BC 2.5, BC 3.0). |
| L-4 | Status job: `DRAFT` → `IN_PROGRESS` → `COMPLETED` atau `ON_HOLD` (dari `IN_PROGRESS`, bisa kembali ke `IN_PROGRESS`) atau `CANCELLED`. |
| L-5 | User dapat mengunggah dokumen (PDF atau Excel) ke job; sistem menganalisis dokumen via AI (Gemini) dan mengekstrak data secara otomatis. |
| L-6 | Dokumen diklasifikasikan sebagai: `BILL_OF_LADING`, `AIR_WAYBILL`, `COMMERCIAL_INVOICE`, atau `OTHER`. |
| L-7 | Data hasil ekstraksi AI (shipper, consignee, nomor dokumen, ETA, carrier, line item invoice, HS code) otomatis mengisi field-field job. |
| L-8 | Jika ada perbedaan data antara invoice dan B/L (berat, jumlah kemasan, dll), sistem menampilkan peringatan. |
| L-9 | User dapat mengedit semua hasil ekstraksi AI secara manual. |
| L-10 | Job memiliki **stages** (milestone/tahapan): user dapat menambah stage, menandai selesai/belum, dan memberikan catatan. |
| L-11 | User dapat mengekspor workbook Excel untuk pengurusan BC dari data job (per jenis BC: BC 2.3, BC 2.5, BC 3.0). |
| L-12 | Job memiliki nomor urut format `VSS-XXXX` (4 digit) yang berbeda dari format Customs Job (5 digit). (**gap potensial:** dua format berbeda untuk entitas berbeda, perlu dikonfirmasi tidak ambigu.) |

### 5.7 Kanban Board (Ticket)

**Tujuan:** Manajemen pekerjaan harian tim dalam bentuk Kanban board personal.

| # | Requirement |
|---|-------------|
| K-1 | Setiap ticket dimiliki oleh satu user (`assigneeId`). |
| K-2 | Ticket harus diikat ke sebuah konteks: Event aktif **atau** Legacy Job aktif (job tidak boleh `COMPLETED` atau `CANCELLED`). |
| K-3 | Ticket memiliki: judul (wajib), deskripsi (opsional), prioritas (`NORMAL` / `URGENT`). |
| K-4 | Status ticket: `TODO` → `PROGRESS` → `DONE`. |
| K-5 | Memindahkan ticket ke `DONE` memerlukan catatan penyelesaian (wajib diisi). |
| K-6 | Membuka kembali ticket dari `DONE` ke status lain memerlukan alasan (wajib diisi). |
| K-7 | User dapat mereorder ticket dalam satu kolom (drag-and-drop). |
| K-8 | User dapat memindahkan ticket antar kolom sekaligus mereorder kolom tujuan (atomik). |
| K-9 | Nomor ticket dihasilkan otomatis, unik per event (bukan global). |
| K-10 | Board menampilkan hanya ticket milik user aktif. |
| K-11 | Dalam mode demo, user dapat mengganti "user aktif" yang ticketnya ditampilkan. |

---

## 6. Aturan Bisnis Cross-Domain

| # | Aturan |
|---|--------|
| B-1 | Data turunan mencegah penghapusan: Event tidak bisa dihapus jika punya Exhibitor, CIPL, Shipment, Customs Job, atau Legacy Job. |
| B-2 | Semua alokasi item (Shipment dari CIPL, Customs Job dari Shipment) dijaga konsistensinya: total alokasi tidak boleh melebihi quantity sumber. |
| B-3 | Ticket hanya bisa dibuat/diikat ke Event yang berstatus `ACTIVE`. |
| B-4 | Ticket hanya bisa diikat ke Legacy Job yang tidak `COMPLETED` atau `CANCELLED` dan event-nya `ACTIVE`. |
| B-5 | CIPL Version yang sudah digunakan Shipment bersifat immutable. |
| B-6 | Penomoran Customs Job (`VSS-XXXXX`) dan Legacy Job (`VSS-XXXX`) dijaga unik masing-masing. |

---

## 7. Integrasi Eksternal

| Integrasi | Keterangan |
|-----------|------------|
| **Supabase** | Database PostgreSQL (satu tabel EAV `app_records`) dan file storage `attachments` (max 50MB per file, hanya PDF). |
| **Google Gemini AI** | Ekstraksi data otomatis dari dokumen PDF/Excel yang diunggah (B/L, AWB, Commercial Invoice). Model: `gemini-3.5-flash-lite`. |
| **NextAuth.js** | Manajemen session dan autentikasi (Credentials provider, JWT strategy). |

---

## 8. Celah (Gaps) dan Pertanyaan Terbuka

Bagian ini mencatat hal-hal yang perlu dikonfirmasi atau diputuskan:

| # | Deskripsi | Risiko |
|---|-----------|--------|
| G-1 | **Otorisasi per fitur belum granular.** Peran `STAFF`, `CUSTOMER_SERVICE`, `DOCUMENT_ASSISTANT` ada di kode tapi tidak ada penjagaan di business logic. Siapapun yang login bisa melakukan semua operasi kecuali akses `/settings`. | Tinggi — data sensitif dapat dimodifikasi oleh siapapun. |
| G-2 | **Password di hardcode (demo mode).** `lib/demo-users.ts` menyimpan password plaintext. Perlu diganti mekanisme hashing (bcrypt/argon2) sebelum production. | Tinggi — keamanan. |
| G-3 | **Tidak ada fitur untuk membuat CIPL pertama dari halaman exhibitor.** Navigasi ke halaman CIPL hanya bisa dari link `/cipls/[id]`. Bagaimana cara user tahu apakah exhibitor sudah punya CIPL atau belum? | Sedang — UX flow kurang jelas. |
| G-4 | **Legacy Job dan New Pipeline (CIPL) berjalan paralel tanpa sinkronisasi eksplisit.** Exhibitor bisa punya Legacy Job sekaligus CIPL. Tidak ada aturan kapan harus pakai salah satu. | Sedang — kebingungan operasional. |
| G-5 | **Domain V2 (`domain/v2/types.ts`) ada di kode tapi belum dipakai di UI.** Ini tampak sebagai desain arsitektur generik yang belum selesai. Apakah ini akan dilanjutkan atau dihapus? | Rendah — dead code. |
| G-6 | **Penomoran Job dua format berbeda:** Legacy Job `VSS-XXXX` (4 digit) vs Customs Job `VSS-XXXXX` (5 digit). Apakah ini disengaja atau typo? | Rendah — ambigu dalam komunikasi dengan user. |
| G-7 | **Tidak ada notifikasi atau audit log.** Perubahan status dan dokumen tidak menghasilkan notifikasi ke user terkait. | Rendah untuk MVP, tapi perlu untuk koordinasi tim. |
| G-8 | **Peran `DOCUMENT_ASSISTANT` sudah ada di tipe data tapi belum ada UI pembatasan khusus untuk peran ini.** | Rendah — belum diselesaikan. |
| G-9 | **Status CIPL tidak berubah otomatis** ketika versi baru ditambahkan atau versi diaktifkan. User harus update status CIPL secara manual. Apakah ini disengaja? | Sedang — bisa menyebabkan status stale. |
| G-10 | **Satu exhibitor hanya bisa punya satu CIPL.** Apakah ini cukup untuk kasus exhibitor yang mengirim barang dalam beberapa gelombang dengan CIPL berbeda? | Sedang — batas bisnis yang perlu dikonfirmasi. |
