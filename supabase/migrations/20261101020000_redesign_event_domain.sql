-- Mengapa: slice Event dari redesign (clean cutover DD-A4). Skema to-be berbasis kolom relasional
-- nyata + FK + CHECK (tanpa payload jsonb, tanpa dua sumber kebenaran per baris — P5/DD-A2).
-- Tabel prototipe lama (venues/event_organizers/events/event_cancellations bergaya
-- like public.venues + payload, PK komposit (workspace_id, id)) TIDAK dipakai sistem baru;
-- tabel itu dibuang lebih dulu agar bentuk ternormalisasi di bawah bersifat deterministik dan tidak
-- diam-diam dipertahankan oleh create table if not exists. Tidak ada data operasional nyata di
-- jalur prototipe ini (hanya build MVP yang sudah didemokan).
drop table if exists public.event_cancellations cascade;
drop table if exists public.events cascade;
drop table if exists public.event_organizers cascade;
drop table if exists public.venues cascade;

-- Master data: lokasi pameran. Dirujuk event lewat id (FK), bukan nilai yang digandakan (DD-A2).
create table if not exists public.venues (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  legal_name   text not null check (char_length(trim(legal_name)) between 1 and 200),
  alias_name   text,
  city         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists venues_workspace_name_idx
  on public.venues (workspace_id, legal_name);

-- Master data: penyelenggara event (EO). Dirujuk event lewat id (FK).
create table if not exists public.event_organizers (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  legal_name   text not null check (char_length(trim(legal_name)) between 1 and 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists event_organizers_workspace_name_idx
  on public.event_organizers (workspace_id, legal_name);

-- Pusat operasional. Lifecycle eksplisit via kolom status (satu sumber kebenaran — DD-E2),
-- bukan diturunkan dari ada/tidaknya baris cancellation seperti build lama yang jalur cancel-nya
-- mati. alias dipersist (DD-E1). pic_id NOT NULL menutup bypass event tanpa PIC bisa dihapus
-- siapa pun (DD-E4/15.1). Invariant tanggal ditegakkan DB lewat CHECK.
create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  name               text not null check (char_length(trim(name)) between 1 and 200),
  alias              text,                               -- TO-BE: dipersist (DD-E1)
  venue_id           uuid not null references public.venues(id) on delete restrict,
  event_organizer_id uuid not null references public.event_organizers(id) on delete restrict,
  pic_id             uuid not null references public.app_users(id) on delete restrict,
  starts_on          date not null,
  ends_on            date not null,
  status             text not null default 'ACTIVE'
                       check (status in ('ACTIVE','CANCELLED','ARCHIVED')),
  created_by_id      uuid not null references public.app_users(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_on >= starts_on)                           -- invariant tanggal ditegakkan DB
);
create index if not exists events_workspace_starts_idx
  on public.events (workspace_id, starts_on desc);
create index if not exists events_workspace_status_idx
  on public.events (workspace_id, status);
create index if not exists events_venue_dates_idx
  on public.events (workspace_id, venue_id, starts_on, ends_on);  -- deteksi konflik venue

-- Catatan pembatalan sebagai fakta first-class (siapa, kapan, kenapa). event_id UNIQUE menjaga
-- bijection CANCELLED <-> cancellation (DD-E2/13.5): tepat satu cancellation per event.
create table if not exists public.event_cancellations (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  event_id        uuid not null unique references public.events(id) on delete cascade,
  reason          text not null check (char_length(trim(reason)) between 1 and 1000),
  cancelled_by_id uuid not null references public.app_users(id) on delete restrict,
  cancelled_at    timestamptz not null default now()
);

-- Tidak ada policy publik; akses hanya lewat service-role di route handler yang sudah
-- memverifikasi sesi. RLS aktif + cabut seluruh grant dari anon/authenticated (5.5).
alter table public.venues enable row level security;
revoke all on table public.venues from anon, authenticated;

alter table public.event_organizers enable row level security;
revoke all on table public.event_organizers from anon, authenticated;

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;

alter table public.event_cancellations enable row level security;
revoke all on table public.event_cancellations from anon, authenticated;
