import { createProject } from '../actions'
import Link from 'next/link'

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/projects" className="text-sm font-medium text-slate-500 hover:text-orange-700">← Kembali ke project</Link>
      <div className="mt-5"><p className="eyebrow">Project intake</p><h1 className="mt-2 text-3xl font-bold">Buat project baru</h1><p className="mt-2 text-sm text-slate-500">Mulai dari identitas dan sumber fakta. Task dan participant ditambahkan setelah project dibuat.</p></div>
      <form action={createProject} className="card mt-7 space-y-6 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="label">Kode project<input required name="code" className="input" placeholder="PRJ-MICE-2026-002" /></label>
          <label className="label">Nama project<input required name="name" className="input" placeholder="Nama kerja project" /></label>
          <label className="label">Mulai<input name="startsAt" type="datetime-local" className="input" /></label>
          <label className="label">Selesai rencana<input name="endsAt" type="datetime-local" className="input" /></label>
        </div>
        <label className="label block">Referensi sumber<input required name="sourceReference" className="input" placeholder="docs/whatsapp-operational-vss.txt:baris" /><span className="mt-1 block text-xs font-normal text-slate-400">Setiap project harus dapat ditelusuri ke sumber fakta.</span></label>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 p-4"><input name="customsRelevant" type="checkbox" className="mt-1 h-4 w-4 accent-orange-600" /><span><span className="block text-sm font-semibold">Project memiliki customs case</span><span className="mt-1 block text-xs text-slate-500">Aktifkan kontrol keputusan dan close-out per cargo item.</span></span></label>
        <div className="flex justify-end gap-3 border-t pt-5"><Link href="/projects" className="btn-secondary">Batal</Link><button className="btn-primary">Simpan project</button></div>
      </form>
    </div>
  )
}
