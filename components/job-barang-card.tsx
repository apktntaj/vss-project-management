'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PackageSearch,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { LartasResultCard } from '@/components/lartas-result-card'
import { numberID } from '@/components/job-exhibitor-summary'
import { buildManifestView, type ManifestPeserta } from '@/lib/manifest-view'
import { checkLartas, getOperationalDetails, type Job } from '@/lib/data-client'
import { chunkHsCodes, collectJobHsCodes, formatHsCode, normalizeHsCode } from '@/lib/job-lartas'
import type { BarisBarang } from '@/domain/exhibition/cipl-document'
import type { KoliDimension } from '@/domain/job/manifest'
import type { LartasResult } from '@/domain/lartas/types'

// Detail barang job dikelompokkan per case (bukan per exhibitor seperti kartu manifest) supaya
// kedalaman tabel tetap satu tingkat. Cek LARTAS/tarif INSW menempel di kartu ini dan hasilnya
// tidak disimpan: dicek manual lewat tombol dan hilang saat halaman ditutup.

/** Satu case (atau kumpulan barang yang belum tertaut ke case) beserta barang di dalamnya. */
type CaseGroup = {
  key: string
  caseLabel: string | null
  pesertaName: string
  dimension: KoliDimension | null
  volumeCbm: number | null
  weightKg: number | null
  items: BarisBarang[]
}

const optionalNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : numberID(value)

function dimensionLabel(dimension: KoliDimension | null): string {
  if (!dimension) return '—'
  return [dimension.lengthCm, dimension.widthCm, dimension.heightCm].map(optionalNumber).join(' × ')
}

/**
 * Ratakan baris CIPL menjadi daftar case. Case tanpa id (data lama) tetap tampil, barang yang tidak
 * menunjuk case mana pun di baris itu dikumpulkan pada satu grup "tanpa case" agar tidak hilang.
 */
function groupByCase(pesertaList: ReadonlyArray<ManifestPeserta>): CaseGroup[] {
  return pesertaList.flatMap((peserta) => {
    const items = peserta.line.items
    const knownKoliIds = new Set(
      peserta.logistics.koli.details.flatMap((koli) => (koli.id ? [koli.id] : [])),
    )

    const groups: CaseGroup[] = peserta.logistics.koli.details.map((koli, index) => {
      const koliId = koli.id
      return {
        key: `${peserta.key}-${koliId ?? index}`,
        caseLabel: koli.label,
        pesertaName: peserta.name,
        dimension: koli.dimension,
        volumeCbm: koli.volumeCbm,
        weightKg: koli.weightKg,
        items: koliId ? items.filter((item) => item.refKoliIds.includes(koliId)) : [],
      }
    })

    const loose = items.filter(
      (item) => !item.refKoliIds.some((koliId) => knownKoliIds.has(koliId)),
    )
    if (loose.length > 0) {
      groups.push({
        key: `${peserta.key}-tanpa-case`,
        caseLabel: null,
        pesertaName: peserta.name,
        dimension: null,
        volumeCbm: null,
        weightKg: null,
        items: loose,
      })
    }
    return groups
  })
}

function hsDigits(value: string | null | undefined): string | null {
  return normalizeHsCode(value)?.digits ?? null
}

function lookupChip(result: LartasResult): { text: string; tone: string } {
  if (result.lookupStatus !== 'found') {
    return { text: 'Tidak ditemukan', tone: 'bg-rose-50 text-rose-700 ring-rose-200' }
  }
  return result.lartas.verification === 'verified'
    ? { text: 'Terverifikasi', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    : { text: 'Data publik', tone: 'bg-amber-50 text-amber-800 ring-amber-200' }
}

export function JobBarangCard({
  job,
  onToast,
}: {
  job: Job
  onToast: (message: string, tone?: 'info' | 'error') => void
}) {
  const view = useMemo(() => buildManifestView(job), [job])
  const groups = useMemo(() => groupByCase(view.peserta), [view.peserta])
  const invoiceItems = getOperationalDetails(job).invoiceItems
  const collection = useMemo(
    () => collectJobHsCodes(job.ciplLines, invoiceItems ?? []),
    [job.ciplLines, invoiceItems],
  )

  // Detail langsung terbaca (card ini memang rincian barang); tiap case bisa dilipat manual.
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(new Set())
  const [results, setResults] = useState<LartasResult[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const usagesByCode = useMemo(
    () => new Map(collection.valid.map((code) => [code.hsCode, code.usages])),
    [collection.valid],
  )
  const resultByCode = useMemo(
    () => new Map((results ?? []).map((result) => [result.hsCode, result])),
    [results],
  )

  const toggle = (key: string) =>
    setCollapsedKeys((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

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

  const { valid, invalid, truncated, missingCount } = collection
  const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <PackageSearch className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Detail Barang</h2>
            <p className="mt-1 text-xs text-slate-500">
              Barang dikelompokkan per case dari CIPL. Tarif dan ketentuan LARTAS tiap HS code bisa
              diperiksa langsung ke INSW.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={loading || valid.length === 0}
          onClick={run}
        >
          <Search data-icon="inline-start" />
          {loading ? 'Memeriksa INSW…' : 'Periksa LARTAS'}
        </Button>
      </div>

      <p className="mt-3 text-sm text-slate-700">
        {groups.length} case · {itemCount} barang · {valid.length} HS code unik siap dicek
        {invalid.length > 0 && <span>, {invalid.length} tidak valid</span>}
        {missingCount > 0 && <span>, {missingCount} baris barang tanpa HS</span>}.
      </p>

      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Belum ada rincian barang pada CIPL job ini.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Case</th>
                <th className="px-3 py-2">Barang</th>
                <th className="px-3 py-2">HS</th>
                <th className="px-3 py-2 text-right">Jumlah</th>
                <th className="px-3 py-2 text-right">Harga</th>
                <th className="px-3 py-2 text-right">Nilai</th>
              </tr>
            </thead>
            {groups.map((group) => {
              const isOpen = !collapsedKeys.has(group.key)
              return (
                <tbody key={group.key} className="divide-y divide-slate-100 border-t border-slate-200">
                  <tr className={isOpen ? 'font-medium text-slate-800' : 'text-slate-600'}>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      {group.items.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggle(group.key)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Tutup' : 'Buka'} barang ${group.caseLabel ?? 'tanpa case'}`}
                          className="inline-flex items-center gap-1.5 rounded p-0.5 hover:bg-slate-100 hover:text-slate-800"
                        >
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {group.caseLabel ? `Case ${group.caseLabel}` : 'Tanpa case'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 pl-1 text-slate-500">
                          {group.caseLabel ? `Case ${group.caseLabel}` : 'Tanpa case'}
                        </span>
                      )}
                    </td>
                    <td colSpan={5} className="px-3 py-2 align-top text-slate-500">
                      <span className="text-slate-700">{group.pesertaName}</span>
                      <span className="ml-2 text-slate-400">
                        {group.caseLabel
                          ? `${dimensionLabel(group.dimension)} cm · ${optionalNumber(group.volumeCbm)} CBM · ${optionalNumber(group.weightKg)} kg · `
                          : ''}
                        {group.items.length} barang
                      </span>
                    </td>
                  </tr>
                  {isOpen &&
                    group.items.map((item, index) => {
                      const digits = hsDigits(item.kodeHs)
                      const result = digits ? resultByCode.get(digits) : undefined
                      const chip = result ? lookupChip(result) : null
                      return (
                        <tr key={`${group.key}-${index}`} className="text-slate-600">
                          <td />
                          <td className="px-3 py-1.5 pl-6 align-top">
                            {item.uraian}
                            {item.merekModel && (
                              <span className="text-slate-400"> · {item.merekModel}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 align-top">
                            {item.kodeHs ? (
                              <span className="tabular-nums">
                                {digits ? formatHsCode(digits) : item.kodeHs}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            {chip && (
                              <span
                                className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${chip.tone}`}
                              >
                                {chip.text}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums">
                            {numberID(item.jumlah)} {item.satuan}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums">
                            {optionalNumber(item.nilaiSatuan)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums">
                            {optionalNumber(item.nilaiTotal)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              )
            })}
          </table>
        </div>
      )}

      {valid.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">
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
            Barang tanpa HS atau dengan HS bukan 8/10 digit
            {invalid.length > 0 && <> ({invalid.join(', ')})</>} tidak ikut diperiksa, sehingga
            LARTAS-nya belum diketahui.
          </p>
        </div>
      )}
      {truncated.length > 0 && (
        <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          {truncated.length} pos tarif 10 digit diperiksa memakai 8 digit pertamanya (
          {truncated.join(', ')}).
        </p>
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
