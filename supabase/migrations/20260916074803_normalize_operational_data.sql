-- Operational data is stored in Supabase only. Each aggregate gets a table so
-- API queries never depend on a browser-side runtime store or demo seed.
-- `payload` keeps the existing domain shapes intact while the application is
-- migrated from the prototype adapter.

create table if not exists public.operational_users (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.venues (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.event_organizers (like public.venues including all);
create table if not exists public.events (like public.venues including all);
create table if not exists public.exhibitors (like public.venues including all);
create table if not exists public.jobs (like public.venues including all);
create table if not exists public.job_stages (like public.venues including all);
create table if not exists public.job_documents (like public.venues including all);
create table if not exists public.coordination_agents (like public.venues including all);
create table if not exists public.cipls (like public.venues including all);
create table if not exists public.cipl_versions (like public.venues including all);
create table if not exists public.shipments (like public.venues including all);
create table if not exists public.customs_jobs (like public.venues including all);
create table if not exists public.tickets (like public.venues including all);
create table if not exists public.preferences (like public.venues including all);
create table if not exists public.migration_review_items (like public.venues including all);

create table if not exists public.attachments (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  owner_type text not null,
  owner_id text not null,
  kind text,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index if not exists attachments_owner_idx on public.attachments (workspace_id, owner_type, owner_id);
create index if not exists events_workspace_updated_idx on public.events (workspace_id, updated_at desc);
create index if not exists jobs_workspace_updated_idx on public.jobs (workspace_id, updated_at desc);
create index if not exists tickets_workspace_updated_idx on public.tickets (workspace_id, updated_at desc);

-- The browser has no direct database access. Next.js route handlers use only
-- the server-side service key after checking the NextAuth session.
alter table public.operational_users enable row level security;
alter table public.venues enable row level security;
alter table public.event_organizers enable row level security;
alter table public.events enable row level security;
alter table public.exhibitors enable row level security;
alter table public.jobs enable row level security;
alter table public.job_stages enable row level security;
alter table public.job_documents enable row level security;
alter table public.coordination_agents enable row level security;
alter table public.cipls enable row level security;
alter table public.cipl_versions enable row level security;
alter table public.shipments enable row level security;
alter table public.customs_jobs enable row level security;
alter table public.tickets enable row level security;
alter table public.preferences enable row level security;
alter table public.migration_review_items enable row level security;
alter table public.attachments enable row level security;

revoke all on table public.operational_users, public.venues, public.event_organizers,
  public.events, public.exhibitors, public.jobs, public.job_stages,
  public.job_documents, public.coordination_agents, public.cipls,
  public.cipl_versions, public.shipments, public.customs_jobs, public.tickets,
  public.preferences, public.migration_review_items, public.attachments
  from anon, authenticated;
