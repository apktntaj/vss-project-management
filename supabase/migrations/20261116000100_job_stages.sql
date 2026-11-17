-- Mengapa: satu kiriman pameran international kini menjadi rangkaian job per dokumen BC —
-- 1 job masuk (BC 2.3) + job turunan BC 2.5 (barang disposal) dan BC 3.0 (re-ekspor) yang
-- ditentukan dari disposisi barang di CIPL. Tiap job tetap baris penuh (status, PIC, tagihan
-- sendiri); nomornya mencerminkan job masuk, diberi label tahap di UI. Road Shipment dan Local
-- tidak punya dokumen BC sehingga tanpa tahap.
--
--   jobs (INBOUND) ──1:0..2── jobs (DISPOSAL | RE_EXPORT, source_job_id)
--
-- - `stage` NOT NULL tepat bila kind international non-road (constraint jobs_stage_matches_jenis).
-- - `source_job_id` terisi tepat bila stage turunan, wajib satu event dengan job masuknya
--   (FK komposit ke unique (id, event_id)); job masuk tidak boleh dibatalkan selama punya
--   turunan aktif (dijaga use-case cancel-job).
-- - Satu tahap turunan aktif per job masuk: unique index parsial `jobs_source_stage_active_key`
--   (baris CANCELLED bebas agar bisa dibuat ulang manual setelah batal).
-- - Job turunan tidak punya nomor/dokumen sumber sendiri: nomor dicerminkan dari job masuk di
--   repository, dokumen CIPL selalu diturunkan dari baris CIPL job masuk saat ditampilkan.
-- - Trigger `jobs_block_update_when_cancelled` menolak perubahan baris CANCELLED; backfill kolom
--   baru menyentuh baris itu, jadi trigger dimatikan sementara dalam transaksi ini.

begin;

alter table public.jobs disable trigger jobs_block_update_when_cancelled;

alter table public.jobs
  add column stage text check (stage in ('INBOUND', 'DISPOSAL', 'RE_EXPORT')),
  add column source_job_id uuid;

update public.jobs set stage = 'INBOUND'
 where kind = 'INTERNATIONAL' and international_jenis <> 'ROAD_SHIPMENT';

-- applicable mengikuti tahap: job masuk hanya BC 2.3; turunan hanya BC miliknya (dibackfill di
-- bawah); Local/Road tanpa dokumen BC (termasuk BC 2.7 — road shipment tidak dilayani dokumen BC).
update public.jobs
   set operational = jsonb_set(jsonb_set(jsonb_set(jsonb_set(operational,
         '{customs,BC_2_3,applicable}', to_jsonb(stage is not distinct from 'INBOUND'), false),
         '{customs,BC_2_5,applicable}', 'false'::jsonb, false),
         '{customs,BC_3_0,applicable}', 'false'::jsonb, false),
         '{customs,BC_2_7,applicable}', 'false'::jsonb, false)
 where operational ? 'customs';

alter table public.jobs
  add constraint jobs_id_event_key unique (id, event_id),
  add constraint jobs_source_job_fk foreign key (source_job_id, event_id)
    references public.jobs(id, event_id) on delete restrict,
  add constraint jobs_stage_matches_jenis check (
    (stage is null) = (kind = 'LOCAL' or international_jenis = 'ROAD_SHIPMENT')),
  add constraint jobs_stage_source check (
    (source_job_id is not null) = (stage is not null and stage <> 'INBOUND')),
  add constraint jobs_derived_number_from_source check (
    source_job_id is null or (manifest_seq is null and commercial_invoice_number is null)),
  add constraint jobs_derived_no_source_documents check (
    source_job_id is null or (cipl_document is null and inward is null));

create unique index jobs_source_stage_active_key
  on public.jobs (source_job_id, stage)
  where source_job_id is not null and status <> 'CANCELLED';

-- Backfill job turunan untuk job masuk aktif yang sudah punya item CIPL (aturan sama dengan
-- `stageOfDisposisi`: RE_EXPORT/TIDAK_DISEBUT → BC 3.0; DISPOSED/GIVE_AWAY → BC 2.5; disposisi
-- absen = TIDAK_DISEBUT). Bentuk `operational` persis keluaran emptyOperationalDetails tahapnya
-- karena rollup tuntas membaca jsonb mentah (customs kosong = dianggap tuntas).
with staged as (
  select j.id, j.workspace_id, j.event_id, j.kind, j.international_jenis, j.transport_mode,
         j.agent_id, j.exhibitor_id, j.created_by_id, j.kepulangan, j.re_export,
         exists (select 1 from public.job_cipl_lines l, jsonb_array_elements(l.items) item
                  where l.job_id = j.id
                    and coalesce(item ->> 'disposisi', 'TIDAK_DISEBUT') in ('RE_EXPORT', 'TIDAK_DISEBUT')) as has_re_export,
         exists (select 1 from public.job_cipl_lines l, jsonb_array_elements(l.items) item
                  where l.job_id = j.id
                    and item ->> 'disposisi' in ('DISPOSED', 'GIVE_AWAY')) as has_disposal
    from public.jobs j
   where j.stage = 'INBOUND' and j.status <> 'CANCELLED'
)
insert into public.jobs
  (workspace_id, event_id, kind, international_jenis, transport_mode, agent_id, exhibitor_id,
   created_by_id, stage, source_job_id, operational, kepulangan, re_export)
select workspace_id, event_id, kind, international_jenis, transport_mode, agent_id, exhibitor_id,
       created_by_id, 'RE_EXPORT', id,
       '{"inbound":{"mode":null,"carrier":null,"scheduleAt":null,"actualAt":null},"outbound":{"mode":null,"carrier":null,"scheduleAt":null,"actualAt":null},"invoiceNumber":null,"customs":{"BC_2_3":{"applicable":false,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null},"BC_2_5":{"applicable":false,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null},"BC_3_0":{"applicable":true,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null},"BC_2_7":{"applicable":false,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}}}'::jsonb,
       kepulangan, re_export
  from staged where has_re_export
union all
select workspace_id, event_id, kind, international_jenis, transport_mode, agent_id, exhibitor_id,
       created_by_id, 'DISPOSAL', id,
       '{"inbound":{"mode":null,"carrier":null,"scheduleAt":null,"actualAt":null},"outbound":{"mode":null,"carrier":null,"scheduleAt":null,"actualAt":null},"invoiceNumber":null,"customs":{"BC_2_3":{"applicable":false,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null},"BC_2_5":{"applicable":true,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null},"BC_3_0":{"applicable":false,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null},"BC_2_7":{"applicable":false,"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}}}'::jsonb,
       null, null
  from staged where has_disposal;

-- Kepulangan kini diisi di job re-ekspor (BC 3.0) — pindahkan dari job masuk yang punya turunan.
update public.jobs s set kepulangan = null, re_export = null
 where s.stage = 'INBOUND' and (s.kepulangan is not null or s.re_export is not null)
   and exists (select 1 from public.jobs d where d.source_job_id = s.id and d.stage = 'RE_EXPORT');

alter table public.jobs enable trigger jobs_block_update_when_cancelled;

commit;
