-- Penanda logistik venue (docs/domain/event-data-definitions.md, keputusan 2026-10-29):
-- move-in/move-out adalah tanggal fakta fisik barang di venue — opsional, terpisah dari
-- starts_on/ends_on (tanggal pameran). Invariant I-7 ditegakkan DB: move out tidak boleh
-- sebelum move in bila keduanya terisi.
alter table public.events
  add column if not exists move_in_on date,
  add column if not exists move_out_on date;

alter table public.events
  drop constraint if exists events_move_dates_check;

alter table public.events
  add constraint events_move_dates_check
  check (move_in_on is null or move_out_on is null or move_out_on >= move_in_on);
