-- Mengapa: koreksi 2026-11-03 — nomor internal VSS-#####  tidak dipakai di lapangan dan bertabrakan
-- dengan No Job manifest sebagai satu-satunya nomor yang dikenal pengguna. Identitas teknis job
-- adalah `jobs.id` (uuid); label di UI adalah No Job (atau awalannya, mis. `S.-`, bila urutan belum
-- diisi). Kolom, fungsi default, dan sequence-nya dibuang.
begin;

alter table public.jobs drop column vss_number;
drop function public.next_job_vss_number();
drop sequence public.job_vss_number_seq;

commit;
