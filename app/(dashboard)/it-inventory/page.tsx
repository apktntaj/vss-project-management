'use client'

import { useMemo, useState } from 'react'
import { Download, Info, Loader2 } from 'lucide-react'

import { toast } from '@/components/toast'
import { BupUpload } from '@/components/it-inventory/bup-upload'
import { LedgerViews } from '@/components/it-inventory/ledger-views'
import { buildLedger } from '@/domain/it-inventory/ledger'
import type { BupDocument } from '@/domain/it-inventory/types'

// Demo tampilan: IT Inventory sebagai PEMBUKUAN arus barang. Dokumen BUP diunggah, diparse di
// server, lalu dibukukan di sesi ini — tidak ada penyimpanan (segar ulang mengosongkan buku).

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })

export default function ItInventoryPage() {
  const [documents, setDocuments] = useState<BupDocument[]>([])
  const [exporting, setExporting] = useState(false)
  const ledger = useMemo(() => buildLedger(documents), [documents])

  function addDocument(document: BupDocument) {
    setDocuments((current) =>
      current.some((doc) => doc.fileName === document.fileName) ? current : [...current, document],
    )
  }

  function removeDocument(fileName: string) {
    setDocuments((current) => current.filter((doc) => doc.fileName !== fileName))
  }

  async function downloadReport() {
    setExporting(true)
    try {
      const response = await fetch('/api/it-inventory/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
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
            Buku arus barang — setiap perpindahan dicatat sebagai transaksi, dan saldo selalu
            dihitung dari jurnal; tidak ada stok yang diedit langsung.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          onClick={() => void downloadReport()}
          disabled={!documents.length || exporting}
        >
          {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Unduh laporan (Excel)
        </button>
      </header>

      <BupUpload documents={documents} onAdd={addDocument} onRemove={removeDocument} />

      {documents.length === 0 ? (
        <section className="card p-12 text-center">
          <Info className="mx-auto text-slate-400" size={28} aria-hidden="true" />
          <p className="mt-3 font-semibold text-slate-800">Buku masih kosong.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Unggah export BUP dokumen pabean untuk mulai membukukan arus barang. BC 2.3 tercatat
            sebagai pemasukan; BC 2.5 dan BC 3.0 sebagai pengeluaran. Setiap jenis barang menjadi
            satu akun dengan kartu stok dan saldo berjalan — meniru pembukuan kas, bukan tabel
            stok gudang.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Demo tampilan: data hidup di sesi ini saja dan tidak disimpan.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan buku">
            <article className="card p-5">
              <p className="text-sm text-slate-500">Dokumen pabean</p>
              <p className="mt-2 text-3xl font-bold text-slate-700">{summary.totalDocuments}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Jenis barang</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">{summary.itemTypes}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Baris mutasi</p>
              <p className="mt-2 text-3xl font-bold text-orange-700">{summary.movementLines}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Arus kuantitas</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">
                {numberFormat.format(summary.totalQtyIn)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                masuk · {numberFormat.format(summary.totalQtyOut)} keluar
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
    </div>
  )
}
