// Mengapa: sub-komponen SERVER (tanpa `'use client'`) yang me-render daftar kartu event dari
// `EventListItem[]` yang SUDAH di-join/di-agregat server-side oleh repository (Req 16.1). Ia
// me-render presentasi inline dari daftar itu — BUKAN memanggil `getEventSummary` per kartu —
// supaya tidak terjadi N+1 query (daftar sudah membawa semua field siap-render). Kepemilikan query
// tetap di repository; komponen ini murni presentasi. Aksi interaktif (edit/hapus) didelegasikan ke
// leaf klien `EventCardActions` agar batas server/klien tetap tegas (Req 3.1).

import Link from 'next/link'
import { Building2, CalendarDays, MapPin, User } from 'lucide-react'

import type { EventListItem } from '@/domain/event/types'

import { EventCardActions } from '@/features/events/components/event-card-actions'
import {
  DISPLAY_STATUS_BADGE,
  DISPLAY_STATUS_LABEL,
  formatDateRange,
  lifecycleBadge,
} from '@/features/events/components/event-presentation'

type EventListProps = {
  items: EventListItem[]
  // Opsi master data diteruskan ke leaf klien untuk form edit per kartu.
  venues?: { id: string; name: string }[]
  organizers?: { id: string; name: string }[]
  pics?: { id: string; name: string }[]
}

/** Grid kartu event. Kosong → pesan ramah; selain itu satu kartu per item. */
export function EventList({ items, venues, organizers, pics }: EventListProps) {
  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="font-medium">Belum ada event yang sesuai</p>
        <p className="mt-1 text-sm text-slate-500">Coba ubah atau reset filter.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const lifecycle = lifecycleBadge(item.lifecycle)
        const isInactive = lifecycle !== null
        return (
          <article
            key={item.id}
            className={`card group flex h-full flex-col p-5 transition hover:border-orange-200 hover:shadow-lg ${
              isInactive ? 'opacity-80' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/events/${item.id}`}
                  className="block truncate text-lg font-semibold leading-snug text-slate-800 hover:text-orange-700 focus-visible:text-orange-700"
                >
                  {item.name}
                </Link>
                {item.alias ? (
                  <p className="mt-1 truncate text-sm text-slate-500">{item.alias}</p>
                ) : null}
              </div>
              <EventCardActions
                event={{
                  id: item.id,
                  name: item.name,
                  alias: item.alias,
                  venueId: '',
                  eventOrganizerId: '',
                  picId: '',
                  startsOn: item.startsOn,
                  endsOn: item.endsOn,
                }}
                venues={venues}
                organizers={organizers}
                pics={pics}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DISPLAY_STATUS_BADGE[item.displayStatus]}`}
              >
                {DISPLAY_STATUS_LABEL[item.displayStatus]}
              </span>
              {lifecycle ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lifecycle.className}`}
                >
                  {lifecycle.label}
                </span>
              ) : null}
            </div>

            <dl className="mt-5 space-y-3 border-t pt-4 text-sm text-slate-600">
              <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2">
                <CalendarDays className="mt-0.5 text-slate-400" size={16} aria-hidden="true" />
                <dd>{formatDateRange(item.startsOn, item.endsOn)}</dd>
              </div>
              <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2">
                <MapPin className="mt-0.5 text-slate-400" size={16} aria-hidden="true" />
                <dd>{item.venueName || 'Venue belum diinput'}</dd>
              </div>
              <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
                <Building2 className="mt-0.5 text-slate-400" size={15} aria-hidden="true" />
                <dd>{item.eventOrganizerName || 'EO belum diinput'}</dd>
              </div>
              <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
                <User className="mt-0.5 text-slate-400" size={15} aria-hidden="true" />
                <dd>PIC: {item.picName || 'Belum diinput'}</dd>
              </div>
            </dl>
          </article>
        )
      })}
    </div>
  )
}
