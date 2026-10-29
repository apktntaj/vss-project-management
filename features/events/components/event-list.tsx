// Sub-komponen SERVER (tanpa `'use client'`) yang me-render daftar event sebagai BARIS tabel dari
// `EventListItem[]` yang sudah di-join server-side oleh repository — bukan query per baris (hindari
// N+1). Aksi interaktif (edit/hapus) didelegasikan ke leaf klien `EventCardActions`.

import Link from 'next/link'

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
  // Opsi master data diteruskan ke leaf klien untuk form edit per baris.
  venues?: { id: string; name: string }[]
  organizers?: { id: string; name: string }[]
  pics?: { id: string; name: string }[]
}

/** Daftar event sebagai baris tabel. Kosong → pesan ramah; selain itu satu baris per item. */
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
    <div className="card max-h-[65vh] overflow-auto">
      <table className="min-w-[920px] w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[44px]" />
          <col />
          <col className="w-[130px]" />
          <col className="w-[105px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[100px]" />
          <col className="w-[48px]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-3 text-right">
              No
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
              Event
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
              Tanggal
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
              Status
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
              Venue
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
              EO
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
              PIC
            </th>
            <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3">
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
                <td className="px-2 py-3 text-right align-top tabular-nums text-slate-500">
                  {index + 1}
                </td>
                <td className="px-3 py-3 align-top">
                  <Link
                    href={`/events/${item.id}`}
                    className="block truncate font-semibold text-slate-900 hover:text-orange-700"
                    title={item.name}
                  >
                    {item.name}
                  </Link>
                  {item.alias ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500" title={item.alias}>
                      {item.alias}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-slate-700">
                    {formatDateRange(item.startsOn, item.endsOn)}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DISPLAY_STATUS_BADGE[item.displayStatus]}`}
                    >
                      {DISPLAY_STATUS_LABEL[item.displayStatus]}
                    </span>
                    {lifecycle ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lifecycle.className}`}
                      >
                        {lifecycle.label}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <p className="truncate text-slate-700" title={item.venueName || undefined}>
                    {item.venueName || 'Venue belum diinput'}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <p
                    className="truncate text-slate-600"
                    title={item.eventOrganizerName || undefined}
                  >
                    {item.eventOrganizerName || 'EO belum diinput'}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <p className="truncate text-slate-600" title={item.picName || undefined}>
                    {item.picName || 'Belum diinput'}
                  </p>
                </td>
                <td className="px-3 py-3 align-top text-right">
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
