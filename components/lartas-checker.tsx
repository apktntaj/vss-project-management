'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, ExternalLink, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type LartasDetail = {
  idDokumen: string | null
  kodeIzin: string | null
  namaIzin: string | null
  komoditi: string | null
  noSkep: string | null
  uraianBarangSkep: string | null
  tanggalMulai: string | null
  tanggalAkhir: string | null
  link: string | null
}

type Result = {
  hsCode: string
  formattedHsCode: string
  lookupStatus: 'found' | 'not-found' | 'invalid' | 'source-error'
  dataSource: 'insw-cms' | 'insw-public-list' | null
  tariffs: { bm: string | null; ppn: string | null; pph: string | null; pphNonApi: string | null }
  lartas: {
    verification: 'verified' | 'unverified'
    import: boolean
    border: boolean
    postBorder: boolean
    export: boolean
    importDetails: LartasDetail[]
    borderDetails: LartasDetail[]
    postBorderDetails: LartasDetail[]
    exportDetails: LartasDetail[]
  }
  error: string | null
}

type ApiResponse = { notice: string; results: Result[] } | { error: string }

function codesFrom(value: string) {
  return value.split(/[\s,;]+/).map((code) => code.trim()).filter(Boolean)
}

function statusLabel(status: Result['lookupStatus']) {
  return {
    found: 'Ditemukan',
    'not-found': 'Tidak ditemukan',
    invalid: 'Kode tidak valid',
    'source-error': 'Sumber gagal',
  }[status]
}

function yesNo(value: boolean) {
  return value ? 'Ada' : 'Tidak ada'
}

function Details({ title, details }: { title: string; details: LartasDetail[] }) {
  if (!details.length) return null
  return <details className="rounded-lg border bg-background p-3"><summary className="cursor-pointer text-sm font-medium">{title} ({details.length})</summary><div className="mt-3 space-y-3">{details.map((detail, index) => <div key={`${detail.idDokumen}-${detail.kodeIzin}-${index}`} className="border-t pt-3 first:border-t-0 first:pt-0"><p className="font-medium">{detail.namaIzin ?? 'Dokumen/izin LARTAS'}</p>{detail.kodeIzin && <p className="mt-1 text-xs text-muted-foreground">Kode izin: {detail.kodeIzin}</p>}{detail.noSkep && <p className="mt-1 text-xs text-muted-foreground">{detail.noSkep}</p>}{detail.uraianBarangSkep && <p className="mt-2 text-sm text-muted-foreground">{detail.uraianBarangSkep}</p>}{detail.link && <a href={detail.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Dokumen regulasi <ExternalLink className="size-3.5" /></a>}</div>)}</div></details>
}

function ResultCard({ result }: { result: Result }) {
  if (result.lookupStatus !== 'found') {
    return <article className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{result.formattedHsCode}</h2><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">{statusLabel(result.lookupStatus)}</span></div><p className="mt-2 text-sm text-amber-900">{result.error ?? 'Kode HS tidak tersedia pada sumber INSW yang diperiksa.'}</p></article>
  }

  const verified = result.lartas.verification === 'verified'
  return <article className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{result.formattedHsCode}</h2><p className="mt-1 text-xs text-muted-foreground">Sumber: {result.dataSource === 'insw-cms' ? 'INSW CMS' : 'INSW daftar publik'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{verified ? 'LARTAS terverifikasi' : 'LARTAS belum terverifikasi'}</span></div>
    {!verified && <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>Data publik hanya memverifikasi tarif. Status ini bukan berarti LARTAS tidak ada.</p></div>}
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div className="rounded-lg bg-muted p-3"><dt className="text-muted-foreground">BM</dt><dd className="mt-1 font-semibold">{result.tariffs.bm ?? '—'}</dd></div><div className="rounded-lg bg-muted p-3"><dt className="text-muted-foreground">PPN</dt><dd className="mt-1 font-semibold">{result.tariffs.ppn ?? '—'}</dd></div><div className="rounded-lg bg-muted p-3"><dt className="text-muted-foreground">PPh API</dt><dd className="mt-1 font-semibold">{result.tariffs.pph ?? '—'}</dd></div><div className="rounded-lg bg-muted p-3"><dt className="text-muted-foreground">PPh non-API</dt><dd className="mt-1 font-semibold">{result.tariffs.pphNonApi ?? '—'}</dd></div></dl>
    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><dt className="text-muted-foreground">Impor</dt><dd className="font-medium">{yesNo(result.lartas.import)}</dd></div><div><dt className="text-muted-foreground">Border</dt><dd className="font-medium">{yesNo(result.lartas.border)}</dd></div><div><dt className="text-muted-foreground">Post-border</dt><dd className="font-medium">{yesNo(result.lartas.postBorder)}</dd></div><div><dt className="text-muted-foreground">Ekspor</dt><dd className="font-medium">{yesNo(result.lartas.export)}</dd></div></dl>
    <div className="mt-4 grid gap-2"><Details title="Ketentuan impor" details={result.lartas.importDetails} /><Details title="Ketentuan border" details={result.lartas.borderDetails} /><Details title="Ketentuan post-border" details={result.lartas.postBorderDetails} /><Details title="Ketentuan ekspor" details={result.lartas.exportDetails} /></div>
  </article>
}

export function LartasChecker() {
  const [value, setValue] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const hsCodes = codesFrom(value)
    if (!hsCodes.length || hsCodes.length > 20) {
      setError('Masukkan 1 sampai 20 kode HS, dipisahkan dengan spasi, koma, atau baris baru.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/lartas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hsCodes }) })
      const payload = await response.json() as ApiResponse
      if (!response.ok || 'error' in payload) throw new Error('error' in payload ? payload.error : 'Pemeriksaan LARTAS gagal.')
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
    <section aria-live="polite" className="space-y-4">{results.map((result) => <ResultCard key={`${result.hsCode}-${result.lookupStatus}`} result={result} />)}</section>
  </div>
}
