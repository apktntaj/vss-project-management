'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BriefcaseBusiness, ClipboardList, Plus } from 'lucide-react'
import { listJobs, type LocalJob } from '@/lib/indexeddb'
import { StatusBadge } from '@/components/status-badge'

export default function EventsPage() {
  const [jobs, setJobs] = useState<LocalJob[]>([])
  useEffect(() => { listJobs().then(setJobs) }, [])
  const completed = jobs.filter((job) => job.status === 'COMPLETED').length
  const open = jobs.length - completed

  return <div className="space-y-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold tracking-tight">Events</h1><p className="mt-2 text-sm text-slate-500">Kelola pekerjaan operasional event dari browser.</p></div><Link href="/jobs/new" className="btn-primary"><Plus size={16}/> New Job</Link></div><div className="grid gap-4 sm:grid-cols-3"><article className="card p-5"><BriefcaseBusiness className="text-orange-600" size={20}/><p className="mt-4 text-sm text-slate-500">Total job</p><p className="mt-1 text-3xl font-bold">{jobs.length}</p></article><article className="card p-5"><ClipboardList className="text-blue-600" size={20}/><p className="mt-4 text-sm text-slate-500">Job terbuka</p><p className="mt-1 text-3xl font-bold">{open}</p></article><article className="card p-5"><ClipboardList className="text-emerald-600" size={20}/><p className="mt-4 text-sm text-slate-500">Selesai</p><p className="mt-1 text-3xl font-bold">{completed}</p></article></div><section className="card overflow-hidden"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Event terbaru</h2><p className="mt-1 text-xs text-slate-500">Tersimpan di perangkat ini</p></div><Link href="/jobs" className="text-sm font-semibold text-orange-700">Lihat semua</Link></div><div className="divide-y">{jobs.slice(0, 5).map((job) => <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50"><div><p className="font-semibold">{job.jobNumber}</p><p className="mt-1 text-sm text-slate-500">{job.clientName} · {job.type}</p></div><StatusBadge status={job.status}/></Link>)}{!jobs.length && <div className="p-12 text-center"><p className="font-medium">Belum ada event</p><p className="mt-1 text-sm text-slate-500">Buat job pertama untuk mulai.</p></div>}</div></section></div>
}