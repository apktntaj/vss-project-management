-- Semua field event opsional kecuali nama (keputusan 2026-10-29): event bisa diciptakan cepat
-- hanya dengan nama, venue/EO/PIC/tanggal diisi belakangan saat informasinya tersedia.
-- CHECK ends_on >= starts_on tetap aman untuk NULL (pass bila salah satu kosong).
alter table public.events
  alter column venue_id drop not null,
  alter column event_organizer_id drop not null,
  alter column pic_id drop not null,
  alter column starts_on drop not null,
  alter column ends_on drop not null;
