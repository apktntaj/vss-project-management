'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowDown, ArrowUp, Combine, Download, FileUp, Loader2, Scissors, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/toast'
import { everyPage, parsePageRanges, splitFileName, type PageGroup } from '@/lib/pdf-pages'

// Tool PDF: potong (ambil halaman tertentu) dan gabung beberapa PDF. Semua proses di browser memakai
// pdf-lib; berkas tidak pernah dikirim ke server. pdf-lib dimuat dinamis agar tidak membebani tab lain.

const loadPdfLib = () => import('pdf-lib')

type LoadedPdf = { name: string; bytes: ArrayBuffer; pageCount: number }

async function readPdf(file: File): Promise<LoadedPdf> {
  const { PDFDocument } = await loadPdfLib()
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes)
  return { name: file.name, bytes, pageCount: doc.getPageCount() }
}

function loadErrorMessage(name: string, error: unknown): string {
  const text = error instanceof Error ? error.message : ''
  if (/encrypt/i.test(text)) return `${name} terkunci kata sandi; buka kuncinya dulu.`
  return `${name} tidak bisa dibaca sebagai PDF.`
}

function toBlobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
}

function download(url: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

function PickButton({
  label,
  multiple,
  disabled,
  onFiles,
}: {
  label: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <FileUp data-icon="inline-start" />
        {label}
      </Button>
    </>
  )
}

// ---------------------------------------------------------------- Potong

type SplitMode = 'single' | 'per-range' | 'every-page'

const splitModes: { value: SplitMode; label: string; hint: string }[] = [
  { value: 'single', label: 'Satu berkas', hint: 'Semua halaman terpilih digabung jadi satu PDF.' },
  { value: 'per-range', label: 'Berkas per rentang', hint: 'Setiap rentang (dipisah koma) jadi PDF sendiri.' },
  { value: 'every-page', label: 'Pisah tiap halaman', hint: 'Setiap halaman jadi PDF sendiri.' },
]

type SplitResult = { name: string; url: string; pages: number }

function PdfSplitter() {
  const [source, setSource] = useState<LoadedPdf | null>(null)
  const [ranges, setRanges] = useState('')
  const [mode, setMode] = useState<SplitMode>('single')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<SplitResult[]>([])

  const resultsRef = useRef(results)
  resultsRef.current = results
  useEffect(() => () => resultsRef.current.forEach((result) => URL.revokeObjectURL(result.url)), [])

  function clearResults() {
    results.forEach((result) => URL.revokeObjectURL(result.url))
    setResults([])
  }

  async function pick([file]: File[]) {
    if (!isPdf(file)) {
      toast(`${file.name} bukan berkas PDF.`, 'error')
      return
    }
    setBusy(true)
    try {
      const loaded = await readPdf(file)
      clearResults()
      setSource(loaded)
      setRanges('')
      toast(`${loaded.name} dimuat (${loaded.pageCount} halaman).`, 'success')
    } catch (error) {
      toast(loadErrorMessage(file.name, error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const parsed = source && mode !== 'every-page' && ranges.trim() ? parsePageRanges(ranges, source.pageCount) : null
  const rangeError = parsed && !parsed.ok ? parsed.error : null

  async function run() {
    if (!source) return
    let groups: PageGroup[]
    if (mode === 'every-page') {
      groups = everyPage(source.pageCount)
    } else {
      const result = parsePageRanges(ranges, source.pageCount)
      if (!result.ok) {
        toast(result.error, 'error')
        return
      }
      groups =
        mode === 'single'
          ? [{ label: result.groups.map((group) => group.label).join('_'), pages: result.groups.flatMap((g) => g.pages) }]
          : result.groups
    }

    setBusy(true)
    try {
      const { PDFDocument } = await loadPdfLib()
      const sourceDoc = await PDFDocument.load(source.bytes)
      const outputs: SplitResult[] = []
      for (const group of groups) {
        const out = await PDFDocument.create()
        const copied = await out.copyPages(
          sourceDoc,
          group.pages.map((page) => page - 1),
        )
        copied.forEach((page) => out.addPage(page))
        outputs.push({
          name: splitFileName(source.name, group.label),
          url: toBlobUrl(await out.save()),
          pages: group.pages.length,
        })
      }
      clearResults()
      setResults(outputs)
      if (outputs.length === 1) download(outputs[0].url, outputs[0].name)
      toast(
        outputs.length === 1 ? `${outputs[0].name} siap diunduh.` : `${outputs.length} berkas PDF siap diunduh.`,
        'success',
      )
    } catch (error) {
      toast(`Gagal memotong PDF: ${error instanceof Error ? error.message : 'kesalahan tak dikenal'}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const canRun = Boolean(source) && !busy && (mode === 'every-page' || (ranges.trim() !== '' && !rangeError))

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <Scissors className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Potong PDF</h2>
            <p className="mt-1 text-xs text-slate-500">Ambil halaman tertentu dari satu PDF.</p>
          </div>
        </div>
        <PickButton label={source ? 'Ganti PDF' : 'Pilih PDF'} disabled={busy} onFiles={pick} />
      </div>

      {source ? (
        <div className="mt-4 space-y-4">
          <p className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium">{source.name}</span>
            <span className="text-slate-500"> · {source.pageCount} halaman</span>
          </p>

          <fieldset>
            <legend className="text-xs font-medium text-slate-600">Hasil</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {splitModes.map((entry) => (
                <label
                  key={entry.value}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                    mode === entry.value
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="pdf-split-mode"
                    value={entry.value}
                    checked={mode === entry.value}
                    onChange={() => setMode(entry.value)}
                    className="sr-only"
                  />
                  {entry.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{splitModes.find((entry) => entry.value === mode)?.hint}</p>
          </fieldset>

          {mode !== 'every-page' && (
            <label className="label">
              Halaman
              <input
                type="text"
                autoComplete="off"
                placeholder={`mis. 1-3, 5, 8- (1–${source.pageCount})`}
                aria-invalid={rangeError ? true : undefined}
                value={ranges}
                onChange={(event) => setRanges(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canRun) void run()
                }}
                className={`input ${rangeError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
              />
              {rangeError ? (
                <span className="mt-1 block text-xs font-normal text-red-600">{rangeError}</span>
              ) : (
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Pisahkan dengan koma. &quot;8-&quot; berarti halaman 8 sampai akhir.
                </span>
              )}
            </label>
          )}

          <Button type="button" disabled={!canRun} onClick={() => void run()}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Scissors data-icon="inline-start" />}
            Potong
          </Button>

          {results.length > 1 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {results.map((result) => (
                <li key={result.url} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {result.name}
                    <span className="text-slate-500"> · {result.pages} hal.</span>
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => download(result.url, result.name)}>
                    <Download data-icon="inline-start" />
                    Unduh
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Belum ada PDF dipilih.
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Gabung

type MergeItem = LoadedPdf & { id: string }

function PdfMerger() {
  const [items, setItems] = useState<MergeItem[]>([])
  const [busy, setBusy] = useState(false)

  async function add(files: File[]) {
    setBusy(true)
    const loaded: MergeItem[] = []
    const failed: string[] = []
    for (const file of files) {
      if (!isPdf(file)) {
        failed.push(`${file.name} bukan berkas PDF.`)
        continue
      }
      try {
        loaded.push({ ...(await readPdf(file)), id: crypto.randomUUID() })
      } catch (error) {
        failed.push(loadErrorMessage(file.name, error))
      }
    }
    setItems((current) => [...current, ...loaded])
    setBusy(false)
    if (loaded.length) toast(`${loaded.length} PDF ditambahkan.`, 'success')
    failed.forEach((message) => toast(message, 'error'))
  }

  function move(index: number, delta: number) {
    setItems((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }

  async function merge() {
    setBusy(true)
    try {
      const { PDFDocument } = await loadPdfLib()
      const out = await PDFDocument.create()
      for (const item of items) {
        const doc = await PDFDocument.load(item.bytes)
        const copied = await out.copyPages(doc, doc.getPageIndices())
        copied.forEach((page) => out.addPage(page))
      }
      const name = `${items[0].name.replace(/\.pdf$/i, '')}_gabungan.pdf`
      const url = toBlobUrl(await out.save())
      download(url, name)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast(`${name} siap diunduh (${out.getPageCount()} halaman).`, 'success')
    } catch (error) {
      toast(`Gagal menggabung PDF: ${error instanceof Error ? error.message : 'kesalahan tak dikenal'}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = items.reduce((sum, item) => sum + item.pageCount, 0)

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <Combine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Gabung PDF</h2>
            <p className="mt-1 text-xs text-slate-500">Satukan beberapa PDF sesuai urutan di daftar.</p>
          </div>
        </div>
        <PickButton label="Tambah PDF" multiple disabled={busy} onFiles={(files) => void add(files)} />
      </div>

      {items.length ? (
        <div className="mt-4 space-y-4">
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate">
                  {item.name}
                  <span className="text-slate-500"> · {item.pageCount} hal.</span>
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Naikkan"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Turunkan"
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Hapus dari daftar"
                  disabled={busy}
                  onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy || items.length < 2} onClick={() => void merge()}>
              {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Combine data-icon="inline-start" />}
              Gabung
            </Button>
            <span className="text-xs text-slate-500">
              {items.length < 2 ? 'Tambahkan minimal dua PDF.' : `Total ${totalPages} halaman.`}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Belum ada PDF di daftar.
        </p>
      )}
    </section>
  )
}

export function ToolsPdf() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Semua proses berjalan di browser; berkas tidak diunggah ke server.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <PdfSplitter />
        <PdfMerger />
      </div>
    </div>
  )
}
