-- PIC event: penanggung jawab event yang tampil di kartu dan berhak menghapus.
alter table public.events
  add column if not exists pic_id uuid references public.app_users(id);

create index if not exists events_workspace_pic_idx on public.events (workspace_id, pic_id);
