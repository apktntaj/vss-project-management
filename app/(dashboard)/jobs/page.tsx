'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileCheck2, FileWarning, Search, SlidersHorizontal } from 'lucide-react'
import { getOperationalDetails, listEvents, listJobs, type LocalEvent, type LocalJob } from '@/lib/indexeddb'
import { StatusBadge } from '@/components/status-badge'

type Scope = 'active' | 'all'
const date = (value: string | null) => value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'
const activeEvent = (event: LocalEvent | undefined) => !!event && new Date(`${event.endsOn}T23:59:59`) >= new Date()
const label = (key: string) => key.replaceAll('_', ' ')

function CustomsProgress({ job }: { job: LocalJob }) {
  const customs = getOperationalDetails(job).customs
  return <div className="flex min-w-[210px] gap-1.5">{(Object.keys(customs) as Array<keyof typeof customs>).map((key) => {
    const item = customs[key]
    const tone = !item.applicable ? 'border-slate-200 bg-slate-50 text-slate-400' : item.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.status === 'ON_HOLD' ? 'border-amber-200 bg-amber-50 text-amber-800' : item.status === 'NOT_STARTED' ? 'border-slate-200 bg-white text-slate-500' : 'border-blue-200 bg-blue-50 text-blue-800'
    return <div key={key} className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-center text-[10px] font-semibold ${tone}`} title={`${label(key)} · ${item.applicable ? item.status : 'Tidak diperlukan'}`}><span className="block">{label(key)}</span><span className="mt-0.5 block truncate font-normal">{item.applicable ? item.registrationNumber || item.ajuNumber || label(item.status) : 'N/A'}</span></div>
  })}</div>
}

function JobRow({ job }: { job: LocalJob }) {
  const operational = getOperationalDetails(job)
  const inbound = operational.inbound
  const outbound = operational.outbound
  return <tr className="border-b border-slate-100 last:border-0 hover:bg-orange-50/40">
    <td className="p-4 align-top"><Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-orange-700">{job.jobNumber}</Link><p className="mt-1 text-xs text-slate-500">Dibuat {date(job.createdAt)}</p></td>
    <td className="p-4 align-top"><p className="font-medium text-slate-800">{job.exhibitor?.legalName || job.shipper || job.clientName}</p><p className="mt-1 text-xs text-slate-500">{job.agent || 'Agent belum diisi'}</p></td>
    <td className="p-4 align-top"><p className="text-sm font-medium text-slate-700">{inbound.documentType || 'Masuk'} · {inbound.documentNumber || 'Belum ada dokumen'}</p><p className="mt-1 text-xs text-slate-500">Keluar: {outbound.documentType ? `${outbound.documentType} · ${outbound.documentNumber || 'belum diisi'}` : 'belum direncanakan'}</p></td>
    <td className="p-4 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${operational.cipl.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : operational.cipl.status === 'RECEIVED' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{operational.cipl.status === 'MISSING' ? 'Menunggu CIPL' : label(operational.cipl.status)}</span><p className="mt-1 text-xs text-slate-500">{operational.cipl.referenceNumber || 'Belum ada referensi'}</p></td>
    <td className="p-4 align-top"><CustomsProgress job={job}/></td>
    <td className="p-4 align-top"><p className="text-sm font-medium text-slate-700">{job.assignedTo?.name || 'Belum ada PIC'}</p><div className="mt-2"><StatusBadge status={job.status}/></div></td>
    <td className="p-4 align-top text-right"><Link href={`/jobs/${job.id}`} className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs">Lengkapi</Link></td>
  </tr>
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) { return <div className="card flex items-center gap-3 p-4"><span className={`rounded-xl p-2.5 ${tone}`}>{icon}</span><div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div></div> }

export default function JobsPage() {
  const [jobs, setJobs] = useState<LocalJob[]>([]); const [events, setEvents] = useState<LocalEvent[]>([])
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [scope, setScope] = useState<Scope>('active'); const [open, setOpen] = useState<Record<string, boolean>>({})
  useEffect(() => { Promise.all([listJobs(), listEvents()]).then(([loadedJobs, loadedEvents]) => { setJobs(loadedJobs); setEvents(loadedEvents); setOpen(Object.fromEntries(loadedEvents.map((event) => [event.id, true]))) }) }, [])
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const filtered = useMemo(() => jobs.filter((job) => { const operational = getOperationalDetails(job); const haystack = [job.jobNumber, job.exhibitor?.legalName, job.clientName, job.shipper, job.agent, job.blNumber, job.awbNumber, operational.cipl.referenceNumber, ...Object.values(operational.customs).flatMap((item) => [item.ajuNumber, item.registrationNumber, item.warehouseName])].filter(Boolean).join(' ').toLowerCase(); return (!search || haystack.includes(search.toLowerCase())) && (!status || job.status === status) && (scope === 'all' || activeEvent(job.eventId ? eventById.get(job.eventId) : undefined)) }), [jobs, search, status, scope, eventById])
  const grouped = useMemo(() => filtered.reduce<Record<string, LocalJob[]>>((all, job) => { const key = job.eventId || 'without-event'; (all[key] ||= []).push(job); return all }, {}), [filtered])
  const waitingCipl = filtered.filter((job) => getOperationalDetails(job).cipl.status === 'MISSING').length
  const needsAction = filtered.filter((job) => Object.values(getOperationalDetails(job).customs).some((item) => item.applicable && item.status !== 'COMPLETED')).length
  return <div className="space-y-6"><section><p className="eyebrow">Operational workbench</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Jobs</h1><p className="mt-2 text-sm text-slate-500">Lengkapi shipment, CIPL, dan dokumen kepabeanan tanpa kehilangan konteks event.</p></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Job aktif" value={filtered.length} icon={<FileCheck2 size={18}/>} tone="text-blue-700 bg-blue-50"/><Metric label="Menunggu CIPL" value={waitingCipl} icon={<FileWarning size={18}/>} tone="text-amber-700 bg-amber-50"/><Metric label="Perlu tindak lanjut" value={needsAction} icon={<SlidersHorizontal size={18}/>} tone="text-orange-700 bg-orange-50"/><Metric label="Selesai" value={filtered.filter((job) => job.status === 'COMPLETED').length} icon={<FileCheck2 size={18}/>} tone="text-emerald-700 bg-emerald-50"/></section>
    <section className="card p-4"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} className="input m-0 bg-slate-50 pl-10" placeholder="Cari nomor Job, exhibitor, agent, B/L, AWB, Nopen, atau gudang"/></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="input m-0 lg:w-52"><option value="">Semua status Job</option><option value="DRAFT">Draf</option><option value="IN_PROGRESS">Diproses</option><option value="ON_HOLD">Ditunda</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option></select><div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium"><button onClick={() => setScope('active')} className={`rounded-md px-3 py-1.5 ${scope === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Event aktif</button><button onClick={() => setScope('all')} className={`rounded-md px-3 py-1.5 ${scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Semua</button></div></div></section>
    {Object.entries(grouped).map(([eventId, eventJobs]) => { const event = eventById.get(eventId); const isOpen = open[eventId] ?? true; return <section key={eventId} className="card overflow-hidden"><button onClick={() => setOpen((value) => ({ ...value, [eventId]: !isOpen }))} className="flex w-full items-center gap-3 border-b bg-slate-50 px-5 py-4 text-left hover:bg-slate-100"><span className="text-slate-400">{isOpen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{event?.officialName || 'Job tanpa event'}</span><span className="mt-0.5 block text-xs text-slate-500">{event ? `${date(event.startsAt)} – ${date(event.endsAt)}` : 'Perlu ditautkan ke event'}</span></span><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{eventJobs.length} Job</span></button>{isOpen && <div className="overflow-x-auto"><table className="min-w-[1120px] w-full text-left text-sm"><thead className="border-b bg-white text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Job</th><th className="p-4">Pihak</th><th className="p-4">Transport</th><th className="p-4">CIPL</th><th className="p-4">Dokumen BC</th><th className="p-4">PIC & Status</th><th className="p-4"/></tr></thead><tbody>{eventJobs.map((job) => <JobRow key={job.id} job={job}/>)}</tbody></table></div>}</section> })}
    {!filtered.length && <section className="card p-12 text-center"><p className="font-semibold text-slate-800">Tidak ada Job yang sesuai</p><p className="mt-2 text-sm text-slate-500">Ubah pencarian atau filter untuk melihat Job lain.</p></section>}
  </div>
}
