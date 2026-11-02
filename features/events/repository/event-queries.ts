import 'server-only'

// Query bentuk daftar/agregat untuk halaman events: daftar tersaring sisi-server, ringkasan count,
// panel attention (overlap jadwal + konflik venue), insight operasional, dan bentuk legacy untuk
// klien lama. Bagian dari repository slice event — lihat `./index.ts` untuk batas publiknya.

import { withWorkspace } from '@/lib/server/db'
import {
  eventTuntas,
  hitungJobBelumTuntas,
  type TuntasJobShape,
} from '@/domain/event/tuntas'
import type {
  EventInsightItem,
  EventInsights,
  EventListAttention,
  EventListItem,
  EventListPage,
  EventListQuery,
  EventListSummary,
  EventNameCount,
  EventScheduleOverlap,
  EventVenueConflict,
} from '@/domain/event/types'
import {
  deriveDisplayStatus,
  firstRelation,
  serverToday,
  EVENT_WITH_RELATIONS,
  type EventJoinedRow,
} from './shared'

// Baris minimal untuk perhitungan attention (overlap jadwal + konflik venue). Hanya kolom yang
// dibutuhkan agar input komputasi pairwise tetap kecil.
type AttentionRow = {
  id: string
  name: string
  venue_id: string | null
  starts_on: string | null
  ends_on: string | null
  venue: { legal_name: string } | { legal_name: string }[] | null
}

// Dua rentang tanggal inklusif beririsan bila masing-masing mulai tidak setelah akhir yang lain.
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

// Tanggal ISO + N hari, tanpa objek Date zona-lokal (aritmetika UTC pada tanggal-saja).
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
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
      // Event tanpa tanggal (belum dijadwalkan) tidak bisa beririsan dengan apa pun.
      if (!a.starts_on || !a.ends_on || !b.starts_on || !b.ends_on) continue
      if (!rangesOverlap(a.starts_on, a.ends_on, b.starts_on, b.ends_on)) continue

      // Rentang beririsan → overlap jadwal.
      scheduleOverlaps.push({
        firstEventId: a.id,
        firstEventName: a.name,
        secondEventId: b.id,
        secondEventName: b.name,
      })

      // Venue sama pada rentang beririsan → konflik venue (sub-kasus overlap jadwal). Dua event
      // sama-sama tanpa venue bukan konflik — konflik butuh venue yang sama.
      if (a.venue_id && a.venue_id === b.venue_id) {
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

// ── Insight operasional (panel "Perlu tindakan" + statistik) ─────────────────────────────────

// Muat payload `jobs` workspace dan kelompokkan per eventId — bahan rollup tuntas. Payload jsonb
// dibaca structural (TuntasJobShape): bentuk job lama dan baru sama-sama diterima; job tanpa
// eventId (job lama lepas) diabaikan.
async function fetchJobsGroupedByEvent(
  client: Awaited<ReturnType<typeof withWorkspace>>['client'],
  workspaceId: string,
): Promise<Map<string, TuntasJobShape[]>> {
  const { data, error } = await client
    .from('jobs')
    .select('payload')
    .eq('workspace_id', workspaceId)
    .returns<{ payload: (TuntasJobShape & { eventId?: string | null }) | null }[]>()

  if (error) {
    throw new Error(`Gagal memuat job untuk insight: ${error.message}`)
  }
  const grouped = new Map<string, TuntasJobShape[]>()
  for (const row of data ?? []) {
    const eventId = row?.payload?.eventId
    if (!eventId) continue
    const list = grouped.get(eventId) ?? []
    list.push(row.payload as TuntasJobShape)
    grouped.set(eventId, list)
  }
  return grouped
}

// Baris event ACTIVE + nama master data sebagai input komputasi insight.
type InsightRow = {
  id: string
  name: string
  starts_on: string | null
  ends_on: string | null
  venue_id: string | null
  event_organizer_id: string | null
  pic_id: string | null
  venue: { legal_name: string } | { legal_name: string }[] | null
  organizer: { legal_name: string } | { legal_name: string }[] | null
  pic: { full_name: string } | { full_name: string }[] | null
}

const INSIGHT_COLUMNS =
  'id, name, starts_on, ends_on, venue_id, event_organizer_id, pic_id, venue:venues(legal_name), organizer:event_organizers(legal_name), pic:app_users!events_pic_id_fkey(full_name)'

// Naikkan penghitung nama dalam Map ranking (beban PIC, EO, venue).
function bumpCount(map: Map<string, EventNameCount>, name: string): void {
  const current = map.get(name)
  if (current) current.count += 1
  else map.set(name, { name, count: 1 })
}

/**
 * Hitung seluruh insight dari baris event ACTIVE + himpunan eventId yang sudah punya job. Murni
 * (tanpa I/O) agar mudah diuji terpisah. Horizon: dueSoon = H+14, soonWithoutJob = H+30; keduanya
 * hanya menghitung event yang belum dimulai — yang sedang berjalan sudah terwakili ringkasan
 * "Berlangsung". Konflik venue dikelompokkan per venue dari gabungan pasangan yang beririsan.
 */
function computeInsights(
  rows: InsightRow[],
  jobsByEvent: Map<string, TuntasJobShape[]>,
  today: string,
): EventInsights {
  const horizon14 = addDays(today, 14)
  const horizon30 = addDays(today, 30)
  const jobEventIds = new Set(jobsByEvent.keys())

  const toItem = (row: InsightRow): EventInsightItem => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on ?? '',
    endsOn: row.ends_on ?? '',
    venueName: firstRelation(row.venue)?.legal_name ?? '',
  })

  const dueSoon: EventInsightItem[] = []
  const soonWithoutJob: EventInsightItem[] = []
  const unfinishedAfterShow: EventInsightItem[] = []
  const archivable: EventInsightItem[] = []
  const picCounts = new Map<string, EventNameCount>()
  const eoCounts = new Map<string, EventNameCount>()
  const venueCounts = new Map<string, EventNameCount>()
  const monthCounts = new Map<string, number>()

  for (const row of rows) {
    // Semua seksi berbasis tanggal hanya menghitung event yang sudah dijadwalkan.
    if (row.starts_on && row.starts_on >= today && row.starts_on <= horizon14) {
      dueSoon.push(toItem(row))
    }
    if (
      row.starts_on &&
      row.starts_on >= today &&
      row.starts_on <= horizon30 &&
      !jobEventIds.has(row.id)
    ) {
      soonWithoutJob.push(toItem(row))
    }
    if (row.ends_on && row.ends_on < today) {
      archivable.push(toItem(row))
      // Pameran sudah lewat namun masih ada job yang belum tuntas — pekerjaan menggantung.
      if (eventTuntas(jobsByEvent.get(row.id) ?? []) === 'BELUM_TUNTAS') {
        unfinishedAfterShow.push(toItem(row))
      }
    }
    bumpCount(picCounts, firstRelation(row.pic)?.full_name ?? 'Tanpa PIC')
    bumpCount(eoCounts, firstRelation(row.organizer)?.legal_name ?? 'Tanpa EO')
    bumpCount(venueCounts, firstRelation(row.venue)?.legal_name ?? 'Tanpa venue')
    if (row.starts_on) {
      const month = row.starts_on.slice(0, 7)
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
    }
  }

  let scheduleOverlapCount = 0
  const conflictsByVenue = new Map<
    string,
    { venueName: string; events: Map<string, EventInsightItem> }
  >()
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]
      const b = rows[j]
      // Event tanpa tanggal (belum dijadwalkan) tidak bisa beririsan dengan apa pun.
      if (!a.starts_on || !a.ends_on || !b.starts_on || !b.ends_on) continue
      if (!rangesOverlap(a.starts_on, a.ends_on, b.starts_on, b.ends_on)) continue
      scheduleOverlapCount += 1
      // Dua event sama-sama tanpa venue bukan konflik venue — konflik butuh venue yang sama.
      if (!a.venue_id || a.venue_id !== b.venue_id) continue
      let group = conflictsByVenue.get(a.venue_id)
      if (!group) {
        group = { venueName: firstRelation(a.venue)?.legal_name ?? '', events: new Map() }
        conflictsByVenue.set(a.venue_id, group)
      }
      group.events.set(a.id, toItem(a))
      group.events.set(b.id, toItem(b))
    }
  }

  const byStartsAsc = (a: EventInsightItem, b: EventInsightItem) =>
    a.startsOn.localeCompare(b.startsOn)
  dueSoon.sort(byStartsAsc)
  soonWithoutJob.sort(byStartsAsc)
  // Paling lama menggantung di atas — yang paling mendesak ditindak.
  unfinishedAfterShow.sort((a, b) => a.endsOn.localeCompare(b.endsOn))
  archivable.sort((a, b) => a.endsOn.localeCompare(b.endsOn))

  const ranked = (counts: Map<string, EventNameCount>) =>
    [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    dueSoon,
    soonWithoutJob,
    unfinishedAfterShow,
    venueConflicts: [...conflictsByVenue.values()].map((group) => ({
      venueName: group.venueName,
      events: [...group.events.values()].sort(byStartsAsc),
    })),
    scheduleOverlapCount,
    archivable,
    picLoad: ranked(picCounts),
    eoRanking: ranked(eoCounts).slice(0, 5),
    perMonth: [...monthCounts.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    venueRanking: ranked(venueCounts).slice(0, 5),
  }
}

/**
 * Seluruh insight operasional untuk halaman events. Dua query: (a) event ACTIVE + nama master data,
 * (b) payload `jobs` dikelompokkan per event untuk rollup tuntas (dokumen BC + kepulangan).
 */
export async function queryEventInsights(): Promise<EventInsights> {
  const { client, workspaceId } = await withWorkspace()
  const today = serverToday()

  const { data: rows, error: rowsError } = await client
    .from('events')
    .select(INSIGHT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('status', 'ACTIVE')
    .order('starts_on', { ascending: true })
    .returns<InsightRow[]>()
  if (rowsError) {
    throw new Error(`Gagal memuat event untuk insight: ${rowsError.message}`)
  }

  const jobsByEvent = await fetchJobsGroupedByEvent(client, workspaceId)
  return computeInsights(rows ?? [], jobsByEvent, today)
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

  // Pencarian substring (Req 16.2/16.3) menjangkau name/alias + nama venue/EO/PIC. PostgREST
  // gerbang ini MENOLAK kolom relasi di dalam logic tree `or` (PGRST100), sehingga pencarian
  // 5-field tak dapat menjadi satu ekspresi SQL; memfilter per-relasi ala `.or(...,
  // { referencedTable })` justru digabung AND (nama harus cocok di SEMUA relasi — pernah membuat
  // semua pencarian mengembalikan nol). Halaman ini tanpa paginasi: baris workspace memang sudah
  // dibaca utuh bersama relasinya, jadi pencarian dicocokkan case-insensitive di JS di bawah.
  const search = (q.search ?? '').trim()

  // Filter lifecycle administratif (Req 16.4) bila disetel.
  if (q.lifecycle) {
    listQuery = listQuery.eq('status', q.lifecycle)
  }

  // Filter PIC (dari control panel "PIC"): predikat sederhana pada FK pic_id.
  if (q.picId) {
    listQuery = listQuery.eq('pic_id', q.picId)
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

  listQuery = listQuery.order('starts_on', { ascending: false, nullsFirst: false })

  const { data: listData, error: listError } = await listQuery.returns<EventJoinedRow[]>()
  if (listError) {
    throw new Error(`Gagal memuat daftar event: ${listError.message}`)
  }

  const items: EventListItem[] = (listData ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    alias: row.alias,
    // Id referensi dibawa agar form edit bisa preselect venue/EO/PIC — tanpa ini pengguna
    // dipaksa mengisi ulang ketiga referensi meski hanya mengubah nama.
    venueId: row.venue_id,
    eventOrganizerId: row.event_organizer_id,
    picId: row.pic_id,
    venueName: firstRelation(row.venue)?.legal_name ?? '',
    eventOrganizerName: firstRelation(row.organizer)?.legal_name ?? '',
    picName: firstRelation(row.pic)?.full_name ?? '',
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    moveInOn: row.move_in_on,
    moveOutOn: row.move_out_on,
    lifecycle: row.status,
    // Derivasi presentasi pada baris yang SUDAH tersaring server-side (bukan filter seluruh tabel).
    displayStatus: deriveDisplayStatus(row.starts_on, row.ends_on, today),
    // Diisi setelah pencarian (lihat bawah).
    jobCount: 0,
    tuntasStatus: 'TANPA_JOB',
    unfinishedJobs: 0,
  }))

  // Pencarian 5-field di JS (lihat catatan di atas): salah-satu-cocok pada name/alias/venue/EO/PIC.
  const visibleItems =
    search.length > 0
      ? items.filter((item) => {
          const needle = search.toLowerCase()
          return [
            item.name,
            item.alias ?? '',
            item.venueName,
            item.eventOrganizerName,
            item.picName,
          ].some((value) => value.toLowerCase().includes(needle))
        })
      : items

  // Rollup tuntas per baris (badge "Belum tuntas" + peringatan arsip) — satu query jobs, digabung
  // di JS karena bentuknya jsonb lintas generasi.
  const jobsByEvent = await fetchJobsGroupedByEvent(client, workspaceId)
  for (const item of visibleItems) {
    const jobs = jobsByEvent.get(item.id) ?? []
    item.jobCount = jobs.length
    item.tuntasStatus = eventTuntas(jobs)
    item.unfinishedJobs = hitungJobBelumTuntas(jobs)
  }
  // ── Agregat ringkasan (Req 16.1) ─────────────────────────────────────────────────────────────
  // Count query dengan `head: true` — hanya menghitung, tidak menarik baris ke memori.
  const summary = await queryEventSummary(client, workspaceId, today)

  // ── Attention (Req 16.6) ─────────────────────────────────────────────────────────────────────
  const attention = await queryEventAttention(client, workspaceId)

  return { items: visibleItems, summary, attention }
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
