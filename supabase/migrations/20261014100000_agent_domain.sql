-- Domain agent: master data agent (forwarder) global + partisipasi per event.
-- Satu agent membawa beberapa exhibitor dan mewakili satu job per event.

create table if not exists public.agents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.event_agents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  event_id text not null,
  agent_id text not null,
  created_by_id uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint event_agents_unique_participation unique (workspace_id, event_id, agent_id)
);

alter table public.event_agents
  add constraint event_agents_event_fk
    foreign key (workspace_id, event_id) references public.events(workspace_id, id) on delete cascade not valid,
  add constraint event_agents_agent_fk
    foreign key (workspace_id, agent_id) references public.agents(workspace_id, id) on delete cascade not valid;

create index if not exists event_agents_workspace_event_idx on public.event_agents (workspace_id, event_id);

-- Jobs lama per exhibitor mewarisi agent dari exhibitor-nya (idempoten; no-op
-- selama belum ada agent yang ditetapkan).
update public.jobs
set payload = jsonb_set(jobs.payload, '{agentId}', to_jsonb(exhibitors.agent_id), true)
from public.exhibitors
where
  (jobs.payload->>'exhibitorId') = exhibitors.id
  and exhibitors.agent_id is not null
  and jobs.payload->>'agentId' is null;

alter table public.agents enable row level security;
revoke all on table public.agents from anon, authenticated;
alter table public.event_agents enable row level security;
revoke all on table public.event_agents from anon, authenticated;
