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

// Nilai awal form. Tanpa `id` → mode buat; dengan `id` → mode edit. Bentuk sejajar `EventInput`
// domain (alias boleh null; referensi dipegang sebagai id).
export type EventFormValues = {
  id?: string
  name: string
  alias: string | null
  venueId: string
  eventOrganizerId: string
  picId: string
  startsOn: string
  endsOn: string
}

type EventFormModalProps = EventFormOptions & {
  // Nilai awal untuk mode edit. Dihilangkan untuk mode buat.
  event?: EventFormValues
  onClose: () => void
  onSaved: () => void
}

// Field yang bisa membawa error validasi per-field dari server (path Zod/invariant).
type FieldErrors = Partial<
  Record<'name' | 'alias' | 'venueId' | 'eventOrganizerId' | 'picId' | 'startsOn' | 'endsOn', string>
>

const EMPTY: EventFormValues = {
  name: '',
  alias: null,
  venueId: '',
  eventOrganizerId: '',
  picId: '',
  startsOn: '',
  endsOn: '',
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

    // Normalisasi alias: kosong-setelah-trim → null (sejalan dengan skema Zod di server).
    const trimmedAlias = (values.alias ?? '').trim()
    const payload = {
      name: values.name.trim(),
      alias: trimmedAlias.length > 0 ? trimmedAlias : null,
      venueId: values.venueId.trim(),
      eventOrganizerId: values.eventOrganizerId.trim(),
      picId: values.picId.trim(),
      startsOn: values.startsOn,
      endsOn: values.endsOn,
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
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
              onChange={(inputEvent) => update('name', inputEvent.target.value)}
              className="input"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name ? <p className="mt-1 text-sm text-rose-600">{errors.name}</p> : null}
          </div>

          <div>
            <label htmlFor={`${titleId}-alias`} className="label">
              Alias <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input
              id={`${titleId}-alias`}
              value={values.alias ?? ''}
              onChange={(inputEvent) => update('alias', inputEvent.target.value)}
              className="input"
              aria-invalid={Boolean(errors.alias)}
            />
            {errors.alias ? <p className="mt-1 text-sm text-rose-600">{errors.alias}</p> : null}
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
                onChange={(inputEvent) => update('startsOn', inputEvent.target.value)}
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
                onChange={(inputEvent) => update('endsOn', inputEvent.target.value)}
                className="input"
                aria-invalid={Boolean(errors.endsOn)}
              />
              {errors.endsOn ? (
                <p className="mt-1 text-sm text-rose-600">{errors.endsOn}</p>
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
          onChange={(inputEvent) => onChange(inputEvent.target.value)}
          className="input"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
        />
      )}
      {error ? <p className="mt-1 text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}
