create table if not exists public.app_records (
  store_name text not null,
  record_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (store_name, record_id)
);

create index if not exists app_records_store_name_idx
  on public.app_records (store_name);

alter table public.app_records enable row level security;
revoke all on public.app_records from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

insert into public.app_records (store_name, record_id, data)
values
  ('users', 'demo-user-nurul', '{"id":"demo-user-nurul","name":"Nurul Handayani","email":"admin@vss.demo","role":"SUPERVISOR","isActive":true}'::jsonb),
  ('users', 'demo-user-andy', '{"id":"demo-user-andy","name":"Andy","email":"operasional@vss.demo","role":"STAFF","isActive":true}'::jsonb),
  ('users', 'demo-user-kevin', '{"id":"demo-user-kevin","name":"Kevin","email":"viewer@vss.demo","role":"CUSTOMER_SERVICE","isActive":true}'::jsonb),
  ('venues', 'demo-venue-jakarta', jsonb_build_object('id', 'demo-venue-jakarta', 'officialName', 'JAKARTA INTERNATIONAL EXPO', 'aliasName', 'JIEXPO', 'address', 'Kemayoran, Jakarta Pusat', 'latitude', -6.1467, 'longitude', 106.8456, 'contactInfo', '+62 21 26645 000', 'createdAt', now(), 'updatedAt', now())),
  ('venues', 'demo-venue-ice', jsonb_build_object('id', 'demo-venue-ice', 'officialName', 'INDONESIA CONVENTION EXHIBITION', 'aliasName', 'ICE BSD', 'address', 'BSD City, Tangerang', 'latitude', -6.3019, 'longitude', 106.6361, 'contactInfo', '+62 21 2971 4600', 'createdAt', now(), 'updatedAt', now())),
  ('venues', 'demo-venue-bali', jsonb_build_object('id', 'demo-venue-bali', 'officialName', 'BALI NUSA DUA CONVENTION CENTER', 'aliasName', 'BNDCC', 'address', 'Kawasan Pariwisata Nusa Dua, Bali', 'latitude', -8.7954, 'longitude', 115.2302, 'contactInfo', null, 'createdAt', now(), 'updatedAt', now())),
  ('eos', 'demo-eo-jakarta', jsonb_build_object('id', 'demo-eo-jakarta', 'legalName', 'PT PAMERINDO INDONESIA', 'aliasName', 'Pamerindo Indonesia', 'contactInfo', 'info@pamerindo.com · +62 21 2525 320', 'createdAt', now(), 'updatedAt', now())),
  ('eos', 'demo-eo-debindo', jsonb_build_object('id', 'demo-eo-debindo', 'legalName', 'PT DEBINDO INTERNATIONAL TRADE AND EXHIBITIONS', 'aliasName', 'Debindo', 'contactInfo', 'info@debindo-group.com · +62 21 8379 7401', 'createdAt', now(), 'updatedAt', now()))
on conflict (store_name, record_id) do nothing;
