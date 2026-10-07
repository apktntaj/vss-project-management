-- CEISA credentials and evidence are server-only. Browser roles never receive table access.
create table if not exists public.ceisa_connections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  credentials_ciphertext text not null,
  credentials_iv text not null,
  credentials_tag text not null,
  key_version smallint not null default 1 check (key_version > 0),
  verification_state text not null default 'UNCONFIGURED'
    check (verification_state in ('UNCONFIGURED', 'UNVERIFIED', 'VERIFIED', 'FAILED')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ceisa_observations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  correlation_key text not null,
  document_type text,
  submission_number text,
  response_code text,
  response_name text,
  observed_at timestamptz not null default now(),
  registration_number text,
  registration_date date,
  attachment_id text,
  payload_ciphertext text not null,
  payload_iv text not null,
  payload_tag text not null,
  payload_sha256 text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, operation, correlation_key, payload_sha256)
);
create index if not exists ceisa_observations_submission_idx
  on public.ceisa_observations (workspace_id, submission_number, observed_at desc);

alter table public.ceisa_connections enable row level security;
alter table public.ceisa_observations enable row level security;
revoke all on table public.ceisa_connections, public.ceisa_observations from anon, authenticated;
