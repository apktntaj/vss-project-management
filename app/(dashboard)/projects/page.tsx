import { prisma } from '@/lib/prisma'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { Search } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const q = searchParams.q?.trim() ?? ''
  const status = searchParams.status ?? ''
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    include: {
      _count: { select: { tasks: true, participants: true, cargoItems: true, blockers: { where: { resolvedAt: null } } } },
      tasks: { select: { readiness: true, execution: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div><p className="eyebrow">Portfolio</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Semua project</h1><p className="mt-2 text-sm text-slate-500">Satu project dapat memuat event, delivery, handling, dan customs case.</p></div>
        <Link href="/projects/new" className="btn-primary shrink-0">Project baru</Link>
      </div>
      <form className="card flex flex-col gap-3 p-4 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input name="q" defaultValue={q} className="input m-0 pl-10" placeholder="Cari kode atau nama project" /></label>
        <select name="status" defaultValue={status} className="input m-0 sm:w-48"><option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="ON_HOLD">Ditahan</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option></select>
        <button className="btn-secondary">Terapkan</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => {
          const done = project.tasks.filter((task) => task.execution === 'COMPLETED').length
          const needsInfo = project.tasks.filter((task) => task.readiness === 'NEEDS_INFORMATION').length
          return (
            <Link href={`/projects/${project.id}`} key={project.id} className="card group p-5 hover:border-indigo-200 hover:shadow-md">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{project.code}</p><h2 className="mt-1 text-lg font-semibold group-hover:text-indigo-700">{project.name}</h2></div><StatusBadge status={project.status} /></div>
              <div className="mt-5 grid grid-cols-4 gap-2 border-t pt-4 text-center">
                <Metric value={`${done}/${project._count.tasks}`} label="Task" />
                <Metric value={needsInfo} label="Gap" warn={needsInfo > 0} />
                <Metric value={project._count.cargoItems} label="Cargo" />
                <Metric value={project._count.blockers} label="Blocker" warn={project._count.blockers > 0} />
              </div>
              <p className="mt-4 text-xs text-slate-400">{project._count.participants} partisipasi · Diperbarui {formatDate(project.updatedAt)}</p>
            </Link>
          )
        })}
      </div>
      {!projects.length && <div className="card p-12 text-center text-sm text-slate-500">Tidak ada project yang sesuai.</div>}
    </div>
  )
}

function Metric({ value, label, warn = false }: { value: number | string; label: string; warn?: boolean }) {
  return <div><p className={`text-lg font-bold ${warn ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p><p className="text-xs text-slate-400">{label}</p></div>
}
