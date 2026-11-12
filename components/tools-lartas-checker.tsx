'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2, Search, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { checkLartas } from '@/lib/data-client'
import { chunkHsCodes } from '@/lib/job-lartas'
import { lartasDocuments, lartasStatus } from '@/lib/lartas-status'
import type { HsScan } from '@/lib/lartas-sheet'
import type { LartasResult } from '@/domain/lartas/types'

// Cek LARTAS dari invoice Excel: berkas dipindai server untuk menemukan kolom HS, lalu hanya HS
// yang dikirim ke INSW. Tampilan sengaja hanya memuat status dan dokumen — tanpa tarif/pajak.

type ScanResponse = HsScan & { codes: string[] }
type Filter = 'lartas' | 'all'

const PREVIEW_ROWS = 12
const ACCEPT = '.xls,.xlsx'

function statusSummary(results: LartasResult[]) {
  const hit = results.filter((result) => lartasStatus(result).key === 'ada').length
  const pending = results.filter(
    (result) => lartasStatus(result).key === 'belum-terverifikasi',
  ).length
  return { hit, pending }
}

export function ToolsLartasChecker() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [scan, setScan] = useState<ScanResponse | null>(null)
  const [results, setResults] = useState<LartasResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [filter, setFilter] = useState<Filter>('lartas')

  async function readExcel(file: File) {
    setReading(true)
    setError(null)
    setScan(null)
    setResults(null)
    setFileName(file.name)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/tools/lartas-columns', { method: 'POST', body })
      const data = (await response.json().catch(() => null)) as
        (ScanResponse & { error?: never }) | { error?: string } | null
      if (!response.ok || !data || !('codes' in data) || !Array.isArray(data.codes)) {
        throw new Error(
          data && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Berkas tidak dapat dibaca.',
        )
      }
      setScan(data)
      if (data.codes.length === 0) {
        setError(
          'Tidak ada kolom berisi HS 8 digit pada berkas ini. Pastikan invoice memuat kolom HS code atau pos tarif.',
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Berkas tidak dapat dibaca.')
    } finally {
      setReading(false)
    }
  }

  async function run() {
    if (!scan?.codes.length) return
    setChecking(true)
    setError(null)
    try {
      const merged: LartasResult[] = []
      for (const chunk of chunkHsCodes(scan.codes)) {
        const payload = await checkLartas(chunk)
        merged.push(...payload.results)
      }
      setResults(merged)
    } catch (caught) {
      setResults([])
      setError(caught instanceof Error ? caught.message : 'Pemeriksaan LARTAS gagal.')
    } finally {
      setChecking(false)
    }
  }

  const codes = scan?.codes ?? []
  const uniqueRows = (() => {
    const seen = new Set<string>()
    return (scan?.rows ?? []).filter((row) => {
      if (seen.has(row.hsCode)) return false
      seen.add(row.hsCode)
      return true
    })
  })()
  const summary = results ? statusSummary(results) : null
  const shown = results
    ? filter === 'lartas'
      ? results.filter((result) => lartasStatus(result).flagged)
      : results
    : []

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Cek LARTAS dari invoice Excel</h2>
              <p className="mt-1 text-xs text-slate-500">
                Unggah invoice yang berisi hs code valid. Sistem akan mencarikan data lartas dari
                INSW.
              </p>
            </div>
          </div>
          <Button type="button" disabled={checking || reading || codes.length === 0} onClick={run}>
            {checking ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Search data-icon="inline-start" />
            )}
            {checking ? 'Memeriksa INSW…' : 'Periksa LARTAS'}
          </Button>
        </div>

        <label
          className={`mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition ${
            reading
              ? 'border-slate-200 bg-slate-50 text-slate-400'
              : 'border-sky-300 bg-sky-50 text-sky-700 hover:border-sky-400 hover:bg-sky-100'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {reading ? (
              <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={18} className="shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">
              {reading
                ? 'Membaca berkas…'
                : fileName
                  ? `Berkas: ${fileName}`
                  : 'Unggah invoice Excel (.xls, .xlsx)'}
            </span>
          </span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={reading || checking}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void readExcel(file)
              event.target.value = ''
            }}
          />
        </label>

        {scan && scan.columns.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-700">
              {scan.columns.length} sheet dipindai · {scan.rows.length} baris berisi HS ·{' '}
              {codes.length} HS unik
              {scan.skipped > 0 && (
                <span className="text-slate-500">, {scan.skipped} sel mirip kode dilewati</span>
              )}
              .
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Sheet</th>
                    <th className="px-3 py-2">Kolom</th>
                    <th className="px-3 py-2">Header</th>
                    <th className="px-3 py-2 text-right">HS ditemukan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {scan.columns.map((column) => (
                    <tr key={`${column.sheet}-${column.column}`}>
                      <td className="px-3 py-1.5">{column.sheet}</td>
                      <td className="px-3 py-1.5 tabular-nums">{column.column}</td>
                      <td className="px-3 py-1.5 text-slate-500">{column.header ?? '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{column.found}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {uniqueRows && uniqueRows.length > 0 && (
              <p className="text-xs text-slate-500">
                Contoh terbaca:{' '}
                {uniqueRows
                  .slice(0, PREVIEW_ROWS)
                  .map((row) => row.hsCode)
                  .join(', ')}
                {uniqueRows.length > PREVIEW_ROWS
                  ? `, dan ${uniqueRows.length - PREVIEW_ROWS} lainnya`
                  : ''}
              </p>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            {error}
          </p>
        )}
      </section>

      {results && summary && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Hasil cek LARTAS</h2>
              <p className="mt-1 text-sm text-slate-600">
                {summary.hit} dari {results.length} HS code terkena LARTAS
                {summary.pending > 0 && (
                  <span className="text-slate-500"> · {summary.pending} belum terverifikasi</span>
                )}
                .
              </p>
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-sm">
              {(
                [
                  ['lartas', 'Hanya yang LARTAS'],
                  ['all', 'Semua HS code'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 font-medium transition ${
                    filter === value
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-3 py-2">No</th>
                  <th className="px-3 py-2">HS code</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Dokumen / izin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                      {filter === 'lartas'
                        ? 'Tidak ada HS code yang terkena LARTAS pada pemeriksaan ini.'
                        : 'Belum ada hasil.'}
                    </td>
                  </tr>
                ) : (
                  shown.map((result, index) => {
                    const status = lartasStatus(result)
                    const documents = lartasDocuments(result)
                    return (
                      <tr key={result.hsCode}>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{index + 1}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                          {result.formattedHsCode}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.tone}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {documents.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <details>
                              <summary className="cursor-pointer text-sm text-primary">
                                {documents.length} dokumen / izin
                              </summary>
                              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {documents.map((document, documentIndex) => (
                                  <li key={`${result.hsCode}-${documentIndex}`}>
                                    <span className="font-medium text-slate-800">
                                      {document.namaIzin ?? document.kodeIzin ?? 'Dokumen LARTAS'}
                                    </span>
                                    {document.kodeIzin && <> · kode {document.kodeIzin}</>}
                                    {document.noSkep && <> · {document.noSkep}</>}
                                    {document.link && (
                                      <>
                                        {' · '}
                                        <a
                                          href={document.link}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          detail
                                        </a>
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Status “Belum terverifikasi” berarti sumber publik INSW hanya memverifikasi tarif —
            jangan simpulkan LARTAS tidak ada.
          </p>
        </section>
      )}
    </div>
  )
}
