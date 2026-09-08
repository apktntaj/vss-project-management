'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FileText, Package, Plus } from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  getCipl,
  getAttachmentContent,
  listCiplVersions,
  listShipments,
  type LocalExhibitor,
  listEventExhibitors,
} from '@/lib/data-client'
import type { Attachment, Cipl, CiplVersion, Shipment } from '@/domain/exhibition/types'
import { StatusBadge } from '@/components/status-badge'

export default function CiplDetailPage() {
  const params = useParams<{ id: string }>()
  const [cipl, setCipl] = useState<Cipl | null>(null)
  const [versions, setVersions] = useState<CiplVersion[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [exhibitor, setExhibitor] = useState<LocalExhibitor | null>(null)

  useEffect(() => {
    getCipl(params.id).then(async (loaded) => {
      setCipl(loaded)
      if (!loaded) return
      const [loadedVersions, loadedShipments, exhibitors] = await Promise.all([
        listCiplVersions(loaded.id), listShipments(loaded.id), listEventExhibitorsForCipl(loaded.eventExhibitorId),
      ])
      setVersions(loadedVersions)
      setShipments(loadedShipments)
      setExhibitor(exhibitors.find((item) => item.id === loaded.eventExhibitorId) ?? null)
    })
  }, [params.id])

  if (!cipl) return <p className="card p-6 text-sm text-slate-500">Memuat CIPL...</p>
  const activeVersion = versions.find((version) => version.id === cipl.activeVersionId)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">CIPL · {exhibitor?.legalName ?? 'Exhibitor'}</p>
          <h1 className="mt-1 text-3xl font-bold">{cipl.referenceNumber || 'CIPL belum bernomor'}</h1>
          <div className="mt-3"><StatusBadge status={cipl.status} /></div>
        </div>
        <Link href={`/cipls/${cipl.id}/versions/new`} className="btn-primary"><Plus size={16} /> Tambah versi</Link>
      </div>

      <section className="card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Versi CIPL</h2><p className="mt-1 text-sm text-slate-500">Revisi lama dipertahankan dan tidak ditimpa.</p></div><FileText className="text-orange-600" size={22} /></div>
        {versions.length ? <div className="mt-5 space-y-3">{versions.map((version) => <div key={version.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">Versi {version.versionNumber} {version.id === cipl.activeVersionId && <span className="ml-2 text-xs text-emerald-700">AKTIF</span>}</p><span className="text-xs text-slate-500">{version.items.length} item</span></div><p className="mt-1 text-sm text-slate-500">{version.sourceDocumentName || 'File belum diunggah'} · diterima {version.receivedAt || 'belum dicatat'}</p>{version.sourceDocument && <OpenAttachment attachment={version.sourceDocument}/>}</div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">Belum ada versi CIPL. Tambahkan dokumen atau input item secara manual.</p>}
      </section>

      <section className="card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Shipment</h2><p className="mt-1 text-sm text-slate-500">Setiap shipment memakai tepat satu B/L atau AWB.</p></div><Package className="text-blue-600" size={22} /></div>
        {activeVersion && <Link href={`/cipls/${cipl.id}/shipments/new?version=${activeVersion.id}`} className="btn-secondary mt-5"><Plus size={16} /> Buat shipment</Link>}
{shipments.length ? <div className="mt-5 divide-y rounded-xl border">{shipments.map((shipment) => <Link href={`/cipls/${cipl.id}/shipments/${shipment.id}`} key={shipment.id} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"><div><p className="font-semibold">{shipment.documentType} · {shipment.documentNumber}</p><p className="mt-1 text-sm text-slate-500">{shipment.direction} · {shipment.allocations.length} alokasi item</p></div><StatusBadge status={shipment.status} /></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">Belum ada shipment.</p>}
      </section>
    </div>
  )
}

function OpenAttachment({ attachment }: { attachment: Attachment }) {
  async function open() {
    const content = await getAttachmentContent(attachment.id)
    if (!content) return
    const url = URL.createObjectURL(content)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  return <button type="button" onClick={open} className="mt-3 text-sm font-medium text-orange-700 hover:underline">Buka {attachment.fileName}</button>
}

async function listEventExhibitorsForCipl(exhibitorId: string) {
  // Exhibition membership is scoped to an event; no global exhibitor lookup is allowed.
  const events = await (await import('@/lib/data-client')).listEvents()
  const groups = await Promise.all(events.map((event) => listEventExhibitors(event.id)))
  return groups.flat().filter((exhibitor) => exhibitor.id === exhibitorId)
}
