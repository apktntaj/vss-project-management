-- NextAuth authenticates application users. Browser clients get no direct
-- database privileges; service_role is used only after server-side auth.
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  role text not null check (role in ('STAFF', 'SUPERVISOR', 'CUSTOMER_SERVICE', 'DOCUMENT_ASSISTANT')),
  is_admin boolean not null default false,
  is_active boolean not null default true,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'MEMBER')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
insert into public.workspaces (slug) values ('default') on conflict (slug) do nothing;

alter table public.app_users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
revoke all on table public.app_users, public.workspaces, public.workspace_members from anon, authenticated;

-- Document bytes belong in the private bucket, not JSON or database rows.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update set public = false;
