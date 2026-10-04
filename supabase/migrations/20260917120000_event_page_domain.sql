-- The existing payload columns remain temporarily for non-event prototype consumers.
-- Event-page reads and writes use the typed columns below; future migrations may remove payload.

alter table public.app_users
  add column if not exists job_role text,
  add column if not exists access_level text,
  add column if not exists updated_at timestamptz not null default now();

update public.app_users
set
  job_role = coalesce(job_role, role),
  access_level = coalesce(access_level, case when is_admin then 'ADMIN' else 'MEMBER' end)
where job_role is null or access_level is null;

alter table public.app_users
  alter column job_role set not null,
  alter column access_level set not null;

alter table public.app_users
  add constraint app_users_job_role_check
    check (job_role in ('STAFF', 'SUPERVISOR', 'CUSTOMER_SERVICE', 'DOCUMENT_ASSISTANT')) not valid,
  add constraint app_users_access_level_check
    check (access_level in ('ADMIN', 'MEMBER')) not valid;

alter table public.venues
  add column if not exists name text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists address text,
  add column if not exists website text,
  add column if not exists loading_access_notes text;

alter table public.event_organizers
  add column if not exists name text,
  add column if not exists npwp text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists address text,
  add column if not exists website text;

alter table public.events
  add column if not exists name text,
  add column if not exists venue_id text,
  add column if not exists event_organizer_id text,
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists created_by_id uuid references public.app_users(id);

alter table public.exhibitors
  add column if not exists event_id text,
  add column if not exists kind text,
  add column if not exists name text,
  add column if not exists contact jsonb not null default '{}'::jsonb,
  add column if not exists agent_id text,
  add column if not exists npwp text,
  add column if not exists created_by_id uuid references public.app_users(id);

create table if not exists public.event_cancellations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  event_id text not null,
  reason text not null check (char_length(trim(reason)) > 0),
  cancelled_at timestamptz not null default now(),
  cancelled_by_id uuid not null references public.app_users(id),
  primary key (workspace_id, event_id),
  foreign key (workspace_id, event_id) references public.events(workspace_id, id) on delete restrict
);

alter table public.event_cancellations enable row level security;
revoke all on table public.event_cancellations from anon, authenticated;

alter table public.venues add constraint venues_name_not_blank check (name is null or char_length(trim(name)) > 0) not valid;
alter table public.event_organizers add constraint event_organizers_name_not_blank check (name is null or char_length(trim(name)) > 0) not valid;
alter table public.events add constraint events_dates_ordered check (starts_on is null or ends_on is null or ends_on >= starts_on) not valid;
alter table public.exhibitors add constraint exhibitors_kind_check check (kind is null or kind in ('LOCAL', 'INTERNATIONAL')) not valid;
alter table public.exhibitors add constraint exhibitors_npwp_local_only check (kind is distinct from 'INTERNATIONAL' or npwp is null) not valid;

create index if not exists events_workspace_starts_on_idx on public.events (workspace_id, starts_on);
create index if not exists exhibitors_workspace_event_idx on public.exhibitors (workspace_id, event_id);
-- Preserve payload-backed rows already created by the prototype adapter.
update public.venues
set
  name = coalesce(name, payload->>'officialName'),
  address = coalesce(address, payload->>'address'),
  contacts = case
    when contacts = '[]'::jsonb and coalesce(payload->>'contactInfo', '') <> ''
      then jsonb_build_array(jsonb_build_object('name', payload->>'contactInfo', 'role', null, 'email', null, 'phone', null, 'isPrimary', true))
    else contacts
  end
where name is null;

update public.event_organizers
set
  name = coalesce(name, payload->>'legalName'),
  contacts = case
    when contacts = '[]'::jsonb and coalesce(payload->>'contactInfo', '') <> ''
      then jsonb_build_array(jsonb_build_object('name', payload->>'contactInfo', 'role', null, 'email', null, 'phone', null, 'isPrimary', true))
    else contacts
  end
where name is null;

update public.events
set
  name = coalesce(name, payload->>'officialName'),
  venue_id = coalesce(venue_id, payload->>'venueId'),
  event_organizer_id = coalesce(event_organizer_id, payload->>'eoId'),
  starts_on = coalesce(starts_on, nullif(payload->>'startsOn', '')::date),
  ends_on = coalesce(ends_on, nullif(payload->>'endsOn', '')::date)
where name is null;

update public.exhibitors
set
  event_id = coalesce(event_id, payload->>'eventId'),
  kind = coalesce(kind, payload->>'type'),
  name = coalesce(name, payload->>'legalName'),
  contact = case
    when contact = '{}'::jsonb
      then jsonb_build_object('name', null, 'role', null, 'email', payload->>'email', 'phone', payload->>'phone')
    else contact
  end
where name is null;

alter table public.events
  add constraint events_venue_fk
    foreign key (workspace_id, venue_id) references public.venues(workspace_id, id) not valid,
  add constraint events_event_organizer_fk
    foreign key (workspace_id, event_organizer_id) references public.event_organizers(workspace_id, id) not valid;

alter table public.exhibitors
  add constraint exhibitors_event_fk
    foreign key (workspace_id, event_id) references public.events(workspace_id, id) not valid;
