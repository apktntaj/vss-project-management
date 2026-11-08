-- Mengapa: job tidak pernah dihapus (agar tidak ada penghapusan tak sengaja). Job yang batal tetap
-- tersimpan, wajib disertai alasan, dan setelah batal tidak boleh diubah lagi.
--
--   Job ──1:0..1── job_cancellations   fakta pembatalan: alasan, pelaku, waktu
--
-- - `jobs.status = 'CANCELLED'` ⇔ ada tepat satu baris job_cancellations (UNIQUE job_id). Keduanya
--   ditulis dalam satu transaksi oleh `cancel_job`, jadi tidak ada status batal tanpa alasan.
-- - Trigger menolak perubahan apa pun pada job yang sudah CANCELLED. Pengecualian: kolom yang
--   diubah aksi FK `on delete set null` (assigned_to_id, created_by_id) serta version/updated_at,
--   supaya penghapusan user tidak gagal karena job batal.
-- - Aditif: tidak mengubah kolom/baris yang ada.

begin;

create table public.job_cancellations (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  job_id          uuid not null unique references public.jobs(id) on delete restrict,
  reason          text not null check (char_length(trim(reason)) between 1 and 1000),
  cancelled_by_id uuid not null references public.app_users(id) on delete restrict,
  cancelled_at    timestamptz not null default now()
);

create index job_cancellations_workspace_idx on public.job_cancellations (workspace_id, cancelled_at desc);

/**
 * Batalkan job dalam satu transaksi terjaga versi: status → CANCELLED, lalu catat alasannya.
 * Mengembalikan versi baru, atau null bila versi basi, job tidak ada, atau sudah batal.
 */
create function public.cancel_job(
  p_workspace_id     uuid,
  p_job_id           uuid,
  p_expected_version integer,
  p_user_id          uuid,
  p_reason           text
)
  returns integer
  language plpgsql
  set search_path = ''
as $$
declare
  v_version integer;
begin
  update public.jobs
     set status = 'CANCELLED',
         version = version + 1,
         updated_at = now()
   where workspace_id = p_workspace_id
     and id = p_job_id
     and version = p_expected_version
     and status <> 'CANCELLED'
  returning version into v_version;
  if v_version is null then
    return null;
  end if;

  insert into public.job_cancellations (workspace_id, job_id, reason, cancelled_by_id)
  values (p_workspace_id, p_job_id, p_reason, p_user_id);

  return v_version;
end;
$$;

create function public.jobs_block_update_when_cancelled()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_ignored constant text[] := array['assigned_to_id', 'created_by_id', 'version', 'updated_at'];
begin
  if old.status = 'CANCELLED'
     and (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
    raise exception using errcode = '23514', message = 'job_cancelled',
      detail = 'Job yang sudah dibatalkan tidak dapat diubah.';
  end if;
  return new;
end;
$$;

create trigger jobs_block_update_when_cancelled
  before update on public.jobs
  for each row execute function public.jobs_block_update_when_cancelled();

-- Akses: hanya service-role di route handler yang sudah memverifikasi sesi ------------------------
alter table public.job_cancellations enable row level security;
revoke all on table public.job_cancellations from anon, authenticated;
revoke all on function public.cancel_job(uuid, uuid, integer, uuid, text) from public, anon, authenticated;
revoke all on function public.jobs_block_update_when_cancelled() from public, anon, authenticated;
grant execute on function public.cancel_job(uuid, uuid, integer, uuid, text) to service_role;

commit;
