'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

import {
  cbmFromDimension,
  koliCollectionSchema,
  operationalNoteKindLabels,
  operationalNoteKinds,
  operationalNoteSchema,
  type OperationalNoteKind,
} from '@/domain/job/manifest'
import {
  ciplLineInputs,
  createEventExhibitors,
  saveJobCipl,
  updateExhibitor,
  type Exhibitor,
  type Job,
  type JobCiplLine,
} from '@/lib/data-client'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

/** `id`/`satuanKemasan` hasil scan dibawa apa adanya: baris barang merujuk koli lewat id-nya. */
type KoliDraft = {
  id?: string
  satuanKemasan?: string | null
  label: string
  lengthCm: string
  widthCm: string
  heightCm: string
  volumeCbm: string
  weightKg: string
  netWeightKg: string
}
type NoteDraft = { kind: OperationalNoteKind; text: string }

const emptyKoli = (): KoliDraft => ({ label: '', lengthCm: '', widthCm: '', heightCm: '', volumeCbm: '', weightKg: '', netWeightKg: '' })
const emptyNote = (): NoteDraft => ({ kind: 'LAINNYA', text: '' })

const numberOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

const computedCbm = (koli: KoliDraft) =>
  cbmFromDimension(Number(koli.lengthCm), Number(koli.widthCm), Number(koli.heightCm))

/** Total berat gross/net: kosong = null (jumlahkan rincian); bukan angka ≥ 0 = galat. */
function checkedWeight(value: string): number | null {
  const parsed = numberOrNull(value)
  if (Number.isNaN(parsed)) throw new Error('Total berat harus angka ≥ 0.')
  return parsed
}

const labelClass = 'label'
const inputClass = 'input mt-1'

const NEW_EXHIBITOR = '__new__'

/**
 * Editor satu baris CIPL job: tautan ke exhibitor event (pilih yang ada / buat baru dari nama di
 * dokumen / biarkan belum tertaut), hall & booth milik exhibitor, serta koli & catatan milik baris
 * (barang exhibitor di kiriman ini). Semua baris CIPL job disimpan ulang utuh dengan guard versi.
 */
export function CiplLineModal({
  job,
  line,
  eventExhibitors,
  onClose,
  onSaved,
}: {
  job: Job
  line: JobCiplLine
  eventExhibitors: Exhibitor[]
  onClose: () => void
  onSaved: (job: Job) => void
}) {
  const [exhibitorChoice, setExhibitorChoice] = useState(line.exhibitorId ?? '')
  const chosen = eventExhibitors.find((exhibitor) => exhibitor.id === exhibitorChoice) ?? null
  const [hall, setHall] = useState(line.exhibitor?.hall ?? '')
  const [booth, setBooth] = useState(line.exhibitor?.booth ?? '')
  const [totalCount, setTotalCount] = useState(String(line.koli.totalCount))
  const [totalWeightKg, setTotalWeightKg] = useState(
    line.koli.totalWeightKg != null ? String(line.koli.totalWeightKg) : '',
  )
  const [totalNetWeightKg, setTotalNetWeightKg] = useState(
    line.koli.totalNetWeightKg != null ? String(line.koli.totalNetWeightKg) : '',
  )
  const [kolis, setKolis] = useState<KoliDraft[]>(
    line.koli.details.length
      ? line.koli.details.map((koli) => ({
          id: koli.id,
          satuanKemasan: koli.satuanKemasan ?? null,
          label: koli.label ?? '',
          lengthCm: koli.dimension ? String(koli.dimension.lengthCm) : '',
          widthCm: koli.dimension ? String(koli.dimension.widthCm) : '',
          heightCm: koli.dimension ? String(koli.dimension.heightCm) : '',
          volumeCbm: koli.volumeCbm !== null ? String(koli.volumeCbm) : '',
          weightKg: koli.weightKg !== null ? String(koli.weightKg) : '',
          netWeightKg: koli.netWeightKg != null ? String(koli.netWeightKg) : '',
        }))
      : [emptyKoli()],
  )
  const [notes, setNotes] = useState<NoteDraft[]>(
    line.notes.map((note) => ({ kind: note.kind, text: note.text })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function chooseExhibitor(value: string) {
    setExhibitorChoice(value)
    const next = eventExhibitors.find((exhibitor) => exhibitor.id === value)
    // Hall/booth milik exhibitor: tampilkan miliknya saat memilih exhibitor lain.
    if (next) {
      setHall(next.hall ?? '')
      setBooth(next.booth ?? '')
    }
  }

  function buildLine() {
    const details = kolis
      .filter((koli) => [koli.label, koli.lengthCm, koli.widthCm, koli.heightCm, koli.volumeCbm, koli.weightKg, koli.netWeightKg].some((value) => value.trim()))
      .map((koli) => {
        const lengthCm = numberOrNull(koli.lengthCm)
        const widthCm = numberOrNull(koli.widthCm)
        const heightCm = numberOrNull(koli.heightCm)
        const volumeCbm = numberOrNull(koli.volumeCbm)
        const weightKg = numberOrNull(koli.weightKg)
        const netWeightKg = numberOrNull(koli.netWeightKg)
        if ([lengthCm, widthCm, heightCm, volumeCbm, weightKg, netWeightKg].includes(Number.NaN)) throw new Error('Ukuran/berat koli harus angka ≥ 0.')
        return {
          ...(koli.id ? { id: koli.id } : {}),
          ...(koli.satuanKemasan !== undefined ? { satuanKemasan: koli.satuanKemasan } : {}),
          label: koli.label.trim() || null,
          dimension:
            lengthCm !== null && widthCm !== null && heightCm !== null
              ? { lengthCm, widthCm, heightCm }
              : null,
          volumeCbm: volumeCbm ?? computedCbm(koli),
          weightKg,
          netWeightKg,
        }
      })
    return {
      koli: koliCollectionSchema.parse({
        totalCount: Number(totalCount.trim() || 0),
        bareCaseCount: line.koli.bareCaseCount ?? null,
        totalWeightKg: checkedWeight(totalWeightKg),
        totalNetWeightKg: checkedWeight(totalNetWeightKg),
        totalVolumeCbm: line.koli.totalVolumeCbm ?? null,
        details,
      }),
      notes: notes
        .filter((note) => note.text.trim())
        .map((note) => operationalNoteSchema.parse({ kind: note.kind, text: note.text.trim() })),
    }
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const { koli, notes: lineNotes } = buildLine()
      const hallValue = hall.trim() || null
      const boothValue = booth.trim() || null

      // 1. Exhibitor: buat baru dari nama di dokumen, atau lengkapi hall/booth yang berubah.
      let exhibitorId: string | null = exhibitorChoice || null
      if (exhibitorChoice === NEW_EXHIBITOR) {
        const [created] = await createEventExhibitors(job.eventId, [
          {
            name: line.nameOnDocument,
            kind: job.kind === 'LOCAL' ? 'LOCAL' : 'INTERNATIONAL',
            hall: hallValue,
            booth: boothValue,
          },
        ])
        exhibitorId = created.id
      } else if (chosen && (chosen.hall !== hallValue || chosen.booth !== boothValue)) {
        await updateExhibitor(chosen.id, { hall: hallValue, booth: boothValue })
      }

      // 2. Baris CIPL: ganti baris ini, kirim ulang semua baris job (atomik + guard versi).
      const lines = ciplLineInputs(job).map((input, index) =>
        job.ciplLines[index]?.id === line.id
          ? { ...input, exhibitorId, koli, notes: lineNotes }
          : input,
      )
      const saved = await saveJobCipl(job, job.ciplDocument, lines)
      toast(`Baris CIPL ${line.nameOnDocument} tersimpan.`, 'success')
      onSaved(saved)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Baris CIPL tidak dapat disimpan.'
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
        aria-labelledby="cipl-line-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5">
          <div className="min-w-0">
            <h2 id="cipl-line-title" className="text-xl font-bold">
              Baris CIPL
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              Tertulis di dokumen: {line.nameOnDocument}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup editor baris CIPL" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <label className={labelClass}>
            Exhibitor event
            <select
              className={inputClass}
              value={exhibitorChoice}
              onChange={(event) => chooseExhibitor(event.target.value)}
            >
              <option value="">Belum ditautkan</option>
              <option value={NEW_EXHIBITOR}>+ Daftarkan baru: {line.nameOnDocument}</option>
              {eventExhibitors.map((exhibitor) => (
                <option key={exhibitor.id} value={exhibitor.id}>
                  {exhibitor.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Menautkan baris ini ke exhibitor event membuat barangnya terhitung milik exhibitor itu
              (untuk tagihan dan rekap lintas job).
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              Hall
              <input
                className={inputClass}
                value={hall}
                placeholder="B1"
                disabled={!exhibitorChoice}
                title={exhibitorChoice ? 'Disimpan pada data exhibitor' : 'Tautkan exhibitor dulu'}
                onChange={(event) => setHall(event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Booth
              <input
                className={inputClass}
                value={booth}
                placeholder="D035"
                disabled={!exhibitorChoice}
                title={exhibitorChoice ? 'Disimpan pada data exhibitor' : 'Tautkan exhibitor dulu'}
                onChange={(event) => setBooth(event.target.value)}
              />
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
            <label className={labelClass}>
              Total gross (kg)
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={totalWeightKg}
                placeholder="Jumlah rincian"
                onChange={(event) => setTotalWeightKg(event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Total net (kg)
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={totalNetWeightKg}
                placeholder="Jumlah rincian"
                onChange={(event) => setTotalNetWeightKg(event.target.value)}
              />
            </label>
          </div>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Rincian koli</legend>
            <div className="space-y-3">
              {kolis.map((koli, index) => {
                const cbm = computedCbm(koli)
                return (
                  <div key={index} className="grid items-end gap-3 lg:grid-cols-[1fr_repeat(3,90px)_110px_110px_110px_auto]">
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
                      Gross (kg)
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
                    <label className={labelClass}>
                      Net (kg)
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={inputClass}
                        value={koli.netWeightKg}
                        onChange={(event) =>
                          setKolis(kolis.map((item, itemIndex) => (itemIndex === index ? { ...item, netWeightKg: event.target.value } : item)))
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
            <legend className="px-1 text-sm font-semibold text-slate-800">Catatan muatan</legend>
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
            {saving ? 'Menyimpan…' : 'Simpan baris CIPL'}
          </button>
        </div>
      </div>
    </div>
  )
}
