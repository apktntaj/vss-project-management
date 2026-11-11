'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Ban,
  CircleAlert,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Pencil,
  Plane,
  Ship,
  Truck,
} from 'lucide-react'

import { getOperationalDetails, type Job } from '@/lib/data-client'
import { transportModeLabels } from '@/domain/job/types'
import { summarizeKoliCollections } from '@/domain/job/manifest'
import { jobJenisLabel, jobJenisKey } from '@/lib/job-jenis'
import type {
  JobInvoiceExtraction,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import type { BcDocumentKind } from '@/domain/job/types'
import { jobFileName, jobLabel } from '@/domain/job/numbering'

export type DocumentClassification = {
  documentType:
    | 'BILL_OF_LADING'
    | 'AIR_WAYBILL'
    | 'COMMERCIAL_INVOICE'
    | 'CIPL'
    | 'PACKING_LIST'
    | 'OTHER'
    | 'UNREADABLE'
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
const quantity = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 })

export type JobDocumentExtraction = {
  invoice?: JobInvoiceExtraction | null
  transport?: JobTransportExtraction | null
}

/** Unduh workbook Excel untuk satu dokumen BC; melempar error bila API gagal. */
export async function downloadCustomsWorkbook(job: Job, documentType: BcDocumentKind) {
  const response = await fetch('/api/export-customs-workbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: job.id, documentType }),
  })
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string }
    throw new Error(payload.error || 'File BC tidak dapat dibuat.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = jobFileName(job, documentType.replaceAll('_', '-'), 'xlsx')
  anchor.click()
  URL.revokeObjectURL(url)
}

export function JobRow({
  job,
  nomor,
  event,
  actions,
}: {
  job: Job
  /** No Job yang diisi manual; kosong bila belum ditetapkan. */
  nomor?: string
  /** Bila diisi, tampil kolom Event · Jenis · Jalur (tabel lintas event di /jobs). */
  event?: { id: string; name: string } | null
  /** Bila diisi, kolom terakhir menampilkan menu titik tiga (Edit/Kanwil/Batalkan) alih-alih PIC. */
  actions?: {
    onEdit: (job: Job) => void
    onCancel: (job: Job) => void
    onKanwilLetter: (job: Job) => void
    onTppbGoodsForm: (job: Job) => void
  }
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const inbound = getOperationalDetails(job).inbound
  const partyName = job.party?.name || 'Pihak belum ditetapkan'
  const shipperName = job.transportDocument?.shipper?.name ?? null
  // Job yang dipegang exhibitor langsung: exhibitor itulah shipper pada B/L.
  const exhibitorDiffersFromShipper = Boolean(
    job.party?.kind === 'EXHIBITOR' &&
      shipperName &&
      normalizedName(job.party.name) !== normalizedName(shipperName),
  )
  // Total PKG dan CBM job = turunan koli seluruh baris CIPL (sama dengan header blok manifest).
  const totals = summarizeKoliCollections(job.ciplLines.map((line) => line.koli))
  const blAwbLabel = job.transportDocumentNumber
    ? `${job.transportDocumentType ? `${job.transportDocumentType} · ` : ''}${job.transportDocumentNumber}`
    : null
  const TransportIcon = inbound.mode === 'AIR' ? Plane : inbound.mode === 'SEA' ? Ship : Truck

  return (
    <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40">
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Link
            href={`/jobs/${job.id}`}
            className="min-w-0 truncate font-semibold text-slate-900 hover:text-orange-700"
          >
            {nomor || jobLabel(job)}
          </Link>
        </div>
      </td>
      {event !== undefined && (
        <td className="px-3 py-2.5 align-middle">
          <div className="flex items-center gap-2 whitespace-nowrap">
            {event ? (
              <Link
                href={`/events/${event.id}`}
                className="min-w-0 truncate font-medium text-slate-800 hover:text-orange-700"
                title={event.name}
              >
                {event.name}
              </Link>
            ) : (
              <span className="text-slate-400">—</span>
            )}
            <span className="shrink-0 text-xs text-slate-500">
              {jobJenisLabel(jobJenisKey(job))}
              {job.transportMode ? ` · ${transportModeLabels[job.transportMode]}` : ''}
            </span>
          </div>
        </td>
      )}
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2 whitespace-nowrap">
          {exhibitorDiffersFromShipper && (
            <span
              className="shrink-0 text-destructive"
              title={`Nama Exhibitor berbeda dari Shipper pada B/L: ${shipperName}`}
            >
              <CircleAlert size={14} role="img" aria-label="Berbeda dengan Shipper B/L" />
            </span>
          )}
          <span className="min-w-0 truncate font-medium text-slate-800" title={partyName}>
            {partyName}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="block truncate text-slate-700" title={blAwbLabel ?? undefined}>
          {blAwbLabel ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <TransportIcon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-700">{date(inbound.scheduleAt)}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
        {totals.totalCount > 0 ? quantity.format(totals.totalCount) : '—'}
      </td>
      <td className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
        {totals.volumeCbm > 0 ? quantity.format(totals.volumeCbm) : '—'}
      </td>
      <td className="px-3 py-2.5 align-middle">
        {actions ? (
          <div className="relative">
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                const rect = clickEvent.currentTarget.getBoundingClientRect()
                setMenuAnchor((current) =>
                  current ? null : { top: rect.bottom + 4, left: rect.right - 256 },
                )
              }}
              aria-label={`Menu aksi untuk ${nomor || jobLabel(job)}`}
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
                  aria-label={`Aksi untuk ${nomor || jobLabel(job)}`}
                  className="fixed z-50 w-64 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
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
                  {job.kind === 'INTERNATIONAL' && job.status !== 'CANCELLED' && (
                    <>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setMenuAnchor(null)
                          actions.onKanwilLetter(job)
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <FileText size={15} /> Surat permohonan Kanwil (PDF)
                      </button>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setMenuAnchor(null)
                          actions.onTppbGoodsForm(job)
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <FileSpreadsheet size={15} /> Form rincian barang (Excel)
                      </button>
                    </>
                  )}
                  {job.status !== 'CANCELLED' && (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenuAnchor(null)
                        actions.onCancel(job)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <Ban size={15} /> Batalkan
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </td>
    </tr>
  )
}
