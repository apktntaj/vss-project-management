import 'server-only'

// Helper dan bentuk baris bersama antara modul repository event. `import 'server-only'` sebagai
// import efektif pertama tetap dipasang di SETIAP modul repository (bukan hanya barrel) agar batas
// server/klien dijaga per-modul, bukan hanya di pintu masuk (Req 3.2, 20.2).

import type { EventDisplayStatus, EventLifecycle } from '@/domain/event/types'

// Select bentuk daftar/ringkasan: kolom event + nama master data lewat foreign-table select.
// Relasi TANPA `!inner` (left join) sejak field opsional (keputusan 2026-10-29): event tanpa
// venue/EO/PIC/tanggal tetap harus muncul di daftar. Hint FK `events_pic_id_fkey` tetap wajib:
// `events` punya DUA FK ke `app_users` (pic_id + created_by_id) — tanpa hint, PostgREST menolak
// dengan PGRST201 (relasi ambigu).
export const EVENT_WITH_RELATIONS =
  'id, name, alias, starts_on, ends_on, move_in_on, move_out_on, status, venue_id, event_organizer_id, pic_id, venue:venues(legal_name), organizer:event_organizers(legal_name), pic:app_users!events_pic_id_fkey(full_name)'

// Bentuk baris join untuk daftar/ringkasan. Supabase mengembalikan relasi foreign-table sebagai
// objek (one-to-one lewat FK), tetapi tipenya kadang dilebarkan menjadi array oleh generator —
// kita menerima keduanya dan mengambil elemen pertama secara defensif.
export type EventJoinedRow = {
  id: string
  name: string
  alias: string | null
  starts_on: string | null
  ends_on: string | null
  move_in_on: string | null
  move_out_on: string | null
  status: EventLifecycle
  venue_id: string | null
  event_organizer_id: string | null
  pic_id: string | null
  venue: { legal_name: string } | { legal_name: string }[] | null
  organizer: { legal_name: string } | { legal_name: string }[] | null
  pic: { full_name: string } | { full_name: string }[] | null
}

// Ambil satu objek relasi dari bentuk objek-atau-array yang dikembalikan Supabase.
export function firstRelation<T>(relation: T | T[] | null): T | null {
  if (relation == null) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
}

// Tanggal "hari ini" sisi-server sebagai YYYY-MM-DD. Dipakai untuk menurunkan display status.
// Perbandingan string ISO leksikografis setara perbandingan tanggal, jadi tak perlu objek Date.
export function serverToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// Turunkan display status dari tanggal terhadap hari ini (Req 16.5): soon bila hari ini < startsOn,
// ongoing bila startsOn <= hari ini <= endsOn (inklusif), done bila hari ini > endsOn. Ini derivasi
// presentasi pada baris yang SUDAH tersaring server-side — bukan filter seluruh tabel di browser.
// Tanggal kini opsional — event tanpa tanggal berstatus 'unscheduled' (belum dijadwalkan), bukan
// dipaksa ke salah satu kategori.
export function deriveDisplayStatus(
  startsOn: string | null,
  endsOn: string | null,
  today: string,
): EventDisplayStatus {
  if (!startsOn || !endsOn) return 'unscheduled'
  if (today < startsOn) return 'soon'
  if (today > endsOn) return 'done'
  return 'ongoing'
}
