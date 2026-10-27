import { AlertTriangle, MapPin } from 'lucide-react'
import { redirect } from 'next/navigation'

import { requireCurrentUser } from '@/features/auth'
import {
  listEventOrganizerReferences,
  listEventsForDashboard,
  listUserReferences,
  listVenueReferences,
} from '@/features/events'
import type { EventListPage, EventListQuery } from '@/domain/event/types'
import type { CurrentUser } from '@/domain/auth/types'
import { ApiError } from '@/lib/server/errors'

import { EventCreateButton } from '@/features/events/components/event-create-button'
import { EventFilters } from '@/features/events/components/event-filters'
import { EventList } from '@/features/events/components/event-list'

export const dynamic = 'force-dynamic'

// Next 14 RSC menerima searchParams sebagai objek string|string[]. Ambil satu nilai string saja.
type EventsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function singleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

// Terjemahkan param UI (`search`, `status`) ke EventListQuery domain. `status`:
//   all     → tanpa filter
//   active  → lifecycle ACTIVE
//   soon|ongoing|done → displayStatus (turunan tanggal, repository menerjemahkan ke predikat tanggal)
function toQuery(searchParams: EventsPageProps['searchParams']): EventListQuery {
  const search = singleParam(searchParams?.search)?.trim() || undefined
  const status = singleParam(searchParams?.status)

  const query: EventListQuery = {}
  if (search) query.search = search
  if (status === 'active') {
    query.lifecycle = 'ACTIVE'
  } else if (status === 'soon' || status === 'ongoing' || status === 'done') {
    query.displayStatus = status
  }
  return query
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  // Sesi basi (cookie pra-cutover tanpa role/workspaceId) → arahkan ke login ulang, bukan
  // biarkan ApiError(401) meledak jadi halaman error.
  let currentUser: CurrentUser
  try {
    currentUser = await requireCurrentUser()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
    throw error
  }
  const query = toQuery(searchParams)

  // Indikator error (Req 16.8): bila query agregat/daftar/attention gagal, use-case MELEMPAR.
  // Kita tangkap di sini dan render keadaan error yang jelas — BUKAN daftar kosong seolah valid.
  let page: EventListPage | null = null
  let loadFailed = false
  try {
    page = await listEventsForDashboard(currentUser, query)
  } catch {
    loadFailed = true
  }

  // Opsi master data untuk form buat/edit event (venue/EO/PIC). Kegagalan memuat opsi TIDAK
  // mematikan halaman: EventFormModal memang dirancang menerima daftar kosong dan jatuh ke input
  // id teks, jadi daftar event tetap tampil.
  let venues: { id: string; name: string }[] | undefined
  let organizers: { id: string; name: string }[] | undefined
  let pics: { id: string; name: string }[] | undefined
  try {
    const [venueRecords, organizerRecords, users] = await Promise.all([
      listVenueReferences(currentUser),
      listEventOrganizerReferences(currentUser),
      listUserReferences(currentUser),
    ])
    venues = venueRecords.map((venue) => ({
      id: venue.id,
      name: venue.aliasName ? `${venue.legalName} (${venue.aliasName})` : venue.legalName,
    }))
    organizers = organizerRecords.map((organizer) => ({
      id: organizer.id,
      name: organizer.legalName,
    }))
    pics = users.map((user) => ({ id: user.id, name: user.fullName }))
  } catch {
    // Opsi dibiarkan undefined — form tetap fungsional dengan input id.
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Events</h1>
      <section>
        <EventFilters>
          <EventCreateButton venues={venues} organizers={organizers} pics={pics} />
        </EventFilters>

        {loadFailed || !page ? (
          <div className="card border-rose-200 p-12 text-center" role="alert">
            <AlertTriangle className="mx-auto text-rose-500" size={28} aria-hidden="true" />
            <p className="mt-3 font-semibold text-rose-700">Data gagal dimuat.</p>
            <p className="mt-1 text-sm text-slate-500">Muat ulang halaman untuk mencoba lagi.</p>
          </div>
        ) : (
          <>
            <section
              className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Ringkasan"
            >
              <article className="card flex items-center justify-between gap-3 p-4">
                <p className="text-sm text-slate-500">Total event</p>
                <p className="text-2xl font-bold text-slate-700">{page.summary.totalEvents}</p>
              </article>
              <article className="card flex items-center justify-between gap-3 p-4">
                <p className="text-sm text-slate-500">Berlangsung</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {page.summary.ongoingEvents}
                </p>
              </article>
              <article className="card p-4" aria-labelledby="events-attention-title">
                <h2 id="events-attention-title" className="text-sm font-semibold">
                  Attention
                </h2>
                {page.attention.scheduleOverlaps.length > 0 ||
                page.attention.venueConflicts.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-600">
                    {page.attention.scheduleOverlaps.length > 0 ? (
                      <li className="flex gap-2">
                        <AlertTriangle
                          className="mt-0.5 shrink-0 text-amber-600"
                          size={16}
                          aria-hidden="true"
                        />
                        <span>{page.attention.scheduleOverlaps.length} jadwal event beririsan.</span>
                      </li>
                    ) : null}
                    {page.attention.venueConflicts.length > 0 ? (
                      <li className="flex gap-2">
                        <MapPin
                          className="mt-0.5 shrink-0 text-amber-600"
                          size={16}
                          aria-hidden="true"
                        />
                        <span>{page.attention.venueConflicts.length} konflik venue.</span>
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Tidak ada perhatian operasional saat ini.
                  </p>
                )}
              </article>
            </section>

            <EventList
              items={page.items}
              venues={venues}
              organizers={organizers}
              pics={pics}
            />
          </>
        )}
      </section>
    </div>
  )
}
