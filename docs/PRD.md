# Product Requirements Document (PRD)
## VSS Project Management — PPJK Shipment Tracker

**Versi:** 1.0  
**Tanggal:** 2026-09-03  
**Status:** Draft

---

## 1. Latar Belakang

PPJK (Pengusaha Pengurusan Jasa Kepabeanan) mengelola proses pengurusan bea cukai untuk shipment import maupun export. Saat ini pengelolaan job shipment masih manual atau tersebar di berbagai media (chat, spreadsheet), sehingga progress sulit dipantau secara terpusat.

VSS Project Management hadir sebagai aplikasi berbasis web untuk mengorganisir job shipment, melacak progress setiap tahapan, dan memudahkan komunikasi status kepada klien — tanpa perlu klien mendaftar atau login.

---

## 2. Tujuan Produk

- Menyediakan sistem terpusat untuk manajemen job shipment PPJK
- Memungkinkan staff dan supervisor melacak dan mengupdate progress setiap job
- Memungkinkan klien memantau status shipment miliknya melalui link tracking tanpa perlu akun
- Menjadi fondasi yang dapat dikembangkan untuk integrasi dengan sistem eksternal (Ceisa, dll.) di masa depan

---

## 3. Pengguna (Users)

### 3.1 Staff
- Petugas operasional yang mengerjakan job sehari-hari
- Dapat membuat job baru, mengupdate progress, dan mengupload dokumen
- Dapat melihat semua job yang ada

### 3.2 Supervisor
- Memiliki semua akses Staff
- Dapat assign job ke staff tertentu
- Dapat membuat dan mengelola akun User (Staff & Supervisor)

### 3.3 Client (tanpa akun)
- Tidak memiliki akun di sistem
- Mengakses tracking shipment melalui unique link yang di-share oleh Staff/Supervisor
- Hanya dapat melihat job miliknya (scope dibatasi oleh token)
- Link otomatis tidak aktif (404) ketika job berstatus COMPLETED atau CANCELLED

---

## 4. Fitur

### 4.1 Autentikasi & Otorisasi
- Login dengan email dan password (Staff & Supervisor)
- Session management dengan NextAuth.js
- Role-based access control (STAFF, SUPERVISOR)
- Middleware proteksi route berdasarkan role

### 4.2 Dashboard
- Ringkasan jumlah job berdasarkan status (aktif, selesai, on hold)
- Daftar job yang memerlukan tindakan (stage pending terlalu lama)
- Aktivitas terbaru

### 4.3 Job Management
- Buat job baru dengan data:
  - Nomor AWB atau BL
  - Tipe shipment (IMPORT / EXPORT)
  - Nama klien / keterangan klien
  - Assign ke staff
  - Catatan awal (opsional)
- Edit data job
- Ubah status job (IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED)
- Lihat daftar semua job dengan filter dan search
- Generate dan reset tracking token

### 4.4 Job Stage (Progress Tracking)
- Setiap job memiliki stages yang bisa ditambah secara custom
- Setiap stage memiliki:
  - Nama stage
  - Status (PENDING, IN_PROGRESS, DONE)
  - Catatan/notes
  - Timestamp selesai
- Staff dapat menambah, mengedit, dan mengupdate status stage
- Urutan stage dapat diatur

### 4.5 Document Management
- Upload dokumen per job (PDF, JPG, PNG, dll.)
- Setiap dokumen memiliki:
  - Nama file / label
  - Tipe dokumen (opsional, bebas diisi)
  - File URL
  - Info uploader dan waktu upload
- Lihat daftar dokumen per job
- Download dokumen

### 4.6 Client Tracking Page
- Halaman publik di route `/track/[token]`
- Menampilkan:
  - Info dasar job (AWB/BL, tipe, status)
  - Timeline progress stages
  - Daftar dokumen (opsional, bisa dikonfigurasi per job apakah dokumen ditampilkan ke client)
- Return 404 jika token tidak ditemukan atau job berstatus COMPLETED / CANCELLED

### 4.7 User Management (Supervisor only)
- Buat akun Staff baru
- Nonaktifkan akun
- Reset password

---

## 5. Non-Functional Requirements

| Aspek | Requirement |
|---|---|
| Platform | Web (desktop-first, responsive) |
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL |
| Auth | NextAuth.js (Credentials Provider) |
| UI | Tailwind CSS + shadcn/ui |
| File Storage | Lokal (VPS), dapat dimigrasikan ke object storage |
| Deploy | VPS self-hosted, PM2 + Nginx |
| Bahasa UI | Bahasa Indonesia |

---

## 6. Data Model (High-level)

### User
| Field | Tipe | Keterangan |
|---|---|---|
| id | UUID | Primary key |
| name | String | Nama lengkap |
| email | String | Unique, untuk login |
| password | String | Bcrypt hashed |
| role | Enum | STAFF \| SUPERVISOR |
| isActive | Boolean | Default true |
| createdAt | DateTime | |

### Job
| Field | Tipe | Keterangan |
|---|---|---|
| id | UUID | Primary key |
| jobNumber | String | Auto-generated, unique (e.g. VSS-2026-001) |
| awbNumber | String | Nullable |
| blNumber | String | Nullable |
| type | Enum | IMPORT \| EXPORT |
| clientName | String | Nama klien (tidak perlu akun) |
| clientInfo | String | Keterangan tambahan klien (opsional) |
| status | Enum | DRAFT \| IN_PROGRESS \| ON_HOLD \| COMPLETED \| CANCELLED |
| assignedToId | UUID | FK ke User (Staff) |
| createdById | UUID | FK ke User |
| trackingToken | String | Unique, random token untuk client tracking link |
| notes | String | Catatan umum job |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### JobStage
| Field | Tipe | Keterangan |
|---|---|---|
| id | UUID | Primary key |
| jobId | UUID | FK ke Job |
| name | String | Nama tahapan |
| status | Enum | PENDING \| IN_PROGRESS \| DONE |
| order | Int | Urutan tampil |
| notes | String | Catatan stage |
| completedAt | DateTime | Nullable |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Document
| Field | Tipe | Keterangan |
|---|---|---|
| id | UUID | Primary key |
| jobId | UUID | FK ke Job |
| label | String | Nama/label dokumen |
| docType | String | Tipe dokumen (bebas isi, opsional) |
| fileUrl | String | Path/URL file |
| fileName | String | Nama file asli |
| fileSize | Int | Ukuran file (bytes) |
| uploadedById | UUID | FK ke User |
| createdAt | DateTime | |

---

## 7. Alur Utama

### Alur Staff membuat dan mengupdate job:
1. Staff login
2. Buat job baru → isi AWB/BL, tipe, nama klien, assign to
3. Tambahkan stages sesuai kebutuhan job
4. Update status setiap stage seiring progress
5. Upload dokumen yang relevan
6. Share tracking link ke klien (copy dari halaman detail job)
7. Ubah status job ke COMPLETED saat selesai → link tracking otomatis 404

### Alur Client tracking:
1. Client menerima link dari staff (WhatsApp, email, dll.)
2. Buka link `/track/[token]`
3. Lihat status job, timeline stages, dan dokumen (jika ditampilkan)
4. Setelah job selesai, link tidak bisa diakses (404)

---

## 8. Out of Scope (v1.0)

- Integrasi dengan sistem Ceisa / bea cukai
- Notifikasi email/WhatsApp otomatis ke klien
- Laporan dan analytics lanjutan
- Mobile app native
- Multi-company / multi-tenant
- Billing / invoicing

---

## 9. Asumsi & Constraint

- Satu job bisa di-assign ke satu staff (bisa diubah di versi berikutnya)
- Satu klien bisa memiliki banyak job, tapi tidak perlu akun — diidentifikasi dari nama saja
- Stages per job bersifat custom, tidak ada template fixed
- File dokumen disimpan lokal di VPS untuk v1.0
- Bahasa antarmuka: Bahasa Indonesia
