'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  listEventExhibitors,
  saveEventExhibitors,
  type EventExhibitorInput,
  type LocalEvent,
} from '@/lib/indexeddb'

const emptyExhibitor = (): EventExhibitorInput => ({
  legalName: '',
  aliasName: null,
  type: 'INTERNATIONAL',
  email: null,
  phone: null,
  address: null,
  countryCode: null,
})

export function EventExhibitorModal({
  event,
  onSaved,
  onCancel,
}: {
  event: LocalEvent
  onSaved: () => void
  onCancel: () => void
}) {
  const [exhibitors, setExhibitors] = useState<EventExhibitorInput[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listEventExhibitors(event.id).then((items) => {
      setExhibitors(
        items.map(({ eventId, createdAt, updatedAt, ...exhibitor }) => exhibitor),
      )
    })
  }, [event.id])

  function updateExhibitor(index: number, field: 'legalName' | 'phone', value: string) {
    setExhibitors((current) =>
      current.map((exhibitor, currentIndex) =>
        currentIndex === index ? { ...exhibitor, [field]: value || null } : exhibitor,
      ),
    )
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (exhibitors.some((exhibitor) => !exhibitor.legalName.trim())) {
      setError('Nama exhibitor wajib diisi.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await saveEventExhibitors(event.id, exhibitors)
      onSaved()
    } catch {
      setError('Tidak dapat menyimpan exhibitor.')
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
        aria-labelledby="add-exhibitor-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden lg:max-w-[50vw]"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="add-exhibitor-title" className="text-xl font-bold">
              Tambah exhibitor
            </h2>
            <p className="mt-1 text-sm text-slate-500">{event.officialName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup modal exhibitor"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8">
          {exhibitors.map((exhibitor, index) => (
            <div key={index} className="rounded-xl border border-black/10 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={exhibitor.type === 'LOCAL'}
                    onChange={(input) =>
                      setExhibitors((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, type: input.target.checked ? 'LOCAL' : 'INTERNATIONAL' }
                            : item,
                        ),
                      )
                    }
                    className="h-3.5 w-3.5 accent-orange-600"
                  />
                  Local
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setExhibitors((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  aria-label={`Hapus exhibitor ${index + 1}`}
                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="label">
                  Nama exhibitor
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
                  Contact
                  <input
                    value={exhibitor.phone ?? ''}
                    onChange={(input) => updateExhibitor(index, 'phone', input.target.value)}
                    className="input"
                  />
                </label>
              </div>
            </div>
          ))}
          {!exhibitors.length && (
            <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">
              Belum ada exhibitor.
            </p>
          )}
          <button
            type="button"
            onClick={() => setExhibitors((current) => [...current, emptyExhibitor()])}
            className="btn-secondary w-full"
          >
            <Plus size={16} /> Tambah exhibitor
          </button>
        </div>

        <div className="shrink-0 border-t px-6 py-4 sm:px-8">
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
    </div>
  )
}
