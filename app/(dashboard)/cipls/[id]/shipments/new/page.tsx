'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams, useParams, useRouter } from 'next/navigation'
import { createShipment, listCiplVersions } from '@/lib/data-client'
import type { CiplVersion } from '@/domain/exhibition/types'
import { ListSkeleton } from '@/components/loading-skeletons'
import { DocumentUploadPanel } from '@/components/document-upload-panel'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'

type TransportPrefill = {
  documentType: 'BL' | 'AWB' | null
  documentNumber: string
  carrier: string
  shipper: string
  consignee: string
  notifyParty: string
  origin: string
  destination: string
  etaOrEtd: string
  shipmentMode: 'FCL' | 'LCL' | ''
}

const EMPTY_PREFILL: TransportPrefill = {
  documentType: null, documentNumber: '', carrier: '', shipper: '', consignee: '',
  notifyParty: '', origin: '', destination: '', etaOrEtd: '', shipmentMode: '',
}

/** Pemetaan JobTransportExtraction → field Shipment (R4.3, R6.1). */
function prefillFromExtraction(result: ExtractionResult): TransportPrefill {
  const transport = result.transport
  if (!transport) return EMPTY_PREFILL
  const documentType = result.classification.documentType === 'BILL_OF_LADING'
    ? 'BL'
    : result.classification.documentType === 'AIR_WAYBILL' ? 'AWB' : null
  return {
    documentType,
    documentNumber: transport.documentNumber ?? '',
    carrier: transport.carrier ?? '',
    shipper: transport.shipper?.name ?? '',
    consignee: transport.consignee?.name ?? '',
    notifyParty: transport.notifyParty?.name ?? '',
    origin: transport.portOfLoading ?? transport.placeOfReceipt ?? '',
    destination: transport.portOfDischarge ?? transport.placeOfDelivery ?? '',
    etaOrEtd: transport.eta ?? transport.etd ?? '',
    shipmentMode: transport.containers.length ? 'FCL' : transport.documentNumber ? 'LCL' : '',
  }
}

export default function NewShipmentPage() {
  const params = useParams<{ id: string }>(); const search = useSearchParams(); const router = useRouter(); const versionId = search.get('version')
  const [version, setVersion] = useState<CiplVersion | null>(null); const [quantities, setQuantities] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<TransportPrefill>(EMPTY_PREFILL)
  useEffect(() => { if (versionId) listCiplVersions(params.id).then((versions) => setVersion(versions.find((item) => item.id === versionId) ?? null)) }, [params.id, versionId])
  const setField = (field: keyof TransportPrefill, value: string) => setPrefill((current) => ({ ...current, [field]: value }))
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const documentType = String(form.get('documentType')) as 'BL' | 'AWB'; const documentNumber = String(form.get('documentNumber') ?? '').trim(); if (!versionId || !version || !documentNumber) { setError('Versi aktif dan nomor dokumen wajib tersedia.'); return }; const allocations = version.items.flatMap((item) => { const quantity = Number(quantities[item.id] || 0); return quantity > 0 ? [{ ciplVersionId: version.id, ciplItemId: item.id, quantity, unit: item.unit }] : [] }); if (!allocations.length) { setError('Alokasikan minimal satu item ke shipment.'); return }; setSaving(true); setError(''); try { await createShipment(params.id, versionId, { documentType, documentNumber, shipmentMode: documentType === 'BL' ? String(form.get('shipmentMode') || '') as 'FCL' | 'LCL' | null : null, direction: String(form.get('direction')) as 'IMPORT' | 'EXPORT', shipper: prefill.shipper.trim() || null, consignee: prefill.consignee.trim() || null, notifyParty: prefill.notifyParty.trim() || null, carrier: prefill.carrier.trim() || null, etaOrEtd: prefill.etaOrEtd.trim() || null, origin: prefill.origin.trim() || null, destination: prefill.destination.trim() || null, attachment: null, status: 'DRAFT' }, allocations); router.push(`/cipls/${params.id}`) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Shipment tidak dapat disimpan.') } finally { setSaving(false) } }
  return <div className="mx-auto max-w-3xl space-y-6">{versionId && version && <div className="card p-6 sm:p-8"><h2 className="text-lg font-bold">Unggah dokumen transport</h2><p className="mt-2 text-sm text-slate-500">Opsional: unggah B/L atau AWB dan field di bawah terisi otomatis — tetap dapat Anda koreksi.</p><div className="mt-4"><DocumentUploadPanel title="Dokumen transport" owner={{ ownerType: 'CIPL_VERSION', ownerId: version.id }} intendedKinds={['TRANSPORT']} onExtracted={(outcome) => setPrefill(prefillFromExtraction(outcome.result))} /></div></div>}<form onSubmit={submit} className="card p-6 sm:p-8"><h1 className="text-2xl font-bold">Buat shipment</h1><p className="mt-2 text-sm text-slate-500">Pilih quantity tiap item yang benar-benar dikirim dalam B/L atau AWB ini.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="label">Jenis dokumen<select name="documentType" value={prefill.documentType ?? ''} onChange={(event) => setPrefill((current) => ({ ...current, documentType: (event.target.value || null) as 'BL' | 'AWB' | null }))} className="input mt-1"><option value="">—</option><option value="AWB">AWB</option><option value="BL">B/L</option></select></label><label className="label">Nomor dokumen<input required name="documentNumber" value={prefill.documentNumber} onChange={(event) => setField('documentNumber', event.target.value)} className="input mt-1"/></label><label className="label">Arah<select name="direction" className="input mt-1"><option value="IMPORT">Impor</option><option value="EXPORT">Ekspor</option></select></label><label className="label">Mode B/L (opsional)<select name="shipmentMode" value={prefill.shipmentMode} onChange={(event) => setPrefill((current) => ({ ...current, shipmentMode: event.target.value as 'FCL' | 'LCL' | '' }))} className="input mt-1"><option value="">—</option><option value="FCL">FCL</option><option value="LCL">LCL</option></select></label><label className="label">Carrier<input name="carrier" value={prefill.carrier} onChange={(event) => setField('carrier', event.target.value)} className="input mt-1"/></label><label className="label">Shipper<input name="shipper" value={prefill.shipper} onChange={(event) => setField('shipper', event.target.value)} className="input mt-1"/></label><label className="label">Consignee<input name="consignee" value={prefill.consignee} onChange={(event) => setField('consignee', event.target.value)} className="input mt-1"/></label><label className="label">Notify party<input name="notifyParty" value={prefill.notifyParty} onChange={(event) => setField('notifyParty', event.target.value)} className="input mt-1"/></label><label className="label">Asal (port of loading)<input name="origin" value={prefill.origin} onChange={(event) => setField('origin', event.target.value)} className="input mt-1"/></label><label className="label">Tujuan (port of discharge)<input name="destination" value={prefill.destination} onChange={(event) => setField('destination', event.target.value)} className="input mt-1"/></label><label className="label">ETA/ETD<input name="etaOrEtd" type="date" value={prefill.etaOrEtd} onChange={(event) => setField('etaOrEtd', event.target.value)} className="input mt-1"/></label></div><section className="mt-7"><h2 className="font-semibold">Alokasi item</h2>{version ? <div className="mt-3 divide-y rounded-xl border">{version.items.map((item) => <label key={item.id} className="grid grid-cols-[1fr_8rem] items-center gap-4 p-4"><span><span className="block font-medium">{item.lineNumber}. {item.description}</span><span className="text-xs text-slate-500">Tersedia: {item.quantity} {item.unit}</span></span><input value={quantities[item.id] ?? ''} onChange={(e) => setQuantities((current) => ({ ...current, [item.id]: e.target.value }))} min="0" max={item.quantity} step="any" type="number" placeholder={item.unit} className="input" aria-label={`Alokasi quantity untuk ${item.description}`}/></label>)}</div> : <div className="mt-3"><ListSkeleton rows={3} /></div>}</section>{error && <p className="mt-5 text-sm text-rose-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => router.back()} className="btn-secondary">Batal</button><button disabled={saving || !version} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan shipment'}</button></div></form></div>
}
