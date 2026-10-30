'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from '@/components/toast'
import {
  listShipmentDocuments,
  markShipmentReadyForCustoms,
  type ShipmentDocumentsView,
} from '@/lib/data-client'
import type { Shipment } from '@/domain/exhibition/types'

const KIND_LABEL: Record<string, string> = {
  CIPL: 'CIPL',
  TRANSPORT: 'Dokumen transport',
  BILL_OF_LADING: 'Bill of lading',
  AIR_WAYBILL: 'Air waybill',
  SUPPORTING_DOCUMENT: 'Pendukung',
}

/** Status kelengkapan Mandatory_Document_Set + tombol tandai siap pabean (R7.2–R7.5). */
export function ShipmentDocumentChecklist({
  shipmentId,
  refreshKey = 0,
  onStatusChange,
}: {
  shipmentId: string
  refreshKey?: number
  onStatusChange?: (shipment: Shipment) => void
}) {
  const [view, setView] = useState<ShipmentDocumentsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function load() {
    setLoading(true)
    listShipmentDocuments(shipmentId)
      .then(setView)
      .catch((caught) => toast(caught instanceof Error ? caught.message : 'Dokumen shipment tidak dapat dimuat.', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [shipmentId, refreshKey])

  async function markReady() {
    setBusy(true)
    try {
      const shipment = await markShipmentReadyForCustoms(shipmentId)
      toast('Shipment siap untuk pabean.', 'success')
      onStatusChange?.(shipment)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Shipment tidak dapat ditandai siap pabean.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const complete = view?.completeness.status === 'COMPLETE'

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Dokumen wajib shipment</h3>
        <span
          aria-label={`Kelengkapan dokumen wajib: ${view?.completeness.status ?? 'memuat'}`}
          role="status"
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {complete ? 'COMPLETE' : view ? 'INCOMPLETE' : '...'}
        </span>
      </div>
      {loading && !view && <p className="mt-3 text-sm text-slate-500">Memuat dokumen...</p>}
      {view && (
        <>
          {view.completeness.messages.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              {view.completeness.messages.map((message) => (
                <li key={message} role="note">{message}</li>
              ))}
            </ul>
          )}
          {complete && (
            <p className="mt-2 flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> CIPL dan dokumen transport lengkap.
            </p>
          )}
          {view.documents.length > 0 ? (
            <ul className="mt-3 divide-y rounded-lg border">
              {view.documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                  <span className="truncate font-medium">{document.fileName}</span>
                  <span className="text-xs text-slate-500">
                    {document.kind ? KIND_LABEL[document.kind] ?? document.kind : 'Lampiran'}
                    {' · '}
                    {Math.max(1, Math.round(document.fileSize / 1024))} KB
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Belum ada dokumen tertaut pada shipment ini.</p>
          )}
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={load} className="btn-secondary" aria-label="Muat ulang daftar dokumen">
          <RefreshCw size={14} /> Muat ulang
        </button>
        <button
          type="button"
          onClick={markReady}
          disabled={busy || !complete}
          aria-label="Tandai shipment siap untuk pabean"
          className="btn-primary"
        >
          {busy ? 'Menyimpan...' : 'Tandai siap pabean'}
        </button>
      </div>
    </div>
  )
}
