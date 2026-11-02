-- Mengapa: model Job & Exhibitor dari nol (keputusan 2026-11-02). Semua data operasional masih demo.
--
--   Event ─┬─< Exhibitor   pihak bisnis per event: bisa membayar (job local) & memegang road shipment
--          │      ▲   ▲
--          │      │   └──── job_cipl_lines   baris CIPL: barang satu exhibitor di satu kiriman
--          │      │                ▲
--          └─< Job ─ pihak ────────┘         satu kiriman = satu B/L/AWB = satu tagihan
--
-- - Job dipegang SATU pihak yang ditagih: agent ATAU exhibitor. LOCAL dan ROAD_SHIPMENT selalu
--   exhibitor. Agent boleh punya banyak job per event.
-- - Dokumen sumber (CIPL, B/L/AWB) hasil LLM disimpan mentah sebagai jsonb; nilai yang dipakai
--   bekerja (nomor dokumen, nomor commercial invoice, baris CIPL) disimpan terstruktur.
-- - No Job manifest `<awalan>.<urut>/<no. commercial invoice>`: awalan diturunkan DB dari jalur +
--   jenis (satu-satunya tabel awalan), urut diisi operator dan unik per event per awalan.
--   `vss_number` adalah nomor internal lintas event yang dibuat otomatis.
-- - Rantai prototipe CIPL → shipment → customs job dibuang seluruhnya.

-- 1. Rantai prototipe yang dibuang ---------------------------------------------------------------
drop table if exists public.cipl_versions cascade;
drop table if exists public.cipls cascade;
drop table if exists public.shipments cascade;
drop table if exists public.customs_jobs cascade;
drop table if exists public.coordination_agents cascade;
drop table if exists public.migration_review_items cascade;
drop function if exists public.nextval_customs_job();
drop sequence if exists public.customs_job_number_seq;

-- Rujukan polimorfik ke data yang dibuang. Objek di bucket `attachments` dibersihkan manual.
delete from public.attachments
  where owner_type in ('CIPL_VERSION', 'SHIPMENT', 'CUSTOMS_JOB', 'JOB', 'LEGACY_JOB');
delete from public.tickets where context_kind = 'JOB';
-- Partisipasi agent di event: data demo, dimulai dari nol.
delete from public.event_agents;

drop table if exists public.jobs cascade;
drop table if exists public.exhibitors cascade;

-- 2. Exhibitor: pihak bisnis per event ---------------------------------------------------------
create table public.exhibitors (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete restrict,
  kind          text not null check (kind in ('LOCAL', 'INTERNATIONAL')),
  name          text not null check (char_length(trim(name)) between 1 and 300),
  npwp          text,
  contact       jsonb not null default '{}'::jsonb check (jsonb_typeof(contact) = 'object'),
  hall          text,
  booth         text,
  created_by_id uuid references public.app_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint exhibitors_npwp_local_only check (kind = 'LOCAL' or npwp is null),
  -- Target FK komposit: rujukan dari job wajib exhibitor pada event yang sama.
  constraint exhibitors_id_event_key unique (id, event_id)
);
create index exhibitors_workspace_event_idx on public.exhibitors (workspace_id, event_id, name);

-- 3. Nomor internal VSS-#####: atomik lewat sequence, minimal 5 digit, tidak pernah dipotong -------
create sequence public.job_vss_number_seq as bigint start with 1 increment by 1;
create function public.next_job_vss_number()
  returns text
  language sql
  volatile
  set search_path = ''
as $$
  select 'VSS-' || lpad(n::text, greatest(5, char_length(n::text)), '0')
  from (select nextval('public.job_vss_number_seq') as n) as next_value;
$$;

-- 4. Job: satu kiriman ---------------------------------------------------------------------------
create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  vss_number          text not null unique default public.next_job_vss_number(),
  event_id            uuid not null references public.events(id) on delete restrict,

  kind                text not null check (kind in ('LOCAL', 'INTERNATIONAL')),
  international_jenis text check (international_jenis in (
                        'TPPB_BC_23', 'ATA_CARNET', 'TEMPORARY_IMPORT', 'PERMANENT_IMPORT', 'ROAD_SHIPMENT')),
  transport_mode      text check (transport_mode in ('SEA', 'AIR', 'ROAD')),
  status              text not null default 'DRAFT'
                        check (status in ('DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),

  -- Pihak yang ditagih: agent ATAU exhibitor (boleh menyusul, tidak boleh keduanya).
  agent_id            text,
  exhibitor_id        uuid,

  -- No Job manifest. Awalan = satu-satunya tabel awalan di sistem.
  manifest_prefix     text generated always as (
                        case
                          when kind = 'LOCAL' then 'LOC'
                          when international_jenis = 'TPPB_BC_23' and transport_mode = 'SEA' then 'S'
                          when international_jenis = 'TPPB_BC_23' and transport_mode = 'AIR' then 'A'
                          when international_jenis = 'ATA_CARNET' then 'ATA'
                          when international_jenis = 'TEMPORARY_IMPORT' then 'TI'
                          when international_jenis = 'PERMANENT_IMPORT' then 'PI'
                          when international_jenis = 'ROAD_SHIPMENT' then 'RS'
                        end
                      ) stored,
  manifest_seq        integer check (manifest_seq > 0),
  commercial_invoice_number text,

  -- Dokumen sumber mentah (hasil LLM / koreksi operator) + nilai kerja terstruktur.
  transport_document        jsonb,
  transport_document_type   text check (transport_document_type in ('BL', 'AWB')),
  transport_document_number text,
  cipl_document             jsonb,

  -- Satu job = satu tagihan ke pihaknya.
  invoice_number      text,
  invoice_amount      numeric(18, 2) check (invoice_amount >= 0),
  invoice_currency    text check (invoice_currency ~ '^[A-Z]{3}$'),
  invoice_status      text not null default 'NOT_READY'
                        check (invoice_status in ('NOT_READY', 'READY', 'SENT', 'PAID')),
  invoice_sent_at     timestamptz,
  invoice_paid_at     timestamptz,

  assigned_to_id      uuid references public.app_users(id) on delete set null,
  created_by_id       uuid references public.app_users(id) on delete set null,

  -- Bagian dalam aggregate: leg transport, status CIPL, customs per BC; inward; kepulangan.
  operational         jsonb not null,
  inward              jsonb,
  kepulangan          jsonb,
  empty_storage       text,
  re_export           text,
  notes               text,

  version             integer not null default 1 check (version > 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint jobs_jenis_matches_kind check (
    (kind = 'LOCAL' and international_jenis is null)
    or (kind = 'INTERNATIONAL' and international_jenis is not null)
  ),
  constraint jobs_single_party check (agent_id is null or exhibitor_id is null),
  constraint jobs_exhibitor_only_party check (
    agent_id is null or not (kind = 'LOCAL' or international_jenis = 'ROAD_SHIPMENT')
  ),
  -- Road shipment tidak lewat laut/udara.
  constraint jobs_road_mode check (
    international_jenis is distinct from 'ROAD_SHIPMENT'
    or transport_mode is null
    or transport_mode = 'ROAD'
  ),
  constraint jobs_manifest_seq_needs_prefix check (manifest_seq is null or manifest_prefix is not null),
  constraint jobs_invoice_sent_has_number check (
    invoice_status not in ('SENT', 'PAID') or invoice_number is not null
  ),
  constraint jobs_invoice_paid_has_date check (invoice_status <> 'PAID' or invoice_paid_at is not null),
  -- agents masih tabel payload ber-PK komposit (workspace_id, id text).
  constraint jobs_agent_fk foreign key (workspace_id, agent_id)
    references public.agents(workspace_id, id) on delete restrict,
  -- Exhibitor pihak wajib dari event yang sama dengan job.
  constraint jobs_exhibitor_fk foreign key (exhibitor_id, event_id)
    references public.exhibitors(id, event_id) on delete restrict,
  constraint jobs_manifest_number_key unique (event_id, manifest_prefix, manifest_seq)
);

create index jobs_workspace_event_idx on public.jobs (workspace_id, event_id);
create index jobs_workspace_updated_idx on public.jobs (workspace_id, updated_at desc);
create index jobs_workspace_status_idx on public.jobs (workspace_id, status);
create index jobs_exhibitor_idx on public.jobs (exhibitor_id);
create index jobs_assigned_to_idx on public.jobs (assigned_to_id);
create index jobs_transport_document_number_idx on public.jobs (workspace_id, transport_document_number);

-- 5. Baris CIPL: barang satu exhibitor di satu job (bagian aggregate Job) -------------------------
create table public.job_cipl_lines (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  job_id           uuid not null references public.jobs(id) on delete cascade,
  -- Kosong sampai operator/pencocokan nama menautkannya.
  exhibitor_id     uuid references public.exhibitors(id) on delete set null,
  position         integer not null check (position > 0),
  name_on_document text not null check (char_length(trim(name_on_document)) between 1 and 300),
  koli             jsonb not null check (jsonb_typeof(koli) = 'object'),
  items            jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  notes            jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),
  created_at       timestamptz not null default now(),
  constraint job_cipl_lines_position_key unique (job_id, position),
  constraint job_cipl_lines_exhibitor_key unique (job_id, exhibitor_id)
);
create index job_cipl_lines_exhibitor_idx on public.job_cipl_lines (workspace_id, exhibitor_id);

/**
 * Simpan CIPL sebuah job dalam satu transaksi terjaga versi aggregate: dokumen mentah + SELURUH
 * baris CIPL (diganti utuh). Nomor commercial invoice job diisi dari dokumen bila masih kosong.
 * Mengembalikan versi baru, atau null bila versi basi / job tidak ada. Exhibitor yang ditautkan
 * wajib dari event job yang sama.
 */
create function public.save_job_cipl(
  p_workspace_id     uuid,
  p_job_id           uuid,
  p_expected_version integer,
  p_cipl_document    jsonb,
  p_lines            jsonb
)
  returns integer
  language plpgsql
  set search_path = ''
as $$
declare
  v_version  integer;
  v_event_id uuid;
begin
  update public.jobs
     set version = version + 1,
         updated_at = now(),
         cipl_document = p_cipl_document,
         commercial_invoice_number = coalesce(
           commercial_invoice_number, nullif(trim(p_cipl_document ->> 'nomor'), ''))
   where workspace_id = p_workspace_id and id = p_job_id and version = p_expected_version
  returning version, event_id into v_version, v_event_id;
  if v_version is null then
    return null;
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_lines) as line
      join public.exhibitors e on e.id = nullif(line ->> 'exhibitorId', '')::uuid
     where e.event_id <> v_event_id or e.workspace_id <> p_workspace_id
  ) then
    raise exception using errcode = '23514', message = 'job_cipl_lines_exhibitor_event',
      detail = 'Exhibitor pada baris CIPL harus terdaftar di event job ini.';
  end if;

  delete from public.job_cipl_lines where job_id = p_job_id;
  insert into public.job_cipl_lines
    (workspace_id, job_id, exhibitor_id, position, name_on_document, koli, items, notes)
  select p_workspace_id,
         p_job_id,
         nullif(line ->> 'exhibitorId', '')::uuid,
         ordinal::integer,
         line ->> 'nameOnDocument',
         line -> 'koli',
         coalesce(line -> 'items', '[]'::jsonb),
         coalesce(line -> 'notes', '[]'::jsonb)
    from jsonb_array_elements(p_lines) with ordinality as entry(line, ordinal);

  return v_version;
end;
$$;

-- 6. Akses: hanya service-role di route handler yang sudah memverifikasi sesi -------------------
alter table public.exhibitors enable row level security;
alter table public.jobs enable row level security;
alter table public.job_cipl_lines enable row level security;
revoke all on table public.exhibitors, public.jobs, public.job_cipl_lines from anon, authenticated;
revoke all on sequence public.job_vss_number_seq from anon, authenticated;
revoke all on function public.next_job_vss_number() from public, anon, authenticated;
revoke all on function public.save_job_cipl(uuid, uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.next_job_vss_number() to service_role;
grant execute on function public.save_job_cipl(uuid, uuid, integer, jsonb, jsonb) to service_role;
