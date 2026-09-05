'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { listEos, listVenues, saveEvent, type LocalEo, type LocalVenue } from '@/lib/indexeddb'

function text(value: FormDataEntryValue | null) {
    return String(value || '').replace(/\s+/g, ' ').trim()
}

function optional(value: FormDataEntryValue | null) {
    return text(value) || null
}

function normalizeInput(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
    event.currentTarget.value = event.currentTarget.value.replace(/\s{2,}/g, ' ').toUpperCase()
}

function RelationPicker({
    label,
    placeholder,
    items,
    query,
    onQueryChange,
    onSelect,
    selected,
}: {
    label: string
    placeholder: string
    items: Array<LocalVenue | LocalEo>
    query: string
    onQueryChange: (value: string) => void
    onSelect: (item: LocalVenue | LocalEo) => void
    selected: LocalVenue | LocalEo | null
}) {
    const matches = items.filter((item) => {
        const name = 'officialName' in item ? item.officialName : item.legalName
        const alias = 'officialName' in item ? item.aliasName : item.aliasName
        return `${name} ${alias || ''}`.toLowerCase().includes(query.toLowerCase())
    }).slice(0, 6)

    return <div className="sm:col-span-2">
        <label className="label">{label}
            <input value={query} onChange={(event) => onQueryChange(event.target.value.toUpperCase())} placeholder={placeholder} className="input uppercase" autoComplete="off" />
        </label>
        {selected && <p className="mt-2 text-xs text-emerald-700">Terpilih: {'officialName' in selected ? selected.officialName : selected.legalName}</p>}
        {query && !selected && <div className="mt-1 overflow-hidden rounded-lg border bg-white shadow-sm">
            {matches.map((item) => <button type="button" key={item.id} onClick={() => onSelect(item)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{'officialName' in item ? item.officialName : item.legalName}<span className="ml-2 text-xs text-slate-500">{'aliasName' in item && item.aliasName ? item.aliasName : ''}</span></button>)}
            {!matches.length && <p className="px-3 py-2 text-sm text-slate-500">Belum ada data yang cocok.</p>}
        </div>}
    </div>
}

export function EventForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [venues, setVenues] = useState<LocalVenue[]>([])
    const [eos, setEos] = useState<LocalEo[]>([])
    const [venueQuery, setVenueQuery] = useState('')
    const [eoQuery, setEoQuery] = useState('')
    const [selectedVenue, setSelectedVenue] = useState<LocalVenue | null>(null)
    const [selectedEo, setSelectedEo] = useState<LocalEo | null>(null)
    const [newVenue, setNewVenue] = useState(false)
    const [newEo, setNewEo] = useState(false)
    const [startsAt, setStartsAt] = useState('')
    const [endsAt, setEndsAt] = useState('')

    useEffect(() => { Promise.all([listVenues(), listEos()]).then(([loadedVenues, loadedEos]) => { setVenues(loadedVenues); setEos(loadedEos) }) }, [])

    async function submit(form: FormData) {
        if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
            setError('Waktu selesai harus setelah waktu mulai.')
            return
        }
        if (!selectedVenue && !newVenue) {
            setError('Pilih venue yang sudah ada atau buat venue baru.')
            return
        }
        if (!selectedEo && !newEo) {
            setError('Pilih EO yang sudah ada atau buat EO baru.')
            return
        }

        setSaving(true)
        setError('')
        try {
            const number = (name: string) => {
                const value = optional(form.get(name))
                return value === null ? null : Number(value)
            }
            const latitude = number('latitude')
            const longitude = number('longitude')
            if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) {
                setError('Latitude dan longitude harus berupa angka.')
                return
            }

            await saveEvent({
                officialName: text(form.get('officialName')),
                alias: optional(form.get('alias')),
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                venue: {
                    officialName: selectedVenue?.officialName || text(form.get('venueOfficialName')),
                    aliasName: selectedVenue?.aliasName || optional(form.get('venueAliasName')),
                    address: selectedVenue?.address || optional(form.get('venueAddress')),
                    latitude: selectedVenue?.latitude ?? latitude,
                    longitude: selectedVenue?.longitude ?? longitude,
                    contactInfo: selectedVenue?.contactInfo || optional(form.get('venueContactInfo')),
                },
                venueId: selectedVenue?.id,
                eventOrganizer: {
                    legalName: selectedEo?.legalName || text(form.get('eoLegalName')),
                    aliasName: selectedEo?.aliasName || optional(form.get('eoAliasName')),
                    contactInfo: selectedEo?.contactInfo || optional(form.get('eoContactInfo')),
                },
                eoId: selectedEo?.id,
            })
            onSaved()
        } catch {
            setError('Tidak dapat menyimpan event di IndexedDB.')
        } finally {
            setSaving(false)
        }
    }

    return <form action={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6 sm:p-8">
            <section>
                <h2 className="text-lg font-semibold">Informasi event</h2>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <label className="label">Nama Official<input required name="officialName" onInput={normalizeInput} className="input uppercase" /></label>
                    <label className="label">Alias<input name="alias" onInput={normalizeInput} className="input uppercase" /></label>
                    <label className="label">Tanggal mulai<input required type="date" name="startsAt" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); if (!endsAt) setEndsAt(event.target.value) }} className="input" /></label>
                    <label className="label">Tanggal selesai<input required type="date" name="endsAt" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} min={startsAt || undefined} className="input" /></label>
                </div>
            </section>

            <section className="pt-2">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold"></h2>
                    <button type="button" onClick={() => { setSelectedVenue(null); setVenueQuery(''); setNewVenue(true) }} className="text-sm font-semibold text-orange-700 hover:text-orange-800">+ New Venue</button>
                </div>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <RelationPicker label="Venue" placeholder="Klik tambah untuk venue baru" items={venues} query={venueQuery} onQueryChange={(value) => { setVenueQuery(value); setSelectedVenue(null); setNewVenue(false) }} onSelect={(item) => { setSelectedVenue(item as LocalVenue); setVenueQuery((item as LocalVenue).officialName); setNewVenue(false) }} selected={selectedVenue} />
                    {newVenue && <>
                        <label className="label">Nama resmi venue<input required name="venueOfficialName" onInput={normalizeInput} className="input uppercase" /></label>
                        <label className="label">Nama alias venue<input name="venueAliasName" onInput={normalizeInput} className="input uppercase" /></label>
                        <label className="label sm:col-span-2">Alamat<textarea name="venueAddress" onInput={normalizeInput} className="input min-h-20 uppercase" /></label>
                        <label className="label">Latitude<input type="number" step="any" name="latitude" className="input" /></label>
                        <label className="label">Longitude<input type="number" step="any" name="longitude" className="input" /></label>
                        <label className="label sm:col-span-2">Kontak venue<input name="venueContactInfo" onInput={normalizeInput} className="input uppercase" /></label>
                    </>}
                </div>
            </section>

            <section className="pt-2">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold">Event organizer (EO)</h2>
                    <button type="button" onClick={() => { setSelectedEo(null); setEoQuery(''); setNewEo(true) }} className="text-sm font-semibold text-orange-700 hover:text-orange-800">+ New EO</button>
                </div>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <RelationPicker label="EO" placeholder="Cari EO yang sudah ada" items={eos} query={eoQuery} onQueryChange={(value) => { setEoQuery(value); setSelectedEo(null); setNewEo(false) }} onSelect={(item) => { setSelectedEo(item as LocalEo); setEoQuery((item as LocalEo).legalName); setNewEo(false) }} selected={selectedEo} />
                    {newEo && <>
                        <label className="label">Nama legal EO<input required name="eoLegalName" onInput={normalizeInput} className="input uppercase" /></label>
                        <label className="label">Nama alias EO<input name="eoAliasName" onInput={normalizeInput} className="input uppercase" /></label>
                        <label className="label sm:col-span-2">Kontak EO<input name="eoContactInfo" onInput={normalizeInput} className="input uppercase" /></label>
                    </>}
                </div>
            </section>
        </div>
        <div className="shrink-0 px-6 py-4 sm:px-8">
            {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-3">
                <button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan'}</button>
                <button type="button" onClick={onCancel} className="btn-secondary">Batal</button>
            </div>
        </div>
    </form>
}