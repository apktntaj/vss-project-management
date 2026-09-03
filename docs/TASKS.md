# Task List Implementasi
## VSS Project Management — PPJK Shipment Tracker

**Versi:** 1.0  
**Tanggal:** 2026-09-03

Setiap task dirancang atomic dan dapat dikerjakan secara berurutan. Tandai `[x]` saat selesai.

---

## Phase 1: Setup & Fondasi

### 1.1 Inisialisasi Project
- [ ] `1.1.1` Buat project Next.js 14 dengan App Router di direktori `vss-project-management`
  ```bash
  npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*"
  ```
- [ ] `1.1.2` Install dependencies utama
  ```bash
  npm install prisma @prisma/client next-auth bcryptjs nanoid
  npm install -D @types/bcryptjs
  ```
- [ ] `1.1.3` Install dan setup shadcn/ui
  ```bash
  npx shadcn@latest init
  ```
- [ ] `1.1.4` Install komponen shadcn yang dibutuhkan (button, input, table, badge, card, dialog, form, select, textarea, dropdown-menu, avatar, separator, sheet, toast)
- [ ] `1.1.5` Buat file `.env` dari `.env.example` dan isi variabel environment
- [ ] `1.1.6` Setup `lib/prisma.ts` (Prisma client singleton)

### 1.2 Database & Schema
- [ ] `1.2.1` Inisialisasi Prisma
  ```bash
  npx prisma init
  ```
- [ ] `1.2.2` Tulis schema Prisma lengkap sesuai `ARCHITECTURE.md` (User, Job, JobStage, Document)
- [ ] `1.2.3` Jalankan migrasi database pertama
  ```bash
  npx prisma migrate dev --name init
  ```
- [ ] `1.2.4` Buat seed file `prisma/seed.ts` untuk membuat akun Supervisor awal
- [ ] `1.2.5` Jalankan seed
  ```bash
  npx prisma db seed
  ```

### 1.3 Autentikasi
- [ ] `1.3.1` Buat `lib/auth.ts` — konfigurasi NextAuth dengan Credentials Provider
- [ ] `1.3.2` Buat API route `app/api/auth/[...nextauth]/route.ts`
- [ ] `1.3.3` Buat `middleware.ts` untuk proteksi route berdasarkan session dan role
- [ ] `1.3.4` Tambahkan helper `lib/utils/auth.ts` — `getServerSession`, `requireRole`
- [ ] `1.3.5` Update `types/index.ts` — extend NextAuth Session type dengan field role

---

## Phase 2: Layout & Halaman Auth

### 2.1 Halaman Login
- [ ] `2.1.1` Buat route group `app/(auth)/` dengan layout minimal (tanpa sidebar)
- [ ] `2.1.2` Buat halaman `app/(auth)/login/page.tsx` — form login (email + password)
- [ ] `2.1.3` Implementasi login action / form submission dengan NextAuth `signIn()`
- [ ] `2.1.4` Handle error: kredensial salah, akun nonaktif

### 2.2 Layout Dashboard
- [ ] `2.2.1` Buat route group `app/(dashboard)/` dengan `layout.tsx`
- [ ] `2.2.2` Buat komponen `components/layout/Sidebar.tsx` — navigasi utama
- [ ] `2.2.3` Buat komponen `components/layout/Navbar.tsx` — header dengan info user dan logout
- [ ] `2.2.4` Buat komponen `components/layout/PageHeader.tsx` — judul halaman reusable
- [ ] `2.2.5` Implementasi menu berbasis role (menu Users hanya muncul untuk SUPERVISOR)

---

## Phase 3: Dashboard

- [ ] `3.1` Buat API route `GET /api/dashboard` — statistik: total job per status, job aktif
- [ ] `3.2` Buat komponen `components/dashboard/StatCard.tsx`
- [ ] `3.3` Buat halaman `app/(dashboard)/page.tsx` — tampilkan stat cards dan daftar job terbaru

---

## Phase 4: Job Management

### 4.1 API Jobs
- [ ] `4.1.1` Buat helper `lib/tokens.ts` — generate `trackingToken` dengan nanoid
- [ ] `4.1.2` Buat helper `lib/jobNumber.ts` — generate job number format `VSS-YYYY-NNN`
- [ ] `4.1.3` Buat Zod schema `lib/validations/job.ts`
- [ ] `4.1.4` Buat `GET /api/jobs` — list job dengan filter status, type, search, pagination
- [ ] `4.1.5` Buat `POST /api/jobs` — create job baru (auto-generate jobNumber + trackingToken)
- [ ] `4.1.6` Buat `GET /api/jobs/[id]` — detail job lengkap (termasuk stages & documents)
- [ ] `4.1.7` Buat `PUT /api/jobs/[id]` — update data job
- [ ] `4.1.8` Buat `DELETE /api/jobs/[id]` — hapus job (SUPERVISOR only)
- [ ] `4.1.9` Buat `POST /api/jobs/[id]/token` — reset tracking token

### 4.2 Halaman Jobs
- [ ] `4.2.1` Buat komponen `components/jobs/JobStatusBadge.tsx`
- [ ] `4.2.2` Buat komponen `components/jobs/JobTable.tsx` — tabel job dengan filter dan search
- [ ] `4.2.3` Buat halaman `app/(dashboard)/jobs/page.tsx` — daftar semua job
- [ ] `4.2.4` Buat komponen `components/jobs/JobForm.tsx` — form create/edit job
- [ ] `4.2.5` Buat halaman `app/(dashboard)/jobs/new/page.tsx` — form buat job baru
- [ ] `4.2.6` Buat halaman `app/(dashboard)/jobs/[id]/page.tsx` — detail job lengkap
- [ ] `4.2.7` Buat halaman `app/(dashboard)/jobs/[id]/edit/page.tsx` — form edit job
- [ ] `4.2.8` Buat komponen `components/jobs/TrackingLinkBox.tsx` — tampilkan + copy tracking link

---

## Phase 5: Job Stages

### 5.1 API Stages
- [ ] `5.1.1` Buat Zod schema `lib/validations/stage.ts`
- [ ] `5.1.2` Buat `GET /api/jobs/[id]/stages` — list stages per job
- [ ] `5.1.3` Buat `POST /api/jobs/[id]/stages` — tambah stage baru
- [ ] `5.1.4` Buat `PUT /api/jobs/[id]/stages/[stageId]` — update stage (nama, status, notes)
- [ ] `5.1.5` Buat `DELETE /api/jobs/[id]/stages/[stageId]` — hapus stage

### 5.2 Komponen Stages
- [ ] `5.2.1` Buat komponen `components/stages/StageItem.tsx` — satu item stage dengan action
- [ ] `5.2.2` Buat komponen `components/stages/StageList.tsx` — list stages dalam halaman detail job
- [ ] `5.2.3` Buat komponen `components/stages/StageForm.tsx` — form tambah/edit stage (dialog/inline)
- [ ] `5.2.4` Integrasi StageList ke halaman `app/(dashboard)/jobs/[id]/page.tsx`

---

## Phase 6: Document Management

### 6.1 API Documents
- [ ] `6.1.1` Setup direktori upload `public/uploads/` dan konfigurasi di `next.config.ts`
- [ ] `6.1.2` Buat Zod schema `lib/validations/document.ts`
- [ ] `6.1.3` Buat `GET /api/jobs/[id]/documents` — list dokumen per job
- [ ] `6.1.4` Buat `POST /api/jobs/[id]/documents` — upload dokumen (multipart/form-data)
  - Validasi tipe file (PDF, JPG, PNG, XLSX, DOCX)
  - Validasi max size 10MB
  - Simpan ke `public/uploads/[jobId]/`
- [ ] `6.1.5` Buat `DELETE /api/jobs/[id]/documents/[docId]` — hapus dokumen (dan file fisik)

### 6.2 Komponen Documents
- [ ] `6.2.1` Buat komponen `components/documents/DocumentList.tsx` — list dokumen per job
- [ ] `6.2.2` Buat komponen `components/documents/DocumentUploadForm.tsx` — form upload
- [ ] `6.2.3` Integrasi DocumentList dan DocumentUploadForm ke halaman detail job

---

## Phase 7: Client Tracking Page

- [ ] `7.1` Buat `GET /api/track/[token]` — ambil data job by token, return 404 jika tidak ada / COMPLETED / CANCELLED
- [ ] `7.2` Buat halaman `app/track/[token]/page.tsx` — public page tanpa auth
  - Tampilkan: info job (AWB/BL, tipe, status, nama klien)
  - Tampilkan: timeline stages
  - Return 404 (Next.js `notFound()`) jika token invalid atau job sudah closed
- [ ] `7.3` Desain tracking page agar mobile-friendly (klien umumnya akses dari HP)

---

## Phase 8: User Management

### 8.1 API Users
- [ ] `8.1.1` Buat Zod schema `lib/validations/user.ts`
- [ ] `8.1.2` Buat `GET /api/users` — list semua user (SUPERVISOR only)
- [ ] `8.1.3` Buat `POST /api/users` — buat user baru dengan password di-hash bcrypt (SUPERVISOR only)
- [ ] `8.1.4` Buat `GET /api/users/[id]` — detail user
- [ ] `8.1.5` Buat `PUT /api/users/[id]` — update user (nama, role, isActive, reset password)

### 8.2 Halaman Users
- [ ] `8.2.1` Buat halaman `app/(dashboard)/users/page.tsx` — daftar user (SUPERVISOR only)
- [ ] `8.2.2` Buat halaman `app/(dashboard)/users/new/page.tsx` — form buat user baru

---

## Phase 9: Polish & QA

### 9.1 UX & Error Handling
- [ ] `9.1.1` Tambahkan loading states di semua form dan tabel
- [ ] `9.1.2` Tambahkan toast notifications untuk sukses/gagal operasi (shadcn Toaster)
- [ ] `9.1.3` Buat halaman `404` custom
- [ ] `9.1.4` Buat halaman `error` custom (error boundary)
- [ ] `9.1.5` Pastikan semua form ada validasi client-side (react-hook-form + zod)
- [ ] `9.1.6` Tambahkan konfirmasi dialog sebelum delete job / dokumen / user

### 9.2 Security
- [ ] `9.2.1` Pastikan semua API route cek session dan role sebelum eksekusi
- [ ] `9.2.2` Validasi input di server-side untuk semua POST/PUT endpoint
- [ ] `9.2.3` Sanitasi file upload (cek MIME type, bukan hanya ekstensi)
- [ ] `9.2.4` Pastikan path traversal tidak mungkin terjadi pada file upload/download

### 9.3 Testing & Deployment
- [ ] `9.3.1` Test manual semua flow utama (login, CRUD job, stages, dokumen, tracking link)
- [ ] `9.3.2` Buat `.env.example` lengkap
- [ ] `9.3.3` Buat `README.md` — cara install, setup, dan run project
- [ ] `9.3.4` Build production dan pastikan tidak ada error
  ```bash
  npm run build
  ```
- [ ] `9.3.5` Setup PM2 config (`ecosystem.config.js`) untuk deploy di VPS
- [ ] `9.3.6` Buat Nginx config untuk reverse proxy

---

## Urutan Pengerjaan yang Direkomendasikan

```
Phase 1 (Setup) 
    → Phase 2 (Layout & Auth) 
    → Phase 3 (Dashboard) 
    → Phase 4 (Jobs) 
    → Phase 5 (Stages) 
    → Phase 6 (Documents) 
    → Phase 7 (Tracking Page) 
    → Phase 8 (Users) 
    → Phase 9 (Polish & Deploy)
```

Setiap phase dapat di-demo/ditest sebelum lanjut ke phase berikutnya.
