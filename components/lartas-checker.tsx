'use client'

import { useState, type FormEvent } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { LartasResultCard } from '@/components/lartas-result-card'
import { checkLartas } from '@/lib/data-client'
import { LARTAS_MAX_CODES_PER_REQUEST, type LartasResult } from '@/domain/lartas/types'

function codesFrom(value: string) {
  return value.split(/[\s,;]+/).map((code) => code.trim()).filter(Boolean)
}

export function LartasChecker() {
  const [value, setValue] = useState('')
  const [results, setResults] = useState<LartasResult[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const hsCodes = codesFrom(value)
    if (!hsCodes.length || hsCodes.length > LARTAS_MAX_CODES_PER_REQUEST) {
      setError('Masukkan 1 sampai 20 kode HS, dipisahkan dengan spasi, koma, atau baris baru.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await checkLartas(hsCodes)
      setResults(payload.results)
      setNotice(payload.notice)
    } catch (caught) {
      setResults([])
      setError(caught instanceof Error ? caught.message : 'Pemeriksaan LARTAS gagal.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="mx-auto max-w-5xl space-y-6"><section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6"><div className="flex gap-3"><ShieldCheck className="size-6 shrink-0 text-primary" /><div><h1 className="text-2xl font-bold">Cek tarif dan LARTAS</h1><p className="mt-1 text-sm text-muted-foreground">Periksa hingga 20 kode HS Indonesia 8 digit langsung ke INSW.</p></div></div><form onSubmit={submit} className="mt-5"><Textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={'Contoh:\n8471.30.90\n8517.13.00'} aria-label="Kode HS" className="min-h-28 bg-background" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Titik dan spasi diperbolehkan. Gunakan klasifikasi HS yang telah ditinjau.</p><Button type="submit" disabled={loading}><Search data-icon="inline-start" />{loading ? 'Memeriksa INSW…' : 'Periksa LARTAS'}</Button></div></form></section>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{notice}</p>}
    <section aria-live="polite" className="space-y-4">{results.map((result) => <LartasResultCard key={`${result.hsCode}-${result.lookupStatus}`} result={result} />)}</section>
  </div>
}
