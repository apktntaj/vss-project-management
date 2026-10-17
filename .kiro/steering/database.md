---
inclusion: fileMatch
fileMatchPattern: 'supabase/**'
---

# Migrasi Supabase

## Konvensi

- Nama file: `<YYYYMMDDHHMMSS>_<deskripsi_snake_case>.sql`, urut timestamp.
- Mulai file dengan komentar singkat yang menjelaskan *kenapa* migrasi ini ada — itu pola yang
  dipakai semua migrasi existing.
- Idempoten: `create table if not exists`, `add column if not exists`,
  `create index if not exists`, `on conflict do nothing`/`do update`.
- **Forward-only.** Jangan menulis migrasi yang menghapus atau mereset data operasional.

## Migrasi yang sudah ada

| File | Isi |
|---|---|
| `20260915000000_initial_vss_schema.sql` | `app_users`, `workspaces`, `workspace_members`, bucket storage privat `attachments`, workspace `default` |
| `20260916074803_normalize_operational_data.sql` | `operational_users`, `venues` sebagai template, 14 tabel klon `like public.venues including all`, tabel `attachments`, RLS + revoke |
| `20260917120000_event_page_domain.sql` | `event_cancellations`, promosi kolom event/exhibitor, FK `created_by_id` |
| `20261006000000_ticket_collaboration.sql` | kolom nyata `tickets`, `ticket_comments`, `ticket_activities`, index |
| `20261006100000_ceisa_integration.sql` | `ceisa_connections` (PK `workspace_id`), `ceisa_observations` |
| `20261014100000_agent_domain.sql` | `agents`, `event_agents` |

## Menambah tabel operasional baru

```sql
create table if not exists public.<nama> (like public.venues including all);
alter table public.<nama> enable row level security;
revoke all on table public.<nama> from anon, authenticated;
create index if not exists <nama>_workspace_updated_idx
  on public.<nama> (workspace_id, updated_at desc);
```

Bentuk warisan dari `venues`: `workspace_id uuid` (FK cascade ke `workspaces`), `id text`,
`payload jsonb not null`, `created_at`, `updated_at`, PK `(workspace_id, id)`.

Lalu daftarkan nama tabel di `operationalTables` pada `lib/supabase/operational-records.ts`, dan
petakan nama logis → nama fisik di `collectionTable` pada `lib/data-client.ts`. Tanpa dua langkah itu
`/api/operational-records?table=<nama>` akan mengembalikan 400 `'Koleksi data tidak valid.'`

## Aturan keamanan yang wajib dipertahankan

- Setiap tabel baru: `enable row level security` **dan** `revoke all ... from anon, authenticated`.
  Tidak ada policy publik; akses hanya lewat service-role di route handler yang sudah memverifikasi sesi.
- Setiap tabel operasional punya `workspace_id` dengan `on delete cascade` ke `workspaces`.
- Bucket storage tetap privat (`public = false`). File dibaca lewat proxy `/api/attachments`.

## Promosi kolom

Pola yang dipakai: field penting dipromosikan dari `payload` jsonb menjadi kolom nyata (dengan FK dan
CHECK), sementara `payload` tetap menyimpan entitas utuh. Kalau mempromosikan field, backfill dari
`payload` dalam migrasi yang sama, dan pastikan kode penulis mengisi kolom **dan** `payload`
konsisten — kalau tidak, dua sumber kebenaran itu akan menyimpang.

CHECK constraint dipakai untuk menegakkan sebagian aturan bisnis di level database (rentang tanggal
event, NPWP hanya untuk exhibitor LOCAL, ticket DONE wajib punya catatan). Aturan baru yang murah
ditegakkan di SQL sebaiknya ikut ditulis di sana, tanpa menghapus validasi Zod/domain-nya.
