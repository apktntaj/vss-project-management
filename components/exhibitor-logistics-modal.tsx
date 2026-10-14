'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

import {
  exhibitorLogisticsSchema,
  operationalNoteKindLabels,
  operationalNoteKinds,
  type ExhibitorLogistics,
  type OperationalNoteKind,
} from '@/domain/job/manifest'
import { saveExhibitorLogistics, type LocalExhibitor } from '@/lib/data-client'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type KoliDraft = { label: string; lengthCm: string; widthCm: string; heightCm: string; volumeCbm: string; weightKg: string }
type NoteDraft = { kind: OperationalNoteKind; text: string }

const emptyKoli = (): KoliDraft => ({ label: '', lengthCm: '', widthCm: '', heightCm: '', volumeCbm: '', weightKg: '' })
const emptyNote = (): NoteDraft => ({ kind: 'LAINNYA', text: '' })

const numberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

const computedCbm = (koli: KoliDraft) => {
  const lengthCm = Number(koli.lengthCm)
  const widthCm = Number(koli.widthCm)
  const heightCm = Number(koli.heightCm)
  if (!lengthCm || !widthCm || !heightCm) return null
  return Math.round(((lengthCm * widthCm * heightCm) / 1_000_000) * 1000) / 1000
}

const labelClass = 'label'
const inputClass = 'input mt-1'

export function ExhibitorLogisticsModal({
  eventId,
  exhibitor,
  onClose,
  onSaved,
}: {
  eventId: string
  exhibitor: LocalExhibitor
  onClose: () => void
  onSaved: (exhibitorId: string, logistics: ExhibitorLogistics) => void
}) {
  const logistics = exhibitor.logistics
  const [hall, setHall] = useState(logistics?.hall ?? '')
  const [booth, setBooth] = useState(logistics?.booth ?? '')
  const [totalCount, setTotalCount] = useState(logistics ? String(logistics.koli.totalCount) : '')
  const [kolis, setKolis] = useState<KoliDraft[]>(
    logistics?.koli.details.length
      ? logistics.koli.details.map((koli) => ({
          label: koli.label ?? '',
          lengthCm: koli.dimension ? String(koli.dimension.lengthCm) : '',
          widthCm: koli.dimension ? String(koli.dimension.widthCm) : '',
          heightCm: koli.dimension ? String(koli.dimension.heightCm) : '',
          volumeCbm: koli.volumeCbm !== null ? String(koli.volumeCbm) : '',
          weightKg: koli.weightKg !== null ? String(koli.weightKg) : '',
        }))
      : [emptyKoli()],
  )
  const [notes, setNotes] = useState<NoteDraft[]>(
    logistics?.notes.map((note) => ({ kind: note.kind, text: note.text })) ?? [],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function buildPayload() {
    const details = kolis
      .filter((koli) => [koli.label, koli.lengthCm, koli.widthCm, koli.heightCm, koli.volumeCbm, koli.weightKg].some((value) => value.trim()))
      .map((koli) => {
        const lengthCm = numberOrNull(koli.lengthCm)
        const widthCm = numberOrNull(koli.widthCm)
        const heightCm = numberOrNull(koli.heightCm)
        const volumeCbm = numberOrNull(koli.volumeCbm)
        const weightKg = numberOrNull(koli.weightKg)
        if ([lengthCm, widthCm, heightCm, volumeCbm, weightKg].includes(Number.NaN)) throw new Error('Ukuran/berat koli harus angka ≥ 0.')
        return {
          label: koli.label.trim() || null,
          dimension:
            lengthCm !== null && widthCm !== null && heightCm !== null
              ? { lengthCm, widthCm, heightCm }
              : null,
          volumeCbm: volumeCbm ?? computedCbm(koli),
          weightKg,
        }
      })
    return exhibitorLogisticsSchema.parse({
      hall: hall.trim() || null,
      booth: booth.trim() || null,
      koli: { totalCount: Number(totalCount.trim() || 0), details },
      notes: notes
        .filter((note) => note.text.trim())
        .map((note) => ({ kind: note.kind, text: note.text.trim() })),
    })
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload()
      const saved = await saveExhibitorLogistics(eventId, exhibitor.id, payload)
      toast(`Logistik ${exhibitor.name} tersimpan.`, 'success')
      onSaved(exhibitor.id, saved)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Data logistik tidak dapat disimpan.'
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
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exhibitor-logistics-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5">
          <div className="min-w-0">
            <h2 id="exhibitor-logistics-title" className="text-xl font-bold">
              Logistik exhibitor
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500">{exhibitor.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup editor logistik" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              Hall
              <input className={inputClass} value={hall} placeholder="B1" onChange={(event) => setHall(event.target.value)} />
            </label>
            <label className={labelClass}>
              Booth
              <input className={inputClass} value={booth} placeholder="D035" onChange={(event) => setBooth(event.target.value)} />
            </label>
            <label className={labelClass}>
              Total koli
              <input
                type="number"
                min="0"
                className={inputClass}
                value={totalCount}
                placeholder="3"
                onChange={(event) => setTotalCount(event.target.value)}
              />
            </label>
          </div>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Rincian koli</legend>
            <div className="space-y-3">
              {kolis.map((koli, index) => {
                const cbm = computedCbm(koli)
                return (
                  <div key={index} className="grid items-end gap-3 lg:grid-cols-[1fr_repeat(3,90px)_110px_110px_auto]">
                    <label className={labelClass}>
                      Label
                      <input
                        className={inputClass}
                        value={koli.label}
                        placeholder="PKG 1"
                        onChange={(event) =>
                          setKolis(kolis.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
                        }
                      />
                    </label>
                    {(['lengthCm', 'widthCm', 'heightCm'] as const).map((field) => (
                      <label key={field} className={labelClass}>
                        {field === 'lengthCm' ? 'P (cm)' : field === 'widthCm' ? 'L (cm)' : 'T (cm)'}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={inputClass}
                          value={koli[field]}
                          onChange={(event) =>
                            setKolis(kolis.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: event.target.value } : item)))
                          }
                        />
                      </label>
                    ))}
                    <label className={labelClass}>
                      CBM
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={inputClass}
                        value={koli.volumeCbm}
                        placeholder={cbm !== null ? String(cbm) : undefined}
                        title={cbm !== null ? `Otomatis dari dimensi: ${cbm} CBM` : undefined}
                        onChange={(event) =>
                          setKolis(kolis.map((item, itemIndex) => (itemIndex === index ? { ...item, volumeCbm: event.target.value } : item)))
                        }
                      />
                    </label>
                    <label className={labelClass}>
                      Berat (kg)
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={inputClass}
                        value={koli.weightKg}
                        onChange={(event) =>
                          setKolis(kolis.map((item, itemIndex) => (itemIndex === index ? { ...item, weightKg: event.target.value } : item)))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Hapus koli ${index + 1}`}
                      className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setKolis(kolis.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
              <button type="button" className="btn-secondary" onClick={() => setKolis([...kolis, emptyKoli()])}>
                <Plus size={16} /> Tambah koli
              </button>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Catatan exhibitor</legend>
            <div className="space-y-3">
              {notes.map((note, index) => (
                <div key={index} className="grid items-end gap-3 sm:grid-cols-[220px_1fr_auto]">
                  <label className={labelClass}>
                    Jenis
                    <select
                      className={inputClass}
                      value={note.kind}
                      onChange={(event) =>
                        setNotes(notes.map((item, itemIndex) => (itemIndex === index ? { ...item, kind: event.target.value as OperationalNoteKind } : item)))
                      }
                    >
                      {operationalNoteKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {operationalNoteKindLabels[kind]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Isi catatan
                    <input
                      className={inputClass}
                      value={note.text}
                      placeholder="Ada barang anomali 1 carton"
                      onChange={(event) =>
                        setNotes(notes.map((item, itemIndex) => (itemIndex === index ? { ...item, text: event.target.value } : item)))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Hapus catatan ${index + 1}`}
                    className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setNotes(notes.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => setNotes([...notes, emptyNote()])}>
                <Plus size={16} /> Tambah catatan
              </button>
            </div>
          </fieldset>

          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Batal
          </button>
          <button type="button" disabled={saving} onClick={submit} className="btn-primary">
            {saving ? 'Menyimpan…' : 'Simpan logistik'}
          </button>
        </div>
      </div>
    </div>
  )
}
