# PRD Ringan — Baseline Implementasi VSS Project Management

Tanggal analisis: **8 Oktober 2026**. Baseline repository: **`d237769`**.

**Status dokumen: bahan discovery dan pembahasan scope, bukan requirement final client, kontrak delivery, atau pernyataan siap production.**

Dokumen ini berasal dari penelusuran source code, route, adapter, migrasi SQL, validator, pengujian yang tersedia, konfigurasi, dan dokumentasi repository. Database live, deployment, akurasi ekstraksi pada dokumen client, dan koneksi vendor tidak diuji dalam analisis ini. Migrasi menunjukkan schema yang dimaksudkan repository; penerapannya pada database live belum dapat dipastikan. Dokumen rencana dan contoh domain tidak diperlakukan sebagai fitur aktif.

Label yang digunakan:

- **Existing implementation**: perilaku/jalur kode yang ditemukan. Status `implemented` berarti tersedia dalam kode, bukan sudah lulus UAT atau siap production.
- **Inferred behavior**: kesimpulan dari gabungan beberapa jalur kode; perlu pembuktian penggunaan end-to-end.
- **Assumption**: keputusan implisit implementasi yang belum dibuktikan sebagai kebutuhan client.
- **Needs confirmation**: requirement/keputusan yang masih harus disepakati client.
- **Potential future enhancement**: tambahan di luar baseline; tidak otomatis masuk production v1.

Status capability: **implemented** = jalur utama tersedia; **partial** = ada bagian fungsi tetapi alur/penegakan belum lengkap; **experimental** = demo, kontrak belum terverifikasi, atau model eksplorasi yang belum tersambung ke workflow utama.

# 1. Product Summary

**Existing implementation.** Aplikasi web internal untuk mencatat event pameran, peserta/exhibitor, pekerjaan pengiriman dan kepabeanan, dokumen pendukung, serta ticket koordinasi. Dashboard menampilkan ringkasan dan timeline; pekerjaan dapat diperkaya dari ekstraksi Invoice dan B/L/AWB, diperiksa manual, dan diekspor menjadi workbook BC 2.3. Tersedia lookup INSW/LARTAS dan sebagian operasi baca CEISA.

Data operasional aktif diakses melalui Next.js API ke **Supabase PostgreSQL dan bucket privat**, dengan NextAuth Credentials untuk sesi. Klaim lama tentang data hanya di browser atau selalu direset saat reload tidak menggambarkan adapter aktif. Fallback demo masih ada untuk autentikasi/pengelolaan user tertentu pada development, bukan backend operasional lengkap.

**Inferred behavior.** Produk tampaknya ditujukan untuk membantu tim operasional menyatukan informasi event, progres dokumen/pengiriman, pemeriksaan data antardokumen, dan tindak lanjut pekerjaan. Pengurangan penyalinan data manual tampak sebagai motivasi ekstraksi LLM dan Excel; besar manfaatnya belum diukur.

**Assumption.** Pengguna utama tampaknya staf internal operasional, supervisor, customer service, dan document assistant. Nama peran tersedia dalam schema; pembagian pekerjaan aktualnya belum ditetapkan dalam permission. Tidak ditemukan portal client/exhibitor yang terpisah.

Evidence: [dashboard](../app/(dashboard)/page.tsx), [data façade](../lib/data-client.ts), [auth](../auth.ts), [adapter database](../lib/supabase/operational-records.ts), [migrasi awal](../supabase/migrations/20260915000000_initial_vss_schema.sql).

# 2. Current Product Capabilities

Seluruh deskripsi pada tabel ini adalah **Existing implementation**, dengan batas yang disebutkan pada kolom deskripsi.

| Fitur | Status | Deskripsi dan batas capability | Lokasi implementasi utama |
| --- | --- | --- | --- |
| Login/logout | implemented | Email/password, JWT session, pengecekan akun aktif saat login database. Demo login hanya ketika Supabase tidak tersedia dan bukan production. | [auth.ts](../auth.ts), [login](../app/(auth)/login), [password hashing](../lib/auth/password.ts), [logout action](../app/(dashboard)/actions.ts) |
| Dashboard dan timeline | implemented | Ringkasan event terjadwal, job berjalan/tertahan, venue yang dipakai event, agenda dan timeline. Angka berasal dari data/status lokal; bukan KPI terverifikasi client. | [dashboard](../app/(dashboard)/page.tsx), [timeline](../components/event-timeline.tsx) |
| Event | implemented | Buat, daftar, detail, cari/filter, batalkan dengan alasan. UI tidak menyediakan edit event; pembatalan dicatat terpisah. | [pages event](../app/(dashboard)/events), [API events](../app/api/events/route.ts), [API cancellation](../app/api/events/[eventId]/route.ts) |
| Venue dan event organizer | implemented | Tambah dan kelola master nama, kontak, alamat, website; venue memiliki loading-access notes, EO memiliki NPWP. Permission berbeda antara API Settings dan API event-records. | [Settings API](../app/api/settings/route.ts), [event-records API](../app/api/event-records/route.ts), [event form](../components/event-form.tsx) |
| Exhibitor per event | implemented | Tambah satu/banyak peserta, LOCAL atau INTERNATIONAL, kontak, agent, NPWP lokal; ditampilkan dalam detail event. Tidak ditemukan endpoint khusus edit/hapus exhibitor. | [exhibitor API](../app/api/events/[eventId]/exhibitors/route.ts), [modal](../components/event-exhibitor-modal.tsx) |
| Job operasional utama | implemented | Jobs dikelompokkan menurut event, pencarian/filter, detail dan editor data transport inbound/outbound, Invoice/CIPL, catatan serta status BC 2.3/2.5/3.0. Pembacaan `/api/jobs` membuat job DRAFT untuk exhibitor yang belum memiliki job. `/jobs/new` redirect ke Events. | [jobs UI](../app/(dashboard)/jobs), [jobs API](../app/api/jobs/route.ts), [editor](../components/job-editor.tsx), [fase turunan](../lib/job-operational-phase.ts) |
| Upload, baca, dan simpan lampiran | implemented | Dokumen diunggah ke Supabase Storage privat; metadata dan attachment ID tersimpan. Jobs menerima PDF dan beberapa format Excel. Multi-file diproses per file, bukan satu transaksi. | [attachments API](../app/api/attachments/route.ts), [storage adapter](../lib/supabase/attachments.ts), [saveJobDocument](../lib/data-client.ts) |
| Klasifikasi dan ekstraksi dokumen | partial | Gemini mengklasifikasikan B/L, AWB, Commercial Invoice, OTHER, UNREADABLE; mengekstrak pihak, barang, nilai, berat, kemasan, transport/container. UI menyimpan file sebagai OTHER bila proses gagal. Tidak ada jaminan akurasi atau approval hasil. | [extraction](../lib/server/document-extraction.ts), [classify API](../app/api/classify-job-document/route.ts), [upload UI](../app/(dashboard)/jobs/page.tsx) |
| Review dan koreksi hasil ekstraksi | implemented | Editor Invoice/transport; perbandingan enam field dengan MATCH, DIFFERENT, UNAVAILABLE. Perbedaan ditampilkan, tidak memblokir ekspor. | [document editor](../components/job-document-editor-dialog.tsx), [comparison](../lib/document-comparison.ts), [job detail](../app/(dashboard)/jobs/[id]/page.tsx) |
| Ekspor Excel kepabeanan | partial | Workbook BC 2.3 dari template dan hasil ekstraksi. Tombol BC lain/template tersedia, tetapi BC 2.5 dan BC 3.0 ditolak karena alokasi turunan belum tersedia. Tidak ada bukti workbook diterima CEISA. | [export API](../app/api/export-customs-workbook/route.ts), [template BC 2.3](bup-23.xlsx), [jobs UI](../app/(dashboard)/jobs/page.tsx) |
| CIPL berversi → Shipment → CustomsJob | partial | Halaman detail CIPL, tambah versi, alokasi shipment B/L/AWB, pembuatan dan pembaruan satu job per jenis BC tersedia. Fungsi `createCipl` ada tetapi tidak ditemukan pemanggil UI aktif untuk memulai CIPL baru. Integrasi ke alur event/job utama belum utuh. | [CIPL pages](../app/(dashboard)/cipls), [data façade](../lib/data-client.ts), [exhibition domain](../domain/exhibition/types.ts) |
| Tickets/kanban | implemented | Ticket saya, belum ditugaskan, semua ticket; konteks GENERAL/EVENT/JOB; prioritas NORMAL/URGENT; assignment/take, edit, drag/reorder pada board pribadi, selesai/reopen, komentar dan aktivitas. Detail polling 5 detik dan refresh saat focus. | [board](../components/ticket-board.tsx), [detail](../components/ticket-detail.tsx), [API](../app/api/tickets), [migration](../supabase/migrations/20261006000000_ticket_collaboration.sql) |
| Pengaturan user | implemented | Admin dapat tambah/edit nama, email, password, akses admin. Schema menyimpan job role dan akun aktif, tetapi UI saat ini tidak menawarkan matriks izin, reset mandiri, atau alur deaktivasi lengkap. | [settings manager](../app/(dashboard)/settings/settings-manager.tsx), [settings API](../app/api/settings/route.ts), [create-user script](../scripts/create-supabase-user.ts) |
| Lookup LARTAS | implemented | 1–20 input HS, normalisasi/deduplikasi, validasi 8 digit, lookup CMS dengan fallback publik. Hasil membedakan verified/unverified, not-found, invalid, source-error. | [LARTAS UI](../components/lartas-checker.tsx), [API](../app/api/lartas/route.ts), [INSW adapter](../lib/insw-lartas.ts) |
| Koneksi dan lookup CEISA | experimental | Admin menyimpan credential terenkripsi dan tes koneksi; UI `/ceisa` hanya mengekspos status nomor aju dan PDF billing. API tambahan ada untuk referensi, kurs/tarif, manifes, detail dan PDF tertentu. Kontrak bisnis sebagian belum dibuktikan. | [CEISA UI](../components/ceisa/ceisa-get-console.tsx), [routes](../app/api/ceisa), [adapter](../lib/server/ceisa/client.ts), [contract notes](ceisa-integration-contract.md) |
| Observasi CEISA ke status CustomsJob | experimental | Operator lookup status lalu memilih terapkan ke status lokal. Mapping memakai pemeriksaan teks respons/nomor registrasi; bukan sinkronisasi background. Keterkaitan evidence belum lengkap. | [CustomsJob detail](../app/(dashboard)/cipls/[id]/shipments/[shipmentId]/jobs/[jobId]/page.tsx), [observation repository](../lib/server/ceisa/repository.ts) |
| Demo draft BC 2.3 | experimental | Upload Invoice + B/L/AWB, ekstraksi, draft JSON, daftar field kurang/konflik dan provenance; isian manual dapat melengkapi draft; JSON draft dapat diunduh. State draft hanya di browser. `LOCALLY_VALID` bukan persetujuan CEISA. | [demo page](../app/(dashboard)/ceisa/bc-23-demo/page.tsx), [draft API](../app/api/ceisa/bc-23/draft/route.ts), [mapper](../lib/ceisa/bc23-draft.ts), [demo component](../components/ceisa/bc23-draft-demo.tsx) |
| Toast dan error feedback | partial | Toast global kanan-bawah dan beberapa toast per halaman tersedia. Sejumlah form lama hanya menampilkan error inline/redirect tanpa toast hasil; toast sukses demo BC memakai tone `info` yang tidak diterima listener global. Belum konsisten dengan pedoman repository. | [AppShell](../components/layout.tsx), [job editor](../components/job-editor.tsx), [CIPL version form](../app/(dashboard)/cipls/[id]/versions/new/page.tsx), [error boundary](../app/error.tsx) |

**Batas inventaris:** `/projects` dan `/general-cargo` menampilkan ComingSoon, bukan modul yang sudah berfungsi. `/tickets` dan `/ticket` redirect ke `/kanban`. `domain/v2` memiliki Project/Task dan validator eksplorasi, tanpa penggunaan ditemukan di runtime `app/`/`components/`/`lib/`. Komponen `JobForm`, `Stages`, `JobDetailActions` dan endpoint `/api/parse-shipment` masih ada, tetapi tidak ditemukan sambungan ke workflow UI utama saat ini. Keberadaan `trackingToken` tidak membuktikan adanya portal tracking publik.

Evidence: [Projects](../app/(dashboard)/projects/page.tsx), [General Cargo](../app/(dashboard)/general-cargo/page.tsx), [domain v2](../domain/v2/types.ts), [legacy parser](../app/api/parse-shipment/route.ts).

# 3. Current User Workflow

## A. Event dan job operasional — alur utama

**Existing implementation:** Login → Events → buat event dengan venue/EO dan tanggal → tambah exhibitor → buka daftar/detail job → upload Invoice dan B/L/AWB → review hasil ekstraksi/perbedaan → koreksi data → catat status operasional → unduh workbook BC 2.3 bila Invoice dan transport tersedia.

**Inferred behavior:** Job exhibitor terlihat seolah otomatis dibuat setelah exhibitor ditambahkan; trigger sebenarnya adalah **GET `/api/jobs`**, bukan transaksi tambah exhibitor. Nomor job dibuat dari koleksi yang dibaca. Belum ada jaminan concurrency maupun model satu exhibitor dengan beberapa pengiriman dalam alur utama.

Upload baru langsung dapat memperbarui data Invoice/transport aktif. Tidak ada approval terpisah sebelum nilai tersebut dipakai ekspor. Kegagalan LLM mencoba penyimpanan file sebagai OTHER. Export hanya menghasilkan unduhan; tidak mengirim ke CEISA atau otomatis mengubah status menjadi SUBMITTED.

## B. Ticket koordinasi

**Existing implementation:** Login → Kanban atau tautan ticket dari Event/Job → buat ticket → pilih konteks/prioritas/PIC → lihat pada board → assign/take/edit/komentar → pindah TODO/PROGRESS → DONE dengan catatan hasil → reopen dengan alasan bila diperlukan.

Jika assignee tidak dikirim ketika membuat ticket konteks JOB, server mengambil PIC job. Ini default saat pembuatan, bukan bukti sinkronisasi PIC secara terus-menerus. Semua user aktif dapat menggunakan scope `all`; board pribadi adalah filter UI, bukan pembatas akses data.

## C. CIPL, shipment dan CustomsJob — alur parsial

**Existing implementation dari CIPL yang sudah ada:** buka `/cipls/[id]` → tambah versi/snapshot item → aktifkan versi → buat shipment dengan alokasi item → buat CustomsJob BC 2.3/2.5/3.0 → isi aju/registrasi/gudang → ubah status.

**Flow belum dapat dipastikan:** cara operator memulai CIPL pertama dari navigasi saat ini, perpindahan dari job utama ke model ini, dan rekonsiliasi item BC 2.3 dengan BC lanjutan. Tidak boleh dipresentasikan sebagai satu workflow end-to-end yang telah selesai.

## D. CEISA dan draft lokal

**Existing implementation:** Admin → Settings → simpan credential → tes koneksi. User login → CEISA → lookup status atau buka PDF billing. Di halaman CustomsJob tersedia lookup → review observasi → terapkan status lokal secara manual.

Terpisah: buka langsung `/ceisa/bc-23-demo` → upload dua dokumen → periksa draft/issues → lengkapi field manual/referensi → lihat/unduh JSON draft lokal. Unduhan hanya berisi draft, bukan seluruh issues/provenance. Penutupan/reload halaman menghilangkan state draft. Belum ada validasi dokumen ke CEISA, penyimpanan draft di CEISA, submit final, approval submit, ataupun rekonsiliasi submit gagal.

## E. Lookup LARTAS dan administrasi

Login → `/lartas` → masukkan HS → baca hasil beserta status verifikasinya. Belum ditemukan integrasi yang otomatis memblokir job berdasarkan hasil ini. Admin → Settings → tambah/edit user, venue atau EO; perubahan user bukan workflow undangan email.

# 4. Domain Model

**Evidence utama:** [schema awal](../supabase/migrations/20260915000000_initial_vss_schema.sql), [schema operasional](../supabase/migrations/20260916074803_normalize_operational_data.sql), [normalisasi event/user](../supabase/migrations/20260917120000_event_page_domain.sql), [ticket schema](../supabase/migrations/20261006000000_ticket_collaboration.sql), [CEISA schema](../supabase/migrations/20261006100000_ceisa_integration.sql).

Schema bersifat **hibrida**: user, event/master, ticket, attachment dan CEISA memiliki kolom terstruktur; jobs, stages, CIPL, shipment dan customs_jobs terutama menyimpan `payload jsonb`. Field domain pada payload dijelaskan berdasarkan [data façade](../lib/data-client.ts) dan [exhibition types](../domain/exhibition/types.ts), **bukan constraint database**. Relasi logis pada JSON tidak sama dengan foreign key yang ditegakkan SQL.

| Entity / tabel | Field penting | Relasi dan lifecycle |
| --- | --- | --- |
| User / `app_users` | UUID, email unik/lowercase, full_name, password_hash, role/job_role, is_admin/access_level, is_active, timestamp | Role pekerjaan STAFF/SUPERVISOR/CUSTOMER_SERVICE/DOCUMENT_ASSISTANT; akses ADMIN/MEMBER. Ada representasi admin ganda yang perlu tetap konsisten. |
| Workspace / `workspaces`, `workspace_members` | id, slug; membership user_id dan role OWNER/MEMBER | Schema mendukung membership, tetapi adapter memilih slug `default`; tidak ditemukan penegakan membership pada jalur data utama. |
| Venue / `venues` | id, name, contacts[], address, website, loading_access_notes, payload | Direferensikan Event; kontak dapat diberi isPrimary, tanpa aturan tepat satu kontak utama. |
| EventOrganizer / `event_organizers` | id, name, npwp, contacts[], address, website, payload | Direferensikan Event. |
| Event / `events` | id, name, venue_id, event_organizer_id, starts_on, ends_on, created_by_id | Satu venue dan EO per event. API utama create/read; cancellation terpisah. UI ACTIVE/CANCELLED diturunkan dari cancellation. |
| EventCancellation / `event_cancellations` | event_id, reason, cancelled_at, cancelled_by_id | Satu record per event/workspace; FK event dengan delete restrict. |
| Exhibitor / `exhibitors` | id, event_id, kind, name, contact, agent_id, npwp, created_by_id | Milik satu event. LOCAL boleh NPWP; INTERNATIONAL harus tanpa NPWP. `agent_id` belum terlihat sebagai relasi lengkap dengan pengelolaan agent aktif. |
| Job utama / `jobs` | payload: jobNumber, type IMPORT/EXPORT, clientName, party/transport, eventId/exhibitorId, assignedToId, createdById, trackingToken, operational | DRAFT/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELLED. Operational menyimpan inbound/outbound, Invoice, CIPL ringkas dan tiga status BC. Berbeda dari CustomsJob. |
| Stage / `job_stages` | payload: jobId, name, order, status, notes | PENDING/IN_PROGRESS/DONE; fungsi/komponen ada, belum terhubung ke UI utama yang ditemukan. |
| JobDocument / `job_documents` | payload: jobId, fileName, mimeType, fileSize, attachmentId, kind | Banyak dokumen per Job; tipe mencakup sumber/transport/Invoice/CIPL/BC/OTHER. |
| Attachment / `attachments` + Storage | id, owner_type, owner_id, kind, file_name, mime_type, file_size, storage_path | Owner CIPL_VERSION/SHIPMENT/CUSTOMS_JOB/LEGACY_JOB; owner merupakan referensi logis, bukan FK polymorphic. File bytes di bucket privat. |
| CoordinationAgent / `coordination_agents` | payload: eventExhibitorId, organizationName, kontak/alamat, countryCode, status | ACTIVE/INACTIVE; model tersedia, pengelolaan lengkap pada UI tidak ditemukan. |
| Cipl / `cipls` | payload: eventExhibitorId, referenceNumber, activeVersionId, sourceDocumentUnavailable | AWAITING_DOCUMENT/RECEIVED/UNDER_REVIEW/READY/ON_HOLD/CANCELLED. Ringkasan CIPL dalam Job adalah model terpisah. |
| CiplVersion / `cipl_versions` | payload: ciplId, versionNumber, receivedAt/By, sourceDocument, items[], revisionNote | Snapshot item; item berisi deskripsi, quantity/unit, nilai/currency, berat, origin, identifiers, intendedUse/Disposal. Versi sumber shipment tetap dirujuk. |
| Shipment / `shipments` | payload: ciplId, sourceCiplVersionId, BL/AWB, documentNumber, direction, mode, parties, allocations[], attachment | DRAFT/DOCUMENT_RECEIVED/UNDER_REVIEW/READY_FOR_CUSTOMS/ON_HOLD/CANCELLED. Satu versi CIPL sumber; alokasi merujuk item versi tersebut. |
| CustomsJob / `customs_jobs` | payload: shipmentId, jobNumber, documentType, ajuNumber, registrationNumber/Date, office/warehouse, assignedToId, allocations[], attachments[], billing, statusHistory[] | Satu jenis BC per job. DRAFT/PREPARING/SUBMITTED/REGISTERED/RELEASED/COMPLETED/ON_HOLD/CANCELLED. History menyimpan from/to/reason/time; field observasi CEISA opsional belum diisi jalur apply. |
| BillingInformation | Union di payload job | NOT_READY/NOT_APPLICABLE/READY/INVOICED/PAID, dengan amount/currency/reference sesuai varian. Tidak membuktikan sistem penagihan/pembayaran terintegrasi. |
| Ticket / `tickets` | ticket_number, creator/assignee, context_kind/id, title, description, status, sort_order, priority, completion_note/at, last_activity_at | GENERAL/EVENT/JOB; TODO/PROGRESS/DONE; NORMAL/URGENT. FK user tersedia, konteks Event/Job berupa ID tanpa FK polymorphic. |
| TicketComment / `ticket_comments` | ticket_id, author_id, body, created_at | Komentar membuat last_activity_at diperbarui. |
| TicketActivity / `ticket_activities` | ticket_id, actor_id, kind, change JSON, occurred_at | Trigger CREATED/DETAILS_CHANGED/ASSIGNEE_CHANGED/STATUS_CHANGED; bukan audit seluruh aplikasi. |
| CEISA connection / `ceisa_connections` | workspace_id, ciphertext/iv/tag, key_version, verification_state, last_verified_at | Satu koneksi per workspace; UNCONFIGURED/UNVERIFIED/VERIFIED/FAILED. VERIFIED hanya hasil probe koneksi. |
| CEISA observation / `ceisa_observations` | operation, correlation_key, submission_number, response_code/name, encrypted payload, SHA-256, timestamps | Menyimpan observasi hasil normalisasi yang diberikan route; bukan arsip lengkap setiap raw response vendor. Dedup berdasarkan workspace/operation/correlation/hash. |
| Preferences, MigrationReviewItem | `preferences`, `migration_review_items` payload | Preferences juga dipakai counter nomor CustomsJob; review migration memiliki REVIEW_REQUIRED/MIGRATED. Bukan workflow migrasi yang lengkap. |

**Model eksplorasi terpisah:** `domain/v2` memuat Project, Task movement/handling/customs/administrative, resource, blocker, evidence dan customs control. Tidak ada tabel Project/Task operasional yang bersesuaian dalam migrasi yang ditelusuri. Model ini bukan capability project management aktif.

# 5. Roles and Permissions

**Existing implementation:** NextAuth menjaga halaman dashboard dan route API mengecek sesi. Password database memakai salted scrypt dan timing-safe comparison. Login database memeriksa `is_active`; ticket API juga memeriksa akun aktif pada tiap konteks request. Banyak route lain hanya memeriksa sesi, sehingga penonaktifan/perubahan admin tidak otomatis tercermin pada semua sesi JWT yang sudah terbit.

| Aksi | Permission yang benar-benar ditemukan | Batas/hal yang belum ditegakkan |
| --- | --- | --- |
| Buka dashboard/operasional | Sesi login | Tidak ada isolasi per job/PIC/exhibitor/client. |
| Settings user/venue/EO | `session.user.isAdmin` pada API Settings dan akses halaman | Venue/EO juga bisa dibuat oleh user login melalui `/api/event-records`. |
| Konfigurasi/test CEISA | Admin melalui `requireCeisaUser(true)` | Lookup bisnis CEISA cukup sesi login; company ID/nomor aju belum dibatasi berdasarkan kepemilikan user. |
| Event/exhibitor | Sesi dengan email yang cocok `app_users` | Tidak ada permission berbasis job_role untuk create/cancel/tambah exhibitor. |
| Ticket | Akun aktif; assignee harus aktif | Semua akun aktif dapat baca semua ticket, edit/assign/take/move/komentar. API tidak membatasi mutasi pada creator/PIC. |
| Generic operational records | Sesi; tabel dalam allowlist; PUT hanya meminta string `id` | Tidak menerapkan schema domain, admin, ownership atau aturan event immutable. Tidak boleh mengandalkan batas UI. |
| Attachment | Sesi login | Tidak mengecek izin atas owner atau keberadaan owner; semua attachment dalam workspace default dapat dibaca lewat ID. |
| Database/Storage | RLS aktif dan privilege tabel dicabut dari anon/authenticated; akses server menggunakan service-role | Service-role memerlukan otorisasi aplikasi yang benar; RLS tidak menggantikan pemeriksaan route. Membership workspace belum dipakai. |

**Assumption:** seluruh staf dipercaya mengakses satu workspace bersama. Nama SUPERVISOR dan DOCUMENT_ASSISTANT tidak mempunyai permission operasional tersendiri. OWNER/MEMBER pada membership belum menjadi sistem multitenant aktif.

Evidence: [auth](../auth.ts), [settings API](../app/api/settings/route.ts), [event context](../lib/supabase/event-api.ts), [ticket context](../lib/supabase/ticket-api.ts), [generic API](../app/api/operational-records/route.ts), [CEISA guard](../lib/server/ceisa/http.ts).

# 6. External Integrations

Bagian ini mendeskripsikan kode yang tersedia, bukan verifikasi kontrak vendor terkini atau ketentuan kepabeanan.

| Integrasi | Tujuan, input → output | Dependency/config | Failure handling yang tersedia dan batasnya |
| --- | --- | --- | --- |
| Supabase PostgreSQL | Data domain/API → row terstruktur atau payload JSON | `@supabase/supabase-js`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, migrasi dan workspace default | Error dikembalikan API; banyak pesan database diteruskan. Multi-write pada façade tidak atomik; tidak ditemukan optimistic concurrency. |
| Supabase Storage privat | File + owner metadata → attachment ID; ID → stream file | Bucket `attachments`, service-role server | Jika insert metadata gagal, adapter mencoba hapus file yang baru diupload. Tidak mencakup rollback Job/JobDocument/CIPL atau recovery bila cleanup gagal. |
| Google Gemini | PDF base64 atau teks spreadsheet → klasifikasi, Invoice/transport; legacy parser → shipment fields | REST generateContent; model hardcoded `gemini-3.5-flash-lite`; `GEMINI_API_KEY` | Cek tipe/ekstensi dan 10 MB pada ekstraksi; teks spreadsheet dipotong 80.000 karakter; respons dinormalisasi. Error 400/413/502/503. Belum ada timeout/retry/rate limit khusus LLM, evaluasi akurasi, maupun gate approval. UI dapat menyimpan OTHER ketika gagal. |
| Excel lokal, bukan layanan eksternal | Payload Job dari browser + template → `.xlsx` BC 2.3 | `xlsx`, file `docs/bup-23.xlsx`; template 25/30 juga ada | Invoice/transport wajib ada; jenis 25/30 ditolak; error menjadi 400. Sheet hilang dilewati tanpa error. Field kosong tetap dapat diekspor; kesesuaian kolom/formula/format belum dibuktikan. |
| CEISA H2H | Credential → token; aju/company → status; kode/query → referensi, kurs, tarif, manifes; reference → PDF/detail | CEISA base/auth URL, API key, username/password, optional platform/origin; credential terenkripsi AES-256-GCM | Timeout default 30 detik; token cache per proses; login ulang sekali saat 401; 404/unavailable/contract mismatch dibedakan. Validasi path download dan indikasi PDF ada. Belum ada write dokumen/submit final. |
| INSW/LARTAS | HS 8 digit → deskripsi/tarif/indikator dan rincian LARTAS dengan sumber/verifikasi | Base URL, token/token file; optional SSO client ID/bearer; timeout default 30 detik | Fallback CMS ke publik, timeout, hasil invalid/not-found/source-error. `unverified` tidak boleh dibaca sebagai bebas LARTAS. Tidak ada bukti hasil disimpan sebagai evidence keputusan job. |

**CEISA perlu dibaca pada dua tingkat.** API server lebih luas daripada UI console yang hanya status aju dan PDF billing. Route references/financial/manifest/documents tidak berarti semua fiturnya sudah menjadi workflow user yang selesai. Tes koneksi memanggil `request('kurs/USD')` tanpa normalisasi kurs; label VERIFIED tidak membuktikan seluruh response contract siap digunakan. Catatan repository menyebut capture login dan probe kurs, tetapi normalizer kurs masih menolak contoh yang tidak memiliki tanggal efektif. Evidence: [connection test](../app/api/ceisa/settings/test/route.ts), [client](../lib/server/ceisa/client.ts), [catatan kontrak](ceisa-integration-contract.md).

Observasi disimpan untuk status, kurs, tarif, manifes melalui route terkait; detail/PDF tidak otomatis diarsipkan sebagai attachment. Timestamp pengambilan dalam payload normalisasi juga berarti hash bukan jaminan dedup atas respons bisnis yang sama pada waktu berbeda.

**Tidak ditemukan integrasi runtime** email, WhatsApp, push notification, payment gateway, ERP/accounting, carrier tracking, atau webhook masuk. File percakapan WhatsApp dan script discovery adalah bahan analisis, bukan integrasi WhatsApp. `next-auth` Credentials bukan penggunaan Supabase Auth sebagai penyedia login.

## Konfigurasi dan asumsi runtime yang ditemukan

| Variabel/config | Penggunaan saat ini |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Wajib untuk adapter operasional; hanya digunakan di server. Tidak ada fallback operasional browser penuh. |
| `AUTH_SECRET` / fallback `NEXTAUTH_SECRET` | Rahasia NextAuth; strategi JWT dan `trustHost: true`. Trust proxy/host deployment perlu dikonfigurasi dengan benar. |
| `GEMINI_API_KEY` | Ekstraksi LLM; model ditentukan dalam source, bukan environment variable. |
| `LARTAS_BASE_URL`, `LARTAS_TOKEN`, `LARTAS_TOKEN_FILE_PATH`, `LARTAS_REQUEST_TIMEOUT_MS` | Endpoint, credential atau file token server, timeout lookup INSW. |
| `INSW_CLIENT_ID`, `INSW_CLIENT_BEARER` | Jalur optional pengambilan token melalui SSO INSW. |
| `CEISA_BASE_URL`, `CEISA_AUTH_BASE_URL`, `CEISA_ORIGIN`, `CEISA_REQUEST_TIMEOUT_MS` | Koneksi gateway/login CEISA; base URL menerima HTTP atau HTTPS dalam kode, tidak otomatis enforce HTTPS. |
| `CEISA_CREDENTIAL_ENCRYPTION_KEY` | Kunci base64 yang didekode menjadi 32 byte; untuk credential dan payload observasi. Username/password/API key CEISA berasal dari database terenkripsi. |
| `VSS_USER_PASSWORD` | Input script pembuatan akun awal; bukan password hardcoded production. |
| `NODE_ENV`, `PORT` | Contoh PM2 menetapkan production dan port 3000. Next memakai runtime Node untuk API file, crypto, dan template workbook. |

Konfigurasi Next membatasi body **server actions** ke 10 MB; ini tidak sama dengan batas semua route handler/upload. Server actions yang ditemukan menangani login/logout; CRUD utama memakai route API. Tidak ditemukan worker terpisah, scheduler, Dockerfile, atau pipeline CI/CD dalam file proyek yang ditelusuri. Kondisi infrastruktur di luar repository belum diketahui.

Evidence: [auth](../auth.ts), [Supabase config](../lib/supabase/admin.ts), [LARTAS route](../app/api/lartas/route.ts), [CEISA crypto](../lib/server/ceisa/crypto.ts), [Next config](../next.config.mjs), [PM2](../ecosystem.config.js), [login action](../app/(auth)/login/actions.ts).

# 7. Business Rules Found in Code

Tingkat penegakan disebutkan agar rule UI/domain tidak dikira invariant server/database.

| Rule eksplisit | Penegakan/evidence | Batas implementasi |
| --- | --- | --- |
| Event wajib nama, venue, EO dan tanggal akhir tidak sebelum awal | Zod API dan sebagian constraint SQL; [event validation](../domain/event/validation.ts) | Validasi tanggal memakai pola string; beberapa constraint migrasi `NOT VALID` untuk data lama. |
| Event dikoreksi dengan cancel + buat baru; pembatalan wajib alasan | Route edit menjelaskan immutable; DELETE khusus mencatat cancellation | Generic records masih memungkinkan write/delete langsung, sehingga immutable belum berlaku menyeluruh. |
| NPWP exhibitor hanya untuk LOCAL | Discriminated Zod input + SQL check | INTERNATIONAL tidak menerima field NPWP; ini aturan aplikasi, bukan kesimpulan kebutuhan client. |
| Ticket DONE wajib catatan dan waktu selesai; status lain tanpa completion | Validator route dan SQL check | Reopen wajib alasan pada route, tetapi parameter `p_reopen_reason` tidak dipakai fungsi SQL; alasan tersebut belum tersimpan dalam history. |
| Assignee ticket harus user aktif | `assertActiveAssignee`; [ticket API](../lib/supabase/ticket-api.ts) | Tidak memeriksa membership workspace. TAKE tidak mensyaratkan ticket masih unassigned. |
| CIPL READY membutuhkan minimal satu item, deskripsi, unit, quantity positif | [exhibition validator](../domain/exhibition/validation.ts), form versi | Pemeriksaan hanya pada jalur tertentu; `activateCiplVersion` tidak menjalankan pemeriksaan READY. Generic write dapat melewati aturan. |
| Shipment mengacu satu versi CIPL dan satu tipe BL/AWB; quantity/unit mengikuti sumber | Façade `createShipment` + validator | Tidak ada transaksi/constraint SQL alokasi; duplicate item dalam satu candidate belum dijumlahkan bersama oleh validator. |
| Alokasi CustomsJob berasal dari shipment dan tidak melebihi quantity | Façade `createCustomsJob` + validator | Menjumlahkan pemakaian semua job existing, tanpa membedakan BC berurutan atau job cancelled; semantics ini perlu konfirmasi. |
| CustomsJob progression DRAFT → PREPARING → SUBMITTED → REGISTERED → RELEASED → COMPLETED | `validateJobTransition` pada façade | ON_HOLD/CANCELLED diizinkan langsung; transisi selain langkah normal memerlukan alasan + lampiran. Validator indeks dapat menganggap ON_HOLD/CANCELLED → DRAFT sebagai langkah normal. Bukan validasi server. |
| Status SUBMITTED lokal dapat diisi tanpa respons pengiriman CEISA | Editor/status validator | Tidak ada submit CEISA; status ini belum merupakan bukti pengajuan eksternal. |
| BC 2.3 export memerlukan Invoice dan transport hasil ekstraksi | [export route](../app/api/export-customs-workbook/route.ts) | Tidak mengecek kelengkapan seluruh field wajib, mismatch, READY, approval, atau verifikasi CEISA. |
| Perbandingan dokumen memakai enam field, toleransi angka 0,001 dan normalisasi teks | [comparison](../lib/document-comparison.ts) | Nilai kosong menjadi UNAVAILABLE. Seller/buyer dibandingkan dengan shipper/consignee, belum tentu identik dalam setiap kasus bisnis. |
| Label fase job diturunkan dari dokumen/CIPL/status BC | [phase function](../lib/job-operational-phase.ts) | Ini aturan tampilan. Tidak menjamin proses fisik selesai; semua BC tidak applicable atau status final dapat menghasilkan COMPLETED. |
| Tidak menyimpulkan “Tidak Ada” LARTAS dari hasil unverified | [LARTAS API](../app/api/lartas/route.ts) | Informasi bantu; belum menjadi gate kelayakan shipment. |

# 8. Assumptions Embedded in the Current Implementation

Semua baris berikut adalah **Assumption**, belum merupakan requirement client.

| Asumsi yang tampak | Indikasi kode | Dampak jika salah |
| --- | --- | --- |
| Operasi berada dalam satu workspace yang dipercaya bersama | Adapter memakai slug `default`; semua staf dapat melihat semua ticket | Perlu perubahan akses/data bila ada cabang, perusahaan atau client yang harus terpisah. |
| Event punya satu venue, satu EO, dan tidak berubah setelah dibuat | Field tunggal dan UI cancel/recreate | Reschedule/koreksi bisa membuat duplikasi event atau kehilangan kesinambungan pekerjaan. |
| Exhibitor dicatat per event, bukan master lintas event | `exhibitors.event_id` | Riwayat exhibitor lintas pameran belum menjadi fitur. |
| Satu job awal IMPORT per exhibitor cukup sebagai unit kerja | `initializeJob` pada GET jobs | Multi-shipment, ekspor, atau revisi bisa membutuhkan cardinality berbeda. |
| Satu Invoice dan satu transport extraction aktif cukup per Job | `operational.invoice` dan `inboundDocument` tunggal | Upload berikutnya mengganti ringkasan aktif, walaupun banyak file tetap tersimpan. |
| Nama penjual/pembeli semestinya sama dengan shipper/consignee | Comparison dokumen | Transaksi melalui agent/distributor dapat menghasilkan peringatan yang sebenarnya wajar. |
| BC 2.3/3.0 applicable secara default, BC 2.5 tidak | `getOperationalDetails` | Tidak membuktikan dokumen tersebut benar untuk semua client/kasus. |
| Total Invoice dapat dipakai langsung untuk beberapa nilai kepabeanan | Export mengisi CIF dari total; draft mapper memakai total untuk cif/fob/hargaPenyerahan | Harus dipastikan sumber dan kalkulasinya sebelum output dipakai operasional. |
| Satu PIC per job/ticket cukup, dan default PIC ticket diambil saat create | `assignedToId`/`assigneeId` | Belum mendukung banyak penanggung jawab atau handover formal. |
| Validasi alokasi bersama seluruh jenis CustomsJob sesuai proses | Penjumlahan quantity semua existing jobs | Item yang sama mungkin perlu ikut dokumen masuk dan dokumen penyelesaian; model saat ini dapat menolaknya. |
| Data pengguna yang membuat/menerima record dapat diwakili nilai default | CIPL version memakai ID demo; helper job memakai user aktif pertama | Atribusi historis bukan bukti actor aktual. |
| Seluruh pengguna internal boleh memakai credential CEISA workspace | Lookup cukup login | Perlu keputusan kewenangan akses data perusahaan/nomor aju. |
| Polling, toast, dan board cukup untuk koordinasi | Detail ticket polling 5 detik; tanpa notifikasi keluar | Assignee tidak menerima pemberitahuan saat tidak membuka aplikasi. |
| Waktu browser dan pemrosesan sinkron cukup | Tanggal UI lokal; LLM/Excel berjalan dalam request | Timezone, volume dokumen, waktu tunggu dan kapasitas belum didefinisikan. |

# 9. Open Questions for Client

**P0** = menentukan bentuk/besaran scope. **P1** = keputusan detail sebelum UAT/operasi. Pertanyaan ini adalah **Needs confirmation**; tidak ada jawaban yang diasumsikan telah disetujui.

## Workflow

- **P0:** Unit kerja yang client sebut “job” sebenarnya satu exhibitor, satu pengiriman B/L/AWB, atau satu dokumen BC? Pilih hubungan antara Job utama dan CIPL → Shipment → CustomsJob yang sekarang terpisah.
- **P0:** Satu exhibitor boleh memiliki berapa shipment, Invoice, B/L/AWB, serta dokumen BC? Apakah item yang sama harus dialokasikan lagi dari BC masuk ke BC penyelesaian?
- **P0:** Apakah seluruh job dimulai dari event/exhibitor, atau ada pekerjaan non-event? Saat ini `/jobs/new` menuju Events dan General Cargo belum berjalan.
- **P0:** Apakah cancel + buat ulang event dapat diterima untuk perubahan tanggal/venue/EO? Apa nasib job dan ticket saat event dibatalkan?
- **P1:** Bukti apa yang wajib untuk SUBMITTED, REGISTERED, RELEASED dan COMPLETED? Apakah label “Siap submit” cukup berasal dari CIPL VERIFIED dan dokumen yang ada?
- **P1:** Siapa yang boleh reopen/ambil alih ticket, dan apakah catatan hasil/alasan reopen wajib disimpan permanen?

## Users & Roles

- **P0:** Apakah semua staf boleh melihat dan mengubah seluruh job/ticket seperti API saat ini, atau perlu pembatasan berdasarkan client, PIC, cabang, atau job role?
- **P0:** Apakah pengguna hanya internal, atau client/exhibitor/agent perlu akun? Portal eksternal belum tersedia.
- **P1:** Siapa yang boleh mengubah user/akses, master venue/EO, status BC, dan hasil ekstraksi? Apakah perubahan akses harus langsung membatalkan sesi lama?

## Documents

- **P0:** Dokumen/formats mana yang wajib untuk v1: Invoice, packing list/CIPL, B/L, AWB, BC? Packing list belum punya classifier khusus.
- **P0:** Apakah dokumen komersial boleh dikirim ke Gemini, dan bagian mana yang perlu dibatasi? Siapa yang mengesahkan hasil sebelum dipakai untuk Excel?
- **P0:** Apakah output yang dibutuhkan workbook BC 2.3 untuk input manual/import ke sistem lain, draft JSON, atau dokumen siap submit? Minta template dan contoh hasil yang diterima client.
- **P1:** Bagaimana memilih dokumen aktif ketika ada revisi/multi-Invoice? Apakah perbedaan seller/shipper atau berat harus memblokir pekerjaan?
- **P1:** Apakah 10 MB dan pemotongan teks spreadsheet cukup untuk dokumen nyata? Berapa item/sheet/file yang lazim?

## CEISA

- **P0:** v1 cukup lookup status/PDF, atau wajib validate/save-draft/submit final? Tiga operasi terakhir belum diimplementasikan.
- **P0:** Akses H2H menggunakan akun/perusahaan siapa dan lingkungan apa? Apakah satu koneksi workspace cukup?
- **P0:** Jenis BC apa yang benar-benar diperlukan dan siapa penanggung jawab keputusan/mappingnya? Jangan menganggap pilihan 23/25/30 pada UI sebagai persetujuan scope.
- **P1:** Siapa pemilik akses sandbox dan contoh respons yang disanitasi untuk membuktikan status, kurs, tarif, manifes dan PDF?
- **P1:** Apakah status eksternal harus diterapkan manual seperti sekarang atau otomatis? Evidence apa yang wajib terhubung pada perubahan status lokal?

## Data Retention

- **P0:** Berapa lama lampiran, versi CIPL, hasil ekstraksi, ticket dan observasi CEISA harus disimpan? Saat ini tidak ada lifecycle retensi/purge.
- **P1:** Apakah pembatalan harus mempertahankan semua data selamanya, dan bagaimana koreksi/salah-upload ditangani?
- **P1:** Data PoC apa yang harus dimigrasikan? Apakah ada sumber browser lama yang masih relevan, mengingat adapter aktif sudah Supabase?

## Audit & Compliance

- **P0:** Aktivitas apa yang harus bisa dibuktikan—perubahan data dokumen, unduhan, perubahan akses, status BC, atau hanya ticket? Saat ini audit paling terstruktur hanya ticket.
- **P1:** Apakah actor/time/before-after dan sumber dokumen wajib untuk setiap perubahan yang berdampak pada workbook/BC? Siapa yang meninjau audit?
- **P1:** Apakah lokasi penyimpanan database/LLM harus mengikuti batas tertentu dari kontrak client? Penilaian ketentuan tersebut belum menjadi hasil analisis kode ini.

## Notifications

- **P0:** Apakah assignment/urgent/reopen wajib memberi notifikasi di luar aplikasi? Saat ini hanya toast dan pembaruan layar/polling.
- **P1:** Jika diperlukan, kejadian, penerima, kanal dan toleransi keterlambatan mana yang benar-benar harus masuk v1?

## Deployment

- **P0:** Siapa menyediakan dan memiliki hosting, Supabase, domain/TLS, Gemini, serta credential CEISA/INSW? Target repository saat ini Node/Next + contoh PM2.
- **P0:** Berapa user serentak, job/event, ukuran dokumen, serta toleransi downtime dan kehilangan data? Ini menentukan kecukupan pembacaan koleksi penuh dan request sinkron.
- **P1:** Apakah staging wajib terpisah dari production, dan timezone operasional yang harus digunakan apa?

## Maintenance / Operations

- **P0:** Siapa merawat perubahan kontrak CEISA/INSW, model Gemini dan template workbook, serta mengesahkan hasil setelah perubahan?
- **P1:** Siapa menerima incident, merotasi credential, memulihkan backup, dan menanggung biaya API/storage?
- **P1:** Siapa menyediakan kasus UAT nyata yang sudah disanitasi dan memutuskan penerimaan setiap workflow?

# 10. Proposed Production Scope v1

**Usulan bersyarat**, bukan komitmen. Fitur kandidat hanya boleh dirilis setelah gap kritis yang berlaku pada fitur tersebut ditutup dan client menetapkan acceptance criteria. Bila integrasi eksperimental belum terverifikasi, batasi/nonaktifkan akses operasionalnya pada rilis awal.

## In Scope

Kandidat konservatif dari implementasi yang paling jelas:

- Workspace internal, login/logout dan pengelolaan akun admin; otorisasi server yang disepakati dan konsisten.
- Venue/EO, event, exhibitor dan job operasional berbasis event; dashboard, pencarian, detail dan timeline.
- Pencatatan manual transport, dokumen, catatan dan status operasional dengan definisi status yang disepakati.
- Penyimpanan/unduhan lampiran privat yang konsisten dengan record induk.
- Ticket konteks General/Event/Job, assignment, board, komentar, selesai/reopen dan riwayat aktivitas yang sudah tersedia.
- Feedback hasil form melalui toast kanan-bawah dan error yang dapat ditindaklanjuti.

Acceptance candidate: user berwenang dapat menuntaskan alur tersebut; perubahan bertahan setelah reload/login kembali; user tanpa izin ditolak server; kegagalan upload/save tidak meninggalkan record seolah lengkap; identitas actor berasal dari sesi sebenarnya. Ini usulan batas penerimaan productionization, bukan hasil uji saat ini.

## Needs Confirmation

- Pilihan satu model job produksi dan nasib alur CIPL/Shipment/CustomsJob; kemungkinan diperlukan rekonsiliasi model/data sebelum rilis.
- Immutability event, pengaruh cancel pada pekerjaan terkait, dan kebutuhan job non-event.
- Gemini sebagai bantuan ekstraksi, dokumen yang boleh dikirim, review manusia dan toleransi kesalahan.
- Workbook BC 2.3: template, kolom, sumber nilai, kelengkapan dan bukti penerimaan output. Kandidat bantuan dokumen, belum dokumen siap submit.
- LARTAS sebagai lookup pendukung dan kebutuhan penyimpanan evidence hasil.
- CEISA read-only: operasi mana yang benar-benar dibutuhkan dan sudah lulus uji kontrak; aturan apply status lokal.
- Retensi, audit, akses per peran serta target operasi/backup yang menentukan biaya productionization.

## Out of Scope for Now

**Potential future enhancement**, memerlukan scope terpisah bila dipilih client:

- Modul Projects/General Cargo dan orkestrasi Task/Resource/CustomsControl dari `domain/v2`.
- Pengiriman dokumen CEISA, final submission, approval submission, retry/reconciliation submission atau sinkronisasi otomatis penuh.
- Ekspor BC 2.5/3.0 dan alokasi turunan lengkap yang sekarang belum tersedia pada jalur export.
- Portal client/exhibitor, public tracking, multi-company/multitenant, SSO/MFA jika tidak menjadi syarat akses yang disepakati.
- Email/WhatsApp/push, carrier tracking, ERP/accounting, pembayaran dan reminder/SLA otomatis.

Out of scope berarti tidak otomatis dihitung sebagai fitur existing yang tinggal dirilis; bukan keputusan permanen menolak kebutuhan client.

# 11. Production Readiness Gaps

Temuan di bawah adalah pembacaan kode. “Tidak ditemukan” berarti tidak terlihat pada repository, bukan kepastian bahwa kontrol infrastruktur eksternal tidak ada.

| Area | Prioritas | Gap dan dampak | Minimum penutupan yang diusulkan |
| --- | --- | --- | --- |
| Authorization | **critical before production** | Generic API memberi PUT/DELETE lintas koleksi bagi sesi login; aturan admin/immutability dan ownership tidak seragam. Service-role melewati RLS. | Tetapkan matriks izin; enforce setiap command/read sensitif di server; tutup jalur generik yang melewati aturan; uji kasus izin negatif. |
| Session/account security | **critical before production** | Role admin di JWT dapat stale; cek akun aktif tidak konsisten; minimum password hanya satu karakter; rate limiting login tidak ditemukan di app. | Kebijakan akun/password dan revocation; validasi akun/izin aktual; pembatasan percobaan autentikasi yang terukur. |
| Data integrity / transaksi | **critical before production** | Job + metadata + file ditulis dengan request paralel; rollback storage hanya lokal. Nomor job berbasis jumlah/counter baca-tulis; race/lost update mungkin terjadi. GET jobs melakukan upsert job otomatis. | Command server dengan atomicity DB, mekanisme kompensasi/recovery Storage, penomoran aman, kontrol concurrency; hindari write tersembunyi saat read. |
| Konsistensi model/schema | **critical before production** | Payload JSON hidup bersama kolom typed; generic write dapat membuat keduanya berbeda. Generic baca exhibitor mengandalkan payload, sementara API baru menyimpan payload input tanpa seluruh identitas; alur `createCipl` dapat tidak cocok. | Pilih model sumber kebenaran; normalisasi/migrasi data dan kontrak façade; verifikasi referensi silang pada data lama/baru. |
| Validasi business rule | **critical before production** | Banyak validator CIPL/allocations/transitions hanya client-side; duplicate allocations/concurrency dan status terminal belum aman; beberapa SQL constraint NOT VALID. | Terapkan invariant di server/DB, uji batas quantity dan transisi; audit/backfill data lama sebelum validasi constraint. |
| Dokumen dan upload | **critical before production** | Batas 10 MB hanya jalur ekstraksi; endpoint attachment tidak enforce size/type/owner. Fallback OTHER dapat tetap menyimpan file yang ditolak ekstraksi. | Batas upload server menyeluruh, pengecekan konten/owner, kontrol akses unduhan, recovery orphan dan penanganan input rusak. |
| Keutuhan hasil ekstraksi | **critical before production** jika fitur dirilis | Upload mengganti extraction aktif; editor operasional membangun ulang objek tanpa membawa seluruh `invoice`/`inboundDocument`, berisiko menghapus hasil lengkap saat simpan. | Pertahankan data yang tidak diedit; tentukan dokumen aktif/revisi dan uji regresi upload → review → edit → export. |
| Excel / LLM correctness | **critical before production** jika fitur dirilis | Nilai CIF/FOB dan kode dokumen memakai mapping sederhana; penulisan sheet tidak mengikat key ke header template secara eksplisit; payload Job dipercaya dari browser. `LOCALLY_VALID` hanya pemeriksaan lokal. | Fixture dokumen/template yang disetujui, validasi output per kolom/field, review manusia dan sumber data server. Jangan beri label siap submit tanpa bukti. |
| CEISA | **critical before production** jika fitur dirilis | Banyak normalizer belum dibuktikan; apply status memakai pencocokan teks; observation ID tidak dimasukkan ke statusHistory; lompatan status dapat tertolak validator karena tanpa attachment. | Contract test dengan respons nyata tersanitasi; mapping status dan evidence server yang eksplisit; batas UI sesuai hasil verifikasi. |
| Auditability | **critical before production** untuk mutasi operasional yang dirilis | Tidak ada audit menyeluruh Job/dokumen/user. Actor CIPL hardcoded; sebagian helper memilih user aktif pertama. Reopen ticket meminta alasan tetapi SQL tidak menyimpannya. | Atribusi actor dari sesi, simpan alasan dan before/after untuk perubahan yang disepakati; evidence CEISA terhubung ke mutasi. |
| Backup/recovery/retention | **critical before production** | Tidak ditemukan kebijakan/latihan restore DB + bucket + kunci enkripsi bersama. Retensi/purge belum ada. | Sepakati batas kehilangan data/waktu pemulihan, konfigurasi backup, uji restore dan ownership retensi. |
| Secrets management | **critical before production** | Service-role dan API secrets dibutuhkan server; kunci AES tunggal dari env, key_version 1; rotasi/recovery belum terlihat. | Provisioning/rotasi/akses rahasia dan pemulihan kunci; verifikasi rahasia tidak masuk browser/log. |
| Deployment | **critical before production** | Next Node/PM2 tersedia; belum ditemukan pipeline migrasi, rollback, health check atau konfigurasi TLS/proxy. Workbook dibaca dari `process.cwd()/docs`. `.env.example` ada lokal tetapi di-ignore dan tidak terlacak Git pada baseline. | Deployment reproducible, contoh konfigurasi tersanitasi terlacak, packaging template, migrasi teruji, TLS dan pemisahan environment. |
| Testing | **critical before production** | Test domain/mapper/crypto tersedia, tetapi integration/E2E API+DB+Storage/vendor/permissions tidak ditemukan. `domain:test` tidak mencakup semua file test helper yang ada. | Uji alur v1, otorisasi, save gagal, concurrency, migrasi dan output dokumen dengan acceptance client. |
| Error handling/feedback | **recommended** | Sejumlah error Supabase diteruskan mentah; beberapa async page tanpa catch dapat terus menampilkan skeleton. `remove()` tidak menunggu DELETE. Toast belum konsisten. | Error tersanitasi dengan korelasi, state retry/not-found yang jelas, await mutasi, toast hasil sesuai pedoman repo. |
| Observability/operations | **recommended** | Console log terbatas; raw error body Gemini dicatat legacy parser. Tidak ditemukan metrik request, biaya/latensi LLM, alarm atau dashboard incident. | Log terstruktur tersanitasi, pemantauan dependency/storage dan alert dasar; runbook kegagalan provider. |
| Performance | **recommended** | Koleksi dibaca penuh lalu difilter di browser; polling detail ticket; buffer PDF/Excel di memori; LLM tanpa timeout khusus. | Ukur dengan volume client; pagination/query terarah, batas request dan timeout; gunakan antrian hanya jika terbukti perlu. |
| Dokumentasi operasi | **recommended** | README/AGENTS masih menyebut runtime/mock file lama yang bukan adapter aktif; kontrak CEISA juga mencampur rencana dan status implementasi. | Sinkronkan panduan dengan rilis yang disepakati dan pisahkan roadmap dari fitur berjalan. |
| Capability tambahan | **optional** | Notification eksternal, advanced analytics, portal eksternal, worker async, multitenant belum ada | Tambahkan hanya setelah keputusan scope dan kebutuhan terukur. |

Evidence utama: [generic API](../app/api/operational-records/route.ts), [data façade](../lib/data-client.ts), [upload API](../app/api/attachments/route.ts), [job editor](../components/job-editor.tsx), [ticket SQL](../supabase/migrations/20261006000000_ticket_collaboration.sql), [export](../app/api/export-customs-workbook/route.ts), [package scripts](../package.json), [Next config](../next.config.mjs), [PM2 config](../ecosystem.config.js), [gitignore](../.gitignore).

# 12. Scope Boundary

## Existing PoC

Snapshot capability pada bagian 2, beserta placeholder, alur parsial, data/model eksplorasi, dan integrasi eksperimentalnya. Fitur yang terlihat di layar, tipe domain, atau template yang sudah ada tidak otomatis merupakan deliverable yang siap dipakai. Klaim baseline dibatasi evidence source code; tidak mencakup jaminan akurasi dokumen, acceptance vendor atau operasi production.

## Productionization

Pekerjaan untuk membuat **subset existing yang disepakati** aman dan dapat dioperasikan: mempertegas satu workflow/model data, otorisasi server, keutuhan transaksi/file, validasi, atribusi/audit, penanganan gagal, backup/restore, konfigurasi/deployment, pengujian dan UAT. Cakupannya mengikuti gap kritis yang relevan, bukan sekadar deploy kode PoC.

Productionization dapat memerlukan refactor dan migrasi substansial walaupun tidak menambah menu. Pemilihan dua model job dan kontrak CEISA merupakan keputusan discovery yang harus mendahului estimasi pasti.

## Batas perubahan scope

Kemampuan baru—misalnya submit CEISA, BC 2.5/3.0 export yang lengkap, Projects/General Cargo, portal client, notification eksternal atau multitenant—adalah **Potential future enhancement / pengembangan tambahan**, dengan acceptance criteria dan estimasi terpisah. Ketersediaan sebagian schema/komponen tidak menjadikannya termasuk otomatis.

Untuk dasar pembicaraan komersial, hasil meeting perlu menetapkan: workflow v1 yang dipilih, daftar fitur masuk/keluar, keputusan P0 yang tersisa, pihak penyedia akses/vendor/data UAT, kriteria penerimaan, serta batas maintenance dan biaya pihak ketiga. Sampai keputusan tersebut tersedia, dokumen ini tetap baseline discovery dan bukan requirement final client.
