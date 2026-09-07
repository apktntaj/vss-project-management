'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  listEos,
  listEventExhibitors,
  listVenues,
  saveEvent,
  saveEventExhibitors,
  type EventExhibitorInput,
  type LocalEo,
  type LocalEvent,
  type LocalVenue,
} from '@/lib/indexeddb'
import { Plus } from 'lucide-react'

function text(value: FormDataEntryValue | null) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function optional(value: FormDataEntryValue | null) {
  return text(value) || null
}

function normalizeInput(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.currentTarget.value = event.currentTarget.value.replace(/\s{2,}/g, ' ').toUpperCase()
}

function formatDateInput(isoDate: string) {
  const date = new Date(isoDate)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null

  const [, day, month, year] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return date
}

function formatDateValue(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3')
}

function RelationPicker({
  label,
  placeholder,
  items,
  query,
  onQueryChange,
  onSelect,
  onAdd,
  selected,
}: {
  label: string
  placeholder: string
  items: Array<LocalVenue | LocalEo>
  query: string
  onQueryChange: (value: string) => void
  onSelect: (item: LocalVenue | LocalEo) => void
  onAdd: () => void
  selected: LocalVenue | LocalEo | null
}) {
  const matches = items
    .filter((item) => {
      const name = 'officialName' in item ? item.officialName : item.legalName
      const alias = 'officialName' in item ? item.aliasName : item.aliasName
      return `${name} ${alias || ''}`.toLowerCase().includes(query.toLowerCase())
    })
    .slice(0, 6)

  return (
    <div className="sm:col-span-2">
      <label className="label">
        {label}
        <span className="relative block">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value.toUpperCase())}
            placeholder={placeholder}
            className="input w-full pe-11 uppercase"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Tambah ${label}`}
            className="absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-md text-orange-600 transition hover:bg-orange-50 hover:text-orange-700"
          >
            <Plus size={18} />
          </button>
        </span>
      </label>
      {selected && (
        <p className="mt-2 text-xs text-emerald-700">
          Terpilih: {'officialName' in selected ? selected.officialName : selected.legalName}
        </p>
      )}
      {query && !selected && (
        <div className="mt-1 overflow-hidden rounded-lg border bg-white shadow-sm">
          {matches.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelect(item)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              {'officialName' in item ? item.officialName : item.legalName}
              <span className="ml-2 text-xs text-slate-500">
                {'aliasName' in item && item.aliasName ? item.aliasName : ''}
              </span>
            </button>
          ))}
          {!matches.length && (
            <p className="px-3 py-2 text-sm text-slate-500">Belum ada data yang cocok.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function EventForm({
  event,
  enableExhibitors = false,
  onSaved,
  onCancel,
}: {
  event?: LocalEvent
  enableExhibitors?: boolean
  onSaved: () => void
  onCancel: () => void
}) {
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
  const [exhibitors, setExhibitors] = useState<EventExhibitorInput[]>([])

  useEffect(() => {
    Promise.all([
      listVenues(),
      listEos(),
      enableExhibitors && event ? listEventExhibitors(event.id) : Promise.resolve([]),
    ]).then(([loadedVenues, loadedEos, loadedExhibitors]) => {
      setVenues(loadedVenues)
      setEos(loadedEos)
      if (enableExhibitors) {
        setExhibitors(
          loadedExhibitors.map(({ eventId, createdAt, updatedAt, ...exhibitor }) => exhibitor),
        )
      }
      if (event) {
        const venue = loadedVenues.find((item) => item.id === event.venueId) ?? null
        const eo = loadedEos.find((item) => item.id === event.eoId) ?? null
        setVenueQuery(venue?.officialName ?? '')
        setSelectedVenue(venue)
        setEoQuery(eo?.legalName ?? '')
        setSelectedEo(eo)
        setStartsAt(formatDateInput(event.startsAt))
        setEndsAt(formatDateInput(event.endsAt))
      }
    })
  }, [enableExhibitors, event])

  function updateExhibitor(index: number, field: keyof EventExhibitorInput, value: string) {
    setExhibitors((current) =>
      current.map((exhibitor, currentIndex) =>
        currentIndex === index ? { ...exhibitor, [field]: value || null } : exhibitor,
      ),
    )
  }

  async function submit(form: FormData) {
    const startDate = parseDateInput(startsAt)
    const endDate = parseDateInput(endsAt)
    if (!startDate || !endDate || endDate <= startDate) {
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
    if (enableExhibitors && exhibitors.some((exhibitor) => !exhibitor.legalName?.trim())) {
      setError('Nama legal setiap exhibitor wajib diisi atau barisnya dihapus.')
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
      if (
        (latitude !== null && Number.isNaN(latitude)) ||
        (longitude !== null && Number.isNaN(longitude))
      ) {
        setError('Latitude dan longitude harus berupa angka.')
        return
      }

      const savedEvent = await saveEvent(
        {
          officialName: text(form.get('officialName')),
          alias: optional(form.get('alias')),
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
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
        },
        event?.id,
      )
      if (enableExhibitors) await saveEventExhibitors(savedEvent.id, exhibitors)
      onSaved()
    } catch {
      setError('Tidak dapat menyimpan event di IndexedDB.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form action={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6 sm:p-8">
        <section>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="label">
              Nama Official
              <input
                required
                name="officialName"
                defaultValue={event?.officialName ?? ''}
                onInput={normalizeInput}
                className="input uppercase"
              />
            </label>
            <label className="label">
              Alias
              <input
                name="alias"
                defaultValue={event?.alias ?? ''}
                onInput={normalizeInput}
                className="input uppercase"
              />
            </label>
            <label className="label">
              Tanggal mulai
              <input
                required
                type="text"
                inputMode="numeric"
                name="startsAt"
                value={startsAt}
                placeholder="dd/mm/yyyy"
                onChange={(event) => {
                  const value = formatDateValue(event.target.value)
                  setStartsAt(value)
                  if (!endsAt) setEndsAt(value)
                }}
                className="input placeholder:text-slate-400"
              />
            </label>
            <label className="label">
              Tanggal selesai
              <input
                required
                type="text"
                inputMode="numeric"
                name="endsAt"
                value={endsAt}
                placeholder="dd/mm/yyyy"
                onChange={(event) => setEndsAt(formatDateValue(event.target.value))}
                className="input placeholder:text-slate-400"
              />
            </label>
          </div>
        </section>

        <section className="pt-2">
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <RelationPicker
              label="Venue"
              placeholder="Klik tambah untuk venue baru"
              items={venues}
              query={venueQuery}
              onAdd={() => {
                setSelectedVenue(null)
                setVenueQuery('')
                setNewVenue(true)
              }}
              onQueryChange={(value) => {
                setVenueQuery(value)
                setSelectedVenue(null)
                setNewVenue(false)
              }}
              onSelect={(item) => {
                setSelectedVenue(item as LocalVenue)
                setVenueQuery((item as LocalVenue).officialName)
                setNewVenue(false)
              }}
              selected={selectedVenue}
            />
            {newVenue && (
              <>
                <label className="label">
                  Nama resmi
                  <input
                    required
                    name="venueOfficialName"
                    onInput={normalizeInput}
                    className="input uppercase"
                  />
                </label>
                <label className="label">
                  Alias
                  <input
                    name="venueAliasName"
                    onInput={normalizeInput}
                    className="input uppercase"
                  />
                </label>
                <label className="label sm:col-span-2">
                  Alamat
                  <textarea
                    name="venueAddress"
                    onInput={normalizeInput}
                    className="input min-h-20 uppercase"
                  />
                </label>
                <label className="label">
                  Latitude
                  <input type="number" step="any" name="latitude" className="input" />
                </label>
                <label className="label">
                  Longitude
                  <input type="number" step="any" name="longitude" className="input" />
                </label>
                <label className="label sm:col-span-2">
                  Kontak venue
                  <input
                    name="venueContactInfo"
                    onInput={normalizeInput}
                    className="input uppercase"
                  />
                </label>
              </>
            )}
          </div>
        </section>

        <section className="">
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <RelationPicker
              label="Event Organizer"
              placeholder="Ketik untuk mencari"
              items={eos}
              query={eoQuery}
              onAdd={() => {
                setSelectedEo(null)
                setEoQuery('')
                setNewEo(true)
              }}
              onQueryChange={(value) => {
                setEoQuery(value)
                setSelectedEo(null)
                setNewEo(false)
              }}
              onSelect={(item) => {
                setSelectedEo(item as LocalEo)
                setEoQuery((item as LocalEo).legalName)
                setNewEo(false)
              }}
              selected={selectedEo}
            />
            {newEo && (
              <>
                <label className="label">
                  Nama legal EO
                  <input
                    required
                    name="eoLegalName"
                    onInput={normalizeInput}
                    className="input uppercase"
                  />
                </label>
                <label className="label">
                  Nama alias EO
                  <input name="eoAliasName" onInput={normalizeInput} className="input uppercase" />
                </label>
                <label className="label sm:col-span-2">
                  Kontak EO
                  <input
                    name="eoContactInfo"
                    onInput={normalizeInput}
                    className="input uppercase"
                  />
                </label>
              </>
            )}
          </div>
        </section>
        {enableExhibitors && (
          <section className="border-t pt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">List of exhibitor</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tambahkan perusahaan exhibitor yang terlibat dalam event ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setExhibitors((current) => [
                    ...current,
                    {
                      legalName: '',
                      aliasName: null,
                      type: 'LOCAL',
                      email: null,
                      phone: null,
                      address: null,
                      countryCode: null,
                    },
                  ])
                }
                className="btn-secondary shrink-0"
              >
                + Tambah exhibitor
              </button>
            </div>
            <div className="mt-5 space-y-5">
              {exhibitors.map((exhibitor, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-black/10 bg-slate-50 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-800">Exhibitor {index + 1}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setExhibitors((current) =>
                          current.filter((_, currentIndex) => currentIndex !== index),
                        )
                      }
                      className="text-sm font-semibold text-rose-700 hover:text-rose-800"
                    >
                      Hapus
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="label">
                      Nama legal
                      <input
                        required
                        value={exhibitor.legalName}
                        onChange={(input) =>
                          updateExhibitor(index, 'legalName', input.target.value.toUpperCase())
                        }
                        className="input uppercase"
                      />
                    </label>
                    <label className="label">
                      Nama alias
                      <input
                        value={exhibitor.aliasName ?? ''}
                        onChange={(input) =>
                          updateExhibitor(index, 'aliasName', input.target.value.toUpperCase())
                        }
                        className="input uppercase"
                      />
                    </label>
                    <label className="label">
                      Tipe exhibitor
                      <select
                        value={exhibitor.type}
                        onChange={(input) => updateExhibitor(index, 'type', input.target.value)}
                        className="input"
                      >
                        <option value="LOCAL">Local</option>
                        <option value="INTERNATIONAL">International</option>
                      </select>
                    </label>
                    <label className="label">
                      Country code
                      <input
                        value={exhibitor.countryCode ?? ''}
                        onChange={(input) =>
                          updateExhibitor(index, 'countryCode', input.target.value.toUpperCase())
                        }
                        placeholder="Contoh: ID"
                        maxLength={2}
                        className="input uppercase"
                      />
                    </label>
                    <label className="label">
                      Email
                      <input
                        type="email"
                        value={exhibitor.email ?? ''}
                        onChange={(input) => updateExhibitor(index, 'email', input.target.value)}
                        className="input"
                      />
                    </label>
                    <label className="label">
                      Nomor telepon
                      <input
                        value={exhibitor.phone ?? ''}
                        onChange={(input) => updateExhibitor(index, 'phone', input.target.value)}
                        className="input"
                      />
                    </label>
                    <label className="label sm:col-span-2">
                      Alamat
                      <textarea
                        value={exhibitor.address ?? ''}
                        onChange={(input) =>
                          updateExhibitor(index, 'address', input.target.value.toUpperCase())
                        }
                        className="input min-h-20 uppercase"
                      />
                    </label>
                  </div>
                </div>
              ))}
              {!exhibitors.length && (
                <p className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-slate-500">
                  Belum ada exhibitor. Tambahkan exhibitor untuk mulai mengisi daftar.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
      <div className="shrink-0 px-6 py-4 sm:px-8">
        {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button disabled={saving} className="btn-primary">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Batal
          </button>
        </div>
      </div>
    </form>
  )
}
