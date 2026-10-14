'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

import {
  containerSizes,
  containerSizeLabels,
  milestoneKindLabels,
  milestoneKinds,
  operationalNoteKindLabels,
  operationalNoteKinds,
  inwardManifestSchema,
  jobReturnSchema,
  type ContainerSize,
  type ExhibitorLogistics,
  type InwardManifest,
  type JobReturn,
  type MilestoneKind,
  type OperationalNoteKind,
} from '@/domain/job/manifest'
import { saveExhibitorLogistics, saveJobInward, saveJobKepulangan, type LocalExhibitor, type LocalJob } from '@/lib/data-client'
import type { ManifestBlockParse } from '@/lib/server/manifest-extraction'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const namesOverlap = (left: string, right: string) => {
  const a = normalizeName(left)
  const b = normalizeName(right)
  return Boolean(a) && Boolean(b) && (a === b || a.includes(b) || b.includes(a))
}

type ContainerDraft = { containerNumber: string; size: ContainerSize; sealNumber: string }
type MilestoneDraft = { kind: MilestoneKind; date: string; documentNumber: string }
type NoteDraft = { kind: OperationalNoteKind; text: string }
type KepulanganDraft = {
  enabled: boolean
  mode: 'FCL' | 'LCL'
  containers: ContainerDraft[]
  koliCount: string
  destination: string
  shippingLine: string
  bookingNumber: string
  vessel: string
  etd: string
  eta: string
  notes: NoteDraft[]
}

const emptyContainer = (): ContainerDraft => ({ containerNumber: '', size: 'K40', sealNumber: '' })
const emptyMilestone = (): MilestoneDraft => ({ kind: 'ETA', date: '', documentNumber: '' })
const emptyNote = (): NoteDraft => ({ kind: 'LAINNYA', text: '' })

function draftFromJob(job: LocalJob) {
  const inward = job.inward
  const kepulangan = job.kepulangan
  const initial: {
    documentKind: 'BL' | 'AWB'
    documentNumber: string
    loadKind: 'LCL' | 'FCL'
    containers: ContainerDraft[]
    milestones: MilestoneDraft[]
    notes: NoteDraft[]
    kepulangan: KepulanganDraft
  } = {
    documentKind: inward?.transportDocument.kind ?? 'BL',
    documentNumber: inward?.transportDocument.number ?? '',
    loadKind: inward?.loadConfiguration.kind ?? 'LCL',
    containers: inward?.loadConfiguration.kind === 'FCL'
      ? inward.loadConfiguration.containers.map((container) => ({
          containerNumber: container.containerNumber ?? '',
          size: container.size,
          sealNumber: container.sealNumber ?? '',
        }))
      : [emptyContainer()],
    milestones: inward?.milestones.map((milestone) => ({
      kind: milestone.kind,
      date: milestone.date,
      documentNumber: milestone.documentNumber ?? '',
    })) ?? [],
    notes: inward?.notes.map((note) => ({ kind: note.kind, text: note.text })) ?? [],
    kepulangan: {
      enabled: Boolean(kepulangan),
      mode: kepulangan?.mode.kind ?? 'FCL',
      containers: kepulangan?.mode.kind === 'FCL'
        ? kepulangan.mode.containers.map((container) => ({
            containerNumber: container.containerNumber ?? '',
            size: container.size,
            sealNumber: container.sealNumber ?? '',
          }))
        : [emptyContainer()],
      koliCount: kepulangan?.mode.kind === 'LCL' ? String(kepulangan.mode.koliCount) : '',
      destination: kepulangan?.destination ?? '',
      shippingLine: kepulangan?.shippingLine ?? '',
      bookingNumber: kepulangan?.bookingNumber ?? '',
      vessel: kepulangan?.vessel ?? '',
      etd: kepulangan?.etd ?? '',
      eta: kepulangan?.eta ?? '',
      notes: kepulangan?.notes.map((note) => ({ kind: note.kind, text: note.text })) ?? [],
    },
  }
  return initial
}

/** JobReturn | null dari draft kepulangan; null saat dimatikan. */
function buildKepulangan(draft: KepulanganDraft): JobReturn | null {
  if (!draft.enabled) return null
  const notes = draft.notes
    .filter((note) => note.text.trim())
    .map((note) => ({ kind: note.kind, text: note.text.trim() }))
  return {
    mode:
      draft.mode === 'LCL'
        ? { kind: 'LCL', koliCount: Number(draft.koliCount || 0) }
        : {
            kind: 'FCL',
            containers: draft.containers.map((container) => ({
              containerNumber: container.containerNumber.trim() || null,
              size: container.size,
              sealNumber: container.sealNumber.trim() || null,
            })),
          },
    destination: draft.destination.trim() || null,
    shippingLine: draft.shippingLine.trim() || null,
    bookingNumber: draft.bookingNumber.trim() || null,
    vessel: draft.vessel.trim() || null,
    etd: draft.etd || null,
    eta: draft.eta || null,
    notes,
  }
}

const labelClass = 'label'
const inputClass = 'input mt-1'

export function JobManifestEditorModal({
  job,
  eventId,
  peserta,
  onClose,
  onSaved,
  onPesertaLogisticsSaved,
}: {
  job: LocalJob
  eventId: string | null
  peserta: Array<{ exhibitor: LocalExhibitor; logistics: LocalExhibitor['logistics'] }>
  onClose: () => void
  onSaved: (job: LocalJob) => void
  onPesertaLogisticsSaved: (exhibitorId: string, logistics: ExhibitorLogistics) => void
}) {
  const [draft, setDraft] = useState(() => draftFromJob(job))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<{ blocks: ManifestBlockParse[]; warnings: string[] } | null>(null)
  const [appliedExhibitorIds, setAppliedExhibitorIds] = useState<Set<string>>(new Set())
  const usedMilestoneKinds = new Set(draft.milestones.map((milestone) => milestone.kind))
  const appliedBlock = importResult
    ? (job.agent ? importResult.blocks.find((block) => namesOverlap(block.agentName, job.agent!)) : undefined) ??
      importResult.blocks[0] ??
      null
    : null

  function buildInward(): InwardManifest {
    return {
      transportDocument:
        draft.documentKind === 'BL'
          ? { kind: 'BL', number: draft.documentNumber.trim() }
          : { kind: 'AWB', number: draft.documentNumber.trim() },
      loadConfiguration:
        draft.loadKind === 'LCL'
          ? { kind: 'LCL' }
          : {
              kind: 'FCL',
              containers: draft.containers.map((container) => ({
                containerNumber: container.containerNumber.trim() || null,
                size: container.size,
                sealNumber: container.sealNumber.trim() || null,
              })),
            },
      milestones: draft.milestones
        .filter((milestone) => milestone.date)
        .map((milestone) => ({
          kind: milestone.kind,
          date: milestone.date,
          documentNumber: milestone.documentNumber.trim() || null,
        })),
      notes: draft.notes
        .filter((note) => note.text.trim())
        .map((note) => ({ kind: note.kind, text: note.text.trim() })),
    }
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const inward = inwardManifestSchema.parse(buildInward())
      const kepulangan = buildKepulangan(draft.kepulangan)
      const kepulanganParsed = kepulangan === null ? null : jobReturnSchema.parse(kepulangan)
      let saved = await saveJobInward(job.id, inward)
      if (kepulanganParsed || job.kepulangan) saved = await saveJobKepulangan(job.id, kepulanganParsed)
      toast('Blok manifest job tersimpan.', 'success')
      onSaved(saved)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Manifest job tidak dapat disimpan.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function applyBlockToDraft(block: ManifestBlockParse) {
    setDraft((current) => ({
      ...current,
      documentKind: block.inward.transportDocument.kind,
      documentNumber: block.inward.transportDocument.number,
      loadKind: block.inward.loadConfiguration.kind,
      containers:
        block.inward.loadConfiguration.kind === 'FCL'
          ? block.inward.loadConfiguration.containers.map((container) => ({
              containerNumber: container.containerNumber ?? '',
              size: container.size,
              sealNumber: container.sealNumber ?? '',
            }))
          : [emptyContainer()],
      milestones: block.inward.milestones.map((milestone) => ({
        kind: milestone.kind,
        date: milestone.date,
        documentNumber: milestone.documentNumber ?? '',
      })),
      notes: block.inward.notes.map((note) => ({ kind: note.kind, text: note.text })),
    }))
  }

  async function importManifestFile(file: File) {
    setImporting(true)
    setImportError('')
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/parse-manifest', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as
        | { blocks?: ManifestBlockParse[]; warnings?: string[] }
        | { error?: string }
        | null
      if (!response.ok || !data || ('error' in data && typeof data.error === 'string')) {
        throw new Error(data && 'error' in data && typeof data.error === 'string' ? data.error : 'Manifest tidak dapat diparse.')
      }
      const result = data as { blocks: ManifestBlockParse[]; warnings?: string[] }
      setImportResult({ blocks: result.blocks, warnings: result.warnings ?? [] })
      if (!result.blocks.length) {
        toast('Tidak ada blok manifest yang terbaca.', 'error')
        return
      }
      const block = (job.agent ? result.blocks.find((item) => namesOverlap(item.agentName, job.agent!)) : undefined) ?? result.blocks[0]
      applyBlockToDraft(block)
      toast(`Blok "${block.agentName}" diterapkan ke form — review lalu simpan.`, 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Manifest tidak dapat diparse.'
      setImportError(message)
      toast(message, 'error')
    } finally {
      setImporting(false)
    }
  }

  async function applyExhibitorLogistics(target: { exhibitor: LocalExhibitor }, logistics: ExhibitorLogistics) {
    if (!eventId) return
    try {
      const saved = await saveExhibitorLogistics(eventId, target.exhibitor.id, logistics)
      setAppliedExhibitorIds((current) => new Set(current).add(target.exhibitor.id))
      onPesertaLogisticsSaved(target.exhibitor.id, saved)
      toast(`Logistik ${target.exhibitor.name} terisi dari manifest.`, 'success')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Logistik exhibitor tidak dapat disimpan.', 'error')
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
        aria-labelledby="job-manifest-editor-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5">
          <div>
            <h2 id="job-manifest-editor-title" className="text-xl font-bold">
              Edit blok manifest
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {job.jobNumber} · {job.agent || job.clientName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup editor manifest" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {eventId && (
            <fieldset className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">Import manifest (otomatis)</legend>
              <p className="text-sm text-slate-600">
                Pilih file inward manifest (Excel/PDF). Blok job ini akan mengisi form di bawah untuk direview sebelum disimpan.
              </p>
              <input
                type="file"
                accept="application/pdf,.pdf,.xlsx,.xls"
                disabled={importing}
                className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-700"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importManifestFile(file)
                  event.target.value = ''
                }}
              />
              {importing && <p className="mt-2 text-sm font-medium text-orange-700">Memparsing manifest…</p>}
              {importError && <p className="mt-2 text-sm text-rose-700">{importError}</p>}
              {importResult && (
                <div className="mt-3 space-y-2 text-sm">
                  {importResult.warnings.map((warning, index) => (
                    <p key={index} className="text-xs text-amber-700">{warning}</p>
                  ))}
                  {appliedBlock ? (
                    <p className="text-slate-700">
                      Blok <strong>{appliedBlock.agentName}</strong> diterapkan ke form ({appliedBlock.inward.transportDocument.kind}{' '}
                      {appliedBlock.inward.transportDocument.number}).
                    </p>
                  ) : (
                    <p className="text-slate-500">Tidak ada blok yang cocok untuk job ini.</p>
                  )}
                  {appliedBlock && appliedBlock.exhibitors.length > 0 && (
                    <div className="rounded-lg border border-black/10 bg-white">
                      <p className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Koli exhibitor dari manifest
                      </p>
                      <ul className="divide-y divide-slate-100">
                        {appliedBlock.exhibitors.map((exhibitor) => {
                          const target = peserta.find((item) => namesOverlap(item.exhibitor.name, exhibitor.name))
                          const applied = target && appliedExhibitorIds.has(target.exhibitor.id)
                          return (
                            <li key={exhibitor.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                              <span className="min-w-0 truncate text-slate-700" title={exhibitor.name}>
                                {exhibitor.name} · {exhibitor.logistics.koli.totalCount} koli
                              </span>
                              {target ? (
                                <button
                                  type="button"
                                  disabled={applied}
                                  onClick={() => void applyExhibitorLogistics(target, exhibitor.logistics)}
                                  className="text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:text-emerald-700"
                                >
                                  {applied ? '✓ Diterapkan' : `Terapkan ke ${target.exhibitor.name}`}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">Tidak ada exhibitor yang cocok</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Dokumen angkut</legend>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <label className={labelClass}>
                Jenis
                <select
                  className={inputClass}
                  value={draft.documentKind}
                  onChange={(event) => setDraft({ ...draft, documentKind: event.target.value as 'BL' | 'AWB' })}
                >
                  <option value="BL">B/L (laut)</option>
                  <option value="AWB">AWB (udara)</option>
                </select>
              </label>
              <label className={labelClass}>
                Nomor {draft.documentKind === 'BL' ? 'B/L' : 'AWB'}
                <input
                  className={inputClass}
                  value={draft.documentNumber}
                  onChange={(event) => setDraft({ ...draft, documentNumber: event.target.value })}
                  placeholder={draft.documentKind === 'BL' ? 'SHFPSJKT26026454' : 'YMJAI237131110'}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Konfigurasi muatan</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="radio"
                  name="load-kind"
                  checked={draft.loadKind === 'LCL'}
                  onChange={() => setDraft({ ...draft, loadKind: 'LCL' })}
                  className="h-4 w-4 accent-orange-600"
                />
                LCL (konsolidasi)
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="radio"
                  name="load-kind"
                  checked={draft.loadKind === 'FCL'}
                  onChange={() => setDraft({ ...draft, loadKind: 'FCL' })}
                  className="h-4 w-4 accent-orange-600"
                />
                FCL (kontainer penuh)
              </label>
            </div>
            {draft.loadKind === 'FCL' && (
              <div className="mt-4 space-y-3">
                {draft.containers.map((container, index) => (
                  <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_140px_1fr_auto]">
                    <label className={labelClass}>
                      Nomor kontainer
                      <input
                        className={inputClass}
                        value={container.containerNumber}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            containers: draft.containers.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, containerNumber: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className={labelClass}>
                      Ukuran
                      <select
                        className={inputClass}
                        value={container.size}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            containers: draft.containers.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, size: event.target.value as ContainerSize } : item,
                            ),
                          })
                        }
                      >
                        {containerSizes.map((size) => (
                          <option key={size} value={size}>
                            {containerSizeLabels[size]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Seal
                      <input
                        className={inputClass}
                        value={container.sealNumber}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            containers: draft.containers.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, sealNumber: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Hapus kontainer ${index + 1}`}
                      className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() =>
                        setDraft({ ...draft, containers: draft.containers.filter((_, itemIndex) => itemIndex !== index) })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDraft({ ...draft, containers: [...draft.containers, emptyContainer()] })}
                >
                  <Plus size={16} /> Tambah kontainer
                </button>
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Milestone operasional</legend>
            <div className="space-y-3">
              {draft.milestones.map((milestone, index) => (
                <div key={index} className="grid items-end gap-3 sm:grid-cols-[200px_170px_1fr_auto]">
                  <label className={labelClass}>
                    Jenis
                    <select
                      className={inputClass}
                      value={milestone.kind}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          milestones: draft.milestones.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, kind: event.target.value as MilestoneKind } : item,
                          ),
                        })
                      }
                    >
                      {milestoneKinds.map((kind) => (
                        <option key={kind} value={kind} disabled={kind !== milestone.kind && usedMilestoneKinds.has(kind)}>
                          {milestoneKindLabels[kind]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Tanggal
                    <input
                      type="date"
                      className={inputClass}
                      value={milestone.date}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          milestones: draft.milestones.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, date: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    Nomor surat (Skep/SPPB)
                    <input
                      className={inputClass}
                      value={milestone.documentNumber}
                      placeholder="S-622/WBC.08/2026"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          milestones: draft.milestones.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, documentNumber: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Hapus milestone ${index + 1}`}
                    className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() =>
                      setDraft({ ...draft, milestones: draft.milestones.filter((_, itemIndex) => itemIndex !== index) })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                disabled={usedMilestoneKinds.size === milestoneKinds.length}
                onClick={() => setDraft({ ...draft, milestones: [...draft.milestones, emptyMilestone()] })}
              >
                <Plus size={16} /> Tambah milestone
              </button>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Catatan job</legend>
            <div className="space-y-3">
              {draft.notes.map((note, index) => (
                <div key={index} className="grid items-end gap-3 sm:grid-cols-[200px_1fr_auto]">
                  <label className={labelClass}>
                    Jenis
                    <select
                      className={inputClass}
                      value={note.kind}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          notes: draft.notes.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, kind: event.target.value as OperationalNoteKind } : item,
                          ),
                        })
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
                      placeholder="Hold until Interfood"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          notes: draft.notes.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, text: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Hapus catatan ${index + 1}`}
                    className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setDraft({ ...draft, notes: draft.notes.filter((_, itemIndex) => itemIndex !== index) })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => setDraft({ ...draft, notes: [...draft.notes, emptyNote()] })}>
                <Plus size={16} /> Tambah catatan
              </button>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-black/10 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Kepulangan (return list)</legend>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.kepulangan.enabled}
                onChange={(event) =>
                  setDraft({ ...draft, kepulangan: { ...draft.kepulangan, enabled: event.target.checked } })
                }
                className="h-4 w-4 accent-orange-600"
              />
              Isi rencana pengembalian kontainer/LCL
            </label>
            {draft.kepulangan.enabled && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="return-mode"
                      checked={draft.kepulangan.mode === 'FCL'}
                      onChange={() => setDraft({ ...draft, kepulangan: { ...draft.kepulangan, mode: 'FCL' } })}
                      className="h-4 w-4 accent-orange-600"
                    />
                    Kontainer penuh
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="return-mode"
                      checked={draft.kepulangan.mode === 'LCL'}
                      onChange={() => setDraft({ ...draft, kepulangan: { ...draft.kepulangan, mode: 'LCL' } })}
                      className="h-4 w-4 accent-orange-600"
                    />
                    LCL
                  </label>
                </div>
                {draft.kepulangan.mode === 'FCL' ? (
                  <div className="space-y-3">
                    {draft.kepulangan.containers.map((container, index) => (
                      <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_140px_auto]">
                        <label className={labelClass}>
                          Nomor kontainer
                          <input
                            className={inputClass}
                            value={container.containerNumber}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                kepulangan: {
                                  ...draft.kepulangan,
                                  containers: draft.kepulangan.containers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, containerNumber: event.target.value } : item,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Ukuran
                          <select
                            className={inputClass}
                            value={container.size}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                kepulangan: {
                                  ...draft.kepulangan,
                                  containers: draft.kepulangan.containers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, size: event.target.value as ContainerSize } : item,
                                  ),
                                },
                              })
                            }
                          >
                            {containerSizes.map((size) => (
                              <option key={size} value={size}>
                                {containerSizeLabels[size]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          aria-label={`Hapus kontainer kepulangan ${index + 1}`}
                          className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              kepulangan: {
                                ...draft.kepulangan,
                                containers: draft.kepulangan.containers.filter((_, itemIndex) => itemIndex !== index),
                              },
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          kepulangan: { ...draft.kepulangan, containers: [...draft.kepulangan.containers, emptyContainer()] },
                        })
                      }
                    >
                      <Plus size={16} /> Tambah kontainer
                    </button>
                  </div>
                ) : (
                  <label className={`${labelClass} max-w-48`}>
                    Jumlah koli
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={draft.kepulangan.koliCount}
                      onChange={(event) =>
                        setDraft({ ...draft, kepulangan: { ...draft.kepulangan, koliCount: event.target.value } })
                      }
                    />
                  </label>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className={labelClass}>
                    Tujuan
                    <input
                      className={inputClass}
                      value={draft.kepulangan.destination}
                      placeholder="Shanghai"
                      onChange={(event) =>
                        setDraft({ ...draft, kepulangan: { ...draft.kepulangan, destination: event.target.value } })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    Shipping line
                    <input
                      className={inputClass}
                      value={draft.kepulangan.shippingLine}
                      placeholder="KMTC"
                      onChange={(event) =>
                        setDraft({ ...draft, kepulangan: { ...draft.kepulangan, shippingLine: event.target.value } })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    Booking number
                    <input
                      className={inputClass}
                      value={draft.kepulangan.bookingNumber}
                      onChange={(event) =>
                        setDraft({ ...draft, kepulangan: { ...draft.kepulangan, bookingNumber: event.target.value } })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    Vessel
                    <input
                      className={inputClass}
                      value={draft.kepulangan.vessel}
                      onChange={(event) =>
                        setDraft({ ...draft, kepulangan: { ...draft.kepulangan, vessel: event.target.value } })
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    ETD
                    <input
                      type="date"
                      className={inputClass}
                      value={draft.kepulangan.etd}
                      onChange={(event) => setDraft({ ...draft, kepulangan: { ...draft.kepulangan, etd: event.target.value } })}
                    />
                  </label>
                  <label className={labelClass}>
                    ETA
                    <input
                      type="date"
                      className={inputClass}
                      value={draft.kepulangan.eta}
                      onChange={(event) => setDraft({ ...draft, kepulangan: { ...draft.kepulangan, eta: event.target.value } })}
                    />
                  </label>
                </div>
                <div className="space-y-3">
                  {draft.kepulangan.notes.map((note, index) => (
                    <div key={index} className="grid items-end gap-3 sm:grid-cols-[200px_1fr_auto]">
                      <label className={labelClass}>
                        Jenis catatan
                        <select
                          className={inputClass}
                          value={note.kind}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              kepulangan: {
                                ...draft.kepulangan,
                                notes: draft.kepulangan.notes.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, kind: event.target.value as OperationalNoteKind } : item,
                                ),
                              },
                            })
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
                          placeholder="Hold until Interfood"
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              kepulangan: {
                                ...draft.kepulangan,
                                notes: draft.kepulangan.notes.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, text: event.target.value } : item,
                                ),
                              },
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Hapus catatan kepulangan ${index + 1}`}
                        className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            kepulangan: {
                              ...draft.kepulangan,
                              notes: draft.kepulangan.notes.filter((_, itemIndex) => itemIndex !== index),
                            },
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setDraft({ ...draft, kepulangan: { ...draft.kepulangan, notes: [...draft.kepulangan.notes, emptyNote()] } })
                    }
                  >
                    <Plus size={16} /> Tambah catatan kepulangan
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Batal
          </button>
          <button type="button" disabled={saving} onClick={submit} className="btn-primary">
            {saving ? 'Menyimpan…' : 'Simpan manifest'}
          </button>
        </div>
      </div>
    </div>
  )
}
