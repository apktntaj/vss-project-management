'use client'

import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2, Upload } from 'lucide-react'

import {
  applyCiplAutofill,
  ciplLineInputs,
  saveJobDocument,
  saveJobOperationalDetails,
  type Exhibitor,
  type Job,
} from '@/lib/data-client'
import {
  barisBarangSchema,
  buildCiplDocument,
  disposisiBarangs,
  disposisiBarangLabels,
  type BarisBarang,
  type CiplDocumentHeader,
  type DisposisiBarang,
} from '@/domain/exhibition/cipl-document'
import {
  autofillResolutionLabels,
  reconcileKoliTotal,
  resolveCiplAutofill,
  summarizeAutofill,
  type CiplScanEntry,
} from '@/domain/exhibition/cipl-autofill'
import { matchExhibitorByName } from '@/domain/event/exhibitor-matching'
import { exhibitorLogisticsSchema, type Koli } from '@/domain/job/manifest'
import type { CiplScanResult } from '@/lib/server/manifest-extraction'
import { isAcceptedJobDocument, jobDocumentAccept } from '@/components/job-document-file'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { jobLabel } from '@/domain/job/numbering'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type CiplLineDraft = {
  label: string
  length: string
  width: string
  height: string
  cbm: string
  weight: string
  satuanKemasan: string
  uraian: string
  merekModel: string
  kodeHs: string
  jumlah: string
  satuan: string
  nilaiSatuan: string
  nilaiTotal: string
  disposisi: DisposisiBarang
}
type CiplRowDraft = {
  key: string
  jobNo: string
  name: string
  totalPackage: string
  bareCase: string
  hall: string
  booth: string
  lines: CiplLineDraft[]
}

/** Badge status penautan satu baris terhadap exhibitor event — diturunkan dari nama, bukan disimpan. */
function rowLinkStatus(name: string, pool: ReadonlyArray<Exhibitor>) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const match = matchExhibitorByName(trimmed, pool)
  if (match.kind === 'MATCHED') return { kind: 'TERTAUT' as const, hint: match.exhibitor.name }
  if (match.kind === 'AMBIGUOUS')
    return { kind: 'AMBIGU' as const, hint: `${match.candidates.length} exhibitor bernama sama` }
  return { kind: 'BARU' as const, hint: 'akan didaftarkan ke event' }
}

const linkStatusClass: Record<'TERTAUT' | 'BARU' | 'AMBIGU', string> = {
  TERTAUT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  BARU: 'bg-amber-50 text-amber-700 ring-amber-200',
  AMBIGU: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const emptyLine = (): CiplLineDraft => ({
  label: '',
  length: '',
  width: '',
  height: '',
  cbm: '',
  weight: '',
  satuanKemasan: '',
  uraian: '',
  merekModel: '',
  kodeHs: '',
  jumlah: '',
  satuan: '',
  nilaiSatuan: '',
  nilaiTotal: '',
  disposisi: 'TIDAK_DISEBUT',
})

const emptyRow = (key: string): CiplRowDraft => ({
  key,
  jobNo: '',
  name: '',
  totalPackage: '',
  bareCase: '',
  hall: '',
  booth: '',
  lines: [emptyLine()],
})

/** Satu baris gabungan (kemasan + barang) → BarisBarang; refKoli diwariskan dari kolom case (fill-down). */
function lineToBarang(line: CiplLineDraft, refKoli: string | null): BarisBarang | null {
  const parsed = barisBarangSchema.safeParse({
    uraian: line.uraian.trim(),
    merekModel: line.merekModel.trim() || null,
    kodeHs: line.kodeHs.trim() || null,
    jumlah: numberOrNull(line.jumlah),
    satuan: line.satuan.trim() || 'UNIT',
    nilaiSatuan: numberOrNull(line.nilaiSatuan),
    nilaiTotal: numberOrNull(line.nilaiTotal),
    disposisi: line.disposisi,
    refKoli,
  })
  return parsed.success ? parsed.data : null
}

/** Minimal satu field terisi — gerbang tombol "Tambah exhibitor". */
function isRowFilled(row: CiplRowDraft): boolean {
  if (
    row.name.trim() ||
    row.totalPackage.trim() ||
    row.bareCase.trim() ||
    row.hall.trim() ||
    row.booth.trim()
  ) {
    return true
  }
  return row.lines.some((line) =>
    Boolean(
      line.label.trim() ||
      line.length.trim() ||
      line.width.trim() ||
      line.height.trim() ||
      line.cbm.trim() ||
      line.weight.trim() ||
      line.satuanKemasan.trim() ||
      line.uraian.trim() ||
      line.merekModel.trim() ||
      line.kodeHs.trim() ||
      line.jumlah.trim() ||
      line.satuan.trim() ||
      line.nilaiSatuan.trim() ||
      line.nilaiTotal.trim() ||
      line.disposisi !== 'TIDAK_DISEBUT',
    ),
  )
}

const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scanFileAcceptable(file: File): boolean {
  if (isAcceptedJobDocument(file)) return true
  toast('File harus berupa PDF atau Excel.', 'error')
  return false
}

/**
 * Entri CIPL massal untuk job yang sudah ada: daftar exhibitor + rincian koli/barang, dengan
 * smart scan LLM. Baris CIPL yang sudah ada di job dipertahankan (penyimpanan mengganti seluruh
 * baris); exhibitor yang sudah punya baris di job ditolak agar tidak terduplikasi.
 */
export function CiplEntryModal({
  job,
  eventExhibitors,
  onSaved,
  onClose,
}: {
  job: Job
  eventExhibitors: Exhibitor[]
  onSaved: (job: Job) => void
  onClose: () => void
}) {
  const [ciplRows, setCiplRows] = useState<CiplRowDraft[]>(() => [emptyRow('cipl-row-0')])
  const [ciplFile, setCiplFile] = useState<File | null>(null)
  const [scanningCipl, setScanningCipl] = useState(false)
  const [ciplHeader, setCiplHeader] = useState<CiplDocumentHeader | null>(null)
  const [ciplBelumTerpetakan, setCiplBelumTerpetakan] = useState<BarisBarang[]>([])
  const [saving, setSaving] = useState(false)
  const rowKeyRef = useRef(0)
  const nextRowKey = () => `cipl-row-${++rowKeyRef.current}`

  async function scanCipl(file: File) {
    if (!scanFileAcceptable(file)) return
    setScanningCipl(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/scan-cipl', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as
        (Partial<CiplScanResult> & { warnings?: string[] }) | { error?: string } | null
      if (!response.ok || !data || !('exhibitors' in data) || !Array.isArray(data.exhibitors)) {
        throw new Error(
          data && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Dokumen tidak dapat dipindai.',
        )
      }
      const rows: CiplRowDraft[] = data.exhibitors.map((exhibitor) => {
        const lines: CiplLineDraft[] = exhibitor.logistics.koli.details.map((koli) => ({
          ...emptyLine(),
          label: koli.label ?? '',
          length: koli.dimension?.lengthCm == null ? '' : String(koli.dimension.lengthCm),
          width: koli.dimension?.widthCm == null ? '' : String(koli.dimension.widthCm),
          height: koli.dimension?.heightCm == null ? '' : String(koli.dimension.heightCm),
          cbm: koli.volumeCbm == null ? '' : String(koli.volumeCbm),
          weight: koli.weightKg == null ? '' : String(koli.weightKg),
          satuanKemasan: koli.satuanKemasan ?? '',
        }))
        for (const item of exhibitor.items ?? []) {
          const refLabel = item.refKoli?.trim() || ''
          const target = refLabel
            ? (lines.find((entry) => entry.label.trim() === refLabel && !entry.uraian.trim()) ??
              null)
            : null
          const line = target ?? { ...emptyLine(), label: item.refKoli ?? '' }
          line.uraian = item.uraian
          line.merekModel = item.merekModel ?? ''
          line.kodeHs = item.kodeHs ?? ''
          line.jumlah = String(item.jumlah)
          line.satuan = item.satuan
          line.nilaiSatuan = item.nilaiSatuan == null ? '' : String(item.nilaiSatuan)
          line.nilaiTotal = item.nilaiTotal == null ? '' : String(item.nilaiTotal)
          line.disposisi = item.disposisi
          if (!target) lines.push(line)
        }
        if (lines.length === 0) lines.push(emptyLine())
        return {
          key: nextRowKey(),
          jobNo: exhibitor.jobNo ?? '',
          name: exhibitor.name,
          totalPackage: String(exhibitor.logistics.koli.totalCount),
          bareCase:
            exhibitor.logistics.koli.bareCaseCount == null
              ? ''
              : String(exhibitor.logistics.koli.bareCaseCount),
          hall: exhibitor.logistics.hall ?? '',
          booth: exhibitor.logistics.booth ?? '',
          lines,
        }
      })
      setCiplRows(rows)
      setCiplHeader(data.header ?? null)
      setCiplBelumTerpetakan(data.itemsBelumTerpetakan ?? [])
      setCiplFile(file)
      if (rows.length) {
        toast(
          `${rows.length} exhibitor terbaca dari dokumen — periksa lalu lanjutkan.${data.warnings?.length ? ` (${data.warnings.length} baris dilewati)` : ''}`,
          'success',
        )
      } else {
        toast('Tidak ada baris exhibitor yang terbaca dari dokumen.', 'error')
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dipindai.', 'error')
    } finally {
      setScanningCipl(false)
    }
  }

  /**
   * Draft tabel → entri scan domain. "Total pkg" yang terlihat operator diteruskan sebagai
   * total yang DISEBUT dokumen, sehingga angka yang ia ketik sendiri menang; bila dikosongkan,
   * label koli ("7-11", "in package No. 22") yang menentukan jumlah paket.
   */
  function buildScanEntries(): CiplScanEntry[] {
    const entries: CiplScanEntry[] = []
    for (const row of ciplRows) {
      const name = row.name.trim()
      if (!name) continue
      const details: Koli[] = []
      const labelToId = new Map<string, string>()
      const items: BarisBarang[] = []
      let currentLabel: string | null = null
      let currentKoliId: string | null = null
      for (const line of row.lines) {
        const label = line.label.trim() || null
        if (label !== null) currentLabel = label
        const lengthCm = numberOrNull(line.length)
        const widthCm = numberOrNull(line.width)
        const heightCm = numberOrNull(line.height)
        const dimension =
          lengthCm !== null && widthCm !== null && heightCm !== null
            ? { lengthCm, widthCm, heightCm }
            : null
        const volumeCbm = numberOrNull(line.cbm)
        const weightKg = numberOrNull(line.weight)
        const hasPackage =
          label !== null || dimension !== null || volumeCbm !== null || weightKg !== null
        if (label !== null && labelToId.has(label)) {
          // case berulang: pakai id koli yang sudah ada (dims hanya di baris pertama)
          currentKoliId = labelToId.get(label)!
        } else if (hasPackage) {
          const id = nanoid()
          details.push({
            id,
            label,
            dimension,
            volumeCbm,
            weightKg,
            satuanKemasan: line.satuanKemasan.trim() || null,
          })
          if (label !== null) labelToId.set(label, id)
          currentKoliId = id
        }
        const barang = lineToBarang(line, currentLabel)
        if (barang) items.push({ ...barang, refKoliIds: currentKoliId ? [currentKoliId] : [] })
      }
      const stated = numberOrNull(row.totalPackage)
      const statedTotalCount = stated === null ? null : Math.round(stated)
      const parsed = exhibitorLogisticsSchema.safeParse({
        hall: row.hall.trim() || null,
        booth: row.booth.trim() || null,
        koli: {
          totalCount: reconcileKoliTotal(details, statedTotalCount),
          bareCaseCount:
            numberOrNull(row.bareCase) == null ? null : Math.round(numberOrNull(row.bareCase)!),
          details,
        },
        notes: [],
      })
      if (parsed.success) {
        entries.push({ name, statedTotalCount, logistics: parsed.data, items })
      }
    }
    return entries
  }

  async function save() {
    const scanEntries = buildScanEntries()
    const skippedNames = ciplRows.filter((row) => isRowFilled(row)).length - scanEntries.length
    const plan = resolveCiplAutofill(scanEntries, eventExhibitors)
    const ciplDocument = buildCiplDocument(ciplHeader, plan.rows, ciplBelumTerpetakan)
    if (!plan.rows.length && !ciplDocument && !ciplFile) {
      onClose()
      return
    }
    // Baris job tersimpan utuh per exhibitor: satu exhibitor hanya boleh punya satu baris.
    const existingIds = new Set(
      job.ciplLines.flatMap((line) => (line.exhibitorId ? [line.exhibitorId] : [])),
    )
    const duplicates = plan.rows.filter(
      (row) => row.exhibitorId && existingIds.has(row.exhibitorId),
    )
    if (duplicates.length) {
      toast(
        `${duplicates.map((row) => row.name).join(', ')} sudah punya baris CIPL di job ini — ubah lewat baris CIPL yang ada.`,
        'error',
      )
      return
    }

    setSaving(true)
    let updated = job
    let failures = 0
    let autofill: Awaited<ReturnType<typeof applyCiplAutofill>> | null = null
    try {
      if (plan.rows.length || ciplDocument) {
        autofill = await applyCiplAutofill({
          job,
          rows: plan.rows,
          ciplDocument: ciplDocument ?? job.ciplDocument,
          eventExhibitors,
          keepLines: ciplLineInputs(job),
        })
        updated = autofill.job
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Baris CIPL tidak dapat disimpan.', 'error')
      setSaving(false)
      return
    }
    // Tanpa agent: pihak yang ditagih adalah exhibitor. Bila CIPL hanya menyebut satu exhibitor
    // yang sudah tertaut, tetapkan langsung; selebihnya dipilih operator di detail job.
    const linkedExhibitorIds = [
      ...new Set(updated.ciplLines.flatMap((line) => (line.exhibitorId ? [line.exhibitorId] : []))),
    ]
    if (!updated.party && !updated.agentId && linkedExhibitorIds.length === 1) {
      try {
        updated = await saveJobOperationalDetails(updated, {
          party: { agentId: null, exhibitorId: linkedExhibitorIds[0] },
        })
      } catch {
        failures += 1
        toast('Pihak job belum bisa ditetapkan — pilih di detail job.', 'error')
      }
    }
    if (ciplFile) {
      try {
        await saveJobDocument(updated, ciplFile, 'CIPL')
      } catch {
        failures += 1
        toast('Dokumen CIPL tidak dapat diunggah.', 'error')
      }
    }
    const parts: string[] = []
    if (plan.rows.length) {
      const ringkasan = summarizeAutofill(plan.rows)
      const rincian = [
        ringkasan.tertaut ? `${ringkasan.tertaut} tertaut` : null,
        autofill?.created.length ? `${autofill.created.length} exhibitor baru` : null,
      ].filter(Boolean)
      parts.push(
        `${plan.rows.length} exhibitor CIPL${rincian.length ? ` (${rincian.join(', ')})` : ''}`,
      )
    }
    const itemCount =
      plan.rows.reduce((sum, row) => sum + row.items.length, 0) + ciplBelumTerpetakan.length
    if (itemCount) parts.push(`${itemCount} baris barang`)
    toast(
      `CIPL disimpan${parts.length ? ` · ${parts.join(' · ')}` : ''}.${failures ? ' Sebagian data gagal — periksa detail job.' : ''}`,
      failures ? 'error' : 'success',
    )
    if (skippedNames > 0)
      toast(`${skippedNames} baris CIPL dilewati karena belum ada nama exhibitor.`, 'error')
    for (const warning of plan.warnings) toast(warning, 'error')
    if (autofill?.unlinked.length)
      toast(
        `${autofill.unlinked.length} baris belum tertaut ke exhibitor event — tautkan dari detail job.`,
        'error',
      )
    setSaving(false)
    onSaved(updated)
  }

  return (
    <Dialog open onOpenChange={(next) => (!next && !saving ? onClose() : undefined)}>
      <DialogContent className="flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-[min(92vw,1100px)]">
        <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-6">
          <DialogTitle>Tambah / scan CIPL</DialogTitle>
          <DialogDescription>
            Job{' '}
            <span className="font-medium text-foreground">
              {jobLabel(job)}
            </span>{' '}
            — baris CIPL yang sudah ada tidak berubah.
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {scanningCipl ? (
            <div
              className="absolute inset-0 z-10 flex flex-col justify-center gap-4 overflow-hidden bg-white p-6 sm:p-8"
              aria-busy="true"
              aria-live="polite"
            >
              <p className="text-sm font-medium text-orange-700">Memeriksa dokumen dengan AI...</p>
              <Skeleton className="h-6 w-56" />
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8">
            <div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 bg-white px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
                <span className="min-w-0 truncate">
                  {ciplFile
                    ? `Terpindai: ${ciplFile.name}`
                    : 'Klik untuk isi otomatis dari dokumen CIPL'}
                </span>
                <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  type="file"
                  accept={jobDocumentAccept}
                  className="sr-only"
                  disabled={scanningCipl || saving}
                  onChange={(inputEvent) => {
                    const file = inputEvent.target.files?.[0]
                    if (file) void scanCipl(file)
                    inputEvent.target.value = ''
                  }}
                />
              </label>
            </div>

            <ul className="space-y-4">
              {ciplRows.map((row, rowIndex) => {
                const sums = row.lines.reduce(
                  (total, line) => ({
                    cbm: total.cbm + (numberOrNull(line.cbm) ?? 0),
                    kg: total.kg + (numberOrNull(line.weight) ?? 0),
                  }),
                  { cbm: 0, kg: 0 },
                )
                const link = rowLinkStatus(row.name, eventExhibitors)
                return (
                  <li key={row.key} className="rounded-xl border border-black/10 p-4">
                    <div className="space-y-3">
                      <div className="flex items-end gap-2">
                        <label className="label flex-1">
                          Exhibitor
                          {row.jobNo ? (
                            <span className="ml-1 text-xs font-normal text-slate-400">
                              {row.jobNo}
                            </span>
                          ) : null}
                          {link ? (
                            <span
                              className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${linkStatusClass[link.kind]}`}
                              title={link.hint}
                            >
                              {autofillResolutionLabels[link.kind]}
                            </span>
                          ) : null}
                          <input
                            value={row.name}
                            onChange={(inputEvent) =>
                              setCiplRows((current) =>
                                current.map((item, i) =>
                                  i === rowIndex
                                    ? { ...item, name: inputEvent.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="input mt-1"
                            disabled={saving}
                          />
                        </label>
                        <button
                          type="button"
                          aria-label={`Hapus exhibitor ${row.name || rowIndex + 1}`}
                          onClick={() =>
                            setCiplRows((current) => current.filter((_, i) => i !== rowIndex))
                          }
                          className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                          disabled={saving}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="label w-24">
                          Total pkg
                          <input
                            type="number"
                            min="0"
                            value={row.totalPackage}
                            onChange={(inputEvent) =>
                              setCiplRows((current) =>
                                current.map((item, i) =>
                                  i === rowIndex
                                    ? { ...item, totalPackage: inputEvent.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="input mt-1"
                            disabled={saving}
                          />
                        </label>
                        <label className="label w-28">
                          Booth no
                          <input
                            value={row.booth}
                            onChange={(inputEvent) =>
                              setCiplRows((current) =>
                                current.map((item, i) =>
                                  i === rowIndex
                                    ? { ...item, booth: inputEvent.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="input mt-1"
                            disabled={saving}
                          />
                        </label>
                        <label className="label w-28">
                          Hall
                          <input
                            value={row.hall}
                            onChange={(inputEvent) =>
                              setCiplRows((current) =>
                                current.map((item, i) =>
                                  i === rowIndex
                                    ? { ...item, hall: inputEvent.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="input mt-1"
                            disabled={saving}
                          />
                        </label>
                        <label className="label w-24">
                          Bare case
                          <input
                            type="number"
                            min="0"
                            value={row.bareCase}
                            onChange={(inputEvent) =>
                              setCiplRows((current) =>
                                current.map((item, i) =>
                                  i === rowIndex
                                    ? { ...item, bareCase: inputEvent.target.value }
                                    : item,
                                ),
                              )
                            }
                            className="input mt-1"
                            disabled={saving}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="space-y-3">
                        {row.lines.map((line, lineIndex) => (
                          <div
                            key={lineIndex}
                            className="rounded-lg border border-black/5 bg-slate-50/60 p-3"
                          >
                            <div className="flex flex-wrap items-end gap-2">
                              {(
                                [
                                  ['label', 'Case', 'text', 'cth. PKG 1', 'w-28 grow'],
                                  ['length', 'L (cm)', 'number', '', 'w-20'],
                                  ['width', 'W (cm)', 'number', '', 'w-20'],
                                  ['height', 'H (cm)', 'number', '', 'w-20'],
                                  ['cbm', 'CBM', 'number', '', 'w-20'],
                                  ['weight', 'Kg', 'number', '', 'w-20'],
                                  ['satuanKemasan', 'Satuan', 'text', 'cth. CARTON', 'w-24'],
                                  ['uraian', 'Uraian', 'text', 'Nama barang', 'w-40 grow'],
                                  ['merekModel', 'Merek/model', 'text', '', 'w-28'],
                                  ['kodeHs', 'HS code', 'text', '', 'w-24'],
                                  ['jumlah', 'Jumlah', 'number', '', 'w-20'],
                                  ['satuan', 'Satuan', 'text', '', 'w-20'],
                                  ['nilaiSatuan', 'Nilai satuan', 'number', '', 'w-24'],
                                  ['nilaiTotal', 'Nilai total', 'number', '', 'w-24'],
                                ] as const
                              ).map(([field, fieldLabel, type, placeholder, width]) => (
                                <label key={field} className={`label text-xs ${width}`}>
                                  {fieldLabel}
                                  <input
                                    type={type}
                                    {...(type === 'number' ? { min: '0', step: 'any' } : {})}
                                    value={line[field]}
                                    onChange={(inputEvent) =>
                                      setCiplRows((current) =>
                                        current.map((item, i) =>
                                          i === rowIndex
                                            ? {
                                                ...item,
                                                lines: item.lines.map((entry, j) =>
                                                  j === lineIndex
                                                    ? {
                                                        ...entry,
                                                        [field]: inputEvent.target.value,
                                                      }
                                                    : entry,
                                                ),
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    placeholder={placeholder || undefined}
                                    className="input mt-1 py-1.5 text-sm"
                                    disabled={saving}
                                  />
                                </label>
                              ))}
                              <label className="label w-36 text-xs">
                                Disposisi
                                <select
                                  value={line.disposisi}
                                  onChange={(inputEvent) =>
                                    setCiplRows((current) =>
                                      current.map((item, i) =>
                                        i === rowIndex
                                          ? {
                                              ...item,
                                              lines: item.lines.map((entry, j) =>
                                                j === lineIndex
                                                  ? {
                                                      ...entry,
                                                      disposisi: inputEvent.target
                                                        .value as DisposisiBarang,
                                                    }
                                                  : entry,
                                              ),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="input mt-1 py-1.5 text-sm"
                                  disabled={saving}
                                >
                                  {disposisiBarangs.map((disposisi) => (
                                    <option key={disposisi} value={disposisi}>
                                      {disposisiBarangLabels[disposisi]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                aria-label={`Hapus baris ${lineIndex + 1}`}
                                onClick={() =>
                                  setCiplRows((current) =>
                                    current.map((item, i) =>
                                      i === rowIndex
                                        ? {
                                            ...item,
                                            lines: item.lines.filter((_, j) => j !== lineIndex),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                disabled={saving}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCiplRows((current) =>
                              current.map((item, i) =>
                                i === rowIndex
                                  ? { ...item, lines: [...item.lines, emptyLine()] }
                                  : item,
                              ),
                            )
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
                          disabled={saving}
                        >
                          <Plus size={13} aria-hidden="true" />
                          Tambah baris
                        </button>
                        <p className="text-xs text-slate-500">
                          Σ {sums.cbm.toLocaleString('id-ID')} CBM ·{' '}
                          {sums.kg.toLocaleString('id-ID')} kg
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <button
              type="button"
              onClick={() => setCiplRows((current) => [...current, emptyRow(nextRowKey())])}
              className="btn-secondary"
              disabled={saving || (ciplRows.length > 0 && !ciplRows.some(isRowFilled))}
            >
              <Plus size={16} aria-hidden="true" />
              Tambah exhibitor
            </button>
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving || scanningCipl}
          >
            Batal
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || scanningCipl}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
