'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FileText, FolderOpen, Plus, ReceiptText } from 'lucide-react'
import { useParams } from 'next/navigation'
import { getShipment, listCiplVersions, listCustomsJobs, type ExtractionOutcome } from '@/lib/data-client'
import type { CiplVersion, CustomsJob, Shipment } from '@/domain/exhibition/types'
import { StatusBadge } from '@/components/status-badge'
import { PageSkeleton } from '@/components/loading-skeletons'
import { CLASSIFICATION_LABEL, DocumentUploadPanel } from '@/components/document-upload-panel'
import { SupportingDocumentUploader } from '@/components/supporting-document-uploader'
import { ShipmentDocumentChecklist } from '@/components/shipment-document-checklist'

const EXPECTED_TRANSPORT: Record<'BL' | 'AWB', string> = { BL: 'BILL_OF_LADING', AWB: 'AIR_WAYBILL' }
const TRANSPORT_LABEL: Record<'BL' | 'AWB', string> = { BL: 'B/L', AWB: 'AWB' }

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string; shipmentId: string }>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [sourceVersion, setSourceVersion] = useState<CiplVersion | null>(null)
  const [jobs, setJobs] = useState<CustomsJob[]>([])
  const [loading, setLoading] = useState(true)
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0)
  const [transportWarning, setTransportWarning] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    getShipment(params.shipmentId)
      .then(async (loaded) => {
        if (!active) return
        setShipment(loaded)
        if (loaded) setJobs(await listCustomsJobs(loaded.id))
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.shipmentId])
  const ciplId = params.id
  useEffect(() => {
    if (!shipment) return
    let active = true
    listCiplVersions(ciplId)
      .then((versions) => {
        if (active) setSourceVersion(versions.find((version) => version.id === shipment.sourceCiplVersionId) ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [ciplId, shipment])

  function handleTransportExtracted(outcome: ExtractionOutcome) {
    setDocumentsRefreshKey((key) => key + 1)
    setTransportWarning(transportMismatchMessage(shipment?.documentType ?? null, outcome.result.classification.documentType))
  }

  if (loading || !shipment) {
    if (loading) return <PageSkeleton cards={2} rows={4} />
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
        <p>Shipment tidak ditemukan.</p>
        <Link href={`/cipls/${params.id}`} className="btn-secondary mt-3 inline-block">
          Kembali ke CIPL
        </Link>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Shipment</p>
          <h1 className="mt-1 text-3xl font-bold">
            {TRANSPORT_LABEL[shipment.documentType]} · {shipment.documentNumber}
          </h1>
          <div className="mt-3">
            <StatusBadge status={shipment.status} />
          </div>
        </div>
        <Link href={`/cipls/${params.id}/shipments/${shipment.id}/jobs/new`} className="btn-primary">
          <Plus size={16} /> Buat Job BC
        </Link>
      </div>

      <section className="space-y-4">
        <ShipmentDocumentChecklist
          shipmentId={shipment.id}
          refreshKey={documentsRefreshKey}
          onStatusChange={(updated) => setShipment(updated)}
        />

        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Dokumen CIPL</h3>
            <FileText size={16} className="text-slate-400" />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Sumber barang shipment ini — CIPL gabungan, packing list, atau commercial invoice dikelola sebagai versi CIPL.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <span className="text-slate-600">
              Versi sumber:{' '}
              <strong>{sourceVersion ? `v${sourceVersion.versionNumber}` : 'memuat...'}</strong>
              {sourceVersion?.sourceDocumentName && (
                <span className="ml-1 text-slate-500">· {sourceVersion.sourceDocumentName}</span>
              )}
            </span>
            <Link href={`/cipls/${params.id}/versions/new`} className="btn-secondary ml-auto">
              <Plus size={14} /> Unggah revisi dokumen CIPL
            </Link>
            <Link href={`/cipls/${params.id}`} className="btn-secondary">
              <FolderOpen size={14} /> Kelola CIPL
            </Link>
          </div>
        </div>

        <DocumentUploadPanel
          title="Dokumen transport (B/L atau AWB)"
          description={`Unggah ${TRANSPORT_LABEL[shipment.documentType]} untuk shipment ini. Hasil ekstraksi hanya ditampilkan, tidak menimpa data form.`}
          owner={{ ownerType: 'SHIPMENT', ownerId: shipment.id }}
          intendedKinds={['TRANSPORT']}
          onExtracted={handleTransportExtracted}
        />
        {transportWarning && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">{transportWarning}</p>
        )}

        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Dokumen pendukung</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">Opsional; tidak memengaruhi kelengkapan dokumen wajib.</p>
          <div className="mt-3">
            <SupportingDocumentUploader
              owner={{ ownerType: 'SHIPMENT', ownerId: shipment.id }}
              onUploaded={() => setDocumentsRefreshKey((key) => key + 1)}
            />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Informasi transport</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Arah</dt>
            <dd className="mt-1 font-medium">{shipment.direction}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Carrier</dt>
            <dd className="mt-1 font-medium">{shipment.carrier || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Shipper</dt>
            <dd className="mt-1 font-medium">{shipment.shipper || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Consignee</dt>
            <dd className="mt-1 font-medium">{shipment.consignee || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Customs Job</h2>
            <p className="mt-1 text-sm text-slate-500">Satu Job merekam satu dokumen BC.</p>
          </div>
          <ReceiptText className="text-orange-600" size={22} />
        </div>
        {jobs.length ? (
          <div className="mt-5 divide-y rounded-xl border">
            {jobs.map((job) => (
              <Link
                href={`/cipls/${params.id}/shipments/${shipment.id}/jobs/${job.id}`}
                key={job.id}
                className="flex items-center justify-between p-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold">
                    {job.jobNumber} · {job.documentType.replace('_', ' ')}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Aju: {job.ajuNumber || 'belum diisi'}</p>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-500">Belum ada Customs Job.</p>
        )}
      </section>
    </div>
  )
}

function transportMismatchMessage(documentType: 'BL' | 'AWB' | null, detected: string): string {
  if (!documentType) return ''
  const expected = EXPECTED_TRANSPORT[documentType]
  if (detected === expected) return ''
  if (detected === 'UNREADABLE' || detected === 'SUPPORTING_DOCUMENT') {
    return `Dokumen tidak terdeteksi sebagai B/L atau AWB — pastikan file yang diunggah adalah ${TRANSPORT_LABEL[documentType]}.`
  }
  return `Terdeteksi ${CLASSIFICATION_LABEL[detected] ?? detected} — shipment ini bertipe ${TRANSPORT_LABEL[documentType]}. Periksa kembali dokumen yang diunggah, atau perbaiki jenis shipment.`
}
