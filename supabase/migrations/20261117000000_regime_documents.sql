-- Alur pabean per rezim (keputusan 2026-11-17): dokumen milik tahap ditentukan rezim job, bukan
-- tahap semata. TPPB = BC 2.3 masuk / BC 2.5 disposal / BC 3.0 re-ekspor. Temporary Import =
-- BC 2.0 (PIB) masuk / BC 2.0 definitif disposal / BC 3.0 re-ekspor. ATA Carnet = Carnet, tanpa
-- dokumen BC dan tanpa disposal (semua barang wajib kembali). Permanent Import = BC 2.0 tunggal
-- tanpa job turunan. Road Shipment dan Local tetap tanpa dokumen pabean.
--
--   jobs.operational (jsonb): customs bertambah key BC_2_0 dan CARNET; field carnet (identitas
--   carnet job ATA) dan guarantee (jaminan PIB job Temporary Import) diisi operator dari UI.
--   Kolom tabel tidak berubah. Applicable semua dokumen dihitung ulang dari (rezim, tahap);
--   status/nomor yang sudah terisi dipertahankan — termasuk job PERMANENT_IMPORT lama yang dahulu
--   "dipaksa" mencatat BC 2.3 (datanya tetap di key BC_2_3, hanya tidak lagi applicable).
--
-- Constraint baru menutup kombinasi mustahil: ATA tidak punya job DISPOSAL, Permanent Import
-- tidak punya job turunan. NOT VALID karena backfill job turunan 2026-11-16 membuat turunan untuk
-- semua job masuk bertahap tanpa melihat rezim; lingkungan dengan job ATA/PI turunan demikian
-- harus membereskannya dulu (batalkan job turunannya) sebelum VALIDATE.

begin;

alter table public.jobs disable trigger jobs_block_update_when_cancelled;

update public.jobs
   set operational = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(operational,
         '{customs,BC_2_0}',
         coalesce(operational->'customs'->'BC_2_0', '{}'::jsonb)
           || '{"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}'::jsonb
           || jsonb_build_object('applicable',
               international_jenis in ('TEMPORARY_IMPORT', 'PERMANENT_IMPORT')
               and stage in ('INBOUND', 'DISPOSAL')),
         true),
         '{customs,BC_2_3}',
         coalesce(operational->'customs'->'BC_2_3', '{}'::jsonb)
           || '{"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}'::jsonb
           || jsonb_build_object('applicable',
               international_jenis = 'TPPB_BC_23' and stage = 'INBOUND'),
         true),
         '{customs,BC_2_5}',
         coalesce(operational->'customs'->'BC_2_5', '{}'::jsonb)
           || '{"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}'::jsonb
           || jsonb_build_object('applicable',
               international_jenis = 'TPPB_BC_23' and stage = 'DISPOSAL'),
         true),
         '{customs,BC_3_0}',
         coalesce(operational->'customs'->'BC_3_0', '{}'::jsonb)
           || '{"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}'::jsonb
           || jsonb_build_object('applicable',
               international_jenis in ('TPPB_BC_23', 'TEMPORARY_IMPORT') and stage = 'RE_EXPORT'),
         true),
         '{customs,BC_2_7}',
         coalesce(operational->'customs'->'BC_2_7', '{}'::jsonb)
           || '{"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}'::jsonb
           || jsonb_build_object('applicable', false),
         true),
         '{customs,CARNET}',
         coalesce(operational->'customs'->'CARNET', '{}'::jsonb)
           || '{"status":"NOT_STARTED","ajuNumber":null,"registrationNumber":null,"registrationDate":null,"warehouseName":null}'::jsonb
           || jsonb_build_object('applicable',
               international_jenis = 'ATA_CARNET' and stage in ('INBOUND', 'RE_EXPORT')),
         true)
   where operational ? 'customs';

alter table public.jobs
  add constraint jobs_ata_no_disposal check (
    international_jenis is distinct from 'ATA_CARNET' or stage is distinct from 'DISPOSAL') not valid,
  add constraint jobs_permanent_single_stage check (
    international_jenis is distinct from 'PERMANENT_IMPORT' or stage = 'INBOUND') not valid;

alter table public.jobs enable trigger jobs_block_update_when_cancelled;

commit;
