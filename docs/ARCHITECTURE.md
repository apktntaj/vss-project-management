# Desain Arsitektur
## VSS Project Management — PPJK Shipment Tracker

**Versi:** 1.0  
**Tanggal:** 2026-09-03

---

## 1. Struktur Folder

```
vss-project-management/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group: halaman auth (tidak ada layout dashboard)
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/              # Route group: halaman internal (ada layout dashboard)
│   │   ├── layout.tsx            # Layout dengan sidebar + navbar
│   │   ├── page.tsx              # Dashboard / home
│   │   ├── jobs/
│   │   │   ├── page.tsx          # Daftar semua job
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Form buat job baru
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Detail job
│   │   │       └── edit/
│   │   │           └── page.tsx  # Edit job
│   │   └── users/                # Supervisor only
│   │       ├── page.tsx          # Daftar user
│   │       └── new/
│   │           └── page.tsx      # Form buat user baru
│   ├── track/
│   │   └── [token]/
│   │       └── page.tsx          # Public tracking page (client)
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts      # NextAuth handler
│       ├── jobs/
│       │   ├── route.ts          # GET (list), POST (create)
│       │   └── [id]/
│       │       ├── route.ts      # GET, PUT, DELETE
│       │       ├── stages/
│       │       │   ├── route.ts  # GET (list), POST (create)
│       │       │   └── [stageId]/
│       │       │       └── route.ts  # PUT, DELETE
│       │       ├── documents/
│       │       │   ├── route.ts  # GET (list), POST (upload)
│       │       │   └── [docId]/
│       │       │       └── route.ts  # DELETE
│       │       └── token/
│       │           └── route.ts  # POST (reset token)
│       ├── track/
│       │   └── [token]/
│       │       └── route.ts      # GET (public, no auth)
│       └── users/
│           ├── route.ts          # GET (list), POST (create) — Supervisor only
│           └── [id]/
│               └── route.ts      # GET, PUT (edit/deactivate)
├── components/
│   ├── ui/                       # shadcn/ui components (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   └── PageHeader.tsx
│   ├── jobs/
│   │   ├── JobCard.tsx
│   │   ├── JobTable.tsx
│   │   ├── JobForm.tsx
│   │   ├── JobStatusBadge.tsx
│   │   └── TrackingLinkBox.tsx
│   ├── stages/
│   │   ├── StageList.tsx
│   │   ├── StageItem.tsx
│   │   └── StageForm.tsx
│   ├── documents/
│   │   ├── DocumentList.tsx
│   │   └── DocumentUploadForm.tsx
│   └── dashboard/
│       └── StatCard.tsx
├── lib/
│   ├── auth.ts                   # NextAuth config
│   ├── prisma.ts                 # Prisma client singleton
│   ├── utils.ts                  # Helper functions (cn, formatDate, dll.)
│   ├── tokens.ts                 # Token generation utility
│   └── validations/              # Zod schemas
│       ├── job.ts
│       ├── stage.ts
│       ├── document.ts
│       └── user.ts
├── middleware.ts                 # Route protection (auth + role check)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                   # Seed data awal (admin user)
├── public/
│   └── uploads/                  # File upload storage (lokal)
├── types/
│   └── index.ts                  # Global TypeScript types
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 2. Schema Database (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  STAFF
  SUPERVISOR
}

enum JobType {
  IMPORT
  EXPORT
}

enum JobStatus {
  DRAFT
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  CANCELLED
}

enum StageStatus {
  PENDING
  IN_PROGRESS
  DONE
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(STAFF)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  jobsAssigned Job[]      @relation("AssignedTo")
  jobsCreated  Job[]      @relation("CreatedBy")
  documents    Document[]
}

model Job {
  id             String    @id @default(uuid())
  jobNumber      String    @unique
  awbNumber      String?
  blNumber       String?
  type           JobType
  clientName     String
  clientInfo     String?
  status         JobStatus @default(DRAFT)
  notes          String?
  trackingToken  String    @unique
  assignedToId   String?
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relations
  assignedTo Job?       @relation("AssignedTo", fields: [assignedToId], references: [id])
  createdBy  User       @relation("CreatedBy", fields: [createdById], references: [id])
  stages     JobStage[]
  documents  Document[]
}

model JobStage {
  id          String      @id @default(uuid())
  jobId       String
  name        String
  status      StageStatus @default(PENDING)
  order       Int
  notes       String?
  completedAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  // Relations
  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)
}

model Document {
  id           String   @id @default(uuid())
  jobId        String
  label        String
  docType      String?
  fileUrl      String
  fileName     String
  fileSize     Int
  uploadedById String
  createdAt    DateTime @default(now())

  // Relations
  job        Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)
  uploadedBy User @relation(fields: [uploadedById], references: [id])
}
```

---

## 3. API Routes

### Auth
| Method | Route | Deskripsi | Auth |
|---|---|---|---|
| POST | `/api/auth/[...nextauth]` | Login / session | Public |

### Jobs
| Method | Route | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/jobs` | List semua job (dengan filter) | STAFF, SUPERVISOR |
| POST | `/api/jobs` | Buat job baru | STAFF, SUPERVISOR |
| GET | `/api/jobs/[id]` | Detail job | STAFF, SUPERVISOR |
| PUT | `/api/jobs/[id]` | Update job | STAFF, SUPERVISOR |
| DELETE | `/api/jobs/[id]` | Hapus job | SUPERVISOR |
| POST | `/api/jobs/[id]/token` | Reset tracking token | STAFF, SUPERVISOR |

### Job Stages
| Method | Route | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/jobs/[id]/stages` | List stages | STAFF, SUPERVISOR |
| POST | `/api/jobs/[id]/stages` | Tambah stage | STAFF, SUPERVISOR |
| PUT | `/api/jobs/[id]/stages/[stageId]` | Update stage | STAFF, SUPERVISOR |
| DELETE | `/api/jobs/[id]/stages/[stageId]` | Hapus stage | STAFF, SUPERVISOR |

### Documents
| Method | Route | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/jobs/[id]/documents` | List dokumen | STAFF, SUPERVISOR |
| POST | `/api/jobs/[id]/documents` | Upload dokumen | STAFF, SUPERVISOR |
| DELETE | `/api/jobs/[id]/documents/[docId]` | Hapus dokumen | STAFF, SUPERVISOR |

### Tracking (Public)
| Method | Route | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/track/[token]` | Data tracking untuk client | Public |

### Users (Supervisor only)
| Method | Route | Deskripsi | Auth |
|---|---|---|---|
| GET | `/api/users` | List semua user | SUPERVISOR |
| POST | `/api/users` | Buat user baru | SUPERVISOR |
| GET | `/api/users/[id]` | Detail user | SUPERVISOR |
| PUT | `/api/users/[id]` | Update / deactivate user | SUPERVISOR |

---

## 4. Middleware & Auth Flow

```
Request masuk
    │
    ▼
middleware.ts
    │
    ├── /track/[token]  → skip auth, lanjut ke handler
    │
    ├── /login          → skip auth, lanjut ke page
    │
    └── semua route lain
            │
            ▼
        Cek session (NextAuth)
            │
            ├── Tidak ada session → redirect /login
            │
            └── Ada session
                    │
                    ├── Route /users → cek role SUPERVISOR
                    │       └── Bukan SUPERVISOR → redirect /jobs (403)
                    │
                    └── Route lain → lanjut
```

---

## 5. Konvensi Kode

### API Response Format
```ts
// Success
{ data: T, message?: string }

// Error
{ error: string, details?: unknown }
```

### Job Number Format
```
VSS-{YYYY}-{NNN}
Contoh: VSS-2026-001, VSS-2026-042
```

### Tracking Token
```ts
// Menggunakan nanoid (21 karakter, URL-safe)
import { nanoid } from 'nanoid'
const token = nanoid() // e.g. "V1StGXR8_Z5jdHi6B-myT"
```

### File Upload
- Disimpan di `public/uploads/[jobId]/[timestamp]-[filename]`
- Max file size: 10MB
- Format yang diizinkan: PDF, JPG, JPEG, PNG, XLSX, DOCX

---

## 6. Environment Variables

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/vss_db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE=10485760  # 10MB in bytes
```

---

## 7. Deploy Architecture (VPS)

```
Internet
    │
    ▼
Nginx (port 80/443)
    │ reverse proxy
    ▼
PM2 → Next.js (port 3000)
    │
    ├── PostgreSQL (port 5432, lokal)
    └── /public/uploads (file storage lokal)
```

### Nginx Config (ringkas)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
