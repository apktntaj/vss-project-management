# Akses Data — Alur Wajib

Ini arsitektur yang sebenarnya berjalan. Beberapa dokumen lama di repo menggambarkan arsitektur
yang berbeda (Server Actions, `/api/data`, tabel EAV `app_records`, IndexedDB); semuanya salah.

## Alur satu arah

```
Komponen client ('use client')
   └─ import { fn } from '@/lib/data-client'      ← satu-satunya pintu masuk data dari UI
        └─ fetch('/api/...', { cache: 'no-store' })
             └─ app/api/**/route.ts                ← guard auth + parse Zod di sini
                  └─ lib/supabase/*.ts             ← 'server-only', pakai service-role client
                       └─ Postgres / Storage
```

Aturan yang tidak boleh dilanggar:

- `app/**` (selain `app/api/**`) dan `components/**` **tidak boleh** mengimpor `@/lib/supabase/*`,
  `@supabase/supabase-js`, atau menyentuh kredensial Supabase. Mereka hanya memakai `@/lib/data-client`.
- `domain/**` bebas dari tipe storage dan dari `Blob`/`File`. Byte file adalah input aplikasi, bukan
  bagian entitas — lihat `attachmentMetadata()` di `lib/data-client.ts` yang membuang field `content`
  sebelum persist. Attachment dirujuk lewat ID.
- Setiap modul di `lib/supabase/` dan `lib/server/` diawali `import 'server-only'`.

## Mutasi data memakai route handler, bukan Server Action

Di repo ini hanya ada **dua** server action: `signIn` di `app/(auth)/login/actions.ts` dan
`logoutAction` di `app/(dashboard)/actions.ts`. Semua create/update/delete data berjalan lewat
`lib/data-client.ts` → `fetch` → route handler. **Ikuti pola ini**; jangan memperkenalkan Server
Action untuk mutasi data tanpa membahasnya lebih dulu, karena akan ada dua mekanisme paralel.

Konsekuensinya: tidak ada `revalidatePath`/`revalidateTag`/`router.refresh()` di repo ini.
Setelah mutasi, komponen memanggil ulang fungsi `list*`/`get*` lalu `setState`. Ikuti itu.

## Endpoint yang sudah ada

| Endpoint | Bentuk |
|---|---|
| `/api/operational-records?table=<tabel>` | Proxy generik GET/PUT/DELETE. `table` di-allowlist oleh `operationalTables` di `lib/supabase/operational-records.ts`. Dipakai untuk cipls, cipl_versions, shipments, customs_jobs, agents, stages, job_documents, preferences, dll. |
| `/api/event-records?resource=venues\|event-organizers` | Data referensi |
| `/api/events`, `/api/events/[eventId]`, `.../agents`, `.../exhibitors`, `.../exhibitor-logistics` | Event dan turunannya |
| `/api/jobs`, `/api/jobs/[jobId]` | Legacy Job. GET `/api/jobs` mengembalikan satu payload gabungan berisi jobs + stages + users + documents + exhibitors + events |
| `/api/tickets`, `/api/tickets/[ticketId]`, `.../comments` | Mutasi ticket lewat satu PATCH dengan `{ action: 'EDIT' \| 'ASSIGN' \| 'TAKE' \| 'MOVE', input }` |
| `/api/settings` | GET/POST/PATCH dengan body `{ resource: 'users'\|'venues'\|'organizers', id?, input }` |
| `/api/attachments` | POST multipart; GET `?id=` mem-proxy byte file (bukan signed URL) |
| `/api/classify-job-document`, `/api/parse-manifest`, `/api/parse-shipment` | Ekstraksi Gemini |
| `/api/export-customs-workbook`, `/api/lartas` | Ekspor Excel, cek LARTAS |
| `/api/ceisa/*` (8 route) | Integrasi CEISA |

Untuk entitas baru yang sederhana, menambah tabel ke `operationalTables` sudah cukup — tidak perlu
route baru. Buat route khusus hanya kalau butuh join, filter server-side, atau aturan otorisasi.

## Skema database

Tulang punggung relasional: `app_users`, `workspaces`, `workspace_members`.

Data operasional dipegang **satu tabel per agregat**, hampir semuanya dibuat dengan
`create table ... (like public.venues including all)` sehingga bentuknya identik:

```sql
workspace_id uuid not null references public.workspaces(id) on delete cascade,
id           text not null,
payload      jsonb not null,      -- entitas domain utuh, field camelCase
created_at   timestamptz not null default now(),
updated_at   timestamptz not null default now(),
primary key (workspace_id, id)
```

Jadi: **entitas domain disimpan utuh di `payload`**, dan sebagian field dipromosikan jadi kolom
nyata + foreign key oleh migrasi berikutnya (`events.venue_id`, `created_by_id`,
`exhibitors.agent_id`, kolom-kolom `tickets`, dst.). Pola hibrida ini membuat ada dua sumber
kebenaran per baris — saat menulis, isi **keduanya** konsisten (lihat `POST /api/event-records`
yang menulis `...toSnake(input)` dan `payload: input` sekaligus).

Tabel dengan kolom nyata penuh: `event_cancellations`, `ticket_comments`, `ticket_activities`,
`agents`, `event_agents`, `ceisa_connections`, `ceisa_observations`, `attachments`.

RLS aktif dan semua grant dicabut dari `anon`/`authenticated`. Browser tidak punya akses database;
hanya service-role di server, sesudah sesi diverifikasi.

### Workspace

Seluruh query menyaring `workspace_id`, tapi workspace-nya **selalu dicari dengan
`.eq('slug', 'default')`**. Skemanya multi-tenant, aplikasinya single-tenant. Ikuti pola yang ada
(`workspaceId()` di `lib/supabase/operational-records.ts`, `getEventApiContext()` di
`lib/supabase/event-api.ts`) dan jangan menulis query tanpa filter `workspace_id`.

## Pola route handler

Semua route menetapkan:

```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
```

Pilih salah satu dari tiga guard yang sudah dipakai:

```ts
// A. Guard inline — untuk route yang tidak butuh workspace/user
if (!(await auth())?.user)
  return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

// B. Context helper — DEFAULT untuk route data
const { client, workspaceId, userId } = await getEventApiContext()   // lib/supabase/event-api.ts
// atau getTicketApiContext() dari lib/supabase/ticket-api.ts
// bungkus dalam try/catch dan kembalikan eventApiFailure(error) / ticketApiFailure(error)

// C. CEISA
const denied = await requireCeisaUser()       // requireCeisaUser(true) untuk admin
if (denied) return denied
```

Gunakan **B** untuk route data baru. Jangan menyalin `getEventApiContext` ke dalam route seperti
yang terjadi di `app/api/event-records/route.ts` (ada duplikat `context()` + `failure()` lokal di sana).

Bentuk error konsisten: `{ error: '<pesan Indonesia>' }` dengan status 401 untuk
`'Autentikasi diperlukan.'`, 400 untuk input tidak valid, 503 untuk kegagalan Supabase/vendor.
`lib/data-client.ts` sudah membaca field `error` ini dan melempar `Error` dengan pesan tersebut.

## Lampiran

Upload: `FormData` dengan `id`, `ownerType`, `ownerId`, `kind?`, `file` → `POST /api/attachments` →
`uploadAttachment()` di `lib/supabase/attachments.ts` → bucket privat `attachments`.
`ownerType` di-allowlist: `CIPL_VERSION | SHIPMENT | CUSTOMS_JOB | LEGACY_JOB` — tambahkan nilai baru
di route dan di `lib/data-client.ts` kalau perlu owner baru.

Baca: `GET /api/attachments?id=` mengembalikan byte dengan `Cache-Control: private, no-store`.
Di client, `getAttachmentContent()` mengembalikan `Blob`; buka dengan `URL.createObjectURL` lalu
`revokeObjectURL` (lihat `OpenAttachment` di `app/(dashboard)/cipls/[id]/page.tsx`).

Batas tipe dokumen job (PDF + varian Excel) saat ini divalidasi di `lib/data-client.ts`
(`jobDocumentMimeTypes`), yaitu **di browser**. `MAX_DOCUMENT_SIZE` 10 MB ada di
`lib/server/document-extraction.ts` dan diduplikasi di `app/api/parse-shipment/route.ts`.

## ID dan penomoran

- ID entitas: `crypto.randomUUID()` dibuat **di browser** (`id()` di `lib/data-client.ts`).
- Customs Job: `VSS-XXXXX` (5 digit) dari read-modify-write counter di tabel `preferences`,
  dijalankan dari client. **Tidak aman terhadap race** — dua user bersamaan bisa menghasilkan nomor
  sama. Jangan menyalin pola ini untuk penomoran baru; pakai sequence/constraint di Postgres.
- Legacy Job: `VSS-XXXX` (4 digit), nomor ditetapkan eksplisit (`lib/job-number.ts` hanya memetakan).

## Performa

Banyak fungsi `list*`/`get*` membaca seluruh tabel lalu memfilter di browser —
`getJob()` adalah `(await listJobs()).find(...)`, dan `listJobs()` memuat semua job dengan event,
stage, user, dan dokumen. Untuk fitur baru dengan volume data yang berarti, buat endpoint dengan
filter server-side daripada mengikuti pola ini.
