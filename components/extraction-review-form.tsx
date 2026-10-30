'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from '@/components/toast'
import { ConfidenceBadge, ReviewNotice } from '@/components/confidence-badge'
import { CLASSIFICATION_LABEL } from '@/components/document-upload-panel'
import {
  createCiplVersionFromExtraction,
  getExtractionCapabilities,
  reExtractWithLlm,
  type DocumentOwner,
  type ExtractionOutcome,
} from '@/lib/data-client'
import type { CiplVersion } from '@/domain/exhibition/types'
import type { DocumentClassificationType } from '@/domain/exhibition/source-documents'
import { ciplVersionFromExtractionSchema } from '@/domain/exhibition/validation'

export type SourceOutcome = ExtractionOutcome

const CONFIRMABLE_TYPES: DocumentClassificationType[] = [
  'CIPL_COMBINED',
  'PACKING_LIST',
  'COMMERCIAL_INVOICE',
  'BILL_OF_LADING',
  'AIR_WAYBILL',
]

const UNREADABLE_MESSAGE = 'Dokumen tidak dapat dibaca. Unggah ulang dengan kualitas lebih baik atau isi form manual.'
const COMBINATION_INVALID = 'CIPL membutuhkan Packing List dan Commercial Invoice, atau satu dokumen CIPL gabungan.'
const LLM_UNAVAILABLE = 'Ekstraksi LLM tidak tersedia karena belum ada penyedia LLM yang dikonfigurasi.'

type ReviewRow = {
  key: string
  sourceIndex: number
  itemIndex: number
  description: string
  quantity: string
  unit: string
  unitValue: string
  currency: string
  grossWeightKg: string
  netWeightKg: string
  countryOfOrigin: string
}

const toRow = (value: number | null) => (value === null ? '' : String(value))

export function ExtractionReviewForm({
  owner,
  ciplId,
  sources,
  onSourceReplaced,
  onSaved,
}: {
  owner: DocumentOwner
  ciplId: string
  sources: SourceOutcome[]
  onSourceReplaced: (index: number, outcome: SourceOutcome) => void
  onSaved: (version: CiplVersion) => void
}) {
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [confirmedTypes, setConfirmedTypes] = useState<Record<number, DocumentClassificationType>>({})
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null)
  const [llmBusyIndex, setLlmBusyIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  useEffect(() => {
    getExtractionCapabilities()
      .then((capabilities) => setLlmAvailable(capabilities.llmAvailable))
      .catch(() => setLlmAvailable(false))
  }, [])

  useEffect(() => {
    const derived: ReviewRow[] = []
    sources.forEach((source, sourceIndex) => {
      source.result.invoice?.items.forEach((item, itemIndex) => {
        derived.push({
          key: `${source.attachmentId}-${itemIndex}`,
          sourceIndex,
          itemIndex,
          description: item.description ?? '',
          quantity: toRow(item.quantity),
          unit: item.unit ?? '',
          unitValue: toRow(item.unitPrice),
          currency: item.currency ?? source.result.invoice?.currency ?? '',
          grossWeightKg: toRow(item.grossWeightKg),
          netWeightKg: toRow(item.netWeightKg),
          countryOfOrigin: item.countryOfOrigin ?? '',
        })
      })
    })
    setRows(derived)
    setRowErrors({})
    setFormError('')
  }, [sources])

  const typeAt = (index: number) => confirmedTypes[index] ?? sources[index]?.result.classification.documentType
  const hasUnreadable = useMemo(
    () => sources.some((source) => source.result.classification.documentType === 'UNREADABLE'),
    [sources],
  )

  const updateRow = (key: string, field: keyof ReviewRow, value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)))

  const fieldNeedsReview = (row: ReviewRow, field: keyof ReviewRow) => {
    const confidence = sources[row.sourceIndex]?.result.fieldConfidence[`invoice.items.${row.itemIndex}.${field}`]
    return typeof confidence === 'number' && confidence < 0.7
  }

  function reExtract(index: number) {
    setLlmBusyIndex(index)
    reExtractWithLlm({ ...owner, attachmentId: sources[index].attachmentId, intendedKind: 'CIPL' })
      .then((outcome) => {
        onSourceReplaced(index, outcome)
        toast('Ekstraksi LLM selesai. Periksa hasilnya sebelum menyimpan.', 'success')
      })
      .catch((caught) => toast(caught instanceof Error ? caught.message : 'Ekstraksi LLM gagal.', 'error'))
      .finally(() => setLlmBusyIndex(null))
  }

  function buildSourcePayload() {
    const types = sources.map((_, index) => typeAt(index))
    if (sources.length === 1) {
      return { kind: 'COMBINED' as const, attachmentId: sources[0].attachmentId }
    }
    const combinedIndex = types.findIndex((type) => type === 'CIPL_COMBINED')
    if (combinedIndex >= 0) {
      return { kind: 'COMBINED' as const, attachmentId: sources[combinedIndex].attachmentId }
    }
    const packingListIndex = types.findIndex((type) => type === 'PACKING_LIST')
    const invoiceIndex = types.findIndex((type) => type === 'COMMERCIAL_INVOICE')
    if (packingListIndex >= 0 && invoiceIndex >= 0) {
      return {
        kind: 'SPLIT' as const,
        packingListAttachmentId: sources[packingListIndex].attachmentId,
        invoiceAttachmentId: sources[invoiceIndex].attachmentId,
      }
    }
    return null
  }

  async function save() {
    const errors: Record<string, string> = {}
    const items = rows.map((row) => {
      const quantity = Number(row.quantity)
      if (!row.description.trim()) errors[`description.${row.key}`] = 'Deskripsi item wajib diisi.'
      if (!(quantity > 0)) errors[`quantity.${row.key}`] = 'Quantity harus positif.'
      if (!row.unit.trim()) errors[`unit.${row.key}`] = 'Unit wajib diisi.'
      const number = (value: string) => {
        const parsed = Number(value)
        return value.trim() && Number.isFinite(parsed) ? parsed : null
      }
      return {
        description: row.description.trim(),
        quantity,
        unit: row.unit.trim().toUpperCase(),
        unitValue: number(row.unitValue),
        currency: row.currency.trim().toUpperCase() || null,
        grossWeightKg: number(row.grossWeightKg),
        netWeightKg: number(row.netWeightKg),
        countryOfOrigin: row.countryOfOrigin.trim().toUpperCase() || null,
      }
    })
    const sourcePayload = buildSourcePayload()
    const combinationError = sourcePayload ? '' : COMBINATION_INVALID
    if (Object.keys(errors).length || combinationError || !sourcePayload) {
      setRowErrors(errors)
      setFormError(combinationError)
      return
    }
    const parsed = ciplVersionFromExtractionSchema.safeParse({ ciplId, source: sourcePayload, items })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data tidak valid.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const version = await createCiplVersionFromExtraction(parsed.data)
      toast('Versi CIPL tersimpan.', 'success')
      onSaved(version)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Versi CIPL tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (hasUnreadable) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
        {UNREADABLE_MESSAGE}
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Tinjau hasil ekstraksi</h3>
        <div className="flex flex-wrap items-center gap-2">
          {sources.map((source, index) => (
            <ConfidenceBadge
              key={source.attachmentId}
              band={source.result.band}
              score={source.result.aggregateConfidence}
            />
          ))}
        </div>
      </div>

      {sources.map((source, index) => {
        const type = typeAt(index)
        const needsConfirmation = source.result.classification.needsUserConfirmation && !confirmedTypes[index]
        const llmDisabled = llmAvailable === false || llmBusyIndex !== null
        return (
          <div key={source.attachmentId} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="label">
                Jenis dokumen
                <select
                  aria-label={`Jenis dokumen untuk lampiran ${index + 1}`}
                  value={type}
                  onChange={(event) =>
                    setConfirmedTypes((current) => ({ ...current, [index]: event.target.value as DocumentClassificationType }))
                  }
                  className="input mt-1 max-w-56"
                >
                  {CONFIRMABLE_TYPES.map((value) => (
                    <option key={value} value={value}>{CLASSIFICATION_LABEL[value] ?? value}</option>
                  ))}
                </select>
              </label>
              {needsConfirmation && <span className="text-xs text-rose-600">Konfirmasi jenis dokumen ini.</span>}
              <button
                type="button"
                onClick={() => reExtract(index)}
                disabled={llmDisabled}
                aria-label={`Ekstrak ulang dengan LLM untuk lampiran ${index + 1}`}
                title={llmAvailable === false ? LLM_UNAVAILABLE : undefined}
                className="btn-secondary ml-auto"
              >
                <Sparkles size={14} />
                {llmBusyIndex === index ? 'Mengekstrak...' : 'Ekstrak ulang dengan LLM'}
              </button>
            </div>
            {llmAvailable === false && <p className="mt-1 text-xs text-slate-500">{LLM_UNAVAILABLE}</p>}
          </div>
        )
      })}

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-slate-500">
          Tidak ada baris barang yang terbaca. Isi manual di form di bawah, atau coba ekstraksi ulang dengan LLM.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => {
            const flagged = (['description', 'quantity', 'unit'] as const).some((field) => fieldNeedsReview(row, field))
            const noticeId = `review-${row.key}`
            const rowError = (field: string) => rowErrors[`${field}.${row.key}`]
            return (
              <div key={row.key} className="rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
                  <label className="label">
                    Deskripsi
                    <input
                      aria-label="Deskripsi item"
                      value={row.description}
                      onChange={(event) => updateRow(row.key, 'description', event.target.value)}
                      aria-invalid={Boolean(rowError('description')) || fieldNeedsReview(row, 'description')}
                      aria-describedby={flagged ? noticeId : undefined}
                      className="input mt-1"
                    />
                  </label>
                  <label className="label">
                    Quantity
                    <input
                      aria-label="Quantity item"
                      type="number"
                      min="0"
                      step="any"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, 'quantity', event.target.value)}
                      aria-invalid={Boolean(rowError('quantity')) || fieldNeedsReview(row, 'quantity')}
                      aria-describedby={flagged ? noticeId : undefined}
                      className="input mt-1"
                    />
                  </label>
                  <label className="label">
                    Unit
                    <input
                      aria-label="Unit item"
                      value={row.unit}
                      onChange={(event) => updateRow(row.key, 'unit', event.target.value)}
                      aria-invalid={Boolean(rowError('unit')) || fieldNeedsReview(row, 'unit')}
                      aria-describedby={flagged ? noticeId : undefined}
                      className="input mt-1 uppercase"
                    />
                  </label>
                </div>
                <details className="mt-2 text-sm text-slate-600">
                  <summary className="cursor-pointer select-none text-xs font-medium">Nilai komersial &amp; bobot</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-5">
                    <label className="label">
                      Nilai satuan
                      <input
                        aria-label="Nilai satuan"
                        type="number"
                        min="0"
                        step="any"
                        value={row.unitValue}
                        onChange={(event) => updateRow(row.key, 'unitValue', event.target.value)}
                        className="input mt-1"
                      />
                    </label>
                    <label className="label">
                      Valuta
                      <input
                        aria-label="Valuta"
                        value={row.currency}
                        onChange={(event) => updateRow(row.key, 'currency', event.target.value)}
                        className="input mt-1 uppercase"
                      />
                    </label>
                    <label className="label">
                      Berat kotor (kg)
                      <input
                        aria-label="Berat kotor dalam kilogram"
                        type="number"
                        min="0"
                        step="any"
                        value={row.grossWeightKg}
                        onChange={(event) => updateRow(row.key, 'grossWeightKg', event.target.value)}
                        className="input mt-1"
                      />
                    </label>
                    <label className="label">
                      Berat bersih (kg)
                      <input
                        aria-label="Berat bersih dalam kilogram"
                        type="number"
                        min="0"
                        step="any"
                        value={row.netWeightKg}
                        onChange={(event) => updateRow(row.key, 'netWeightKg', event.target.value)}
                        className="input mt-1"
                      />
                    </label>
                    <label className="label">
                      Negara asal
                      <input
                        aria-label="Kode negara asal"
                        value={row.countryOfOrigin}
                        onChange={(event) => updateRow(row.key, 'countryOfOrigin', event.target.value)}
                        className="input mt-1 uppercase"
                        maxLength={2}
                      />
                    </label>
                  </div>
                </details>
                {Object.entries(rowErrors).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(['description', 'quantity', 'unit'] as const).map((field) =>
                      rowError(field) ? (
                        <p key={field} className="text-xs text-rose-600">{rowError(field)}</p>
                      ) : null,
                    )}
                  </div>
                )}
                {flagged && <ReviewNotice id={noticeId} />}
              </div>
            )
          })}
        </div>
      )}

      {formError && (
        <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{formError}</p>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || rows.length === 0}
          aria-label="Simpan versi CIPL dari hasil ekstraksi"
          className="btn-primary"
        >
          {saving ? 'Menyimpan...' : 'Simpan sebagai versi CIPL'}
        </button>
      </div>
    </div>
  )
}
