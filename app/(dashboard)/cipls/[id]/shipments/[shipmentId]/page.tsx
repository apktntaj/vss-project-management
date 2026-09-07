'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, ReceiptText } from 'lucide-react'
import { useParams } from 'next/navigation'
import { getShipment, listCustomsJobs } from '@/lib/indexeddb'
import type { CustomsJob, Shipment } from '@/domain/exhibition/types'
import { StatusBadge } from '@/components/status-badge'

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string; shipmentId: string }>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [jobs, setJobs] = useState<CustomsJob[]>([])
  useEffect(() => { getShipment(params.shipmentId).then(async (loaded) => { setShipment(loaded); if (loaded) setJobs(await listCustomsJobs(loaded.id)) }) }, [params.shipmentId])
  if (!shipment) return <p className="card p-6 text-sm text-slate-500">Memuat shipment...</p>
  return <div className="mx-auto max-w-4xl space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Shipment</p><h1 className="mt-1 text-3xl font-bold">{shipment.documentType} · {shipment.documentNumber}</h1><div className="mt-3"><StatusBadge status={shipment.status} /></div></div><Link href={`/cipls/${params.id}/shipments/${shipment.id}/jobs/new`} className="btn-primary"><Plus size={16} /> Buat Job BC</Link></div><section className="card p-6"><h2 className="font-semibold">Informasi transport</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Arah</dt><dd className="mt-1 font-medium">{shipment.direction}</dd></div><div><dt className="text-slate-500">Carrier</dt><dd className="mt-1 font-medium">{shipment.carrier || '—'}</dd></div><div><dt className="text-slate-500">Shipper</dt><dd className="mt-1 font-medium">{shipment.shipper || '—'}</dd></div><div><dt className="text-slate-500">Consignee</dt><dd className="mt-1 font-medium">{shipment.consignee || '—'}</dd></div></dl></section><section className="card p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Customs Job</h2><p className="mt-1 text-sm text-slate-500">Satu Job merekam satu dokumen BC.</p></div><ReceiptText className="text-orange-600" size={22}/></div>{jobs.length ? <div className="mt-5 divide-y rounded-xl border">{jobs.map((job) => <Link href={`/cipls/${params.id}/shipments/${shipment.id}/jobs/${job.id}`} key={job.id} className="flex items-center justify-between p-4 hover:bg-slate-50"><div><p className="font-semibold">{job.jobNumber} · {job.documentType.replace('_', ' ')}</p><p className="mt-1 text-sm text-slate-500">Aju: {job.ajuNumber || 'belum diisi'}</p></div><StatusBadge status={job.status}/></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">Belum ada Customs Job.</p>}</section></div>
}
