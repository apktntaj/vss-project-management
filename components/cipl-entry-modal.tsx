'use client'

import { useRef, useState } from 'react'
import { Bot, Plus, Upload } from 'lucide-react'

import {
  applyCiplAutofill,
  ciplLineInputs,
  saveJobCipl,
  saveJobDocument,
  saveJobOperationalDetails,
  type Exhibitor,
  type Job,
  type CiplAutofillOutcome,
  type JobCiplLineInput,
} from '@/lib/data-client'
import {
  buildCiplDocument,
  type BarisBarang,
  type CiplDocumentHeader,
} from '@/domain/exhibition/cipl-document'
import { resolveCiplAutofill, summarizeAutofill } from '@/domain/exhibition/cipl-autofill'
import { isSameExhibitorName, matchExhibitorByName } from '@/domain/event/exhibitor-matching'
import type { CiplScanResult } from '@/lib/server/manifest-extraction'
import {
  documentTotals,
  emptyRow,
  isRowFilled,
  rowFromScan,
  rowSums,
  rowToScanEntry,
  type CiplRowDraft,
} from '@/lib/cipl-form-draft'
import { CiplExhibitorForm, TotalField } from '@/components/cipl-exhibitor-form'
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

function scanFileAcceptable(file: File): boolean {
  if (isAcceptedJobDocument(file)) return true
  toast('File harus berupa PDF atau Excel.', 'error')
  return false
}

/**
 * Pintu scan CIPL / packing list untuk job yang sudah ada. Hasil scan AI mengisi draft yang bisa
 * dikoreksi manual per field. Baris hasil scan yang menunjuk exhibitor yang SUDAH punya baris di
 * job ditawarkan sebagai PENGGANTI baris lama (diff koli/items; catatan digabung) — operator yang
 * memutuskan lewat panel penggantian sebelum menyimpan.
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
  const [applyReplace, setApplyReplace] = useState(true)
  const [docNomor, setDocNomor] = useState(job.ciplDocument?.nomor ?? '')
  const [docTanggal, setDocTanggal] = useState(job.ciplDocument?.tanggal ?? '')
  const [docIncoterm, setDocIncoterm] = useState(job.ciplDocument?.incoterm ?? '')
  const [saving, setSaving] = useState(false)
  const rowKeyRef = useRef(0)
  const nextRowKey = () => `cipl-row-${++rowKeyRef.current}`

  /** Index baris CIPL job yang ditunjuk sebuah nama hasil scan (nama master ATAU nama di dokumen). */
  function matchJobLineIndex(name: string): number {
    const trimmed = name.trim()
    if (!trimmed) return -1
    return job.ciplLines.findIndex((line) =>
      isSameExhibitorName(line.exhibitor?.name ?? line.nameOnDocument, trimmed),
    )
  }

  function resetScanState() {
    setCiplRows([emptyRow('cipl-row-0')])
    setCiplFile(null)
    setCiplHeader(null)
    setCiplBelumTerpetakan([])
    setDocNomor(job.ciplDocument?.nomor ?? '')
    setDocTanggal(job.ciplDocument?.tanggal ?? '')
    setDocIncoterm(job.ciplDocument?.incoterm ?? '')
  }

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
      const rows: CiplRowDraft[] = data.exhibitors.map((exhibitor) =>
        rowFromScan(nextRowKey(), exhibitor),
      )
      setCiplRows(rows)
      setCiplHeader(data.header ?? null)
      if (data.header) {
        setDocNomor(data.header.nomor ?? '')
        setDocTanggal(data.header.tanggal ?? '')
        setDocIncoterm(data.header.incoterm ?? '')
      }
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

  async function save() {
    const built = ciplRows.flatMap((row) => {
      const result = rowToScanEntry(row)
      return result ? [result] : []
    })
    const scanEntries = built.map((result) => result.entry)
    const invalidItems = built.reduce((sum, result) => sum + result.invalidItems, 0)
    const skippedNames = ciplRows.filter((row) => isRowFilled(row)).length - scanEntries.length
    if (!scanEntries.length && !ciplFile && !job.ciplLines.length) {
      onClose()
      return
    }

    // Penggantian: entri/baris hasil scan yang menunjuk baris job yang sudah ada — nama master
    // ATAU nama di dokumen cocok setelah normalisasi. `applyReplace` menentukan keduanya: ganti
    // baris lama, atau lewati entri itu sama sekali (baris lama utuh).
    const entryLineIndex = scanEntries.map((entry) => matchJobLineIndex(entry.name))
    const matchedCount = entryLineIndex.filter((index) => index >= 0).length

    setSaving(true)
    let updated = job
    let failures = 0
    try {
      // Kepala dokumen: identitas dari scan (pengirim, penerima, dsb.) digabung dengan field yang
      // diketik operator (no. invoice, tanggal, incoterm) — operator menang.
      const typedNomor = docNomor.trim() || null
      const typedTanggal = docTanggal || null
      const typedIncoterm = docIncoterm.trim().toUpperCase() || null
      const header: CiplDocumentHeader = {
        ...(ciplHeader ?? {
          pengirim: null,
          penerima: null,
          namaPameran: null,
          mataUang: null,
          infoKontainer: null,
          nilaiTotalDeklarasi: null,
        }),
        nomor: typedNomor,
        tanggal: typedTanggal,
        incoterm: typedIncoterm,
      }
      const headerUsed = ciplHeader || typedNomor || typedTanggal || typedIncoterm ? header : null
      const plan = resolveCiplAutofill(scanEntries, eventExhibitors)
      const ciplDocument = buildCiplDocument(headerUsed, plan.rows, ciplBelumTerpetakan)
      // resolveCiplAutofill bisa MENGGABUNGkan entri bernama sama, jadi kecocokan baris dihitung
      // per baris plan (bukan per entri): nama tertera dulu, lalu nama master.
      const rowLineIndex = plan.rows.map((row) => {
        const byDocument = matchJobLineIndex(row.namaTertera)
        return byDocument >= 0 ? byDocument : matchJobLineIndex(row.name)
      })
      // lineIndex → baris plan yang menggantikannya (baris pertama menang bila dua baris
      // mengarah ke baris job yang sama).
      const replacerByLine = new Map<number, number>()
      rowLineIndex.forEach((lineIndex, rowIndex) => {
        if (lineIndex >= 0 && applyReplace && !replacerByLine.has(lineIndex))
          replacerByLine.set(lineIndex, rowIndex)
      })
      // Baris pengganti di-substitusi di posisi baris lamanya; baris baru lewat autofill.
      const keepLines: JobCiplLineInput[] = ciplLineInputs(job).map((line, index) => {
        const rowIndex = replacerByLine.get(index)
        if (rowIndex === undefined) return line
        const row = plan.rows[rowIndex]
        return {
          exhibitorId: line.exhibitorId ?? row.exhibitorId,
          nameOnDocument: row.namaTertera,
          koli: row.logistics.koli,
          items: row.items,
          notes: [...line.notes, ...row.logistics.notes],
        }
      })
      // Baris yang menunjuk baris lama TIDAK pernah masuk sebagai baris baru: applyReplace
      // menggantikan lewat substitusi; tanpa applyReplace baris itu dilewati total.
      const newRows = plan.rows.filter((_, rowIndex) => rowLineIndex[rowIndex] < 0)
      const replacedCount = replacerByLine.size
      const skippedReplace = !applyReplace ? rowLineIndex.filter((index) => index >= 0).length : 0
      let autofill: CiplAutofillOutcome | null = null
      if (newRows.length || ciplDocument) {
        autofill = await applyCiplAutofill({
          job,
          rows: newRows,
          ciplDocument: ciplDocument ?? job.ciplDocument,
          eventExhibitors,
          keepLines,
        })
        updated = autofill.job
      } else if (replacedCount) {
        // Semua baris adalah pengganti tanpa header dokumen: simpan substitusi langsung.
        updated = await saveJobCipl(job, ciplDocument ?? job.ciplDocument, keepLines)
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
      if (newRows.length) {
        const ringkasan = summarizeAutofill(newRows)
        const rincian = [
          ringkasan.tertaut ? `${ringkasan.tertaut} tertaut` : null,
          autofill?.created.length ? `${autofill.created.length} exhibitor baru` : null,
        ].filter(Boolean)
        parts.push(`${newRows.length} exhibitor CIPL${rincian.length ? ` (${rincian.join(', ')})` : ''}`)
      }
      if (replacedCount) parts.push(`${replacedCount} baris lama diganti`)
      if (skippedReplace)
        parts.push(`${skippedReplace} baris sudah ada — dipertahankan (penggantian dimatikan)`)
      const itemCount =
        plan.rows.reduce((sum, row) => sum + row.items.length, 0) + ciplBelumTerpetakan.length
      if (itemCount) parts.push(`${itemCount} baris barang`)
      toast(
        `CIPL disimpan${parts.length ? ` · ${parts.join(' · ')}` : ''}.${failures ? ' Sebagian data gagal — periksa detail job.' : ''}`,
        failures ? 'error' : 'success',
      )
      if (autofill?.unlinked.length)
        toast(
          `${autofill.unlinked.length} baris belum tertaut ke exhibitor event — tautkan dari detail job.`,
          'error',
        )
      for (const warning of plan.warnings) toast(warning, 'error')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Baris CIPL tidak dapat disimpan.', 'error')
      setSaving(false)
      return
    }
    if (skippedNames > 0)
      toast(`${skippedNames} baris CIPL dilewati karena belum ada nama exhibitor.`, 'error')
    if (invalidItems > 0)
      toast(
        `${invalidItems} baris barang dilewati karena deskripsi atau quantity belum terisi.`,
        'error',
      )
    setSaving(false)
    onSaved(updated)
  }

  /** Baris draft saat ini yang menunjuk baris job yang sudah ada — dasar panel penggantian. */
  const replacementRows = ciplRows.filter(
    (row) => row.name.trim().length > 0 && matchJobLineIndex(row.name) >= 0,
  )

  return (
    <Dialog open onOpenChange={(next) => (!next && !saving ? onClose() : undefined)}>
      <DialogContent className="flex h-[min(90vh,900px)] max-h-[90vh] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-[min(92vw,1100px)]">
        <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-6">
          <DialogTitle className="text-xl font-semibold">Form Commercial Invoice &amp; Packing List</DialogTitle>
          <DialogDescription className="text-base">
            No. Job <span className="text-lg font-semibold text-foreground">{jobLabel(job)}</span>
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
            <div className="space-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-100">
                <Bot size={18} className="shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {ciplFile ? `Terbaca AI: ${ciplFile.name}` : 'Upload your CIPL and let AI do the rest'}
                </span>
                <Upload size={15} className="shrink-0" aria-hidden="true" />
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

              <div className="rounded-xl border border-black/10 p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Dokumen</p>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <label className="label w-44 text-xs">
                    No. invoice
                    <input
                      className="input mt-1 py-1.5 text-sm"
                      value={docNomor}
                      onChange={(event) => setDocNomor(event.target.value)}
                      disabled={saving}
                    />
                  </label>
                  <label className="label w-40 text-xs">
                    Tanggal
                    <input
                      type="date"
                      className="input mt-1 py-1.5 text-sm"
                      value={docTanggal}
                      onChange={(event) => setDocTanggal(event.target.value)}
                      disabled={saving}
                    />
                  </label>
                  <label className="label w-28 text-xs">
                    Incoterm
                    <input
                      className="input mt-1 py-1.5 text-sm uppercase"
                      list="incoterm-options"
                      value={docIncoterm}
                      onChange={(event) => setDocIncoterm(event.target.value)}
                      disabled={saving}
                    />
                    <datalist id="incoterm-options">
                      {['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'].map(
                        (term) => (
                          <option key={term} value={term} />
                        ),
                      )}
                    </datalist>
                  </label>
                  {(() => {
                    const totals = documentTotals(ciplRows, ciplBelumTerpetakan)
                    return (
                      <>
                        <TotalField label="Total amount" derived={totals.amount} className="w-32" />
                        <TotalField label="Total package" derived={totals.packages} className="w-28" />
                        <TotalField label="Vol (CBM)" derived={totals.cbm} className="w-28" />
                        <TotalField label="Gross (kg)" derived={totals.gross} className="w-32" />
                        <TotalField label="Net (kg)" derived={totals.net} className="w-32" />
                      </>
                    )
                  })()}
                </div>
              </div>
              {replacementRows.length > 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {replacementRows.length} baris menunjuk exhibitor yang sudah punya baris di
                    job ini
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900/90">
                    {replacementRows.map((row) => {
                      const lineIndex = matchJobLineIndex(row.name)
                      const existing = lineIndex >= 0 ? job.ciplLines[lineIndex] : null
                      const newTotal = rowSums(row).packages
                      return (
                        <li key={row.key} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{existing?.exhibitor?.name ?? row.name}</span>
                          <span>
                            koli {existing?.koli.totalCount ?? '—'} → {newTotal}
                          </span>
                          <span className="text-xs">
                            items {existing?.items.length ?? 0} →{' '}
                            {row.cases.reduce(
                              (sum, entry) => sum + entry.items.filter((item) => item.uraian.trim()).length,
                              0,
                            )}
                          </span>
                          <span className="text-xs">catatan digabung</span>
                        </li>
                      )
                    })}
                  </ul>
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-900">
                    <input
                      type="checkbox"
                      checked={applyReplace}
                      disabled={saving}
                      onChange={(inputEvent) => setApplyReplace(inputEvent.target.checked)}
                    />
                    Ganti baris CIPL yang sudah ada dengan hasil scan di atas
                  </label>
                  {!applyReplace ? (
                    <p className="mt-1 text-xs text-amber-800">
                      Baris lama dibiarkan utuh; entri yang sudah ada dilewati saat menyimpan.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <ul className="space-y-4">
              {ciplRows.map((row, rowIndex) => (
                <CiplExhibitorForm
                  key={row.key}
                  row={row}
                  link={rowLinkStatus(row.name, eventExhibitors)}
                  replacing={matchJobLineIndex(row.name) >= 0}
                  disabled={saving}
                  onChange={(update) =>
                    setCiplRows((current) =>
                      current.map((item, i) => (i === rowIndex ? update(item) : item)),
                    )
                  }
                  onRemove={() =>
                    setCiplRows((current) => current.filter((_, i) => i !== rowIndex))
                  }
                />
              ))}
            </ul>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCiplRows((current) => [...current, emptyRow(nextRowKey())])}
                className="mr-6 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || (ciplRows.length > 0 && !ciplRows.some(isRowFilled))}
              >
                <Plus size={16} aria-hidden="true" />
                Tambah exhibitor
              </button>
            </div>
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-5"
            onClick={onClose}
            disabled={saving || scanningCipl}
          >
            Batal
          </Button>
          <Button type="button" className="h-10 px-5" onClick={() => void save()} disabled={saving || scanningCipl}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
