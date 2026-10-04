'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  listEos,
  listVenues,
  saveEvent,
  type LocalEo,
  type LocalVenue,
} from '@/lib/data-client'
import { FormSkeleton } from '@/components/loading-skeletons'


function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}


export function EventForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [venues, setVenues] = useState<LocalVenue[]>([])
  const [organizers, setOrganizers] = useState<LocalEo[]>([])
  const [venueId, setVenueId] = useState('')
  const [organizerId, setOrganizerId] = useState('')
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (endsOn < startsOn) {
      setError('Tanggal selesai harus sama dengan atau setelah tanggal mulai.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (!venueId || !organizerId) throw new Error('Pilih EO dan venue terlebih dahulu.')
      await saveEvent({
        name: name.trim(),
        venueId,
        eventOrganizerId: organizerId,
        startsOn,
        endsOn,
      })
      toast('Event berhasil dibuat.', 'success')
      onSaved()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Event tidak dapat dibuat.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <FormSkeleton fields={6} />

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-6 sm:p-8">
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
                setEndsOn(nextStartsOn ? addDays(nextStartsOn, 3) : '')
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
        <section className="space-y-4 border-t pt-6">
          <h2 className="font-semibold">Venue</h2>
          <label className="label">Venue<select required value={venueId} onChange={(event) => setVenueId(event.target.value)} className="input"><option value="">Pilih venue</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
        </section>
        <section className="space-y-4 border-t pt-6">
          <h2 className="font-semibold">Event organizer</h2>
          <label className="label">Event organizer<select required value={organizerId} onChange={(event) => setOrganizerId(event.target.value)} className="input"><option value="">Pilih event organizer</option>{organizers.map((organizer) => <option key={organizer.id} value={organizer.id}>{organizer.name}</option>)}</select></label>
        </section>
      </div>
      <div className="shrink-0 border-t px-6 py-4 sm:px-8">{error && <p className="mb-3 text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-3"><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Buat event'}</button><button type="button" onClick={onCancel} className="btn-secondary">Batal</button></div></div>
    </form>
  )
}
