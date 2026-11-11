import 'server-only'

// CRUD dan pencarian satu event pada tabel `events` (+ pencatatan pembatalan + pemeriksaan
// referensi). Bagian dari repository slice event — lihat `./index.ts` untuk batas publiknya.
// `import 'server-only'` sebagai import efektif pertama adalah sabuk pengaman build-time — kunci
// service-role tidak boleh pernah ikut ke bundle browser (Req 3.2, 20.2). Setiap query menyaring
// `workspace_id` dari konteks `withWorkspace()` (single-tenant via `slug = 'default'`, Req 5.4).

import { withWorkspace } from '@/lib/server/db'
import type { EventDisplayStatus, EventInput, EventLifecycle } from '@/domain/event/types'
import type { EventReferenceContext } from '@/domain/event/validation'
import {
  deriveDisplayStatus,
  firstRelation,
  serverToday,
  EVENT_WITH_RELATIONS,
  type EventJoinedRow,
} from './shared'

// Baris `events` dengan kolom di-camelCase-kan — batas publik repository untuk use-case yang perlu
// baris mentah (bukan bentuk daftar yang sudah di-join/di-agregat). Bentuknya mencerminkan kolom
// nyata tabel `events` pada migrasi 20261101020000; tanpa `payload` jsonb (skema ternormalisasi).
export type EventRow = {
  id: string
  workspaceId: string
  name: string
  alias: string | null
  venueId: string | null
  eventOrganizerId: string | null
  picId: string | null
  startsOn: string | null
  endsOn: string | null
  moveInOn: string | null
  moveOutOn: string | null
  status: EventLifecycle
  createdById: string
  createdAt: string
  updatedAt: string
}

// Ringkasan satu event untuk EventCard: nama master data sudah di-resolve lewat join agar kartu
// tidak perlu query ulang per referensi. `displayStatus` diturunkan dari tanggal (Req 16.5).
export type EventSummary = {
  id: string
  name: string
  alias: string | null
  venueId: string | null
  venueName: string
  eventOrganizerName: string
  picName: string
  startsOn: string | null
  endsOn: string | null
  moveInOn: string | null
  moveOutOn: string | null
  lifecycle: EventLifecycle
  displayStatus: EventDisplayStatus
}

// Kolom tabel `events` yang diambil — eksplisit agar tidak menarik lebih dari yang dibutuhkan dan
// agar perubahan skema terlihat jelas di diff.
const EVENT_COLUMNS =
  'id, workspace_id, name, alias, venue_id, event_organizer_id, pic_id, starts_on, ends_on, move_in_on, move_out_on, status, created_by_id, created_at, updated_at'

// Bentuk baris mentah dari Postgres (snake_case apa adanya). Dipakai internal untuk memetakan ke
// `EventRow` camelCase.
type EventDbRow = {
  id: string
  workspace_id: string
  name: string
  alias: string | null
  venue_id: string | null
  event_organizer_id: string | null
  pic_id: string | null
  starts_on: string | null
  ends_on: string | null
  move_in_on: string | null
  move_out_on: string | null
  status: EventLifecycle
  created_by_id: string
  created_at: string
  updated_at: string
}

// Petakan baris DB snake_case → `EventRow` camelCase. Satu tempat agar bentuk konversi konsisten.
function toEventRow(row: EventDbRow): EventRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    alias: row.alias,
    venueId: row.venue_id,
    eventOrganizerId: row.event_organizer_id,
    picId: row.pic_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    moveInOn: row.move_in_on,
    moveOutOn: row.move_out_on,
    status: row.status,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Sisipkan event baru dan kembalikan baris yang tersimpan (dengan id/timestamp dari DB). Alias
 * dipersist apa adanya dari input (normalisasi trim/null sudah dilakukan skema Zod di batas API).
 * `status` awal diserahkan ke default kolom DB ('ACTIVE'); `created_by_id` dipasok use-case.
 */
export async function insertEvent(
  input: EventInput,
  createdById: string,
): Promise<EventRow> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('events')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      alias: input.alias,
      venue_id: input.venueId,
      event_organizer_id: input.eventOrganizerId,
      pic_id: input.picId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      move_in_on: input.moveInOn,
      move_out_on: input.moveOutOn,
      created_by_id: createdById,
    })
    .select(EVENT_COLUMNS)
    .single<EventDbRow>()

  // Kegagalan tulis adalah kegagalan Supabase nyata, bukan kasus "tidak ditemukan" — lempar agar
  // `toErrorResponse` memetakannya ke 503.
  if (error || !data) {
    throw new Error(`Gagal menyimpan event: ${error?.message ?? 'tidak ada data'}`)
  }
  return toEventRow(data)
}

/**
 * Perbarui event dalam workspace. Mengembalikan baris terbaru, atau null bila event tidak ada
 * (bukan error — use-case menerjemahkannya ke 404). `updated_at` disetel eksplisit ke sekarang.
 * Alias dipersist apa adanya dari input ter-normalisasi.
 */
export async function updateEvent(id: string, input: EventInput): Promise<EventRow | null> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('events')
    .update({
      name: input.name,
      alias: input.alias,
      venue_id: input.venueId,
      event_organizer_id: input.eventOrganizerId,
      pic_id: input.picId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      move_in_on: input.moveInOn,
      move_out_on: input.moveOutOn,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select(EVENT_COLUMNS)
    .maybeSingle<EventDbRow>()

  if (error) {
    throw new Error(`Gagal memperbarui event: ${error.message}`)
  }
  // Tidak ada baris cocok → event tidak ditemukan di workspace ini.
  if (!data) return null
  return toEventRow(data)
}

/**
 * Transisikan HANYA kolom `status` event (lifecycle) dalam workspace, menyetel ulang `updated_at`.
 * Dipakai use-case cancel (→ CANCELLED) dan archive (→ ARCHIVED): keduanya mengubah lifecycle tanpa
 * menyentuh field data lain, jadi satu setter sempit lebih aman daripada `updateEvent` penuh.
 * Mengembalikan baris terbaru, atau null bila event tidak ada (race: terhapus di antara load dan
 * transisi) — bukan error; use-case menerjemahkannya ke 404. Keputusan BOLEH/tidaknya transisi
 * (guard PIC/penerima akses/admin, pencatatan cancellation) tetap milik use-case; repository hanya menulis.
 */
export async function setEventStatus(
  id: string,
  status: EventLifecycle,
): Promise<EventRow | null> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select(EVENT_COLUMNS)
    .maybeSingle<EventDbRow>()

  if (error) {
    throw new Error(`Gagal mengubah status event: ${error.message}`)
  }
  if (!data) return null
  return toEventRow(data)
}

/**
 * Cari satu event mentah berdasarkan id dalam workspace. Mengembalikan null bila tidak ditemukan
 * (bukan error). Dipakai use-case update/cancel/delete untuk memeriksa keberadaan + mengambil
 * `pic_id` bagi guard per-objek.
 */
export async function findEventById(id: string): Promise<EventRow | null> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle<EventDbRow>()

  if (error) {
    throw new Error(`Gagal memuat event: ${error.message}`)
  }
  if (!data) return null
  return toEventRow(data)
}

/**
 * Ambil ringkasan event untuk EventCard: nama master data sudah di-resolve lewat join agar kartu
 * tidak query ulang. Mengembalikan null bila event tidak ditemukan. `displayStatus` diturunkan dari
 * tanggal terhadap hari ini (Req 16.5).
 */
export async function findEventSummary(id: string): Promise<EventSummary | null> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('events')
    .select(EVENT_WITH_RELATIONS)
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle<EventJoinedRow>()

  if (error) {
    throw new Error(`Gagal memuat ringkasan event: ${error.message}`)
  }
  if (!data) return null

  const today = serverToday()
  return {
    id: data.id,
    name: data.name,
    alias: data.alias,
    venueId: data.venue_id,
    venueName: firstRelation(data.venue)?.legal_name ?? '',
    eventOrganizerName: firstRelation(data.organizer)?.legal_name ?? '',
    picName: firstRelation(data.pic)?.full_name ?? '',
    startsOn: data.starts_on,
    endsOn: data.ends_on,
    moveInOn: data.move_in_on,
    moveOutOn: data.move_out_on,
    lifecycle: data.status,
    displayStatus: deriveDisplayStatus(data.starts_on, data.ends_on, today),
  }
}

/**
 * Hapus event dalam workspace. Mengembalikan true bila sebuah baris terhapus, false bila tidak ada
 * yang cocok (event sudah tidak ada). Keputusan boleh/tidaknya hapus (guard PIC/penerima akses/admin,
 * pengecekan data turunan) adalah urusan use-case — repository hanya mengeksekusi.
 */
export async function deleteEvent(id: string): Promise<boolean> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('events')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .select('id')

  if (error) {
    throw new Error(`Gagal menghapus event: ${error.message}`)
  }
  // Panjang > 0 berarti ada baris terhapus; array kosong berarti tidak ada yang cocok.
  return Array.isArray(data) && data.length > 0
}

// Argumen pembuatan baris cancellation — nilai sudah tervalidasi di use-case/Zod.
export type CancellationInput = {
  eventId: string
  reason: string
  cancelledById: string
}

/**
 * Sisipkan satu baris `event_cancellations` untuk event yang dibatalkan. Transisi status event ke
 * CANCELLED dilakukan terpisah oleh use-case; di sini hanya pencatatan fakta pembatalan. Kolom
 * `event_id` UNIQUE menjaga bijection CANCELLED↔cancellation di level DB (Req 13.5).
 */
export async function insertCancellation(input: CancellationInput): Promise<void> {
  const { client, workspaceId } = await withWorkspace()

  const { error } = await client.from('event_cancellations').insert({
    workspace_id: workspaceId,
    event_id: input.eventId,
    reason: input.reason,
    cancelled_by_id: input.cancelledById,
  })

  if (error) {
    throw new Error(`Gagal mencatat pembatalan event: ${error.message}`)
  }
}

/**
 * Cek keberadaan referensi (venue, event organizer, PIC) dalam workspace, mengembalikan bentuk
 * `EventReferenceContext` yang dikonsumsi validator murni `validateEventReferences`. Repository
 * hanya MENYUPLAI boolean eksistensi; keputusan valid/tidak milik domain (Req 10.6 / 12.4). Tiga
 * cek count dijalankan paralel; `head: true` tidak menarik baris, hanya menghitung.
 */
export async function checkReferences(input: EventInput): Promise<EventReferenceContext> {
  const { client, workspaceId } = await withWorkspace()

  const existsIn = async (table: string, id: string): Promise<boolean> => {
    const { count, error } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
    if (error) {
      throw new Error(`Gagal memeriksa referensi ${table}: ${error.message}`)
    }
    return (count ?? 0) > 0
  }

  // app_users tidak punya kolom workspace_id — keanggotaan lewat workspace_members (pola
  // features/auth/repository, sumber yang sama dengan daftar PIC di form). Mengembalikan peran
  // anggota, atau null bila bukan anggota workspace.
  const memberRole = async (userId: string): Promise<string | null> => {
    const { data, error } = await client
      .from('app_users')
      .select('role, workspace_members!inner(workspace_id)')
      .eq('id', userId)
      .eq('workspace_members.workspace_id', workspaceId)
      .maybeSingle<{ role: string }>()
    if (error) {
      throw new Error(`Gagal memeriksa referensi app_users: ${error.message}`)
    }
    return data ? data.role : null
  }

  // Referensi kini opsional: yang kosong dianggap valid (tak ada yang perlu diperiksa).
  const [venueExists, eventOrganizerExists, picRole] = await Promise.all([
    input.venueId ? existsIn('venues', input.venueId) : Promise.resolve(true),
    input.eventOrganizerId
      ? existsIn('event_organizers', input.eventOrganizerId)
      : Promise.resolve(true),
    input.picId ? memberRole(input.picId) : Promise.resolve('CS'),
  ])

  return {
    venueExists,
    eventOrganizerExists,
    picExists: picRole !== null,
    picIsCs: picRole === 'CS' || picRole === null,
  }
}

/**
 * Apakah event punya data turunan yang menghalangi penghapusan keras (Req 14.3)? Job dan exhibitor
 * ber-FK `on delete restrict` ke event, jadi tanpa pengecekan ini penghapusan gagal dengan error
 * FK mentah alih-alih 409 yang jelas. Disaring `workspace_id` + `event_id`.
 */
export async function hasDerivedData(eventId: string): Promise<boolean> {
  const { client, workspaceId } = await withWorkspace()
  const counts = await Promise.all(
    (['jobs', 'exhibitors'] as const).map(async (table) => {
      const { count, error } = await client
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('event_id', eventId)
      if (error) {
        throw new Error(`Gagal memeriksa data turunan event: ${error.message}`)
      }
      return count ?? 0
    }),
  )
  return counts.some((count) => count > 0)
}
