'use client'

import { useSearchParams, useParams, useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createShipment } from '@/lib/indexeddb'

export default function NewShipmentPage() {
  const params = useParams<{ id: string }>(); const search = useSearchParams(); const router = useRouter()
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const documentType = String(form.get('documentType')) as 'BL' | 'AWB'; const documentNumber = String(form.get('documentNumber') ?? '').trim()
    const version = search.get('version'); if (!version || !documentNumber) { setError('Versi aktif dan nomor dokumen wajib tersedia.'); return }
    setSaving(true); setError('')
    try {
      await createShipment(params.id, version, { documentType, documentNumber, shipmentMode: documentType === 'BL' ? String(form.get('shipmentMode') || '') as 'FCL' | 'LCL' | null : null, direction: String(form.get('direction')) as 'IMPORT' | 'EXPORT', shipper: null, consignee: null, notifyParty: null, carrier: null, etaOrEtd: null, origin: null, destination: null, attachment: null, status: 'DRAFT' }, [])
      router.push(`/cipls/${params.id}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Shipment tidak dapat disimpan.') } finally { setSaving(false) }
  }
  return <div className="mx-auto max-w-2xl"><form onSubmit={submit} className="card p-6 sm:p-8"><h1 className="text-2xl font-bold">Buat shipment</h1><p className="mt-2 text-sm text-slate-500">Lengkapi alokasi item sebelum shipment dinyatakan siap untuk customs.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="label">Jenis dokumen<select name="documentType" className="input mt-1"><option value="AWB">AWB</option><option value="BL">B/L</option></select></label><label className="label">Nomor dokumen<input required name="documentNumber" className="input mt-1" /></label><label className="label">Arah<select name="direction" className="input mt-1"><option value="IMPORT">Impor</option><option value="EXPORT">Ekspor</option></select></label><label className="label">Mode B/L (opsional)<select name="shipmentMode" className="input mt-1"><option value="">—</option><option value="FCL">FCL</option><option value="LCL">LCL</option></select></label></div>{error && <p className="mt-5 text-sm text-rose-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="btn-secondary">Batal</button><button disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan shipment'}</button></div></form></div>
}
