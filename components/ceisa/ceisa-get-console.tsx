'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Action = 'status' | 'billing-pdf'
type ActionConfig = {
  label: string
  description: string
  endpoint: string
  field: { name: string; label: string; placeholder?: string }
  binary?: boolean
}

const actions: Record<Action, ActionConfig> = {
  status: {
    label: 'Status nomor aju',
    description: 'GET status CEISA untuk satu nomor aju 26 karakter. Hasilnya direkam sebagai evidence tanpa mengubah lifecycle Customs Job.',
    endpoint: '/api/ceisa/status',
    field: { name: 'nomorAju', label: 'Nomor aju', placeholder: '26 karakter alfanumerik' },
  },
  'billing-pdf': {
    label: 'PDF billing',
    description: 'Membuka PDF billing pada tab baru hanya bila respons CEISA tervalidasi sebagai PDF.',
    endpoint: '/api/ceisa/documents',
    field: { name: 'billingCode', label: 'Kode billing' },
    binary: true,
  },
}

export function CeisaGetConsole() {
  const [action, setAction] = useState<Action>('status')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const config = actions[action]
  const url = useMemo(() => {
    const query = new URLSearchParams({ [config.field.name]: value })
    if (action === 'billing-pdf') query.set('action', 'billing')
    return `${config.endpoint}?${query}`
  }, [action, config, value])

  function select(next: Action) { setAction(next); setValue(''); setResult(null); setError('') }
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

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6"><header><p className="text-sm font-medium text-primary">CEISA 4.0 · Proof of concept</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Lookup GET CEISA</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Demo ini membatasi operasi ke status nomor aju dan PDF billing.</p></header><section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Pilih lookup</h2><div className="mt-4 flex flex-wrap gap-2">{(Object.keys(actions) as Action[]).map((key) => <Button key={key} type="button" variant={key === action ? 'default' : 'outline'} size="sm" onClick={() => select(key)}>{actions[key].label}</Button>)}</div></section><section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{config.label}</h2><p className="mt-1 text-sm text-muted-foreground">{config.description}</p><FieldGroup className="mt-5"><Field><FieldLabel htmlFor="ceisa-lookup-value">{config.field.label}</FieldLabel><Input id="ceisa-lookup-value" placeholder={config.field.placeholder} value={value} onChange={(event) => setValue(event.target.value)} /></Field></FieldGroup><div className="mt-5 flex items-center gap-3"><Button type="button" disabled={loading || !value.trim()} onClick={run}>{loading ? 'Memuat…' : config.binary ? 'Buka PDF billing' : 'Jalankan GET'}</Button><FieldDescription>{config.endpoint}</FieldDescription></div>{error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}{result !== null && <pre className="mt-5 max-h-[28rem] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>}</section></div>
}
