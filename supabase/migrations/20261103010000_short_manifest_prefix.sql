-- Mengapa: koreksi 2026-11-03 — awalan No Job disingkat: Temporary Import T (was TI), Permanent
-- Import P (was PI), Road Shipment R (was RS), Local L (was LOC). S/A (TPPB laut/udara) dan ATA
-- tetap. Urutan dan akhiran tetap diisi operator.
--
-- `manifest_prefix` adalah generated column; ekspresinya tidak bisa diubah di tempat pada semua versi
-- Postgres, jadi kolom (beserta check & unique yang memakainya) dibuat ulang. Pemetaan lama → baru
-- satu-ke-satu dan awalan baru tidak saling bertabrakan, sehingga unique (event, awalan, urutan)
-- tetap terpenuhi dan urutan yang sudah ditetapkan tidak berubah.
begin;

alter table public.jobs drop constraint jobs_manifest_number_key;
alter table public.jobs drop constraint jobs_manifest_seq_needs_prefix;
alter table public.jobs drop column manifest_prefix;

alter table public.jobs add column manifest_prefix text generated always as (
  case
    when kind = 'LOCAL' then 'L'
    when international_jenis = 'TPPB_BC_23' and transport_mode = 'SEA' then 'S'
    when international_jenis = 'TPPB_BC_23' and transport_mode = 'AIR' then 'A'
    when international_jenis = 'ATA_CARNET' then 'ATA'
    when international_jenis = 'TEMPORARY_IMPORT' then 'T'
    when international_jenis = 'PERMANENT_IMPORT' then 'P'
    when international_jenis = 'ROAD_SHIPMENT' then 'R'
  end
) stored;

alter table public.jobs add constraint jobs_manifest_seq_needs_prefix
  check (manifest_seq is null or manifest_prefix is not null);
alter table public.jobs add constraint jobs_manifest_number_key
  unique (event_id, manifest_prefix, manifest_seq);

commit;
