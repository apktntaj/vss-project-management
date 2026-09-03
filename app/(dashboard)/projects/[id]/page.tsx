import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Package, ShieldCheck, UserRoundCog } from 'lucide-react'
import { addAssignment, addCargoItem, addEvidence, addParticipant, addTask, setTaskExecution } from '../actions'

export const dynamic = 'force-dynamic'

type Gap = { code?: string; label?: string }
type EvidenceRequirement = { evidenceType?: string; minimum?: number }

const roleLabels: Record<string, string> = {
  CUSTOMER: 'Customer', AGENT: 'Agent', EXHIBITOR: 'Exhibitor', ORGANIZER: 'Organizer',
  VENUE: 'Venue', FORWARDER: 'Forwarder', VENDOR: 'Vendor', DRIVER: 'Driver',
  FIELD_OPERATIONS: 'Field Operations', WAREHOUSE: 'Warehouse', CUSTOMER_SERVICE: 'Customer Service',
  DOCUMENT_CUSTOMS: 'Document & Customs', FINANCE: 'Finance', SUPERVISOR: 'Supervisor',
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      participants: { orderBy: [{ partyName: 'asc' }, { role: 'asc' }] },
      cargoItems: { include: { customsDecision: true }, orderBy: { reference: 'asc' } },
      tasks: {
        include: { assignments: { orderBy: { startsAt: 'asc' } }, blockers: true, evidence: true },
        orderBy: [{ mandatory: 'desc' }, { createdAt: 'asc' }],
      },
      milestones: { orderBy: { title: 'asc' } },
      blockers: { where: { taskId: null }, orderBy: { openedAt: 'desc' } },
      changes: { orderBy: { occurredAt: 'desc' } },
    },
  })
  if (!project) notFound()

  const incompleteTasks = project.tasks.filter((task) => task.mandatory && task.execution !== 'COMPLETED')
  const incompleteMilestones = project.milestones.filter((milestone) => milestone.mandatory && milestone.state !== 'COMPLETED')
  const openCustoms = project.cargoItems.filter((item) => item.customsDecision && item.customsDecision.closeOutStatus !== 'COMPLETED')
  const canClose = !incompleteTasks.length && !incompleteMilestones.length && !openCustoms.length
  const completed = project.tasks.filter((task) => task.execution === 'COMPLETED').length
  const progress = project.tasks.length ? Math.round((completed / project.tasks.length) * 100) : 0

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl">
        <div className="grid gap-8 p-6 md:grid-cols-[1fr_280px] md:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-200">{project.code}</span><StatusBadge status={project.status} /></div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="mt-2 text-sm text-slate-400">Sumber: {project.sourceReference}</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              <span>{project.startsAt ? formatDate(project.startsAt) : 'Mulai belum ditentukan'}</span>
              <span>→</span>
              <span>{project.endsAt ? formatDate(project.endsAt) : 'Selesai belum ditentukan'}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Progress task</span><strong>{progress}%</strong></div>
            <div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-indigo-400" style={{ width: `${progress}%` }} /></div>
            <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-4">
              {canClose ? <CheckCircle2 className="mt-0.5 text-emerald-400" size={20} /> : <AlertCircle className="mt-0.5 text-amber-400" size={20} />}
              <div><p className="text-sm font-semibold">{canClose ? 'Siap ditutup' : 'Belum dapat ditutup'}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{canClose ? 'Semua kewajiban telah selesai.' : `${incompleteTasks.length} task, ${incompleteMilestones.length} milestone, ${openCustoms.length} customs close-out masih terbuka.`}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={Clock3} label="Task" value={`${completed}/${project.tasks.length}`} note="selesai" />
        <Summary icon={AlertCircle} label="Information gap" value={project.tasks.reduce((sum, task) => sum + asGaps(task.informationGaps).length, 0)} note="perlu dikonfirmasi" />
        <Summary icon={UserRoundCog} label="Partisipasi" value={project.participants.length} note="party × role" />
        <Summary icon={ShieldCheck} label="Customs" value={project.customsRelevant ? openCustoms.length : 'N/A'} note={project.customsRelevant ? 'close-out terbuka' : 'tidak relevan'} />
      </section>

      <section className="card overflow-hidden">
        <SectionHeader title="Task & execution" subtitle="Readiness terpisah dari status pelaksanaan" />
        <div className="divide-y">
          {project.tasks.map((task) => {
            const gaps = asGaps(task.informationGaps)
            const requirements = task.evidenceRequirements as EvidenceRequirement[]
            return (
              <article key={task.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-indigo-600">{task.code}</span><StatusBadge status={task.kind} /><StatusBadge status={task.readiness} /><StatusBadge status={task.execution} />{task.mandatory && <span className="text-xs font-semibold text-rose-600">Wajib</span>}</div>
                    <h3 className="mt-2 font-semibold">{task.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{task.action} · {task.origin && task.destination ? `${task.origin} → ${task.destination}` : task.location ?? task.requestedTimeText ?? 'Detail belum lengkap'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((execution) => (
                      <form action={setTaskExecution} key={execution}>
                        <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="execution" value={execution} />
                        <button disabled={task.execution === execution} className="btn-secondary px-3 py-1.5 text-xs">{execution === 'PLANNED' ? 'Rencanakan' : execution === 'IN_PROGRESS' ? 'Mulai' : 'Selesaikan'}</button>
                      </form>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <InfoBox title="Information gaps" empty="Tidak ada gap" items={gaps.map((item) => `[${item.code ?? 'GAP'}] ${item.label ?? ''}`)} warn />
                  <InfoBox title="Assignment" empty="Belum ada assignment" items={task.assignments.map((item) => `${item.resourceLabel} · ${item.status}`)} />
                  <InfoBox title="Evidence" empty={`Dibutuhkan: ${requirements.map((item) => item.evidenceType).join(', ')}`} items={task.evidence.map((item) => `${item.evidenceType} · ${item.verification}`)} />
                </div>
                <details className="mt-4 rounded-lg border bg-slate-50">
                  <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-600">Catat evidence</summary>
                  <form action={addEvidence} className="grid gap-3 border-t p-4 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="taskId" value={task.id} />
                    <input required name="evidenceType" className="input m-0" placeholder="delivery-receipt" />
                    <input required name="fileReference" className="input m-0" placeholder="Nomor dokumen / URL file" />
                    <button className="btn-primary">Simpan evidence</button>
                  </form>
                </details>
                <details className="mt-2 rounded-lg border bg-slate-50">
                  <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-600">Buat assignment</summary>
                  <form action={addAssignment} className="grid gap-3 border-t p-4 md:grid-cols-3">
                    <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="taskId" value={task.id} />
                    <select name="resourceType" className="input m-0"><option value="PERSON">Person</option><option value="VEHICLE">Vehicle</option><option value="EQUIPMENT">Equipment</option><option value="VENDOR">Vendor</option></select>
                    <input required name="resourceLabel" className="input m-0" placeholder="Resource konkret" />
                    <input required name="sourceReference" className="input m-0" placeholder="Referensi sumber" />
                    <label className="text-xs text-slate-500">Mulai<input required name="startsAt" type="datetime-local" className="input" /></label>
                    <label className="text-xs text-slate-500">Selesai<input required name="endsAt" type="datetime-local" className="input" /></label>
                    <button className="btn-primary self-end">Simpan assignment</button>
                  </form>
                </details>
              </article>
            )
          })}
        </div>
        <details className="border-t bg-slate-50">
          <summary className="cursor-pointer p-5 text-sm font-semibold text-indigo-700">+ Tambah task</summary>
          <form action={addTask} className="grid gap-4 border-t bg-white p-5 md:grid-cols-2">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="label">Kode<input required name="code" className="input" placeholder="TSK-..." /></label>
            <label className="label">Judul<input required name="title" className="input" /></label>
            <label className="label">Jenis<select name="kind" className="input"><option value="MOVEMENT">Movement</option><option value="HANDLING">Handling</option><option value="CUSTOMS">Customs</option><option value="ADMINISTRATIVE">Administrative</option></select></label>
            <label className="label">Action<input required name="action" className="input" placeholder="DELIVERY" /></label>
            <label className="label">Requested time<input name="requestedTimeText" className="input" placeholder="besok / waktu permintaan" /></label>
            <label className="label">Lokasi atau rute<input name="place" className="input" placeholder="Origin → Destination" /></label>
            <label className="label">Mulai rencana<input name="plannedStartsAt" type="datetime-local" className="input" /></label>
            <label className="label">Selesai rencana<input name="plannedEndsAt" type="datetime-local" className="input" /></label>
            <label className="label">Evidence minimum<input name="evidenceType" className="input" placeholder="completion-proof" /></label>
            <label className="label">Sumber<input required name="sourceReference" className="input" placeholder="docs/...:baris" /></label>
            <label className="flex items-center gap-2 text-sm"><input defaultChecked name="mandatory" type="checkbox" /> Task wajib</label>
            <button className="btn-primary md:justify-self-end">Tambah task</button>
          </form>
        </details>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <SectionHeader title="Participant & role" subtitle="Role melekat pada project, bukan party selamanya" />
          <div className="divide-y">{project.participants.map((item) => <div key={item.id} className="flex items-center justify-between p-4"><div><p className="font-medium">{item.partyName}</p><p className="mt-1 text-xs text-slate-400">{item.sourceReference}</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{roleLabels[item.role]}</span></div>)}</div>
          <details className="border-t bg-slate-50"><summary className="cursor-pointer p-4 text-sm font-semibold text-indigo-700">+ Tambah participant</summary><form action={addParticipant} className="grid gap-3 border-t bg-white p-4 sm:grid-cols-2"><input type="hidden" name="projectId" value={project.id} /><input required name="partyName" className="input m-0" placeholder="Nama party" /><select name="role" className="input m-0">{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input required name="sourceReference" className="input m-0 sm:col-span-2" placeholder="Referensi sumber" /><button className="btn-primary sm:col-span-2 sm:justify-self-end">Tambah participant</button></form></details>
        </section>

        <section className="card overflow-hidden">
          <SectionHeader title="Milestone" subtitle="Titik kendali, bukan pengganti task" />
          <div className="divide-y">{project.milestones.map((item) => <div key={item.id} className="flex items-center justify-between p-4"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">Owner: {roleLabels[item.ownerRole]}</p></div><StatusBadge status={item.state} /></div>)}{!project.milestones.length && <p className="p-5 text-sm text-slate-500">Belum ada milestone.</p>}</div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <SectionHeader title="Cargo & customs control" subtitle="Treatment dan intended disposal ditetapkan per item" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-4">Cargo item</th><th className="p-4">Quantity</th><th className="p-4">Intended use / disposal</th><th className="p-4">Treatment</th><th className="p-4">Close-out</th></tr></thead><tbody className="divide-y">{project.cargoItems.map((item) => <tr key={item.id}><td className="p-4"><p className="font-semibold">{item.reference}</p><p className="mt-1 text-slate-500">{item.description}</p></td><td className="p-4">{String(item.quantity)} {item.quantityUnit}</td><td className="p-4"><p>{item.intendedUse ?? '—'}</p><p className="mt-1 text-xs font-semibold text-indigo-700">{item.intendedDisposal.replaceAll('_', ' ')}</p></td><td className="p-4"><StatusBadge status={item.customsDecision?.treatmentStatus ?? 'UNDECIDED'} /><p className="mt-2 max-w-xs text-xs text-slate-500">{item.customsDecision?.confirmationNeeded ?? item.customsDecision?.routeLabel ?? 'Belum dinilai'}</p></td><td className="p-4"><StatusBadge status={item.customsDecision?.closeOutStatus ?? 'NOT_YET_DUE'} /></td></tr>)}</tbody></table>
          {!project.cargoItems.length && <div className="p-10 text-center text-sm text-slate-500"><Package className="mx-auto mb-2 text-slate-300" />Belum ada cargo item.</div>}
        </div>
        {project.customsRelevant && <div className="border-t bg-amber-50 px-5 py-4 text-sm text-amber-900"><strong>Catatan:</strong> status ini adalah kontrol operasional. Aplikasi tidak menetapkan HS, LARTAS, tarif, atau keputusan hukum.</div>}
        <details className="border-t bg-slate-50">
          <summary className="cursor-pointer p-5 text-sm font-semibold text-indigo-700">+ Tambah cargo item</summary>
          <form action={addCargoItem} className="grid gap-4 border-t bg-white p-5 md:grid-cols-2 xl:grid-cols-3">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="label">Referensi item<input required name="reference" className="input" placeholder="CARGO-001" /></label>
            <label className="label xl:col-span-2">Deskripsi<input required name="description" className="input" /></label>
            <label className="label">Owner<input name="ownerName" className="input" /></label>
            <label className="label">Quantity<input required name="quantity" type="number" min="0.001" step="0.001" className="input" /></label>
            <label className="label">Unit<input required name="quantityUnit" className="input" placeholder="case / package / unit" /></label>
            <label className="label">Identifier<input name="identifiers" className="input" placeholder="serial, marking, case no." /></label>
            <label className="label">Intended use<input name="intendedUse" className="input" placeholder="Pameran" /></label>
            <label className="label">Intended disposal<select name="intendedDisposal" className="input"><option value="UNDECIDED">Undecided</option><option value="RETURN_ABROAD">Return abroad</option><option value="RETURN_TO_INDONESIA">Return to Indonesia</option><option value="REMAIN_IN_INDONESIA">Remain in Indonesia</option><option value="CONSUMED">Consumed</option><option value="DISTRIBUTED">Distributed</option><option value="SOLD_OR_TRANSFERRED">Sold / transferred</option><option value="DESTROYED">Destroyed</option></select></label>
            <label className="label md:col-span-2 xl:col-span-3">Sumber<input required name="sourceReference" className="input" placeholder="docs/...:baris" /></label>
            <button className="btn-primary md:col-span-2 md:justify-self-end xl:col-span-3">Tambah cargo</button>
          </form>
        </details>
      </section>

      <section className="card overflow-hidden">
        <SectionHeader title="Change history" subtitle="Rencana lama tidak ditimpa" />
        <div className="divide-y">{project.changes.map((item) => <div key={item.id} className="grid gap-2 p-4 md:grid-cols-[170px_1fr_180px]"><p className="text-xs text-slate-400">{formatDate(item.occurredAt)}</p><div><p className="text-sm font-medium">{item.subject} · {item.field}</p><p className="mt-1 text-xs text-slate-500">{item.reason}</p></div><p className="text-xs text-slate-500 md:text-right">{item.actorLabel}<br />{item.changeType}</p></div>)}{!project.changes.length && <p className="p-5 text-sm text-slate-500">Belum ada perubahan tercatat.</p>}</div>
      </section>
    </div>
  )
}

function asGaps(value: unknown): Gap[] {
  return Array.isArray(value) ? value.filter((item): item is Gap => Boolean(item && typeof item === 'object')) : []
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="border-b px-5 py-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>
}

function Summary({ icon: Icon, label, value, note }: { icon: typeof FileCheck2; label: string; value: string | number; note: string }) {
  return <article className="card flex items-center gap-4 p-4"><span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><Icon size={20} /></span><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-xl font-bold">{value} <span className="text-xs font-normal text-slate-400">{note}</span></p></div></article>
}

function InfoBox({ title, items, empty, warn = false }: { title: string; items: string[]; empty: string; warn?: boolean }) {
  return <div className={`rounded-lg border p-3 text-xs ${warn && items.length ? 'border-amber-200 bg-amber-50' : 'bg-slate-50'}`}><p className="font-semibold">{title}</p>{items.length ? <ul className="mt-2 space-y-1 text-slate-600">{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-slate-400">{empty}</p>}</div>
}
