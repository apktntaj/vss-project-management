'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  MoreVertical,
  Pencil,
  Plane,
  Ship,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react'

import {
  getOperationalDetails,
  type LocalJob,
  type LocalJobDocument,
} from '@/lib/data-client'
import type {
  JobInvoiceExtraction,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import type { BcDocumentKind } from '@/domain/job/types'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { EditableJobDocument } from '@/components/job-document-editor-dialog'
import { JobUploadDialog } from '@/components/job-upload-dialog'
import { compareInvoiceWithTransport } from '@/lib/document-comparison'

export type DocumentClassification = {
  documentType: 'BILL_OF_LADING' | 'AIR_WAYBILL' | 'COMMERCIAL_INVOICE' | 'OTHER' | 'UNREADABLE'
  confidence: number
  rationale: string | null
}
export const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '—'
export const label = (key: string) => key.replaceAll('_', ' ')
const normalizedName = (value: string | null | undefined) =>
  value?.toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu, '') ?? ''

export type JobDocumentExtraction = {
  invoice?: JobInvoiceExtraction | null
  transport?: JobTransportExtraction | null
}

/** Terapkan hasil upload dokumen shipment ke satu job — documents bertambah dan operational diperbarui dari ekstraksi. */
export function applyUploadedDocument(
  job: LocalJob,
  document: LocalJobDocument,
  extraction?: JobDocumentExtraction,
): LocalJob {
  return {
    ...job,
    documents: [...job.documents, document],
    ...(extraction?.transport
      ? {
          blNumber:
            document.kind === 'BILL_OF_LADING' ? extraction.transport.documentNumber : job.blNumber,
          awbNumber:
            document.kind === 'AIR_WAYBILL' ? extraction.transport.documentNumber : job.awbNumber,
          shippingLine: extraction.transport.carrier,
          ...(extraction.transport.shipper?.name
            ? { shipper: extraction.transport.shipper.name }
            : {}),
          ...(extraction.transport.consignee?.name
            ? { consignee: extraction.transport.consignee.name }
            : {}),
          ...(extraction.transport.notifyParty?.name
            ? { notifyParty: extraction.transport.notifyParty.name }
            : {}),
        }
      : {}),
    operational:
      extraction?.invoice || extraction?.transport
        ? {
            ...getOperationalDetails(job),
            inbound: extraction.transport
              ? {
                  ...getOperationalDetails(job).inbound,
                  mode: document.kind === 'BILL_OF_LADING' ? 'SEA' : 'AIR',
                  documentType: document.kind === 'BILL_OF_LADING' ? 'BL' : 'AWB',
                  documentNumber: extraction.transport.documentNumber,
                  carrier: extraction.transport.carrier,
                  scheduleAt:
                    extraction.transport.eta ?? getOperationalDetails(job).inbound.scheduleAt,
                }
              : getOperationalDetails(job).inbound,
            ...(extraction.transport ? { inboundDocument: extraction.transport } : {}),
            ...(extraction.invoice
              ? {
                  invoiceNumber:
                    extraction.invoice.invoiceNumber ??
                    getOperationalDetails(job).invoiceNumber ??
                    null,
                  invoiceItems: extraction.invoice.items,
                  invoice: extraction.invoice,
                }
              : {}),
          }
        : job.operational,
  }
}

/** Unduh workbook Excel untuk satu dokumen BC; melempar error bila API gagal. */
export async function downloadCustomsWorkbook(job: LocalJob, documentType: BcDocumentKind) {
  const response = await fetch('/api/export-customs-workbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job, documentType }),
  })
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string }
    throw new Error(payload.error || 'File BC tidak dapat dibuat.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${documentType.replaceAll('_', '-')}-${job.jobNumber}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}

function CustomsProgress({
  job,
  onGenerate,
}: {
  job: LocalJob
  onGenerate: (job: LocalJob, documentType: BcDocumentKind) => void
}) {
  const customs = getOperationalDetails(job).customs
  return (
    <div className="flex min-w-[175px] gap-1">
      {(Object.keys(customs) as Array<keyof typeof customs>).map((key) => {
        const item = customs[key]
        const tone = !item.applicable
          ? 'border-slate-200 bg-slate-50 text-slate-400'
          : item.status === 'COMPLETED'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : item.status === 'ON_HOLD'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : item.status === 'NOT_STARTED'
                ? 'border-slate-200 bg-white text-slate-500'
                : 'border-blue-200 bg-blue-50 text-blue-800'
        return (
          <button
            type="button"
            key={key}
            disabled={!item.applicable}
            onClick={() => onGenerate(job, key)}
            className={`min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-center text-[10px] font-semibold ${tone}`}
            title={
              item.applicable
                ? `${label(key)} · Klik untuk mengunduh Excel`
                : `${label(key)} · Tidak diperlukan`
            }
          >
            <span className="block">{label(key)}</span>
            <span className="mt-0.5 block truncate font-normal">
              {item.applicable
                ? item.registrationNumber || item.ajuNumber || label(item.status)
                : 'N/A'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function JobRow({
  job,
  nomor,
  actions,
  onDocumentUploaded,
  onToast,
  onGenerate,
  onEditDocument,
}: {
  job: LocalJob
  /** No Job yang diisi manual; kosong bila belum ditetapkan. */
  nomor?: string
  /** Bila diisi, kolom terakhir menampilkan menu titik tiga (Edit/Hapus) alih-alih PIC. */
  actions?: {
    onEdit: (job: LocalJob) => void
    onDelete: (job: LocalJob) => void
  }
  onDocumentUploaded: (
    jobId: string,
    document: LocalJobDocument,
    extraction?: JobDocumentExtraction,
  ) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
  onGenerate: (job: LocalJob, documentType: BcDocumentKind) => void
  onEditDocument: (job: LocalJob, kind: EditableJobDocument) => void
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const operational = getOperationalDetails(job)
  const inbound = operational.inbound
  const documentComparison =
    operational.invoice && operational.inboundDocument
      ? compareInvoiceWithTransport(operational.invoice, operational.inboundDocument)
      : null
  const comparisonDifferences =
    documentComparison?.filter((item) => item.status === 'DIFFERENT') ?? []
  const hasComparableDocumentValues =
    documentComparison?.some((item) => item.status !== 'UNAVAILABLE') ?? false
  const exhibitorName = job.exhibitor?.legalName || job.clientName
  const shipperName = operational.inboundDocument?.shipper?.name || job.shipper
  const exhibitorDiffersFromShipper = Boolean(
    job.exhibitor?.legalName &&
    shipperName &&
    normalizedName(job.exhibitor.legalName) !== normalizedName(shipperName),
  )
  const TransportIcon = inbound.mode === 'AIR' ? Plane : inbound.mode === 'SEA' ? Ship : Truck

  return (
    <>
      <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40">
      <td className="px-3 py-3 align-top">
        <Link
          href={`/jobs/${job.id}`}
          className="font-semibold text-slate-900 hover:text-orange-700"
          title={nomor && nomor !== job.jobNumber ? `No. internal: ${job.jobNumber}` : undefined}
        >
          {nomor || job.jobNumber || 'Belum diisi'}
        </Link>
        <p className="mt-1">
          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
            {date(job.createdAt)}
          </span>
        </p>
        <div className="mt-1.5">
          <StatusBadge status={job.status} />
        </div>
      </td>
      <td className="w-[145px] max-w-[145px] px-3 py-3 align-top">
        <p className="truncate font-medium text-slate-800" title={exhibitorName}>
          {exhibitorName}
        </p>
        {exhibitorDiffersFromShipper && (
          <p
            className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive"
            title={`Nama Exhibitor berbeda dari Shipper pada B/L: ${shipperName}`}
          >
            <CircleAlert aria-hidden="true" /> Berbeda dengan Shipper B/L
          </p>
        )}
        <p className="mt-1 truncate" title={job.agent || 'Agent belum diisi'}>
          <span className="inline-flex max-w-full truncate rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
            {job.agent || 'Agent belum diisi'}
          </span>
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Hall: {job.exhibitor?.logistics?.hall || '—'}
          <br />
          Booth: {job.exhibitor?.logistics?.booth || '—'}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            aria-label={`Upload dokumen shipment untuk ${job.jobNumber}`}
            title="Upload dokumen: CIPL, B/L atau AWB, dokumen pendukung"
            className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-orange-100 hover:text-orange-700"
          >
            <Upload size={16} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => onEditDocument(job, 'TRANSPORT')}
            >
              {inbound.documentType || 'Masuk'} · {inbound.documentNumber || 'Belum ada dokumen'}
            </Button>
            <p className="mt-1">
              <Button
                type="button"
                variant="link"
                size="xs"
                className="text-primary hover:text-primary/80"
                onClick={() => onEditDocument(job, 'INVOICE')}
              >
                <FileText data-icon="inline-start" />
                Invoice: {operational.invoiceNumber || 'Belum ada dokumen'}
              </Button>
            </p>
            {documentComparison &&
              hasComparableDocumentValues &&
              (comparisonDifferences.length ? (
                <p
                  className="group relative mt-1 flex w-fit cursor-help items-center gap-1 text-xs font-medium text-amber-700"
                  aria-describedby={`document-differences-${job.id}`}
                >
                  <CircleAlert size={14} aria-hidden="true" />
                  {comparisonDifferences.length} data berbeda
                  <span
                    id={`document-differences-${job.id}`}
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-64 translate-y-1 rounded-md bg-slate-900 px-2.5 py-2 text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition-all duration-75 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    Field yang berbeda: {comparisonDifferences.map((item) => item.label).join(', ')}
                    .
                  </span>
                </p>
              ) : (
                <Link
                  href={`/jobs/${job.id}#pemeriksaan-dokumen`}
                  className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                  title="Buka ringkasan pemeriksaan dokumen"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Dokumen sesuai
                </Link>
              ))}
            {!documentComparison && (
              <p className="mt-1 text-xs text-slate-500">Menunggu Invoice dan B/L/AWB</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <TransportIcon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-700">{date(inbound.scheduleAt)}</p>
            <p className="mt-1">
              <span className="inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {inbound.carrier || '-'}
              </span>
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="truncate text-slate-600" title={job.billTo || undefined}>
          {job.billTo || '—'}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        {job.invoiceSent ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 size={12} aria-hidden="true" /> Terkirim
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            Belum
          </span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <p className="line-clamp-2 text-slate-600" title={job.notes || undefined}>
          {job.notes || '—'}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <CustomsProgress job={job} onGenerate={onGenerate} />
      </td>
      <td className="px-3 py-3 align-top">
        {actions ? (
          <div className="relative">
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                const rect = clickEvent.currentTarget.getBoundingClientRect()
                setMenuAnchor((current) =>
                  current ? null : { top: rect.bottom + 4, left: rect.right - 176 },
                )
              }}
              aria-label={`Menu aksi untuk ${nomor || job.jobNumber}`}
              aria-expanded={menuAnchor !== null}
              aria-haspopup="menu"
              title="Menu"
              className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700"
            >
              <MoreVertical size={18} />
            </button>
            {menuAnchor && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  role="presentation"
                  onClick={() => setMenuAnchor(null)}
                />
                <div
                  role="menu"
                  aria-label={`Aksi untuk ${nomor || job.jobNumber}`}
                  className="fixed z-50 w-44 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
                  style={{ top: menuAnchor.top, left: menuAnchor.left }}
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuAnchor(null)
                      actions.onEdit(job)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuAnchor(null)
                      actions.onDelete(job)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </td>
      </tr>
      <JobUploadDialog
        job={job}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onDocumentUploaded={onDocumentUploaded}
        onToast={onToast}
      />
    </>
  )
}
