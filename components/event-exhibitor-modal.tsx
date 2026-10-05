'use client'

import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { saveEventExhibitors, type EventExhibitorInput, type LocalEvent } from '@/lib/data-client'

const emptyExhibitor = (): EventExhibitorInput => ({
  kind: 'INTERNATIONAL',
  name: '',
  contact: { name: null, role: null, email: null, phone: null },
  agentId: null,
})

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

export function EventExhibitorModal({ event, onSaved, onCancel }: { event: LocalEvent; onSaved: () => void; onCancel: () => void }) {
  const [exhibitors, setExhibitors] = useState<EventExhibitorInput[]>([emptyExhibitor()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(index: number, change: Partial<EventExhibitorInput>) {
    const normalizedChange =
      change.name === undefined
        ? change
        : { ...change, name: change.name.toLocaleUpperCase('id-ID') }
    setExhibitors((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...normalizedChange } as EventExhibitorInput : item,
      ),
    )
  }
  function setKind(index: number, kind: EventExhibitorInput['kind']) {
    setExhibitors((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const shared = {
          name: item.name,
          contact: item.contact,
          agentId: item.agentId,
        }
        return kind === 'LOCAL'
          ? { ...shared, kind, npwp: null }
          : { ...shared, kind }
      }),
    )
  }


  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (exhibitors.some((exhibitor) => !exhibitor.name.trim())) {
      setError('Nama exhibitor wajib diisi.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveEventExhibitors(event.id, exhibitors)
      toast('Exhibitor berhasil ditambahkan.', 'success')
      onSaved()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Exhibitor tidak dapat disimpan.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="add-exhibitor-title" className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden"><div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8"><div><h2 id="add-exhibitor-title" className="text-xl font-bold">Tambah exhibitor</h2><p className="mt-1 text-sm text-slate-500">{event.name}</p></div><button type="button" onClick={onCancel} aria-label="Tutup modal exhibitor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8">{exhibitors.map((exhibitor, index) => <div key={index} className="rounded-xl border border-black/10 bg-slate-50 p-4"><div className="flex items-start justify-between gap-4"><fieldset className="flex gap-4 text-sm font-medium"><label><input type="radio" checked={exhibitor.kind === 'LOCAL'} onChange={() => setKind(index, 'LOCAL')} /> Local</label><label><input type="radio" checked={exhibitor.kind === 'INTERNATIONAL'} onChange={() => setKind(index, 'INTERNATIONAL')} /> International</label></fieldset>{exhibitors.length > 1 && <button type="button" onClick={() => setExhibitors((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Hapus exhibitor ${index + 1}`} className="text-rose-600"><Trash2 size={16} /></button>}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="label sm:col-span-2">Nama exhibitor<input required value={exhibitor.name} onChange={(event) => update(index, { name: event.target.value })} className="input" /></label><label className="label">Nama PIC<input value={exhibitor.contact.name ?? ''} onChange={(event) => update(index, { contact: { ...exhibitor.contact, name: event.target.value || null } })} className="input" /></label><label className="label">Jabatan PIC<input value={exhibitor.contact.role ?? ''} onChange={(event) => update(index, { contact: { ...exhibitor.contact, role: event.target.value || null } })} className="input" /></label><label className="label">Email PIC<input type="email" value={exhibitor.contact.email ?? ''} onChange={(event) => update(index, { contact: { ...exhibitor.contact, email: event.target.value || null } })} className="input" /></label><label className="label">Telepon PIC<input value={exhibitor.contact.phone ?? ''} onChange={(event) => update(index, { contact: { ...exhibitor.contact, phone: event.target.value || null } })} className="input" /></label>{exhibitor.kind === 'LOCAL' && <label className="label sm:col-span-2">NPWP<input value={exhibitor.npwp ?? ''} onChange={(event) => update(index, { npwp: event.target.value || null })} className="input" /></label>}</div></div>)}<button type="button" onClick={() => setExhibitors((current) => [...current, emptyExhibitor()])} className="btn-secondary w-full"><Plus size={16} /> Tambah exhibitor</button></div><div className="shrink-0 border-t px-6 py-4 sm:px-8">{error && <p className="mb-4 text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-3"><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan exhibitor'}</button><button type="button" onClick={onCancel} className="btn-secondary">Batal</button></div></div></form></div>
}
