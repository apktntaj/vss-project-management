'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  listEos,
  listVenues,
  saveEo,
  saveEvent,
  saveVenue,
  type EoInput,
  type LocalEo,
  type LocalVenue,
  type VenueInput,
} from '@/lib/data-client'
import { FormSkeleton } from '@/components/loading-skeletons'

const noContacts = [] as const

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text || null
}

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

export function EventForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [venues, setVenues] = useState<LocalVenue[]>([])
  const [organizers, setOrganizers] = useState<LocalEo[]>([])
  const [venueId, setVenueId] = useState('')
  const [organizerId, setOrganizerId] = useState('')
  const [createVenue, setCreateVenue] = useState(false)
  const [createOrganizer, setCreateOrganizer] = useState(false)
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
    const form = new FormData(event.currentTarget)
    const startsOn = String(form.get('startsOn') ?? '')
    const endsOn = String(form.get('endsOn') ?? '')
    if (endsOn < startsOn) {
      setError('Tanggal akhir harus sama dengan atau setelah tanggal mulai.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const newVenue: VenueInput = {
        name: String(form.get('venueName') ?? '').trim(), contacts: noContacts.slice(), address: optional(form.get('venueAddress')), website: optional(form.get('venueWebsite')), loadingAccessNotes: optional(form.get('loadingAccessNotes')),
      }
      const newOrganizer: EoInput = {
        name: String(form.get('organizerName') ?? '').trim(), npwp: optional(form.get('organizerNpwp')), contacts: noContacts.slice(), address: optional(form.get('organizerAddress')), website: optional(form.get('organizerWebsite')),
      }
      const selectedVenueId = createVenue ? (await saveVenue(newVenue)).id : venueId
      const selectedOrganizerId = createOrganizer ? (await saveEo(newOrganizer)).id : organizerId
      if (!selectedVenueId || !selectedOrganizerId) throw new Error('Pilih atau buat EO dan venue terlebih dahulu.')
      await saveEvent({ name: String(form.get('name') ?? '').trim(), venueId: selectedVenueId, eventOrganizerId: selectedOrganizerId, startsOn, endsOn })
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
          <input required name="name" className="input" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="label">Tanggal mulai<input required type="date" name="startsOn" className="input" /></label>
          <label className="label">Tanggal selesai<input required type="date" name="endsOn" className="input" /></label>
        </div>
        <section className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Venue</h2><button type="button" className="text-sm font-semibold text-orange-700" onClick={() => setCreateVenue((value) => !value)}>{createVenue ? 'Pilih venue tersedia' : 'Buat venue'}</button></div>
          {createVenue ? <div className="grid gap-4"><label className="label">Nama venue<input required name="venueName" className="input" /></label><label className="label">Alamat<textarea name="venueAddress" className="input min-h-20" /></label><label className="label">Website<input name="venueWebsite" type="url" className="input" /></label><label className="label">Catatan akses loading<textarea name="loadingAccessNotes" className="input min-h-20" /></label></div> : <label className="label">Venue<select required value={venueId} onChange={(event) => setVenueId(event.target.value)} className="input"><option value="">Pilih venue</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>}
        </section>
        <section className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Event organizer</h2><button type="button" className="text-sm font-semibold text-orange-700" onClick={() => setCreateOrganizer((value) => !value)}>{createOrganizer ? 'Pilih EO tersedia' : 'Buat EO'}</button></div>
          {createOrganizer ? <div className="grid gap-4"><label className="label">Nama EO<input required name="organizerName" className="input" /></label><label className="label">NPWP<input name="organizerNpwp" className="input" /></label><label className="label">Alamat<textarea name="organizerAddress" className="input min-h-20" /></label><label className="label">Website<input name="organizerWebsite" type="url" className="input" /></label></div> : <label className="label">Event organizer<select required value={organizerId} onChange={(event) => setOrganizerId(event.target.value)} className="input"><option value="">Pilih event organizer</option>{organizers.map((organizer) => <option key={organizer.id} value={organizer.id}>{organizer.name}</option>)}</select></label>}
        </section>
      </div>
      <div className="shrink-0 border-t px-6 py-4 sm:px-8">{error && <p className="mb-3 text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-3"><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Buat event'}</button><button type="button" onClick={onCancel} className="btn-secondary">Batal</button></div></div>
    </form>
  )
}
