-- Mengapa: otorisasi job per event (B6). Peran disederhanakan menjadi CS / SPESIALIS / FINANCE
-- (admin tetap flag is_admin). Spesialis memegang jenis job tertentu (handled_job_jenis). Job
-- turunan BC 2.5/3.0 dimiliki pembuat job masuknya, jadi created_by_id diselaraskan.
-- Urutan: remap peran -> ganti dua check peran -> tambah kolom -> tambah dua check jenis -> jobs.

-- 1. Remap peran lama. Per 20 Nov tidak ada baris yang terkena; ini hanya pengaman.
update public.app_users
   set role = 'CS', job_role = 'CS'
 where role in ('STAFF', 'OPERATIONS', 'DOCUMENT_ASSISTANT')
    or job_role in ('STAFF', 'OPERATIONS', 'DOCUMENT_ASSISTANT');

-- 2. Ganti check peran (check lama ditinggalkan dulu agar remap tidak bentrok).
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users
  add constraint app_users_role_check
    check (role in ('CS', 'SPESIALIS', 'FINANCE'));

alter table public.app_users drop constraint if exists app_users_job_role_check;
alter table public.app_users
  add constraint app_users_job_role_check
    check (job_role in ('CS', 'SPESIALIS', 'FINANCE'));

-- 3. Jenis job yang dipegang spesialis. Semua baris kosong (belum ada SPESIALIS), sehingga
--    check role/jenis langsung terpenuhi. Tanpa duplikat dijaga Zod; tanpa index (tidak dipakai menyaring).
alter table public.app_users
  add column if not exists handled_job_jenis text[] not null default '{}';

alter table public.app_users drop constraint if exists app_users_handled_job_jenis_values_check;
alter table public.app_users
  add constraint app_users_handled_job_jenis_values_check
    check (handled_job_jenis <@ array['TPPB_BC_23','ATA_CARNET','TEMPORARY_IMPORT','PERMANENT_IMPORT','ROAD_SHIPMENT','LOCAL']::text[]);

alter table public.app_users drop constraint if exists app_users_handled_job_jenis_role_check;
alter table public.app_users
  add constraint app_users_handled_job_jenis_role_check
    check ((role = 'SPESIALIS') = (cardinality(handled_job_jenis) > 0));

-- 4. Pemilik job turunan = pemilik job sumbernya. Trigger jobs_block_update_when_cancelled
--    mengabaikan created_by_id, jadi job batal ikut terupdate.
update public.jobs d
   set created_by_id = s.created_by_id
  from public.jobs s
 where d.source_job_id = s.id
   and d.created_by_id is distinct from s.created_by_id;
