-- Role taxonomy: CS / STAFF / OPERATIONS / DOCUMENT_ASSISTANT / FINANCE (+ is_admin super-user)
-- and per-event access grants (co-PIC).

-- Remap existing rows BEFORE swapping the CHECK constraints.
alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users drop constraint if exists app_users_job_role_check;

update public.app_users set is_admin = true where role = 'SUPERVISOR';
update public.app_users set role = 'CS' where role = 'CUSTOMER_SERVICE';
update public.app_users set role = 'OPERATIONS' where role = 'SUPERVISOR';
update public.app_users set job_role = role;

alter table public.app_users
  add constraint app_users_role_check
    check (role in ('CS', 'STAFF', 'OPERATIONS', 'DOCUMENT_ASSISTANT', 'FINANCE'));
alter table public.app_users
  add constraint app_users_job_role_check
    check (job_role in ('CS', 'STAFF', 'OPERATIONS', 'DOCUMENT_ASSISTANT', 'FINANCE'));

create table if not exists public.event_access (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references public.app_users(id) on delete cascade,
  granted_by_id uuid not null references public.app_users(id) on delete restrict,
  granted_at    timestamptz not null default now(),
  primary key (workspace_id, event_id, user_id)
);

create index if not exists event_access_user_idx
  on public.event_access (workspace_id, user_id);

alter table public.event_access enable row level security;
revoke all on table public.event_access from anon, authenticated;
