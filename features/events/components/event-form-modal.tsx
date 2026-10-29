'use client'

// Mengapa: leaf KLIEN — modal form untuk membuat/menyunting event. Ia melakukan MUTASI lewat
// `fetch('/api/events', { cache: 'no-store' })` (POST untuk buat, PATCH ke `/api/events/[id]` untuk
// edit) lalu `router.refresh()` saat sukses agar Server Component dashboard membaca ulang data
// terbaru (Req 2.3/2.4/3.3). Leaf ini TIDAK mengimpor modul server-only mana pun — otorisasi dan
// invariant ditegakkan di use-case server di balik route. Error validasi per-field ditampilkan
// inline di dekat input (tidak diganti toast); kegagalan mutasi memunculkan toast dari field
// `error` respons (kontrak error seragam). Teks pengguna bahasa Indonesia.

import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

import { toast } from '@/components/toast'

// Opsi master data (venue/EO/PIC) diteruskan dari induk (Server Component). Endpoint opsi master
// belum ada di slice ini (task 14 menanganinya); karena itu daftar boleh kosong dan form jatuh ke
// input id teks agar tetap fungsional.
export type EventFormOptions = {
  venues?: { id: string; name: string }[]
  organizers?: { id: string; name: string }[]
  pics?: { id: string; name: string }[]
}

// Nilai awal form. Tanpa `id` → mode buat; dengan `id` → mode edit. `alias` tidak lagi diedit di
// UI, tapi tetap dibawa saat edit agar PATCH tidak menghapus alias event lama.
export type EventFormValues = {
  id?: string
  name: string
  alias?: string | null
  venueId: string
  eventOrganizerId: string
  picId: string
  startsOn: string
  endsOn: string
  /** Penanda logistik venue (opsional): tanggal barang masuk/keluar venue, bukan tanggal pameran. */
  moveInOn?: string | null
  moveOutOn?: string | null
}

type EventFormModalProps = EventFormOptions & {
  // Nilai awal untuk mode edit. Dihilangkan untuk mode buat.
  event?: EventFormValues
  onClose: () => void
  onSaved: () => void
}

// Field yang bisa membawa error validasi per-field dari server (path Zod/invariant).
type FieldErrors = Partial<
  Record<
    'name' | 'venueId' | 'eventOrganizerId' | 'picId' | 'startsOn' | 'endsOn' | 'moveInOn' | 'moveOutOn',
    string
  >
>

const EMPTY: EventFormValues = {
  name: '',
  venueId: '',
  eventOrganizerId: '',
  picId: '',
  startsOn: '',
  endsOn: '',
  moveInOn: '',
  moveOutOn: '',
}

// Aritmetika tanggal-saja tanpa lib: komponen lokal agar hasil tak bergeser zona waktu.
function plusDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const result = new Date(year, month - 1, day + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())}`
}

/**
 * Modal form create/edit event. Mengelola state field lokal, submit ke route, dan umpan balik.
 * Dapat ditutup dengan tombol tutup, klik backdrop, atau tombol Escape (aksesibilitas).
 */
export function EventFormModal({
  event,
  venues,
  organizers,
  pics,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const router = useRouter()
  const isEdit = Boolean(event?.id)
  const titleId = useId()

  const [values, setValues] = useState<EventFormValues>(event ?? EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (submitting) return
    setErrors({})
    setSubmitting(true)

    const payload = {
      name: values.name.trim(),
      alias: values.alias ?? null,
      venueId: values.venueId.trim() || null,
      eventOrganizerId: values.eventOrganizerId.trim() || null,
      picId: values.picId.trim() || null,
      startsOn: values.startsOn || null,
      endsOn: values.endsOn || null,
      moveInOn: values.moveInOn || null,
      moveOutOn: values.moveOutOn || null,
    }

    const target = isEdit ? `/api/events/${event?.id}` : '/api/events'
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const response = await fetch(target, {
        method,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; field?: string }
          | null
        const message = body?.error ?? 'Event tidak dapat disimpan.'
        // Bila server menandai field spesifik, tampilkan inline; selain itu tampilkan toast.
        if (body?.field && body.field in EMPTY) {
          setErrors({ [body.field as keyof FieldErrors]: message })
        } else {
          toast(message, 'error')
        }
        return
      }

      toast(isEdit ? 'Event diperbarui.' : 'Event dibuat.', 'success')
      router.refresh()
      onSaved()
    } catch {
      toast('Gagal terhubung ke server. Coba lagi.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (!submitting && mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Escape' && !submitting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            {isEdit ? 'Edit event' : 'Event baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor={`${titleId}-name`} className="label">
              Nama event
            </label>
            <input
              id={`${titleId}-name`}
              value={values.name}
              onChange={(inputEvent) => update('name', inputEvent.target.value.toUpperCase())}
              className="input uppercase"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name ? <p className="mt-1 text-sm text-rose-600">{errors.name}</p> : null}
          </div>

          <ReferenceField
            id={`${titleId}-venue`}
            label="Venue"
            placeholder="ID venue"
            value={values.venueId}
            options={venues}
            error={errors.venueId}
            onChange={(value) => update('venueId', value)}
          />
          <ReferenceField
            id={`${titleId}-organizer`}
            label="Event organizer"
            placeholder="ID event organizer"
            value={values.eventOrganizerId}
            options={organizers}
            error={errors.eventOrganizerId}
            onChange={(value) => update('eventOrganizerId', value)}
          />
          <ReferenceField
            id={`${titleId}-pic`}
            label="PIC"
            placeholder="ID PIC"
            value={values.picId}
            options={pics}
            error={errors.picId}
            onChange={(value) => update('picId', value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${titleId}-starts`} className="label">
                Tanggal mulai
              </label>
              <input
                id={`${titleId}-starts`}
                type="date"
                value={values.startsOn}
                onChange={(inputEvent) => {
                  const nextStart = inputEvent.target.value
                  if (!nextStart) {
                    update('startsOn', '')
                    return
                  }
                  // Rekomendasi otomatis (keputusan 2026-10-29): pameran 3 hari (mulai+2),
                  // move-in H-3, move-out = hari terakhir pameran — hanya mengisi field yang
                  // masih kosong atau tidak sah, tanpa menimpa isi manual.
                  const recommendedEnd = plusDays(nextStart, 2)
                  setValues((current) => ({
                    ...current,
                    startsOn: nextStart,
                    endsOn:
                      !current.endsOn || current.endsOn < nextStart
                        ? recommendedEnd
                        : current.endsOn,
                    moveInOn: current.moveInOn ? current.moveInOn : plusDays(nextStart, -3),
                    moveOutOn: current.moveOutOn ? current.moveOutOn : recommendedEnd,
                  }))
                }}
                className="input"
                aria-invalid={Boolean(errors.startsOn)}
              />
              {errors.startsOn ? (
                <p className="mt-1 text-sm text-rose-600">{errors.startsOn}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor={`${titleId}-ends`} className="label">
                Tanggal akhir
              </label>
              <input
                id={`${titleId}-ends`}
                type="date"
                value={values.endsOn}
                onChange={(inputEvent) => {
                  const nextEnd = inputEvent.target.value
                  setValues((current) => ({
                    ...current,
                    endsOn: nextEnd,
                    moveOutOn: nextEnd && !current.moveOutOn ? nextEnd : current.moveOutOn,
                  }))
                }}
                className="input"
                aria-invalid={Boolean(errors.endsOn)}
              />
              {errors.endsOn ? (
                <p className="mt-1 text-sm text-rose-600">{errors.endsOn}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${titleId}-move-in`} className="label">
                Move in (venue)
              </label>
              <input
                id={`${titleId}-move-in`}
                type="date"
                value={values.moveInOn ?? ''}
                onChange={(inputEvent) => update('moveInOn', inputEvent.target.value)}
                className="input"
                aria-invalid={Boolean(errors.moveInOn)}
              />
              {errors.moveInOn ? (
                <p className="mt-1 text-sm text-rose-600">{errors.moveInOn}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor={`${titleId}-move-out`} className="label">
                Move out (venue)
              </label>
              <input
                id={`${titleId}-move-out`}
                type="date"
                value={values.moveOutOn ?? ''}
                onChange={(inputEvent) => update('moveOutOn', inputEvent.target.value)}
                className="input"
                aria-invalid={Boolean(errors.moveOutOn)}
              />
              {errors.moveOutOn ? (
                <p className="mt-1 text-sm text-rose-600">{errors.moveOutOn}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Buat event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Field referensi: bila daftar opsi tersedia → dropdown; bila belum (endpoint master data belum ada)
// → input id teks agar form tetap bisa dipakai. Satu komponen agar ketiga referensi konsisten.
function ReferenceField({
  id,
  label,
  placeholder,
  value,
  options,
  error,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  options?: { id: string; name: string }[]
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {options && options.length > 0 ? (
        <select
          id={id}
          value={value}
          onChange={(inputEvent) => onChange(inputEvent.target.value)}
          className="input"
          aria-invalid={Boolean(error)}
        >
          <option value="">Pilih {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          value={value}
          onChange={(inputEvent) => onChange(inputEvent.target.value.toUpperCase())}
          className="input uppercase"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
        />
      )}
      {error ? <p className="mt-1 text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}
