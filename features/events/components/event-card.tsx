// Mengapa: sub-komponen SERVER (tanpa `'use client'`) yang me-render ringkasan satu event. Ia
// `await getEventSummary(currentUser, eventId)` LANGSUNG di server — kolokasi baca di tepi RSC,
// tanpa `fetch` bolak-balik ke klien (Req 2.1/2.2). TIDAK ada SQL/Supabase di sini: kepemilikan
// query tetap di `features/events/repository.ts`; komponen hanya memanggil use-case. Karena ini
// Server Component, ia boleh mengimpor batas server `@/features/events`. Aksi interaktif
// (edit/hapus) dipisah ke leaf klien `EventCardActions` agar batas server/klien tetap tegas
// (Req 3.1) — presentasi statis di server, interaktivitas di klien.

import Link from 'next/link'
import { Building2, CalendarDays, MapPin, User } from 'lucide-react'

import { getEventSummary } from '@/features/events'
import type { CurrentUser } from '@/domain/auth/types'

import { EventCardActions } from '@/features/events/components/event-card-actions'
import {
  DISPLAY_STATUS_BADGE,
  DISPLAY_STATUS_LABEL,
  formatDateRange,
  lifecycleBadge,
} from '@/features/events/components/event-presentation'

type EventCardProps = {
  currentUser: CurrentUser
  eventId: string
  // Opsi master data diteruskan ke leaf klien untuk form edit (venue/EO/PIC). Boleh kosong bila
  // sumber opsi belum tersedia — leaf akan jatuh ke input id teks.
  venues?: { id: string; name: string }[]
  organizers?: { id: string; name: string }[]
  pics?: { id: string; name: string }[]
}

/**
 * Kartu ringkasan satu event. Membaca ringkasan di server lalu merender presentasi statis; aksi
 * edit/hapus didelegasikan ke leaf klien. Seluruh kartu menautkan ke halaman detail event.
 */
export async function EventCard({ currentUser, eventId, venues, organizers, pics }: EventCardProps) {
  const summary = await getEventSummary(currentUser, eventId)
  const lifecycle = lifecycleBadge(summary.lifecycle)
  const isInactive = lifecycle !== null

  return (
    <article
      className={`card group flex h-full flex-col p-5 transition hover:border-orange-200 hover:shadow-lg ${
        isInactive ? 'opacity-80' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/events/${summary.id}`}
            className="block truncate text-lg font-semibold leading-snug text-slate-800 hover:text-orange-700 focus-visible:text-orange-700"
          >
            {summary.name}
          </Link>
          {summary.alias ? (
            <p className="mt-1 truncate text-sm text-slate-500">{summary.alias}</p>
          ) : null}
        </div>
        <EventCardActions
          event={{
            id: summary.id,
            name: summary.name,
            alias: summary.alias,
            venueId: '',
            eventOrganizerId: '',
            picId: '',
            startsOn: summary.startsOn,
            endsOn: summary.endsOn,
          }}
          venues={venues}
          organizers={organizers}
          pics={pics}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DISPLAY_STATUS_BADGE[summary.displayStatus]}`}
        >
          {DISPLAY_STATUS_LABEL[summary.displayStatus]}
        </span>
        {lifecycle ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lifecycle.className}`}>
            {lifecycle.label}
          </span>
        ) : null}
      </div>

      <dl className="mt-5 space-y-3 border-t pt-4 text-sm text-slate-600">
        <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2">
          <CalendarDays className="mt-0.5 text-slate-400" size={16} aria-hidden="true" />
          <dd>{formatDateRange(summary.startsOn, summary.endsOn)}</dd>
        </div>
        <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2">
          <MapPin className="mt-0.5 text-slate-400" size={16} aria-hidden="true" />
          <dd>{summary.venueName || 'Venue belum diinput'}</dd>
        </div>
        <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
          <Building2 className="mt-0.5 text-slate-400" size={15} aria-hidden="true" />
          <dd>{summary.eventOrganizerName || 'EO belum diinput'}</dd>
        </div>
        <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
          <User className="mt-0.5 text-slate-400" size={15} aria-hidden="true" />
          <dd>PIC: {summary.picName || 'Belum diinput'}</dd>
        </div>
      </dl>
    </article>
  )
}
