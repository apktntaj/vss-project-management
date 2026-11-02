-- Mengapa: slice Job dari redesign (clean cutover, mengikuti pola 20261101020000_redesign_event_domain).
-- Job adalah AGGREGATE: root-nya baris `jobs`; bagian dalamnya (inward manifest, kepulangan,
-- manifest exhibitors, operational/customs per BC) selalu dibaca-tulis per job, jadi disimpan sebagai
-- dokumen jsonb di kolom terpisah dan divalidasi Zod di server. Identitas, rujukan ke aggregate lain
-- (event/agent/exhibitor/user), status, jenis, dan field yang dicari menjadi kolom nyata + FK + CHECK.
--
-- Tabel prototipe lama (`jobs`/`job_stages`/`job_documents` bergaya `payload jsonb` utuh) dibuang:
-- isinya hanya data demo. `job_stages` tidak dibuat ulang (tidak pernah ditulis maupun ditampilkan);
-- `job_documents` digantikan `attachments` dengan owner_type 'JOB' (isinya hanya duplikat metadata).

-- Rujukan polimorfik ke job lama akan menggantung setelah id berganti uuid — bersihkan dulu.
delete from public.tickets where context_kind = 'JOB';
-- Baris metadata lampiran job lama. Objek di bucket `attachments` dibersihkan manual (data demo).
delete from public.attachments where owner_type = 'LEGACY_JOB';

drop table if exists public.job_documents cascade;
drop table if exists public.job_stages cascade;
drop table if exists public.jobs cascade;

create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  -- Rujukan ke aggregate lain: hanya id, tidak pernah salinan datanya.
  event_id            uuid not null references public.events(id) on delete restrict,
  agent_id            text,
  exhibitor_id        text,
  assigned_to_id      uuid references public.app_users(id) on delete set null,
  created_by_id       uuid references public.app_users(id) on delete set null,

  job_number          text check (job_number is null or char_length(trim(job_number)) between 1 and 100),
  kind                text not null check (kind in ('LOCAL', 'INTERNATIONAL')),
  international_jenis text check (international_jenis in (
                        'TPPB_BC_23', 'ATA_CARNET', 'TEMPORARY_IMPORT', 'PERMANENT_IMPORT', 'ROAD_SHIPMENT')),
  status              text not null default 'DRAFT'
                        check (status in ('DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),

  -- Field yang diisi/dikoreksi operator.
  client_name         text,
  shipper             text,
  consignee           text,
  notify_party        text,
  bill_to             text,
  empty_storage       text,
  re_export           text,
  notes               text,
  invoice_sent        boolean not null default false,

  -- Bagian dalam aggregate (dokumen). Bentuknya dijaga Zod di server.
  operational         jsonb not null,
  inward              jsonb,
  kepulangan          jsonb,
  manifest_exhibitors jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(manifest_exhibitors) = 'array'),
  -- Snapshot CIPL hasil scan wizard (header + baris barang); calon sumber "Details Barang".
  cipl_document       jsonb,

  -- Satu sumber kebenaran nomor B/L/AWB masuk = operational.inbound; kolom ini turunan untuk pencarian.
  inbound_document_number text generated always as (operational -> 'inbound' ->> 'documentNumber') stored,

  -- Optimistic concurrency aggregate: setiap tulis mensyaratkan versi yang terakhir dibaca klien.
  version             integer not null default 1 check (version > 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint jobs_jenis_matches_kind check (
    (kind = 'LOCAL' and international_jenis is null)
    or (kind = 'INTERNATIONAL' and international_jenis is not null)
  ),
  -- agents/exhibitors masih tabel payload ber-PK komposit (workspace_id, id text).
  constraint jobs_agent_fk foreign key (workspace_id, agent_id)
    references public.agents(workspace_id, id) on delete restrict,
  constraint jobs_exhibitor_fk foreign key (workspace_id, exhibitor_id)
    references public.exhibitors(workspace_id, id) on delete restrict,
  -- Satu agent mewakili tepat satu job per event (dulu dicek di browser + id deterministik).
  constraint jobs_event_agent_key unique (event_id, agent_id)
);

create unique index jobs_workspace_job_number_key
  on public.jobs (workspace_id, job_number) where job_number is not null;
create index jobs_workspace_event_idx on public.jobs (workspace_id, event_id);
create index jobs_workspace_updated_idx on public.jobs (workspace_id, updated_at desc);
create index jobs_workspace_status_idx on public.jobs (workspace_id, status);
create index jobs_assigned_to_idx on public.jobs (assigned_to_id);

-- Tidak ada policy publik; akses hanya lewat service-role di route handler yang sudah
-- memverifikasi sesi. RLS aktif + cabut seluruh grant dari anon/authenticated.
alter table public.jobs enable row level security;
revoke all on table public.jobs from anon, authenticated;
