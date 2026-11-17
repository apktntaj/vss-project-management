// Sub-komponen SERVER (tanpa `'use client'`) yang me-render daftar event sebagai BARIS tabel dari
// `EventListItem[]` yang sudah di-join server-side oleh repository — bukan query per baris (hindari
// N+1). Aksi interaktif (edit/hapus) didelegasikan ke leaf klien `EventCardActions`.

import Link from 'next/link'

import type { EventListItem } from '@/domain/event/types'

import { ClickableRow } from '@/features/events/components/clickable-row'
import { EventAppointmentLetterLink } from '@/features/events/components/event-appointment-letter-link'
import { EventCardActions } from '@/features/events/components/event-card-actions'
import {
  displayStatusBadgeClass,
  displayStatusLabel,
  formatDateRange,
  lifecycleBadge,
} from '@/features/events/components/event-presentation'
import { wibDateOf } from '@/lib/wib-date'

type EventListProps = {
  items: EventListItem[]
  // Opsi master data diteruskan ke leaf klien untuk form edit per baris.
  venues?: { id: string; name: string }[]
  organizers?: { id: string; name: string }[]
  pics?: { id: string; name: string }[]
}

/** Daftar event sebagai baris tabel. Kosong → pesan ramah; selain itu satu baris per item. */
export function EventList({ items, venues, organizers, pics }: EventListProps) {
  // "Hari ini" WIB — sama dengan `serverToday()` yang menurunkan display status — sebagai dasar
  // hitungan "n hari lagi" (ISO tanggal-saja).
  const today = wibDateOf(new Date())
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
      <table className="min-w-[1200px] w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[44px]" />
          <col />
          <col className="w-[140px]" />
          <col className="w-[170px]" />
          <col className="w-[170px]" />
          <col className="w-[120px]" />
          <col className="w-[56px]" />
          <col className="w-[150px]" />
          <col className="w-[56px]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
              Surat Penunjukan
            </th>
            <th className="sticky right-0 top-0 z-20 border-b border-slate-200 bg-white px-2 py-2">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const lifecycle = lifecycleBadge(item.lifecycle)
            // Event selesai/dibatalkan/diarsipkan diredam lewat warna (bukan opacity) agar teks tetap
            // memenuhi kontras 4.5:1.
            const isMuted = lifecycle !== null || item.displayStatus === 'done'
            const bodyText = isMuted ? 'text-muted-foreground' : 'text-slate-700'
            return (
              <ClickableRow
                key={item.id}
                href={`/events/${item.id}`}
                className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-2 py-2 text-right align-top tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-2 py-2 align-top">
                  <Link
                    href={`/events/${item.id}`}
                    className={`line-clamp-2 font-semibold hover:underline ${isMuted ? 'text-slate-700' : 'text-foreground'}`}
                    title={item.name}
                  >
                    {item.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${displayStatusBadgeClass(item.displayStatus, item.startsOn, today)}`}
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
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.alias}>
                      {item.alias}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2 align-top">
                  {item.startsOn && item.endsOn ? (
                    <p className={`font-medium ${bodyText}`}>
                      {formatDateRange(item.startsOn, item.endsOn)}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">Belum dijadwalkan</p>
                  )}
                </td>
                <td className="px-2 py-2 align-top">
                  <p className={`truncate ${bodyText}`} title={item.venueName || undefined}>
                    {item.venueName || 'Venue belum diinput'}
                  </p>
                </td>
                <td className="px-2 py-2 align-top">
                  <p
                    className={`truncate ${bodyText}`}
                    title={item.eventOrganizerName || undefined}
                  >
                    {item.eventOrganizerName || 'EO belum diinput'}
                  </p>
                </td>
                <td className="px-2 py-2 align-top">
                  <p className={`truncate ${bodyText}`} title={item.picName || undefined}>
                    {item.picName || 'Belum diinput'}
                  </p>
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums">
                  {item.jobCount > 0 ? (
                    <span
                      className={`text-sm font-semibold ${bodyText}`}
                      title={`${item.jobCount} job pada event ini`}
                    >
                      {item.jobCount}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground" aria-label="Belum ada job">—</span>
                  )}
                </td>
                {item.appointmentLetter ? (
                  <td className="px-2 py-2 align-top" data-row-click-ignore>
                    <EventAppointmentLetterLink letter={item.appointmentLetter} className="-mx-1 max-w-full text-xs" />
                  </td>
                ) : (
                  <td className="px-2 py-2 align-top">
                    <p className="text-sm italic text-muted-foreground">Belum ada</p>
                  </td>
                )}
                <td
                  className="sticky right-0 z-10 bg-white px-2 py-2 text-right align-top shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.18)] group-hover:bg-slate-50"
                  data-row-click-ignore
                >
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
                      appointmentLetter: item.appointmentLetter,
                    }}
                    lifecycle={item.lifecycle}
                    venues={venues}
                    organizers={organizers}
                    pics={pics}
                  />
                </td>
              </ClickableRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
