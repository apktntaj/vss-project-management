'use client'

import { useMemo, useState } from 'react'
import { Download, Info, Loader2, Plus } from 'lucide-react'

import { toast } from '@/components/toast'
import { AddEntryDialog } from '@/components/it-inventory/add-entry-dialog'
import { LedgerViews } from '@/components/it-inventory/ledger-views'
import { buildLedger } from '@/domain/it-inventory/ledger'
import type { JournalEntry } from '@/domain/it-inventory/types'

// Demo tampilan: IT Inventory sebagai PEMBUKUAN arus barang. Jurnal = daftar entry; entry
// ditambahkan manual atau massal (unggah BUP) lalu dibukukan di sesi ini — tidak ada
// penyimpanan (segar ulang mengosongkan buku).

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export default function ItInventoryPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const ledger = useMemo(() => buildLedger(entries), [entries])

  function addEntries(incoming: JournalEntry[]) {
    setEntries((current) => {
      const seen = new Set(current.map((entry) => entry.id))
      return [...current, ...incoming.filter((entry) => !seen.has(entry.id))]
    })
  }

  async function downloadReport() {
    setExporting(true)
    try {
      const response = await fetch('/api/it-inventory/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
        cache: 'no-store',
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        toast(body?.error ?? 'Laporan gagal dibuat.', 'error')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `it-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Laporan gagal dibuat.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const { summary } = ledger

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IT Inventory</h1>
          <p className="mt-2 text-sm text-slate-500">
            Jurnal arus barang — setiap entry adalah satu perpindahan; saldo selalu dihitung dari
            jurnal, tidak ada stok yang diedit langsung.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={16} />
            Tambah Entry
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => void downloadReport()}
            disabled={!entries.length || exporting}
          >
            {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            Unduh laporan (Excel)
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <section className="card p-12 text-center">
          <Info className="mx-auto text-slate-400" size={28} aria-hidden="true" />
          <p className="mt-3 font-semibold text-slate-800">Jurnal masih kosong.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Entry dokumen pabean hanya dibuat dengan mengunggah export BUP — BC 2.3 tercatat
            sebagai arus masuk, BC 2.5 dan BC 3.0 sebagai arus keluar. Penyesuaian di luar
            dokumen (stock opname, rusak, hilang, koreksi) dicatat manual sebagai entry
            penyesuaian. Setiap barang menjadi satu akun dengan kartu stok dan saldo berjalan —
            meniru pembukuan kas, bukan tabel stok gudang.
          </p>
          <button
            type="button"
            className="btn-primary mt-6 inline-flex items-center gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={16} />
            Tambah Entry pertama
          </button>
          <p className="mt-4 text-xs text-slate-400">
            Demo tampilan: data hidup di sesi ini saja dan tidak disimpan.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan buku">
            <article className="card p-5">
              <p className="text-sm text-slate-500">Entry</p>
              <p className="mt-2 text-3xl font-bold text-slate-700">{summary.totalEntries}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Jenis barang</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">{summary.itemTypes}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Arus masuk</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">
                {numberFormat.format(summary.totalQtyIn)}
              </p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Arus keluar</p>
              <p className="mt-2 text-3xl font-bold text-rose-700">
                {numberFormat.format(summary.totalQtyOut)}
              </p>
            </article>
          </div>

          <LedgerViews ledger={ledger} />

          <p className="text-xs text-slate-400">
            Demo tampilan — data hidup di sesi ini saja. Kolom laporan mengikuti elemen data
            Lampiran R PER-6/BC/2023.
          </p>
        </>
      )}

      <AddEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entries={entries}
        onAdd={addEntries}
      />
    </div>
  )
}
