'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

import {
  adjustmentReasonLabels,
  bupDocumentLabels,
  type BupDocumentCode,
  type JournalEntry,
  type Ledger,
  type LedgerItem,
} from '@/domain/it-inventory/types'

// Kartu stok dalam bentuk modal, dibuka dari baris Mutasi Barang. Layout mengikuti struktur
// laporan PER-24/BC/2023: header identitas barang, lalu dua kolom terpisah — Pemasukan dan
// Pengeluaran — masing-masing daftar entry dengan informasi dokumennya.

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })

const fmtJumlah = (quantity: number, unit: string | null) =>
  `${numberFormat.format(quantity)}${unit ? ` ${unit}` : ''}`
const fmtDate = (value: string | null) => (value ? dateFormat.format(new Date(value)) : '—')
const fmtValue = (value: number | null, currency: string | null) =>
  value == null ? '—' : `${currency ? `${currency} ` : ''}${numberFormat.format(value)}`

const badgeStyles: Record<BupDocumentCode, string> = {
  '23': 'bg-blue-100 text-blue-800',
  '25': 'bg-amber-100 text-amber-900',
  '30': 'bg-violet-100 text-violet-800',
}

type KartuStokModalProps = {
  item: LedgerItem
  ledger: Ledger
  onClose: () => void
}

/** Satu baris mutasi di kolom Pemasukan/Pengeluaran: dokumen + tanggal + jumlah. */
function MutasiRow({ entry, currency }: { entry: JournalEntry; currency: string | null }) {
  const isDocument = entry.source === 'DOCUMENT' && entry.documentCode != null
  return (
    <li className="flex items-start justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isDocument && entry.documentCode ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyles[entry.documentCode]}`}>
              {bupDocumentLabels[entry.documentCode]}
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
              Penyesuaian
            </span>
          )}
          <span className="text-sm font-medium text-slate-800">
            {isDocument ? (entry.nomorDaftar ?? '—') : (entry.adjustmentReason ? adjustmentReasonLabels[entry.adjustmentReason] : 'Tanpa alasan')}
          </span>
        </div>
        <span className="mt-0.5 block text-xs text-slate-400">
          {fmtDate(entry.entryDate)}
          {isDocument && entry.invoiceNumber ? ` · ${entry.invoiceNumber}` : ''}
          {!isDocument && entry.beritaAcaraNumber ? ` · ${entry.beritaAcaraNumber}` : ''}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <span className="block text-sm font-semibold text-slate-800">
          {fmtJumlah(entry.quantity, entry.unitCode)}
        </span>
        {entry.value != null && (
          <span className="block text-xs text-slate-500">
            {fmtValue(entry.value, currency)}
          </span>
        )}
      </div>
    </li>
  )
}

export function KartuStokModal({ item, ledger, onClose }: KartuStokModalProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const entries = ledger.entries.filter((entry) => entry.itemKey === item.key)
  const pemasukan = entries.filter((entry) => entry.direction === 'IN')
  const pengeluaran = entries.filter((entry) => entry.direction === 'OUT')
  const totalIn = pemasukan.reduce((sum, entry) => sum + entry.quantity, 0)
  const totalOut = pengeluaran.reduce((sum, entry) => sum + entry.quantity, 0)
  // Harga satuan terakhir yang diketahui (entry terbaru yang membawa harga).
  const hargaSatuan = entries.reduce<number | null>(
    (last, entry) => (entry.unitPrice != null ? entry.unitPrice : last),
    null,
  )
  const currency = ledger.summary.currency

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kartu-stok-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="kartu-stok-title" className="truncate text-lg font-semibold text-slate-900">
                {item.description}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-slate-500">
                {item.itemCode ?? '—'}
                {item.hsCode ? ` · HS ${item.hsCode}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup kartu stok"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Satuan</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">{item.unitCode ?? '—'}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Harga satuan</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {fmtValue(hargaSatuan, currency)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Saldo</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {fmtJumlah(item.balanceQty, item.unitCode)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Nilai saldo</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {fmtValue(item.balanceValue, currency)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <section className="card overflow-hidden" aria-label="Pemasukan">
              <header className="flex items-center justify-between border-b bg-emerald-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-emerald-800">Pemasukan</h3>
                <span className="text-sm font-semibold text-emerald-800">
                  {fmtJumlah(totalIn, item.unitCode)}
                </span>
              </header>
              {pemasukan.length ? (
                <ul>
                  {pemasukan.map((entry) => (
                    <MutasiRow key={entry.id} entry={entry} currency={currency} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  Tidak ada pemasukan.
                </p>
              )}
            </section>

            <section className="card overflow-hidden" aria-label="Pengeluaran">
              <header className="flex items-center justify-between border-b bg-rose-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-rose-800">Pengeluaran</h3>
                <span className="text-sm font-semibold text-rose-800">
                  {fmtJumlah(totalOut, item.unitCode)}
                </span>
              </header>
              {pengeluaran.length ? (
                <ul>
                  {pengeluaran.map((entry) => (
                    <MutasiRow key={entry.id} entry={entry} currency={currency} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  Tidak ada pengeluaran.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
