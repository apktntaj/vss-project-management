-- Mengapa: special instruction = permintaan khusus klien per job (mis. "butuh vacuum pack",
-- "urgent re-export") yang harus terlihat sebagai peringatan di dashboard (dikelompokkan per event)
-- dan di kolom "Special Instructions" export inward manifest. Satu catatan per job, terpisah dari
-- `notes` (catatan internal) karena maknanya peringatan tindakan, bukan catatan bebas.
--
-- - Aditif dan idempoten: kolom nullable tanpa default/constraint/backfill.
-- - RLS dan grant tabel `jobs` tidak berubah.

alter table public.jobs
  add column if not exists special_instructions text;
