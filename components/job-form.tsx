'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getJob, listUsers, saveJob, type LocalJob, type LocalUser } from '@/lib/indexeddb'

export function JobForm({ jobId }: { jobId?: string }) {
	const router = useRouter()
	const [job, setJob] = useState<LocalJob | null>(null)
	const [users, setUsers] = useState<LocalUser[]>([])
	const [error, setError] = useState('')
	const [saving, setSaving] = useState(false)

	useEffect(() => { Promise.all([listUsers(), jobId ? getJob(jobId) : Promise.resolve(null)]).then(([loadedUsers, loadedJob]) => { setUsers(loadedUsers); setJob(loadedJob) }) }, [jobId])

	async function submit(form: FormData) {
		setSaving(true); setError('')
		try {
			const value = (name: string) => String(form.get(name) || '').trim() || null
			const saved = await saveJob({ awbNumber: value('awbNumber'), blNumber: value('blNumber'), type: String(form.get('type')) as LocalJob['type'], clientName: String(form.get('clientName') || '').trim(), clientInfo: value('clientInfo'), status: String(form.get('status') || 'DRAFT') as LocalJob['status'], notes: value('notes'), assignedToId: value('assignedToId') }, jobId)
			router.push(`/jobs/${saved.id}`)
		} catch { setError('Tidak dapat menyimpan job di IndexedDB.') } finally { setSaving(false) }
	}

	if (jobId && !job) return <p className="card p-6 text-sm text-slate-500">Memuat data job lokal…</p>
	return <form action={submit} className="card max-w-3xl p-6"><div className="grid gap-5 sm:grid-cols-2"><label className="label">Tipe shipment<select name="type" defaultValue={job?.type || 'IMPORT'} className="input"><option value="IMPORT">Impor</option><option value="EXPORT">Ekspor</option></select></label><label className="label">Nama klien<input required name="clientName" defaultValue={job?.clientName || ''} className="input" /></label><label className="label">Nomor AWB<input name="awbNumber" defaultValue={job?.awbNumber || ''} className="input" /></label><label className="label">Nomor BL<input name="blNumber" defaultValue={job?.blNumber || ''} className="input" /></label><label className="label">Ditugaskan ke<select name="assignedToId" defaultValue={job?.assignedToId || ''} className="input"><option value="">Belum ditugaskan</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>{job && <label className="label">Status job<select name="status" defaultValue={job.status} className="input"><option value="DRAFT">Draf</option><option value="IN_PROGRESS">Sedang diproses</option><option value="ON_HOLD">Ditunda</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Selesai dibatalkan</option></select></label>}</div><label className="label mt-5 block">Keterangan klien<input name="clientInfo" defaultValue={job?.clientInfo || ''} className="input" /></label><label className="label mt-5 block">Catatan<textarea name="notes" defaultValue={job?.notes || ''} className="input min-h-24" /></label>{error && <p className="mt-4 text-sm text-rose-700">{error}</p>}<div className="mt-6 flex gap-3"><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan job'}</button><button type="button" onClick={() => router.back()} className="btn-secondary">Batal</button></div></form>
}
