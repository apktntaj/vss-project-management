import { prisma } from '@/lib/prisma'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, ArrowUpRight, CheckCircle2, ClipboardList, PackageOpen, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const [projects, openTasks, readyTasks, openBlockers, customsCases] = await Promise.all([
    prisma.project.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tasks: true, cargoItems: true } },
        tasks: { select: { execution: true } },
      },
    }),
    prisma.projectTask.count({ where: { execution: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.projectTask.count({ where: { readiness: 'READY', execution: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.projectBlocker.count({ where: { resolvedAt: null } }),
    prisma.project.count({ where: { customsRelevant: true, status: { not: 'COMPLETED' } } }),
  ])

  const stats = [
    { label: 'Project aktif', value: projects.filter((item) => item.status === 'ACTIVE').length, note: 'Portofolio berjalan', icon: PackageOpen, tone: 'text-orange-700 bg-orange-50' },
    { label: 'Task terbuka', value: openTasks, note: `${readyTasks} siap dijalankan`, icon: ClipboardList, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Blocker', value: openBlockers, note: 'Perlu tindak lanjut', icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Customs case', value: customsCases, note: 'Close-out dipantau', icon: ShieldAlert, tone: 'text-rose-700 bg-rose-50' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Command center</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Operasional hari ini</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Pantau kesiapan pekerjaan, hambatan lapangan, dan kewajiban customs dari satu tempat.</p>
        </div>
        <Link href="/projects/new" className="btn-primary">Buat project</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, tone }) => (
          <article key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></div>
              <span className={`rounded-xl p-2.5 ${tone}`}><Icon size={20} /></span>
            </div>
            <p className="mt-3 text-xs text-slate-400">{note}</p>
          </article>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div><h2 className="font-semibold">Project terbaru</h2><p className="mt-1 text-xs text-slate-500">Status lintas task dan cargo</p></div>
          <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700">Lihat semua <ArrowUpRight size={15} /></Link>
        </div>
        <div className="divide-y">
          {projects.map((project) => {
            const done = project.tasks.filter((task) => task.execution === 'COMPLETED').length
            const progress = project._count.tasks ? Math.round((done / project._count.tasks) * 100) : 0
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group grid gap-4 p-5 hover:bg-slate-50 md:grid-cols-[1fr_160px_150px] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold group-hover:text-orange-700">{project.name}</p><StatusBadge status={project.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">{project.code} · {project._count.cargoItems} cargo item · diperbarui {formatDate(project.updatedAt)}</p>
                </div>
                <div><div className="flex justify-between text-xs"><span>Progress</span><span className="font-semibold">{progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-600" style={{ width: `${progress}%` }} /></div></div>
                <div className="flex items-center gap-2 text-sm text-slate-500">{progress === 100 ? <CheckCircle2 className="text-emerald-600" size={17} /> : <ClipboardList size={17} />}{done}/{project._count.tasks} task selesai</div>
              </Link>
            )
          })}
          {!projects.length && <div className="p-12 text-center"><PackageOpen className="mx-auto text-slate-300" /><p className="mt-3 font-medium">Belum ada project</p><p className="mt-1 text-sm text-slate-500">Buat project pertama untuk mulai merencanakan pekerjaan.</p></div>}
        </div>
      </section>
    </div>
  )
}
