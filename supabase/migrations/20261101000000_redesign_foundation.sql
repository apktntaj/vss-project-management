-- Mengapa: fondasi redesign (clean cutover DD-A4). Skema to-be berbasis kolom relasional nyata +
-- FK + CHECK, bukan payload jsonb. Otorisasi diturunkan dari `role` yang ditegakkan di server,
-- bukan dari flag `is_admin`. Tenant boundary tetap single-tenant via workspace slug 'default'.
create extension if not exists pgcrypto;

-- Tenant boundary. Skema multi-tenant, aplikasi single-tenant (slug 'default').
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.workspaces (slug) values ('default') on conflict (slug) do nothing;

-- Identitas + peran yang benar-benar ditegakkan di server (bukan sekadar is_admin).
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email)),
  full_name     text not null check (char_length(trim(full_name)) between 1 and 120),
  role          text not null
                 check (role in ('STAFF','SUPERVISOR','CUSTOMER_SERVICE','DOCUMENT_ASSISTANT')),
  is_active     boolean not null default true,
  password_hash text not null,           -- scrypt self-describing, tidak pernah ke client
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keanggotaan workspace (single-tenant hari ini, schema siap multi-tenant).
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.app_users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Tidak ada policy publik; akses hanya lewat service-role di route handler yang sudah
-- memverifikasi sesi. RLS aktif + cabut seluruh grant dari anon/authenticated.
alter table public.workspaces enable row level security;
revoke all on table public.workspaces from anon, authenticated;

alter table public.app_users enable row level security;
revoke all on table public.app_users from anon, authenticated;

alter table public.workspace_members enable row level security;
revoke all on table public.workspace_members from anon, authenticated;
