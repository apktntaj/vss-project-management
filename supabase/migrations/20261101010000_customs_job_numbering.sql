-- Mengapa: ganti read-modify-write counter dari browser yang rawan race di build lama.
-- Sequence Postgres bersifat atomik, sehingga penomoran customs job aman terhadap concurrency
-- (unik + monoton naik ketat). Nomor di-format `VSS-XXXXX` di lapisan aplikasi
-- (`lib/server/numbering.ts`), minimal 5 digit dan boleh lebih tanpa dipotong.
create sequence if not exists public.customs_job_number_seq as bigint start with 1 increment by 1;

-- Fungsi rpc yang mengembalikan `nextval` sequence dalam satu round-trip atomik. Dipanggil dari
-- service-role client via `db.rpc('nextval_customs_job')`. Tanpa baca-ubah-tulis di klien.
create or replace function public.nextval_customs_job()
  returns bigint
  language sql
  volatile
as $$
  select nextval('public.customs_job_number_seq');
$$;

-- Tidak ada akses publik: hanya service-role (di route handler yang sudah memverifikasi sesi)
-- yang boleh memajukan sequence. Cabut seluruh grant dari peran anon/authenticated.
revoke all on sequence public.customs_job_number_seq from anon, authenticated;
revoke all on function public.nextval_customs_job() from anon, authenticated;
