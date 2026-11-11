-- Mengapa: surat permohonan Kanwil dan form rincian barang diajukan atas nama pengusaha TPPB
-- (pengelola venue), karena pabean hanya mengenal pengusaha TPPB sebagai pemohon. Datanya permanen
-- per venue, jadi disimpan di master `venues`, bukan diketik ulang per surat.
--
-- - Aditif dan idempoten: kolom nullable tanpa default/constraint/backfill.
-- - RLS dan grant tabel `venues` tidak berubah.

alter table public.venues
  add column if not exists tppb_operator_name      text,
  add column if not exists tppb_operator_npwp      text,
  add column if not exists tppb_operator_address   text,
  add column if not exists customs_regional_office text,
  add column if not exists signatory_1_name        text,
  add column if not exists signatory_1_title       text,
  add column if not exists signatory_2_name        text,
  add column if not exists signatory_2_title       text;
