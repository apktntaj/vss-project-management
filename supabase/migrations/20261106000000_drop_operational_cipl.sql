-- Mengapa: keputusan 2026-11-06 — status CIPL kini diturunkan dari berkas lampiran + data job
-- (`deriveCiplStatus`), bukan field manual. `operational.cipl` (status/referensi/tanggal diterima)
-- tidak lagi dibaca maupun ditulis, jadi dibuang dari jsonb job yang sudah ada. Lampiran lama
-- tidak dipetakan ulang (tanpa backfill); cukup scan atau unggah ulang.
begin;

update public.jobs set operational = operational - 'cipl' where operational ? 'cipl';

commit;
