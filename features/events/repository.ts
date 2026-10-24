import 'server-only'

// Mengapa: repository ini adalah SATU-SATUNYA pemilik query Postgres untuk slice event. Use-case
// dan komponen memanggilnya; ia tidak memegang aturan bisnis (murni I/O). `import 'server-only'`
// sebagai import efektif pertama adalah sabuk pengaman build-time — kunci service-role tidak boleh
// pernah ikut ke bundle browser (Req 3.2, 20.2). Setiap query menyaring `workspace_id` dari konteks
// `withWorkspace()` (single-tenant via `slug = 'default'`, Req 5.4). Mengikuti gaya
// `features/auth/repository.ts`: daftar kolom eksplisit, baris snake_case dipetakan ke camelCase,
// fungsi mengambil konteks via `withWorkspace()` sendiri dan hanya menerima argumen domain.

import { withWorkspace } from '@/lib/server/db'
import type {
  EventDisplayStatus,
  EventInput,
  EventLifecycle,
  EventListAttention,
  EventListItem,
  EventListPage,
  EventListQuery,
  EventListSummary,
  EventOrganizerInput,
  EventOrganizerRecord,
  EventScheduleOverlap,
  EventVenueConflict,
  VenueInput,
  VenueRecord,
} from '@/domain/event/types'
import type { EventReferenceContext } from '@/domain/event/validation'

// Baris `events` dengan kolom di-camelCase-kan — batas publik repository untuk use-case yang perlu
// baris mentah (bukan bentuk daftar yang sudah di-join/di-agregat). Bentuknya mencerminkan kolom
// nyata tabel `events` pada migrasi 20261101020000; tanpa `payload` jsonb (skema ternormalisasi).
export type EventRow = {
  id: string
  workspaceId: string
  name: string
  alias: string | null
  venueId: string
  eventOrganizerId: string
  picId: string
  startsOn: string
  endsOn: string
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
  venueName: string
  eventOrganizerName: string
  picName: string
  startsOn: string
  endsOn: string
  lifecycle: EventLifecycle
  displayStatus: EventDisplayStatus
}

// Kolom tabel `events` yang diambil — eksplisit agar tidak menarik lebih dari yang dibutuhkan dan
// agar perubahan skema terlihat jelas di diff.
const EVENT_COLUMNS =
  'id, workspace_id, name, alias, venue_id, event_organizer_id, pic_id, starts_on, ends_on, status, created_by_id, created_at, updated_at'

// Select bentuk daftar/ringkasan: kolom event + nama master data lewat foreign-table select.
// `!inner` memastikan baris tanpa relasi valid tidak muncul (FK NOT NULL menjamin selalu ada).
// Embed `pic` WAJIB menyebut FK secara eksplisit (`events_pic_id_fkey`): sejak redesign, `events`
// punya DUA FK ke `app_users` (pic_id + created_by_id) — tanpa hint, PostgREST menolak dengan
// PGRST201 (relasi ambigu) dan seluruh halaman /events gagal memuat.
const EVENT_WITH_RELATIONS =
  'id, name, alias, starts_on, ends_on, status, venue:venues!inner(legal_name), organizer:event_organizers!inner(legal_name), pic:app_users!events_pic_id_fkey!inner(full_name)'

// Bentuk baris mentah dari Postgres (snake_case apa adanya). Dipakai internal untuk memetakan ke
// `EventRow` camelCase.
type EventDbRow = {
  id: string
  workspace_id: string
  name: string
  alias: string | null
  venue_id: string
  event_organizer_id: string
  pic_id: string
  starts_on: string
  ends_on: string
  status: EventLifecycle
  created_by_id: string
  created_at: string
  updated_at: string
}

// Bentuk baris join untuk daftar/ringkasan. Supabase mengembalikan relasi foreign-table sebagai
// objek (one-to-one lewat FK), tetapi tipenya kadang dilebarkan menjadi array oleh generator —
// kita menerima keduanya dan mengambil elemen pertama secara defensif.
type EventJoinedRow = {
  id: string
  name: string
  alias: string | null
  starts_on: string
  ends_on: string
  status: EventLifecycle
  venue: { legal_name: string } | { legal_name: string }[] | null
  organizer: { legal_name: string } | { legal_name: string }[] | null
  pic: { full_name: string } | { full_name: string }[] | null
}

// Ambil satu objek relasi dari bentuk objek-atau-array yang dikembalikan Supabase.
function firstRelation<T>(relation: T | T[] | null): T | null {
  if (relation == null) return null
  return Array.isArray(relation) ? (relation[0] ?? null) : relation
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
    status: row.status,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Tanggal "hari ini" sisi-server sebagai YYYY-MM-DD. Dipakai untuk menurunkan display status.
// Perbandingan string ISO leksikografis setara perbandingan tanggal, jadi tak perlu objek Date.
function serverToday(): string {
  return new Date().toISOString().slice(0, 10)
}

// Turunkan display status dari tanggal terhadap hari ini (Req 16.5): soon bila hari ini < startsOn,
// ongoing bila startsOn <= hari ini <= endsOn (inklusif), done bila hari ini > endsOn. Ini derivasi
// presentasi pada baris yang SUDAH tersaring server-side — bukan filter seluruh tabel di browser.
function deriveDisplayStatus(startsOn: string, endsOn: string, today: string): EventDisplayStatus {
  if (today < startsOn) return 'soon'
  if (today > endsOn) return 'done'
  return 'ongoing'
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
 * (guard PIC/SUPERVISOR, pencatatan cancellation) tetap milik use-case; repository hanya menulis.
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
    venueName: firstRelation(data.venue)?.legal_name ?? '',
    eventOrganizerName: firstRelation(data.organizer)?.legal_name ?? '',
    picName: firstRelation(data.pic)?.full_name ?? '',
    startsOn: data.starts_on,
    endsOn: data.ends_on,
    lifecycle: data.status,
    displayStatus: deriveDisplayStatus(data.starts_on, data.ends_on, today),
  }
}

/**
 * Hapus event dalam workspace. Mengembalikan true bila sebuah baris terhapus, false bila tidak ada
 * yang cocok (event sudah tidak ada). Keputusan boleh/tidaknya hapus (guard PIC/SUPERVISOR,
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
  // features/auth/repository, sumber yang sama dengan daftar PIC di form).
  const memberExists = async (userId: string): Promise<boolean> => {
    const { count, error } = await client
      .from('app_users')
      .select('id, workspace_members!inner(workspace_id)', { count: 'exact', head: true })
      .eq('id', userId)
      .eq('workspace_members.workspace_id', workspaceId)
    if (error) {
      throw new Error(`Gagal memeriksa referensi app_users: ${error.message}`)
    }
    return (count ?? 0) > 0
  }

  const [venueExists, eventOrganizerExists, picExists] = await Promise.all([
    existsIn('venues', input.venueId),
    existsIn('event_organizers', input.eventOrganizerId),
    memberExists(input.picId),
  ])

  return { venueExists, eventOrganizerExists, picExists }
}

/**
 * Apakah event punya data turunan (exhibitor/CIPL) yang menghalangi penghapusan keras (Req 14.3)?
 *
 * PLACEHOLDER yang DISENGAJA: entitas hilir (exhibitors/cipl) BELUM ada tabelnya di slice ini —
 * "entitas hilir akan menggantung di bawah events pada spec domain berikutnya". Mengkueri tabel
 * yang belum ada akan memutus build/test. Jadi untuk sekarang selalu false (tidak ada data turunan
 * yang mungkin ada). Saat slice exhibitor/CIPL mendarat, ganti ini dengan count nyata ke tabel-tabel
 * tersebut, tetap disaring `workspace_id` + `event_id`.
 */
export async function hasDerivedData(_eventId: string): Promise<boolean> {
  return false
}

// Baris minimal untuk perhitungan attention (overlap jadwal + konflik venue). Hanya kolom yang
// dibutuhkan agar input komputasi pairwise tetap kecil.
type AttentionRow = {
  id: string
  name: string
  venue_id: string
  starts_on: string
  ends_on: string
  venue: { legal_name: string } | { legal_name: string }[] | null
}

// Dua rentang tanggal inklusif beririsan bila masing-masing mulai tidak setelah akhir yang lain.
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

// Hitung overlap jadwal dan konflik venue dari kumpulan event AKTIF yang sudah tersaring server-side
// ke workspace ini. Pairwise overlap bersifat O(n^2) dan tidak bisa diekspresikan sebagai filter
// SQL sederhana; karena itu komputasi dilakukan di JS DI ATAS hasil yang sudah dibatasi server
// (hanya event ACTIVE workspace ini), bukan dengan membaca seluruh tabel lalu memfilter di browser.
// Ini membentuk panel turunan (Attention_Panel), bukan memfilter daftar.
function computeAttention(rows: AttentionRow[]): EventListAttention {
  const scheduleOverlaps: EventScheduleOverlap[] = []
  const venueConflicts: EventVenueConflict[] = []

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]
      const b = rows[j]
      if (!rangesOverlap(a.starts_on, a.ends_on, b.starts_on, b.ends_on)) continue

      // Rentang beririsan → overlap jadwal.
      scheduleOverlaps.push({
        firstEventId: a.id,
        firstEventName: a.name,
        secondEventId: b.id,
        secondEventName: b.name,
      })

      // Venue sama pada rentang beririsan → konflik venue (sub-kasus overlap jadwal).
      if (a.venue_id === b.venue_id) {
        venueConflicts.push({
          venueId: a.venue_id,
          venueName: firstRelation(a.venue)?.legal_name ?? '',
          firstEventId: a.id,
          firstEventName: a.name,
          secondEventId: b.id,
          secondEventName: b.name,
        })
      }
    }
  }

  return { scheduleOverlaps, venueConflicts }
}

/**
 * Daftar event untuk dashboard dengan filter SEPENUHNYA sisi-server (Req 16.1–16.7): join
 * venue/EO/PIC, pencarian substring `ilike`, filter lifecycle, filter display-status diterjemahkan
 * ke predikat tanggal terhadap hari ini, agregat ringkasan lewat count query, dan panel attention.
 * Tidak pernah membaca seluruh tabel ke memori lalu memfilter di browser.
 */
export async function queryEventList(q: EventListQuery): Promise<EventListPage> {
  const { client, workspaceId } = await withWorkspace()
  const today = serverToday()

  // ── Daftar baris tersaring ────────────────────────────────────────────────────────────────
  let listQuery = client
    .from('events')
    .select(EVENT_WITH_RELATIONS)
    .eq('workspace_id', workspaceId)

  // Pencarian substring (Req 16.2/16.3): `ilike` pada name/alias di tabel dasar DAN pada nama legal
  // venue/EO + full_name PIC di foreign table. Supabase `.or()` tidak menjangkau kolom foreign-table
  // dalam satu ekspresi; jadi name/alias digabung dalam satu `.or` di tabel dasar, sementara
  // kolom foreign-table disaring lewat `referencedTable` masing-masing. Semua tetap sisi-server.
  const search = (q.search ?? '').trim()
  if (search.length > 0) {
    const pattern = `%${search}%`
    listQuery = listQuery.or(`name.ilike.${pattern},alias.ilike.${pattern}`)
    // Catatan: filter foreign-table berikut mem-batasi baris bila disetel; karena `!inner`,
    // predikat ini menyaring server-side pada kolom relasi. Digabung agar pencarian menjangkau
    // kelima field yang disyaratkan tanpa menarik seluruh tabel.
    listQuery = listQuery
      .or(`legal_name.ilike.${pattern}`, { referencedTable: 'venue' })
      .or(`legal_name.ilike.${pattern}`, { referencedTable: 'organizer' })
      .or(`full_name.ilike.${pattern}`, { referencedTable: 'pic' })
  }

  // Filter lifecycle administratif (Req 16.4) bila disetel.
  if (q.lifecycle) {
    listQuery = listQuery.eq('status', q.lifecycle)
  }

  // Filter display-status (Req 16.4/16.5) diterjemahkan ke predikat tanggal terhadap hari ini —
  // dibandingkan di SQL, bukan di browser:
  //   soon    → starts_on > today
  //   ongoing → starts_on <= today AND ends_on >= today
  //   done    → ends_on < today
  if (q.displayStatus === 'soon') {
    listQuery = listQuery.gt('starts_on', today)
  } else if (q.displayStatus === 'ongoing') {
    listQuery = listQuery.lte('starts_on', today).gte('ends_on', today)
  } else if (q.displayStatus === 'done') {
    listQuery = listQuery.lt('ends_on', today)
  }

  listQuery = listQuery.order('starts_on', { ascending: false })

  const { data: listData, error: listError } = await listQuery.returns<EventJoinedRow[]>()
  if (listError) {
    throw new Error(`Gagal memuat daftar event: ${listError.message}`)
  }

  const items: EventListItem[] = (listData ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    alias: row.alias,
    venueName: firstRelation(row.venue)?.legal_name ?? '',
    eventOrganizerName: firstRelation(row.organizer)?.legal_name ?? '',
    picName: firstRelation(row.pic)?.full_name ?? '',
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    lifecycle: row.status,
    // Derivasi presentasi pada baris yang SUDAH tersaring server-side (bukan filter seluruh tabel).
    displayStatus: deriveDisplayStatus(row.starts_on, row.ends_on, today),
  }))

  // ── Agregat ringkasan (Req 16.1) ─────────────────────────────────────────────────────────────
  // Count query dengan `head: true` — hanya menghitung, tidak menarik baris ke memori.
  const summary = await queryEventSummary(client, workspaceId, today)

  // ── Attention (Req 16.6) ─────────────────────────────────────────────────────────────────────
  const attention = await queryEventAttention(client, workspaceId)

  return { items, summary, attention }
}

// Hitung agregat ringkasan lewat count query tanpa menarik baris. exhibitors/ciplItems = 0 karena
// tabel entitas hilir belum ada di slice ini ("entitas hilir akan menggantung di bawah events pada
// spec domain berikutnya") — mengkueri tabel yang belum ada akan memutus build.
async function queryEventSummary(
  client: Awaited<ReturnType<typeof withWorkspace>>['client'],
  workspaceId: string,
  today: string,
): Promise<EventListSummary> {
  const { count: totalCount, error: totalError } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (totalError) {
    throw new Error(`Gagal menghitung total event: ${totalError.message}`)
  }

  // "Ongoing" = sedang berlangsung hari ini DAN masih aktif administratif.
  const { count: ongoingCount, error: ongoingError } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'ACTIVE')
    .lte('starts_on', today)
    .gte('ends_on', today)
  if (ongoingError) {
    throw new Error(`Gagal menghitung event berjalan: ${ongoingError.message}`)
  }

  return {
    totalEvents: totalCount ?? 0,
    ongoingEvents: ongoingCount ?? 0,
    // Placeholder sampai slice exhibitor/CIPL mendarat (lihat hasDerivedData).
    totalExhibitors: 0,
    totalCiplItems: 0,
  }
}

// Ambil kumpulan event ACTIVE (kolom minimal) sisi-server, lalu hitung overlap/konflik di JS. Input
// sudah dibatasi server ke event aktif workspace ini — bukan membaca seluruh tabel lalu memfilter.
async function queryEventAttention(
  client: Awaited<ReturnType<typeof withWorkspace>>['client'],
  workspaceId: string,
): Promise<EventListAttention> {
  const { data, error } = await client
    .from('events')
    .select('id, name, venue_id, starts_on, ends_on, venue:venues!inner(legal_name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'ACTIVE')
    .returns<AttentionRow[]>()
  if (error) {
    throw new Error(`Gagal memuat data perhatian event: ${error.message}`)
  }
  return computeAttention(data ?? [])
}

/**
 * Baris event dalam bentuk legacy (snake_case + embed venues/event_organizers/
 * event_cancellations/exhibitors) untuk klien lama lewat GET /api/events — halaman
 * detail event dan detail CIPL masih memetakannya via `eventFromRow`/`exhibitorFromRow`
 * di lib/data-client sampai keduanya pindah ke bentuk features.
 */
export async function listLegacyEventRows(): Promise<Record<string, unknown>[]> {
  const { client, workspaceId } = await withWorkspace()

  // exhibitors TIDAK bisa di-embed: tabel legacy ini tidak punya FK ke events,
  // jadi diambil terpisah lalu dijahit per event_id (pola /api/jobs).
  const [eventsResult, exhibitorsResult] = await Promise.all([
    client
      .from('events')
      .select(
        'id, name, alias, venue_id, event_organizer_id, pic_id, starts_on, ends_on, status, created_at, created_by_id, updated_at, ' +
          'venues(id, legal_name, alias_name, city, created_at, updated_at), ' +
          'event_organizers(id, legal_name, created_at, updated_at), ' +
          'event_cancellations(event_id, reason, cancelled_at, cancelled_by_id)',
      )
      .eq('workspace_id', workspaceId)
      .order('starts_on')
      .returns<Record<string, unknown>[]>(),
    client
      .from('exhibitors')
      .select('id, event_id, name, kind, contact, agent_id, npwp, created_at, created_by_id, updated_at')
      .eq('workspace_id', workspaceId)
      .order('name')
      .returns<Record<string, unknown>[]>(),
  ])

  if (eventsResult.error) {
    throw new Error(`Gagal memuat event: ${eventsResult.error.message}`)
  }
  if (exhibitorsResult.error) {
    throw new Error(`Gagal memuat exhibitor: ${exhibitorsResult.error.message}`)
  }

  const exhibitorsByEvent = new Map<string, Record<string, unknown>[]>()
  for (const exhibitor of exhibitorsResult.data ?? []) {
    const key = String(exhibitor.event_id)
    const bucket = exhibitorsByEvent.get(key)
    if (bucket) bucket.push(exhibitor)
    else exhibitorsByEvent.set(key, [exhibitor])
  }
  return (eventsResult.data ?? []).map((row) => ({
    ...row,
    exhibitors: exhibitorsByEvent.get(String(row.id)) ?? [],
  }))
}

// ── Master data venue/EO (create-inline + select existing) ────────────────────────────────────
// Mengapa di sini: repository tetap SATU-SATUNYA pemilik query Postgres untuk slice event, termasuk
// master data yang dirujuk event (Req 12.2/12.3). Event menyimpan FK id ke baris ini, bukan nilai
// yang digandakan. Daftar kolom eksplisit + pemetaan snake→camel + filter `workspace_id` mengikuti
// gaya fungsi event di atas.

const VENUE_COLUMNS = 'id, legal_name, alias_name, city'
const EVENT_ORGANIZER_COLUMNS = 'id, legal_name'

// Bentuk baris mentah (snake_case) untuk master data.
type VenueDbRow = { id: string; legal_name: string; alias_name: string | null; city: string | null }
type EventOrganizerDbRow = { id: string; legal_name: string }

function toVenueRecord(row: VenueDbRow): VenueRecord {
  return { id: row.id, legalName: row.legal_name, aliasName: row.alias_name, city: row.city }
}

function toEventOrganizerRecord(row: EventOrganizerDbRow): EventOrganizerRecord {
  return { id: row.id, legalName: row.legal_name }
}

/**
 * Sisipkan venue baru (create-inline) dan kembalikan baris tersimpan dengan id dari DB — id inilah
 * yang kemudian dirujuk event lewat FK (Req 12.2/12.3). Nilai sudah ter-trim/null oleh skema Zod di
 * batas API. Kegagalan tulis = kegagalan Supabase nyata → lempar agar dipetakan ke 503.
 */
export async function insertVenue(input: VenueInput): Promise<VenueRecord> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('venues')
    .insert({
      workspace_id: workspaceId,
      legal_name: input.legalName,
      alias_name: input.aliasName,
      city: input.city,
    })
    .select(VENUE_COLUMNS)
    .single<VenueDbRow>()

  if (error || !data) {
    throw new Error(`Gagal menyimpan venue: ${error?.message ?? 'tidak ada data'}`)
  }
  return toVenueRecord(data)
}

/**
 * Sisipkan event organizer baru (create-inline) dan kembalikan baris tersimpan dengan id dari DB.
 * Event merujuk id ini lewat FK, bukan menggandakan nama (Req 12.2/12.3).
 */
export async function insertEventOrganizer(
  input: EventOrganizerInput,
): Promise<EventOrganizerRecord> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('event_organizers')
    .insert({ workspace_id: workspaceId, legal_name: input.legalName })
    .select(EVENT_ORGANIZER_COLUMNS)
    .single<EventOrganizerDbRow>()

  if (error || !data) {
    throw new Error(`Gagal menyimpan event organizer: ${error?.message ?? 'tidak ada data'}`)
  }
  return toEventOrganizerRecord(data)
}

/**
 * Daftar venue dalam workspace untuk memilih yang SUDAH ADA (Req 12.1), diurut berdasarkan nama
 * agar pemilihan di UI stabil. Hanya baris workspace aktif (filter `workspace_id`).
 */
export async function listVenues(): Promise<VenueRecord[]> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('venues')
    .select(VENUE_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('legal_name', { ascending: true })
    .returns<VenueDbRow[]>()

  if (error) {
    throw new Error(`Gagal memuat daftar venue: ${error.message}`)
  }
  return (data ?? []).map(toVenueRecord)
}

/**
 * Daftar event organizer dalam workspace untuk memilih yang SUDAH ADA (Req 12.1), diurut nama.
 */
export async function listEventOrganizers(): Promise<EventOrganizerRecord[]> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('event_organizers')
    .select(EVENT_ORGANIZER_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('legal_name', { ascending: true })
    .returns<EventOrganizerDbRow[]>()

  if (error) {
    throw new Error(`Gagal memuat daftar event organizer: ${error.message}`)
  }
  return (data ?? []).map(toEventOrganizerRecord)
}
