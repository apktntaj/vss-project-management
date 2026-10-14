'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import {
  listEos,
  listVenues,
  saveEvent,
  updateEvent,
  type LocalEo,
  type LocalEvent,
  type LocalVenue,
} from '@/lib/data-client'


function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}


export function EventFormModal({
  event,
  onSaved,
  onCancel,
}: {
  /** Event yang diedit; null/undefined berarti membuat event baru. */
  event?: LocalEvent | null
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = Boolean(event)
  const [venues, setVenues] = useState<LocalVenue[]>([])
  const [organizers, setOrganizers] = useState<LocalEo[]>([])
  const [venueId, setVenueId] = useState(event?.venueId ?? '')
  const [organizerId, setOrganizerId] = useState(event?.eventOrganizerId ?? '')
  const [name, setName] = useState(event?.name ?? '')
  const [startsOn, setStartsOn] = useState(event?.startsOn ?? '')
  const [endsOn, setEndsOn] = useState(event?.endsOn ?? '')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([listVenues(), listEos()])
      .then(([loadedVenues, loadedOrganizers]) => {
        setVenues(loadedVenues)
        setOrganizers(loadedOrganizers)
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : 'Data EO dan venue tidak dapat dimuat.'
        setError(message)
        toast(message, 'error')
      })
      .finally(() => setLoading(false))
  }, [])

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (endsOn < startsOn) {
      setError('Tanggal selesai harus sama dengan atau setelah tanggal mulai.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const input = {
        name: name.trim(),
        venueId,
        eventOrganizerId: organizerId,
        startsOn,
        endsOn,
      }
      if (event) {
        await updateEvent(event.id, input)
        toast('Event berhasil diperbarui.', 'success')
      } else {
        await saveEvent(input)
        toast('Event berhasil dibuat.', 'success')
      }
      onSaved()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Event tidak dapat disimpan.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel()
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="event-form-title" className="text-xl font-bold">{isEdit ? 'Edit event' : 'Event baru'}</h2>
            <p className="mt-1 text-sm text-slate-500">Format tanggal mengikuti pengaturan perangkat Anda.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Tutup modal event" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 sm:p-8">
          <label className="label">
            Nama event
            <input
              required
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value.toLocaleUpperCase('id-ID'))}
              className="input"
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="label">
              Tanggal mulai
              <input
                required
                type="date"
                name="startsOn"
                value={startsOn}
                onChange={(event) => {
                  const nextStartsOn = event.target.value
                  setStartsOn(nextStartsOn)
                  if (!isEdit) setEndsOn(nextStartsOn ? addDays(nextStartsOn, 3) : '')
                }}
                className="input"
              />
            </label>
            <label className="label">
              Tanggal selesai
              <input
                required
                type="date"
                name="endsOn"
                value={endsOn}
                min={startsOn || undefined}
                onChange={(event) => setEndsOn(event.target.value)}
                className="input"
              />
            </label>
          </div>
          <label className="label">
            Venue
            <select
              required
              disabled={loading}
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              className="input"
            >
              <option value="">{loading ? 'Memuat venue…' : 'Pilih venue'}</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Event organizer
            <select
              required
              disabled={loading}
              value={organizerId}
              onChange={(event) => setOrganizerId(event.target.value)}
              className="input"
            >
              <option value="">{loading ? 'Memuat event organizer…' : 'Pilih event organizer'}</option>
              {organizers.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>{organizer.name}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
        <div className="shrink-0 border-t px-6 py-4 sm:px-8">
          <div className="flex justify-end gap-3">
            <button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Buat event'}</button>
            <button type="button" onClick={onCancel} className="btn-secondary">Batal</button>
          </div>
        </div>
      </form>
    </div>
  )
}
