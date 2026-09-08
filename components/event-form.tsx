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
} from '@/lib/data-client'

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

function parseDateInput(value: string) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!isoMatch && !displayMatch) return null

  const [, isoYear, isoMonth, isoDay] = isoMatch ?? []
  const [, displayDay, displayMonth, displayYear] = displayMatch ?? []
  const year = isoYear || displayYear
  const month = isoMonth || displayMonth
  const day = isoDay || displayDay
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
  const matches = items
    .filter((item) => {
      const name = 'officialName' in item ? item.officialName : item.legalName
      const alias = 'officialName' in item ? item.aliasName : item.aliasName
      return `${name} ${alias || ''}`.toLowerCase().includes(query.toLowerCase())
    })
    .slice(0, 6)

  return (
    <div>
      <label className="label">
        {label}
        <span className="relative block">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value.toUpperCase())}
            placeholder={placeholder}
            className="input w-full uppercase"
            autoComplete="off"
          />
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
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [endDateEdited, setEndDateEdited] = useState(false)
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
        setStartsAt(event.startsOn)
        setEndsAt(event.endsOn)
        setEndDateEdited(true)
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
    if (!startDate || !endDate || endDate < startDate) {
      setError('Tanggal selesai harus sama dengan atau setelah tanggal mulai.')
      return
    }
    if (!selectedVenue) {
      setError('Pilih venue yang sudah ada.')
      return
    }
    if (!selectedEo) {
      setError('Pilih EO yang sudah ada.')
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
          startsOn: startDate.toISOString().slice(0, 10),
          endsOn: endDate.toISOString().slice(0, 10),
          venue: {
            officialName: selectedVenue.officialName,
            aliasName: selectedVenue.aliasName,
            address: selectedVenue.address,
            latitude: selectedVenue.latitude ?? latitude,
            longitude: selectedVenue.longitude ?? longitude,
            contactInfo: selectedVenue.contactInfo,
          },
          venueId: selectedVenue?.id,
          eventOrganizer: {
            legalName: selectedEo.legalName,
            aliasName: selectedEo.aliasName,
            contactInfo: selectedEo.contactInfo,
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
            <RelationPicker
              label="Event Organizer"
              placeholder="Ketik untuk mencari EO"
              items={eos}
              query={eoQuery}
              onQueryChange={(value) => {
                setEoQuery(value)
                setSelectedEo(null)
              }}
              onSelect={(item) => {
                setSelectedEo(item as LocalEo)
                setEoQuery((item as LocalEo).legalName)
              }}
              selected={selectedEo}
            />
            <RelationPicker
              label="Venue"
              placeholder="Ketik untuk mencari venue"
              items={venues}
              query={venueQuery}
              onQueryChange={(value) => {
                setVenueQuery(value)
                setSelectedVenue(null)
              }}
              onSelect={(item) => {
                setSelectedVenue(item as LocalVenue)
                setVenueQuery((item as LocalVenue).officialName)
              }}
              selected={selectedVenue}
            />
          </div>
        </section>

        <section>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="label">
              Pameran
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
                type="date"
                name="startsAt"
                value={startsAt}
                onChange={(event) => {
                  setStartsAt(event.target.value)
                  if (!endDateEdited) {
                    const start = parseDateInput(event.target.value)
                    if (start) {
                      start.setUTCDate(start.getUTCDate() + 3)
                      setEndsAt(start.toISOString().slice(0, 10))
                    }
                  }
                }}
                className="input"
              />
            </label>
            <label className="label">
              Tanggal selesai
              <input
                required
                type="date"
                name="endsAt"
                value={endsAt}
                onChange={(event) => {
                  setEndsAt(event.target.value)
                  setEndDateEdited(true)
                }}
                className="input"
              />
            </label>
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
