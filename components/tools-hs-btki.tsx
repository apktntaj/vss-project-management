'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardCopy, Download, FileSearch, Loader2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/toast'
import { fetchHsTariffs, matchBtki, readInvoiceHsItems } from '@/lib/data-client'
import {
  BTKI_MATCH_MAX_ITEMS,
  formatBtkiCode,
  formatHsInvoice,
  hsPrefix,
  type BtkiCandidate,
  type BtkiMatch,
} from '@/lib/btki-match'
import type { InvoiceHsItem } from '@/lib/invoice-hs-items'
import { LARTAS_MAX_CODES_PER_REQUEST, type LartasResult } from '@/domain/lartas/types'

// HS BTKI: baca baris barang dari invoice, potong HS ke 6 digit (bagian yang seragam antarnegara),
// lalu sarankan pos BTKI 8 digit dari INSW yang uraiannya paling cocok. Saran selalu bisa diganti
// per baris — keputusan klasifikasi tetap di tangan PPJK.

const ACCEPT = '.pdf,.xls,.xlsx'

const CONFIDENCE_TONE: Record<BtkiMatch['confidence'], string> = {
  tinggi: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  sedang: 'bg-amber-50 text-amber-800 ring-amber-200',
  rendah: 'bg-rose-50 text-rose-700 ring-rose-200',
}
const CONFIDENCE_LABEL: Record<BtkiMatch['confidence'], string> = {
  tinggi: 'Yakin',
  sedang: 'Periksa',
  rendah: 'Lemah',
}
const METHOD_LABEL: Record<BtkiMatch['method'], string> = {
  tunggal: 'pos tunggal',
  ai: 'AI',
  kata: 'kecocokan kata',
  'tidak-ada': 'tanpa saran',
}

type TariffCell = LartasResult['tariffs'] | 'loading' | 'gagal'

function candidateLabel(candidate: BtkiCandidate): string {
  const uraian = candidate.uraianId || candidate.uraianEn
  return `${candidate.formatted} — ${uraian.length > 70 ? `${uraian.slice(0, 70)}…` : uraian}`
}

export function ToolsHsBtki() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [items, setItems] = useState<InvoiceHsItem[] | null>(null)
  const [source, setSource] = useState<'excel' | 'ai' | null>(null)
  const [matches, setMatches] = useState<Record<string, BtkiMatch>>({})
  const [groups, setGroups] = useState<Record<string, BtkiCandidate[]>>({})
  const [manual, setManual] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // Unggahan baru membatalkan hasil pencocokan berkas sebelumnya yang masih berjalan.
  const runId = useRef(0)

  const busy = reading || progress !== null
  const [tariffs, setTariffs] = useState<Record<string, TariffCell>>({})
  // Kode yang sudah diminta ke INSW; kegagalan dikeluarkan lagi agar dicoba ulang saat pilihan berubah.
  const requestedTariffs = useRef(new Set<string>())

  async function findBtki(rows: InvoiceHsItem[], run: number) {
    const withHs = rows.filter((row) => hsPrefix(row.hsCode).prefix !== null)
    if (withHs.length === 0) return
    setProgress({ done: 0, total: withHs.length })
    try {
      for (let start = 0; start < withHs.length; start += BTKI_MATCH_MAX_ITEMS) {
        const chunk = withHs.slice(start, start + BTKI_MATCH_MAX_ITEMS)
        const payload = await matchBtki(
          chunk.map((row) => ({ id: row.id, description: row.description, hsCode: row.hsCode })),
        )
        if (runId.current !== run) return
        setGroups((current) => ({ ...current, ...payload.groups }))
        setMatches((current) => ({
          ...current,
          ...Object.fromEntries(payload.matches.map((match) => [match.id, match])),
        }))
        if (payload.notice) setNotice(payload.notice)
        setProgress({ done: Math.min(start + chunk.length, withHs.length), total: withHs.length })
      }
      toast(`Pos BTKI dicarikan untuk ${withHs.length} baris.`, 'success')
    } catch (caught) {
      if (runId.current !== run) return
      const message = caught instanceof Error ? caught.message : 'Pencarian pos BTKI gagal.'
      setError(message)
      toast(message, 'error')
    } finally {
      if (runId.current === run) setProgress(null)
    }
  }

  async function readInvoice(file: File) {
    const run = (runId.current += 1)
    setReading(true)
    setError(null)
    setNotice(null)
    setItems(null)
    setMatches({})
    setGroups({})
    setManual({})
    setProgress(null)
    setFileName(file.name)
    let rows: InvoiceHsItem[] = []
    try {
      const payload = await readInvoiceHsItems(file)
      if (runId.current !== run) return
      rows = payload.items
      setItems(rows)
      setSource(payload.source)
      if (rows.length === 0) {
        setError('Tidak ada baris barang ber-HS code yang terbaca dari berkas ini.')
      }
    } catch (caught) {
      if (runId.current !== run) return
      const message = caught instanceof Error ? caught.message : 'Invoice tidak dapat dibaca.'
      setError(message)
      toast(message, 'error')
    } finally {
      if (runId.current === run) setReading(false)
    }
    if (runId.current === run && rows.length > 0) await findBtki(rows, run)
  }

  const rows = (items ?? []).map((item) => {
    const { prefix } = hsPrefix(item.hsCode)
    const match = matches[item.id] ?? null
    const candidates = match?.group ? (groups[match.group] ?? []) : []
    const chosen = manual[item.id] ?? match?.suggested ?? ''
    const candidate = candidates.find((entry) => entry.code === chosen) ?? null
    return { item, prefix, match, candidates, chosen, candidate, isManual: item.id in manual }
  })
  const matched = rows.filter((row) => row.match)
  const chosenKey = [...new Set(rows.map((row) => row.chosen).filter(Boolean))].sort().join(',')

  // Tarif BM/PPN/PPH diambil per pos 8 digit terpilih, setelah pencocokan selesai; mengganti pos
  // hanya mengambil kode yang belum pernah diminta.
  useEffect(() => {
    if (busy || !chosenKey) return
    const missing = chosenKey.split(',').filter((code) => !requestedTariffs.current.has(code))
    if (missing.length === 0) return
    for (const code of missing) requestedTariffs.current.add(code)
    setTariffs((current) => ({
      ...current,
      ...Object.fromEntries(missing.map((code) => [code, 'loading' as const])),
    }))
    void (async () => {
      for (let start = 0; start < missing.length; start += LARTAS_MAX_CODES_PER_REQUEST) {
        const chunk = missing.slice(start, start + LARTAS_MAX_CODES_PER_REQUEST)
        try {
          const { results } = await fetchHsTariffs(chunk)
          const byCode = new Map(results.map((result) => [result.hsCode, result]))
          setTariffs((current) => ({
            ...current,
            ...Object.fromEntries(
              chunk.map((code) => {
                const result = byCode.get(code)
                if (result?.lookupStatus === 'source-error') requestedTariffs.current.delete(code)
                return [
                  code,
                  !result || result.lookupStatus === 'source-error' ? 'gagal' : result.tariffs,
                ]
              }),
            ),
          }))
        } catch (caught) {
          for (const code of chunk) requestedTariffs.current.delete(code)
          setTariffs((current) => ({
            ...current,
            ...Object.fromEntries(chunk.map((code) => [code, 'gagal' as const])),
          }))
          toast(
            caught instanceof Error ? caught.message : 'Tarif tidak dapat diambil dari INSW.',
            'error',
          )
        }
      }
    })()
  }, [busy, chosenKey])
  const needsReview = matched.filter(
    (row) => !row.isManual && (row.match?.confidence !== 'tinggi' || !row.chosen),
  ).length

  function exportRows(): string[][] {
    return [
      [
        'No',
        'Uraian barang',
        'HS invoice',
        'International HS code',
        'Branch',
        'Pos BTKI',
        'Uraian BTKI',
        'BM',
        'PPN',
        'PPH',
        'Keyakinan',
        'Reasoning',
      ],
      ...rows.map((row, index) => {
        const rate = row.chosen ? tariffs[row.chosen] : undefined
        const rates = rate && typeof rate === 'object' ? rate : null
        return [
          String(index + 1),
          row.item.description,
          formatHsInvoice(row.item.hsCode),
          row.prefix ? formatBtkiCode(row.prefix) : '',
          row.match && row.candidates.length > 0 ? String(row.candidates.length) : '',
          row.chosen ? formatBtkiCode(row.chosen) : '',
          row.candidate ? row.candidate.pathId.join(' > ') : '',
          rates?.bm ?? '',
          rates?.ppn ?? '',
          rates?.pph ?? '',
          row.isManual ? 'Manual' : row.match ? CONFIDENCE_LABEL[row.match.confidence] : '',
          row.isManual ? '' : (row.match?.reason ?? ''),
        ]
      }),
    ]
  }

  async function copyTable() {
    try {
      await navigator.clipboard.writeText(
        exportRows()
          .map((line) => line.map((cell) => cell.replace(/[\t\n]+/g, ' ')).join('\t'))
          .join('\n'),
      )
      toast('Tabel disalin — tempel langsung ke Excel.', 'success')
    } catch {
      toast('Tabel tidak dapat disalin ke clipboard.', 'error')
    }
  }

  async function downloadExcel() {
    try {
      const XLSX = await import('xlsx')
      const sheet = XLSX.utils.aoa_to_sheet(exportRows())
      sheet['!cols'] = [
        { wch: 5 },
        { wch: 50 },
        { wch: 14 },
        { wch: 12 },
        { wch: 8 },
        { wch: 12 },
        { wch: 70 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 50 },
      ]
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'HS BTKI')
      const base = (fileName ?? 'invoice').replace(/\.[^.]+$/, '')
      XLSX.writeFile(book, `${base} - HS BTKI.xlsx`)
      toast('Excel hasil diunduh.', 'success')
    } catch {
      toast('Excel tidak dapat dibuat.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex gap-3">
          <FileSearch className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">HS invoice → pos BTKI 8 digit</h2>
            <p className="mt-1 text-xs text-slate-500">
              Menerima hs code dan mencarikan alternatif yang sesuai di Buku Tarif Kepabeanan
              Indonesia (BTKI).
            </p>
          </div>
        </div>

        <label
          className={`mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition ${
            busy
              ? 'border-slate-200 bg-slate-50 text-slate-400'
              : 'border-sky-300 bg-sky-50 text-sky-700 hover:border-sky-400 hover:bg-sky-100'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {busy ? (
              <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={18} className="shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">
              {reading
                ? `Membaca ${fileName ?? 'invoice'}…`
                : progress
                  ? `Mencari pos BTKI… ${progress.done}/${progress.total} baris`
                  : fileName
                    ? `Berkas: ${fileName} — unggah berkas lain untuk mengganti`
                    : 'Unggah invoice (.pdf, .xls, .xlsx)'}
            </span>
          </span>
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void readInvoice(file)
              event.target.value = ''
            }}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {notice}
          </p>
        )}
      </section>

      {rows.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Hasil pencocokan</h2>
              <p className="mt-1 text-sm text-slate-600">
                {rows.length} baris barang terbaca{source === 'ai' ? ' oleh AI' : ''}
                {matched.length > 0 && (
                  <>
                    {' · '}
                    {needsReview === 0
                      ? 'semua saran berkeyakinan tinggi'
                      : `${needsReview} baris perlu diperiksa`}
                  </>
                )}
                .
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={copyTable}>
                <ClipboardCopy data-icon="inline-start" />
                Salin
              </Button>
              <Button type="button" disabled={busy} onClick={downloadExcel}>
                <Download data-icon="inline-start" />
                Unduh Excel
              </Button>
            </div>
          </div>

          <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_theme(colors.slate.200)]">
                <tr>
                  <th className="w-8 px-2 py-2">No</th>
                  <th className="px-2 py-2">Uraian barang</th>
                  <th className="px-2 py-2">HS invoice</th>
                  <th className="whitespace-nowrap px-2 py-2">Int. HS code</th>
                  <th className="px-2 py-2 text-center">Branch</th>
                  <th className="min-w-56 px-2 py-2">Pos BTKI</th>
                  <th className="px-2 py-2">BM</th>
                  <th className="px-2 py-2">PPN</th>
                  <th className="px-2 py-2">PPH</th>
                  <th className="px-2 py-2">Keyakinan</th>
                  <th className="px-2 py-2">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-middle text-slate-700">
                {rows.map((row, index) => (
                  <tr key={row.item.id}>
                    <td className="px-2 py-2 tabular-nums text-slate-500">{index + 1}</td>
                    <td className="px-2 py-2">
                      <div className="w-36 truncate" title={row.item.description || undefined}>
                        {row.item.description || (
                          <span className="text-slate-400">(uraian kosong)</span>
                        )}
                      </div>
                      {row.item.sheet && (
                        <span className="mt-0.5 block whitespace-nowrap text-[11px] text-slate-400">
                          {row.item.sheet} · baris {row.item.row}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {row.item.hsCode ? (
                        formatHsInvoice(row.item.hsCode)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {row.prefix ? (
                        formatBtkiCode(row.prefix)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.match && row.candidates.length > 0 ? (
                        row.candidates.length
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {!row.match ? (
                        <span className="text-slate-400">
                          {!row.prefix ? 'HS tidak terbaca' : progress ? 'Mencari…' : '—'}
                        </span>
                      ) : row.candidates.length === 0 ? (
                        <span className="text-xs text-rose-700">{row.match.reason}</span>
                      ) : (
                        <select
                          aria-label={`Pos BTKI baris ${index + 1}`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none"
                          value={row.chosen}
                          onChange={(event) =>
                            setManual((current) => ({
                              ...current,
                              [row.item.id]: event.target.value,
                            }))
                          }
                        >
                          {!row.chosen && <option value="">Pilih pos…</option>}
                          {row.candidates.map((candidate) => (
                            <option key={candidate.code} value={candidate.code}>
                              {candidateLabel(candidate)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    {(['bm', 'ppn', 'pph'] as const).map((key) => {
                      const rate = row.chosen ? tariffs[row.chosen] : undefined
                      return (
                        <td key={key} className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {!row.chosen ? (
                            <span className="text-slate-400">—</span>
                          ) : rate === undefined || rate === 'loading' ? (
                            <span className="text-slate-300">…</span>
                          ) : rate === 'gagal' ? (
                            <span
                              className="text-rose-600"
                              title="Tarif tidak dapat diambil dari INSW"
                            >
                              !
                            </span>
                          ) : (
                            (rate[key] ?? <span className="text-slate-400">—</span>)
                          )}
                        </td>
                      )
                    })}
                    <td className="whitespace-nowrap px-2 py-2">
                      {row.isManual ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                          Manual
                        </span>
                      ) : row.match && row.candidates.length > 0 ? (
                        <>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CONFIDENCE_TONE[row.match.confidence]}`}
                          >
                            {CONFIDENCE_LABEL[row.match.confidence]}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400">
                            {METHOD_LABEL[row.match.method]}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-600">
                      {!row.isManual &&
                      row.match &&
                      row.candidates.length > 0 &&
                      row.match.reason ? (
                        row.match.reason
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Pos BTKI di sini adalah saran berdasarkan uraian di invoice, bukan penetapan
            klasifikasi. Periksa baris bertanda “Periksa” atau “Lemah” sebelum dipakai di PIB.
          </p>
        </section>
      )}
    </div>
  )
}
