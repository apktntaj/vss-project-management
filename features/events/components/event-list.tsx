// Sub-komponen SERVER (tanpa `'use client'`) yang me-render daftar event sebagai BARIS tabel dari
// `EventListItem[]` yang sudah di-join server-side oleh repository — bukan query per baris (hindari
// N+1). Aksi interaktif (edit/hapus) didelegasikan ke leaf klien `EventCardActions`.

import Link from 'next/link'

import type { EventListItem } from '@/domain/event/types'

import { EventCardActions } from '@/features/events/components/event-card-actions'
import {
  DISPLAY_STATUS_BADGE,
  displayStatusLabel,
  formatDateRange,
  lifecycleBadge,
} from '@/features/events/components/event-presentation'

type EventListProps = {
  items: EventListItem[]
  // Opsi master data diteruskan ke leaf klien untuk form edit per baris.
  venues?: { id: string; name: string }[]
  organizers?: { id: string; name: string }[]
  pics?: { id: string; name: string }[]
}

/** Daftar event sebagai baris tabel. Kosong → pesan ramah; selain itu satu baris per item. */
export function EventList({ items, venues, organizers, pics }: EventListProps) {
  // "Hari ini" sisi-server sebagai dasar hitungan "n hari lagi" (ISO tanggal-saja).
  const today = new Date().toISOString().slice(0, 10)
  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-medium text-slate-600">Belum ada event yang sesuai</p>
        <p className="mt-1 text-sm text-slate-400">Coba ubah atau reset filter.</p>
      </div>
    )
  }

  return (
    <div className="card max-h-[65vh] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1">
      <table className="min-w-[1060px] w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[44px]" />
          <col />
          <col className="w-[150px]" />
          <col className="w-[215px]" />
          <col className="w-[215px]" />
          <col className="w-[180px]" />
          <col className="w-[56px]" />
          <col className="w-[48px]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 text-right">
              No
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
              Event
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
              Tanggal
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
              Venue
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
              Event Organizer
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">PIC</th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 text-right">
              Jobs
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lifecycle = lifecycleBadge(item.lifecycle)
            const isInactive = lifecycle !== null
            return (
              <tr
                key={item.id}
                className={`border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40 ${
                  isInactive ? 'opacity-80' : ''
                }`}
              >
                <td className="px-2 py-2 text-right align-top tabular-nums text-slate-400">
                  {index + 1}
                </td>
                <td className="px-2 py-2 align-top">
                  <Link
                    href={`/events/${item.id}`}
                    className="block truncate font-semibold text-slate-600 hover:text-orange-700"
                    title={item.name}
                  >
                    {item.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DISPLAY_STATUS_BADGE[item.displayStatus]}`}
                    >
                      {displayStatusLabel(item.displayStatus, item.startsOn, today)}
                    </span>
                    {lifecycle ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lifecycle.className}`}
                      >
                        {lifecycle.label}
                      </span>
                    ) : null}
                  </div>
                  {item.alias ? (
                    <p className="mt-0.5 truncate text-xs text-slate-400" title={item.alias}>
                      {item.alias}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2 align-top">
                  {item.startsOn && item.endsOn ? (
                    <p className="font-medium text-slate-500">
                      {formatDateRange(item.startsOn, item.endsOn)}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300">Belum dijadwalkan</p>
                  )}
                </td>
                <td className="px-2 py-2 align-top">
                  <p className="truncate text-slate-500" title={item.venueName || undefined}>
                    {item.venueName || 'Venue belum diinput'}
                  </p>
                </td>
                <td className="px-2 py-2 align-top">
                  <p
                    className="truncate text-slate-500"
                    title={item.eventOrganizerName || undefined}
                  >
                    {item.eventOrganizerName || 'EO belum diinput'}
                  </p>
                </td>
                <td className="px-2 py-2 align-top">
                  <p className="truncate text-slate-500" title={item.picName || undefined}>
                    {item.picName || 'Belum diinput'}
                  </p>
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums">
                  {item.jobCount > 0 ? (
                    <span
                      className="text-sm font-semibold text-slate-500"
                      title={`${item.jobCount} job pada event ini`}
                    >
                      {item.jobCount}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2 align-top text-right">
                  <EventCardActions
                    event={{
                      id: item.id,
                      name: item.name,
                      alias: item.alias,
                      venueId: item.venueId ?? '',
                      eventOrganizerId: item.eventOrganizerId ?? '',
                      picId: item.picId ?? '',
                      startsOn: item.startsOn ?? '',
                      endsOn: item.endsOn ?? '',
                      moveInOn: item.moveInOn ?? '',
                      moveOutOn: item.moveOutOn ?? '',
                    }}
                    lifecycle={item.lifecycle}
                    venues={venues}
                    organizers={organizers}
                    pics={pics}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
