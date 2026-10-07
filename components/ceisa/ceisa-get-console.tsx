'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Action = 'status' | 'pending' | 'foreign-port' | 'domestic-port' | 'tps' | 'rate' | 'tariff' | 'manifest' | 'document-detail' | 'billing-pdf' | 'final-form'
type FieldConfig = { name: string; label: string; placeholder?: string; type?: 'text' | 'date' }
type ActionConfig = { label: string; description: string; endpoint: string; fields: FieldConfig[]; binary?: boolean }

const actions: Record<Action, ActionConfig> = {
  status: { label: 'Status nomor aju', description: 'GET /status/{nomorAju}. Nomor aju harus 26 karakter alfanumerik.', endpoint: '/api/ceisa/status', fields: [{ name: 'nomorAju', label: 'Nomor aju', placeholder: '26 karakter' }] },
  pending: { label: 'Status perusahaan', description: 'GET status belum diambil per Company ID/NITKU.', endpoint: '/api/ceisa/status', fields: [{ name: 'idPerusahaan', label: 'Company ID / NITKU' }] },
  'foreign-port': { label: 'Pelabuhan luar negeri', description: 'Cari minimal dua karakter.', endpoint: '/api/ceisa/references', fields: [{ name: 'q', label: 'Kata pencarian', placeholder: 'Singapore' }] },
  'domestic-port': { label: 'Pelabuhan domestik', description: 'Memerlukan kode kantor pabean.', endpoint: '/api/ceisa/references', fields: [{ name: 'customsOfficeCode', label: 'Kode kantor pabean' }] },
  tps: { label: 'TPS / gudang', description: 'Memerlukan kode kantor pabean.', endpoint: '/api/ceisa/references', fields: [{ name: 'customsOfficeCode', label: 'Kode kantor pabean' }] },
  rate: { label: 'Kurs', description: 'GET /kurs/{kodeValuta}. Respons tanpa tanggal efektif tetap ditolak sebagai observasi kurs.', endpoint: '/api/ceisa/financial', fields: [{ name: 'currency', label: 'Kode valuta', placeholder: 'USD' }] },
  tariff: { label: 'Tarif HS', description: 'Observasi tarif CEISA; bukan pengganti verifikasi LARTAS INSW.', endpoint: '/api/ceisa/financial', fields: [{ name: 'hsCode', label: 'Kode HS', placeholder: '8 digit' }, { name: 'effectiveDate', label: 'Tanggal efektif', type: 'date' }] },
  manifest: { label: 'Manifest BC 1.1', description: 'Tampilkan kandidat; operator memilih hasil yang tepat.', endpoint: '/api/ceisa/manifest', fields: [{ name: 'hostDocumentNumber', label: 'Nomor B/L atau AWB' }, { name: 'hostDocumentDate', label: 'Tanggal B/L atau AWB', type: 'date' }, { name: 'customsOfficeCode', label: 'Kode kantor pabean' }, { name: 'importerName', label: 'Nama importir' }] },
  'document-detail': { label: 'Detail dokumen BC 2.3', description: 'Memerlukan nomor aju dan kode kantor.', endpoint: '/api/ceisa/documents', fields: [{ name: 'nomorAju', label: 'Nomor aju' }, { name: 'customsOfficeCode', label: 'Kode kantor pabean' }] },
  'billing-pdf': { label: 'PDF billing', description: 'Membuka PDF billing pada tab baru setelah CEISA mengembalikan PDF valid.', endpoint: '/api/ceisa/documents', fields: [{ name: 'billingCode', label: 'Kode billing' }], binary: true },
  'final-form': { label: 'Formulir final PDF', description: 'Membuka formulir final pada tab baru.', endpoint: '/api/ceisa/documents', fields: [{ name: 'nomorAju', label: 'Nomor aju' }], binary: true },
}

function queryFor(action: Action, values: Record<string, string>) {
  const query = new URLSearchParams(values)
  if (action === 'foreign-port' || action === 'domestic-port' || action === 'tps') query.set('kind', action)
  if (action === 'rate') query.set('action', 'rate')
  if (action === 'tariff') query.set('action', 'tariff')
  if (action === 'document-detail') query.set('action', 'detail')
  if (action === 'billing-pdf') query.set('action', 'billing')
  if (action === 'final-form') query.set('action', 'final-form')
  return query
}

export function CeisaGetConsole() {
  const [action, setAction] = useState<Action>('status')
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const config = actions[action]
  const url = useMemo(() => `${config.endpoint}?${queryFor(action, values).toString()}`, [action, config.endpoint, values])

  function select(next: Action) { setAction(next); setValues({}); setResult(null); setError('') }
  async function run() {
    setLoading(true); setError(''); setResult(null)
    try {
      if (config.binary) { window.open(url, '_blank', 'noopener,noreferrer'); return }
      const response = await fetch(url, { cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'GET CEISA gagal.')
      setResult(body)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'GET CEISA gagal.') } finally { setLoading(false) }
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6"><header><p className="text-sm font-medium text-primary">CEISA 4.0</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Lookup GET CEISA</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Semua aksi memakai endpoint GET yang diizinkan. Hasil vendor tetap bersifat evidence provisional sampai kontrak endpoint terverifikasi.</p></header><section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Pilih lookup</h2><div className="mt-4 flex flex-wrap gap-2">{(Object.keys(actions) as Action[]).map((key) => <Button key={key} type="button" variant={key === action ? 'default' : 'outline'} size="sm" onClick={() => select(key)}>{actions[key].label}</Button>)}</div></section><section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{config.label}</h2><p className="mt-1 text-sm text-muted-foreground">{config.description}</p><FieldGroup className="mt-5 grid gap-4 md:grid-cols-2">{config.fields.map((field) => <Field key={field.name}><FieldLabel htmlFor={`ceisa-${field.name}`}>{field.label}</FieldLabel><Input id={`ceisa-${field.name}`} type={field.type ?? 'text'} placeholder={field.placeholder} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} /></Field>)}</FieldGroup><div className="mt-5 flex items-center gap-3"><Button type="button" disabled={loading || config.fields.some((field) => !values[field.name]?.trim())} onClick={run}>{loading ? 'Memuat…' : config.binary ? 'Buka PDF' : 'Jalankan GET'}</Button><FieldDescription>{config.endpoint}</FieldDescription></div>{error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}{result !== null && <pre className="mt-5 max-h-[28rem] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>}</section></div>
}
