'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { listJobs, type LocalJob } from '@/lib/indexeddb'
import { StatusBadge } from '@/components/status-badge'

export default function JobsPage() {
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => { listJobs({ search, status }).then(setJobs) }, [search, status])

  return <><div className="mb-7 flex items-start justify-between"><div><h1 className="text-2xl font-bold">Semua job</h1><p className="mt-1 text-sm text-slate-500">Data MVP disimpan lokal di browser melalui IndexedDB.</p></div><Link href="/jobs/new" className="btn-primary">Buat job</Link></div><div className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row"><input className="input m-0" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor job, AWB/BL, atau klien"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="input m-0 sm:w-48"><option value="">Semua status</option><option value="DRAFT">Draf</option><option value="IN_PROGRESS">Diproses</option><option value="ON_HOLD">Ditunda</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option></select></div><div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Job</th><th className="p-4">Shipment</th><th className="p-4">Klien</th><th className="p-4">PIC</th><th className="p-4">Status</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-4 font-semibold text-blue-800"><Link href={`/jobs/${job.id}`}>{job.jobNumber}</Link></td><td className="p-4">{job.type}<br/><span className="text-slate-500">{job.awbNumber || job.blNumber || '—'}</span></td><td className="p-4">{job.clientName}</td><td className="p-4">{job.assignedTo?.name || '—'}</td><td className="p-4"><StatusBadge status={job.status}/></td></tr>)}</tbody></table>{!jobs.length && <p className="p-10 text-center text-slate-500">Belum ada job lokal yang sesuai.</p>}</div></>
}
