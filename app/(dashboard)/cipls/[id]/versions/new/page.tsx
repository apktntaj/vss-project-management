'use client'

import { useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { activateCiplVersion, addCiplVersion } from '@/lib/indexeddb'

export default function NewCiplVersionPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const quantity = Number(form.get('quantity'))
    const description = String(form.get('description') ?? '').trim()
    const unit = String(form.get('unit') ?? '').trim().toUpperCase()
    if (!description || !unit || !(quantity > 0)) { setError('Deskripsi, quantity positif, dan unit wajib diisi.'); return }
    setSaving(true); setError('')
    try {
      const file = form.get('file')
      const sourceDocument = file instanceof File && file.size ? { id: crypto.randomUUID(), fileName: file.name, mimeType: 'application/pdf' as const, fileSize: file.size, file, createdAt: new Date().toISOString() } : null
      const version = await addCiplVersion(params.id, {
        receivedAt: new Date().toISOString(), receivedBy: 'local-user', sourceDocumentName: sourceDocument?.fileName ?? null, sourceDocument,
        items: [{ id: crypto.randomUUID(), lineNumber: 1, description, quantity, unit, unitValue: null, currency: null, grossWeightKg: null, netWeightKg: null, countryOfOrigin: null, identifiers: [], intendedUse: null, intendedDisposal: null }],
      })
      await activateCiplVersion(params.id, version.id, 'UNDER_REVIEW')
      router.push(`/cipls/${params.id}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Versi CIPL tidak dapat disimpan.') } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-2xl"><form onSubmit={submit} className="card p-6 sm:p-8"><h1 className="text-2xl font-bold">Tambah versi CIPL</h1><p className="mt-2 text-sm text-slate-500">Versi baru menjadi versi aktif. Tambahkan item lain melalui revisi berikutnya pada iterasi ini.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="label sm:col-span-2">Deskripsi item<input required name="description" className="input mt-1" /></label><label className="label">Quantity<input required min="0.0001" step="any" type="number" name="quantity" className="input mt-1" /></label><label className="label">Unit<input required name="unit" placeholder="PCS" className="input mt-1 uppercase" /></label><label className="label sm:col-span-2">PDF CIPL (opsional)<input accept="application/pdf" type="file" name="file" className="mt-1 block w-full text-sm" /></label></div>{error && <p className="mt-5 text-sm text-rose-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="btn-secondary">Batal</button><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan versi'}</button></div></form></div>
}
