'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Search, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { LartasResultCard } from '@/components/lartas-result-card'
import type { Job } from '@/lib/data-client'
import { checkLartas, getOperationalDetails } from '@/lib/data-client'
import type { LartasResult } from '@/domain/lartas/types'
import { chunkHsCodes, collectJobHsCodes } from '@/lib/job-lartas'

// Cek LARTAS/tarif INSW untuk HS code barang job. Hasil tidak disimpan: dicek manual lewat tombol
// dan hilang saat halaman ditutup. "Tidak ada LARTAS" hanya boleh disimpulkan dari hasil `verified`.

export function JobLartasCard({
  job,
  onToast,
}: {
  job: Job
  onToast: (message: string, tone?: 'info' | 'error') => void
}) {
  const invoiceItems = getOperationalDetails(job).invoiceItems
  const collection = useMemo(
    () => collectJobHsCodes(job.ciplLines, invoiceItems ?? []),
    [job.ciplLines, invoiceItems],
  )
  const [results, setResults] = useState<LartasResult[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const usagesByCode = useMemo(
    () => new Map(collection.valid.map((code) => [code.hsCode, code.usages])),
    [collection.valid],
  )

  async function run() {
    setLoading(true)
    try {
      const merged: LartasResult[] = []
      let responseNotice: string | null = null
      for (const chunk of chunkHsCodes(collection.valid.map((code) => code.hsCode))) {
        const response = await checkLartas(chunk)
        merged.push(...response.results)
        responseNotice ??= response.notice
      }
      setResults(merged)
      setNotice(responseNotice)
      const unverified = merged.filter((result) => result.lartas.verification !== 'verified').length
      onToast(
        unverified
          ? `Cek LARTAS selesai; ${unverified} HS code belum terverifikasi.`
          : 'Cek LARTAS selesai.',
      )
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Pemeriksaan LARTAS gagal.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const { valid, invalid, missingCount } = collection
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Cek LARTAS</h2>
            <p className="mt-1 text-xs text-slate-500">
              Periksa tarif dan ketentuan LARTAS dari HS code barang di job ini langsung ke INSW.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" disabled={loading || valid.length === 0} onClick={run}>
          <Search data-icon="inline-start" />
          {loading ? 'Memeriksa INSW…' : 'Periksa LARTAS'}
        </Button>
      </div>

      <p className="mt-3 text-sm text-slate-700">
        {valid.length} HS code unik siap dicek
        {invalid.length > 0 && <span>, {invalid.length} tidak valid</span>}
        {missingCount > 0 && <span>, {missingCount} baris barang tanpa HS</span>}.
      </p>
      {valid.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">
          Belum ada HS code 8 digit pada barang job ini. Lengkapi CIPL atau cek manual di{' '}
          <Link href="/tools?tab=lartas" className="font-medium text-primary hover:underline">
            halaman Cek LARTAS
          </Link>
          .
        </p>
      )}
      {(invalid.length > 0 || missingCount > 0) && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Barang tanpa HS atau dengan HS bukan 8 digit
            {invalid.length > 0 && <> ({invalid.join(', ')})</>} tidak ikut diperiksa, sehingga LARTAS-nya
            belum diketahui.
          </p>
        </div>
      )}

      {notice && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {notice}
        </p>
      )}
      {results && (
        <div aria-live="polite" className="mt-4 space-y-4">
          {results.map((result) => {
            const usages = usagesByCode.get(result.hsCode) ?? []
            return (
              <LartasResultCard key={result.hsCode} result={result}>
                {usages.length > 0 && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Dipakai oleh: {usages.map((usage) => usage.description).join('; ')}
                  </p>
                )}
              </LartasResultCard>
            )
          })}
        </div>
      )}
    </section>
  )
}
