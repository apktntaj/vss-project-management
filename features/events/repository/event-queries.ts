import 'server-only'

// Query bentuk daftar untuk halaman events: daftar tersaring sisi-server, insight operasional,
// dan bentuk legacy untuk klien lama. Bagian dari repository slice event — lihat `./index.ts`
// untuk batas publiknya.

import { withWorkspace } from '@/lib/server/db'
import {
  eventTuntas,
  hitungJobBelumTuntas,
  type TuntasJobShape,
} from '@/domain/event/tuntas'
import type {
  EventInsights,
  EventListItem,
  EventListPage,
  EventListQuery,
  EventNameCount,
  EventScheduleRef,
} from '@/domain/event/types'
import {
  deriveDisplayStatus,
  firstRelation,
  serverToday,
  EVENT_WITH_RELATIONS,
  type EventJoinedRow,
} from './shared'


// ── Insight operasional (panel "Perlu tindakan" + statistik) ─────────────────────────────────

// Muat kolom job yang dibutuhkan rollup tuntas dan kelompokkan per event. Hanya kolom yang
// dipakai `TuntasJobShape` yang diambil — bukan seluruh aggregate.
type TuntasJobRow = {
  event_id: string
  status: string
  kind: string
  international_jenis: string | null
  kepulangan: unknown
  operational: TuntasJobShape['operational']
}

async function fetchJobsGroupedByEvent(
  client: Awaited<ReturnType<typeof withWorkspace>>['client'],
  workspaceId: string,
): Promise<Map<string, TuntasJobShape[]>> {
  const { data, error } = await client
    .from('jobs')
    .select('event_id, status, kind, international_jenis, kepulangan, operational')
    .eq('workspace_id', workspaceId)
    .returns<TuntasJobRow[]>()

  if (error) {
    throw new Error(`Gagal memuat job untuk insight: ${error.message}`)
  }
  const grouped = new Map<string, TuntasJobShape[]>()
  for (const row of data ?? []) {
    const list = grouped.get(row.event_id) ?? []
    list.push({
      status: row.status,
      kind: row.kind,
      internationalJenis: row.international_jenis,
      kepulangan: row.kepulangan,
      operational: row.operational,
    })
    grouped.set(row.event_id, list)
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
  // Hall exhibitor event — sumber data hall untuk venue activity.
  exhibitors: { hall: string | null }[] | null
}

const INSIGHT_COLUMNS =
  'id, name, starts_on, ends_on, venue_id, event_organizer_id, pic_id, venue:venues(legal_name), organizer:event_organizers(legal_name), pic:app_users!events_pic_id_fkey(full_name), exhibitors(hall)'

// Naikkan penghitung nama dalam Map ranking (beban PIC, EO, venue).
function bumpCount(map: Map<string, EventNameCount>, name: string): void {
  const current = map.get(name)
  if (current) current.count += 1
  else map.set(name, { name, count: 1 })
}

/**
 * Hitung seluruh insight dari baris event ACTIVE. Murni (tanpa I/O) agar mudah diuji terpisah.
 * Kalender venue activity dihitung di dashboard dari `venueEvents` (tanggal mulai bisa diubah).
 */
function computeInsights(rows: InsightRow[]): EventInsights {
  const picCounts = new Map<string, EventNameCount>()
  const eoCounts = new Map<string, EventNameCount>()
  const venueCounts = new Map<string, EventNameCount>()
  const monthCounts = new Map<string, number>()
  for (const row of rows) {
    bumpCount(picCounts, firstRelation(row.pic)?.full_name ?? 'Tanpa PIC')
    bumpCount(eoCounts, firstRelation(row.organizer)?.legal_name ?? 'Tanpa EO')
    bumpCount(venueCounts, firstRelation(row.venue)?.legal_name ?? 'Tanpa venue')
    if (row.starts_on) {
      const month = row.starts_on.slice(0, 7)
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
    }
  }

  const venueEvents = rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    venueId: row.venue_id,
    venueName: firstRelation(row.venue)?.legal_name ?? '',
    halls: [...new Set((row.exhibitors ?? []).map((exhibitor) => exhibitor.hall))],
  }))

  const ranked = (counts: Map<string, EventNameCount>) =>
    [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    venueEvents,
    picLoad: ranked(picCounts),
    eoRanking: ranked(eoCounts).slice(0, 5),
    perMonth: [...monthCounts.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    venueRanking: ranked(venueCounts).slice(0, 5),
  }
}

/** Insight operasional + jadwal event ACTIVE untuk dashboard, dari satu query event ACTIVE. */
export async function queryEventInsights(): Promise<{
  insights: EventInsights
  events: EventScheduleRef[]
}> {
  const { client, workspaceId } = await withWorkspace()

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

  const events: EventScheduleRef[] = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    venueName: firstRelation(row.venue)?.legal_name ?? '',
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }))
  return { insights: computeInsights(rows ?? []), events }
}

/**
 * Daftar event untuk dashboard dengan filter SEPENUHNYA sisi-server (Req 16.1–16.7): join
 * venue/EO/PIC, pencarian substring `ilike`, filter lifecycle, filter display-status diterjemahkan
 * ke predikat tanggal terhadap hari ini.
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

  // Urutan akhir ditentukan sort kedekatan-hari-ini di bawah (butuh "hari ini"); order SQL hanya
  // memberi urutan deterministik awal.
  listQuery = listQuery.order('starts_on', { ascending: true, nullsFirst: false })

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

  // Urut berdasarkan kedekatan dengan hari ini: berlangsung → akan datang (terdekat dulu) →
  // selesai (terbaru dulu) → belum dijadwalkan. Sort stabil menjaga urutan SQL untuk nilai kembar.
  const proximityRank = { ongoing: 0, soon: 1, done: 2, unscheduled: 3 } as const
  visibleItems.sort((a, b) => {
    const rank = proximityRank[a.displayStatus] - proximityRank[b.displayStatus]
    if (rank !== 0) return rank
    if (a.displayStatus === 'soon' || a.displayStatus === 'ongoing') {
      return (a.startsOn ?? '').localeCompare(b.startsOn ?? '')
    }
    if (a.displayStatus === 'done') return (b.endsOn ?? '').localeCompare(a.endsOn ?? '')
    return 0
  })

  // Rollup tuntas per baris (badge "Belum tuntas" + peringatan arsip) — satu query jobs, digabung
  // di JS karena bentuknya jsonb lintas generasi.
  const jobsByEvent = await fetchJobsGroupedByEvent(client, workspaceId)
  for (const item of visibleItems) {
    const jobs = jobsByEvent.get(item.id) ?? []
    item.jobCount = jobs.length
    item.tuntasStatus = eventTuntas(jobs)
    item.unfinishedJobs = hitungJobBelumTuntas(jobs)
  }

  return { items: visibleItems }
}

/**
 * Baris event dalam bentuk legacy (snake_case + embed venues/event_organizers/
 * event_cancellations/exhibitors) untuk klien lama lewat GET /api/events — halaman detail event
 * dan daftar job masih memetakannya via `eventFromRow`/`exhibitorFromRow` di lib/data-client.
 */
export async function listLegacyEventRows(): Promise<Record<string, unknown>[]> {
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('events')
    .select(
      'id, name, alias, venue_id, event_organizer_id, pic_id, starts_on, ends_on, status, created_at, created_by_id, updated_at, ' +
        'venues(id, legal_name, alias_name, city, created_at, updated_at), ' +
        'event_organizers(id, legal_name, created_at, updated_at), ' +
        'event_cancellations(event_id, reason, cancelled_at, cancelled_by_id), ' +
        'exhibitors(id, event_id, kind, name, npwp, contact, hall, booth, created_at, updated_at)',
    )
    .eq('workspace_id', workspaceId)
    .order('starts_on')
    .returns<Record<string, unknown>[]>()
  if (error) {
    throw new Error(`Gagal memuat event: ${error.message}`)
  }
  return data ?? []
}
