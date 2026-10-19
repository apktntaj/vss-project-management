'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { buildItemLedgerRows } from '@/domain/it-inventory/ledger'
import {
  bupDocumentLabels,
  type BupDocumentCode,
  type Ledger,
} from '@/domain/it-inventory/types'

// Tiga tampilan yang bercerita seperti pembukuan akuntansi:
// 1. Buku Kas Barang — jurnal datar per transaksi (analogi buku kas; Masuk|Keluar ala Debit|Kredit).
// 2. Kartu Stok    — buku besar per akun: satu jenis barang dengan saldo berjalan.
// 3. Rekap Dokumen — bentuk yang dipersandingkan monev DJBC dengan data SKP/CEISA per dokumen.

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
const inputTimeFormat = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const fmtQty = (value: number) => numberFormat.format(value)
const fmtValue = (value: number | null, currency: string | null) =>
  value == null ? '—' : `${currency ? `${currency} ` : ''}${numberFormat.format(value)}`
const fmtDate = (value: string | null) => (value ? dateFormat.format(new Date(value)) : '—')
const fmtInputTime = (value: string | null) =>
  value ? `input ${inputTimeFormat.format(new Date(value))}` : null

const badgeStyles: Record<BupDocumentCode, string> = {
  '23': 'bg-blue-100 text-blue-800',
  '25': 'bg-amber-100 text-amber-900',
  '30': 'bg-violet-100 text-violet-800',
}

function DocBadge({ code }: { code: BupDocumentCode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyles[code]}`}>
      {bupDocumentLabels[code]}
    </span>
  )
}

type LedgerView = 'jurnal' | 'kartu' | 'dokumen'

const viewOptions: [LedgerView, string][] = [
  ['jurnal', 'Buku Kas Barang'],
  ['kartu', 'Kartu Stok'],
  ['dokumen', 'Rekap Dokumen'],
]

export function LedgerViews({ ledger }: { ledger: Ledger }) {
  const [view, setView] = useState<LedgerView>('jurnal')
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)

  const filteredItems = useMemo(() => {
    const needle = itemSearch.trim().toUpperCase()
    if (!needle) return ledger.items
    return ledger.items.filter(
      (item) =>
        item.description.toUpperCase().includes(needle) ||
        (item.hsCode ?? '').toUpperCase().includes(needle),
    )
  }, [ledger, itemSearch])

  const selectedItem =
    ledger.items.find((item) => item.key === selectedItemKey) ?? filteredItems[0] ?? null
  const kartuRows = selectedItem ? buildItemLedgerRows(ledger, selectedItem.key) : []

  return (
    <section className="space-y-5" aria-label="Buku arus barang">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist">
        {viewOptions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`rounded-md px-3 py-1.5 ${view === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'jurnal' && (
        <section className="card overflow-hidden" aria-label="Buku kas barang">
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[27%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-3 py-3">Jenis barang</th>
                  <th className="px-3 py-3">Dokumen</th>
                  <th className="px-3 py-3 text-right">Masuk</th>
                  <th className="px-3 py-3 text-right">Keluar</th>
                  <th className="px-3 py-3 text-right">Harga satuan</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ledger.journal.map((row, index) => {
                  const inputTime = fmtInputTime(row.uploadedAt)
                  return (
                    <tr key={`${row.documentKey}-${index}`} className="border-b last:border-b-0">
                      <td className="px-5 py-2.5">
                        <span className="block text-slate-700">{fmtDate(row.tanggalDaftar)}</span>
                        {inputTime && (
                          <span className="mt-0.5 block text-xs text-slate-400">{inputTime}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block truncate font-medium text-slate-800" title={row.description}>
                          {row.description}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {row.hsCode ? `HS ${row.hsCode}` : 'Tanpa HS'}
                          {row.unitCode ? ` · ${row.unitCode}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <DocBadge code={row.documentCode} />
                        <span className="mt-1 block truncate text-xs text-slate-600">
                          {row.nomorDaftar ?? '—'}
                        </span>
                        {row.sourceRef && (
                          <span
                            className="mt-0.5 block truncate text-xs text-slate-400"
                            title={row.sourceRef}
                          >
                            ← {row.sourceRef}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {row.quantityIn ? (
                          <span className="text-emerald-700">{fmtQty(row.quantityIn)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {row.quantityOut ? (
                          <span className="text-rose-700">{fmtQty(row.quantityOut)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">
                        {fmtValue(row.unitPrice, ledger.summary.currency)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-700">
                        {fmtValue(row.value, ledger.summary.currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t bg-slate-50 text-sm font-semibold text-slate-700">
                <tr>
                  <td colSpan={3} className="px-5 py-3">
                    Jumlah · {ledger.summary.movementLines} transaksi
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {fmtQty(ledger.summary.totalQtyIn)}
                  </td>
                  <td className="px-3 py-3 text-right text-rose-700">
                    {fmtQty(ledger.summary.totalQtyOut)}
                  </td>
                  <td className="px-3 py-3" />
                  <td className="px-5 py-3 text-right">
                    <span className="block text-emerald-700">
                      masuk {fmtValue(ledger.summary.valueIn, ledger.summary.currency)}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-rose-700">
                      keluar {fmtValue(ledger.summary.valueOut, ledger.summary.currency)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Baris diurutkan kronologis per tanggal daftar dokumen; subteks di bawah tanggal adalah
            stempel waktu posting ke buku (log aktivitas).
          </p>
        </section>
      )}

      {view === 'kartu' && (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <section className="card overflow-hidden" aria-label="Daftar jenis barang">
            <div className="border-b bg-slate-50 px-4 py-3">
              <label className="relative block">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  className="input m-0 border-0 bg-white pl-9 shadow-none"
                  placeholder="Cari jenis barang atau HS"
                  aria-label="Cari jenis barang"
                />
              </label>
            </div>
            <ul className="max-h-[540px] overflow-y-auto">
              {filteredItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedItemKey(item.key)}
                    aria-current={selectedItem?.key === item.key}
                    title={`${item.description}${item.hsCode ? ` · HS ${item.hsCode}` : ''}`}
                    className={`flex w-full items-center justify-between gap-3 border-b px-4 py-2.5 text-left text-sm last:border-b-0 ${
                      selectedItem?.key === item.key
                        ? 'bg-orange-50 text-slate-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.description}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {item.hsCode ? `HS ${item.hsCode}` : 'Tanpa HS'}
                        {item.unitCode ? ` · ${item.unitCode}` : ''}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.balanceQty > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.balanceQty < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {fmtQty(item.balanceQty)}
                    </span>
                  </button>
                </li>
              ))}
              {!filteredItems.length && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada jenis barang yang cocok.
                </li>
              )}
            </ul>
          </section>

          <section className="card overflow-hidden" aria-label="Kartu stok">
            {selectedItem ? (
              <>
                <div className="border-b bg-slate-50 px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedItem.description}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Saldo{' '}
                      <span className="font-semibold text-slate-800">
                        {fmtQty(selectedItem.balanceQty)} {selectedItem.unitCode ?? ''}
                      </span>
                      {selectedItem.balanceValue != null && (
                        <>
                          {' '}· nilai{' '}
                          <span className="font-semibold text-slate-800">
                            {fmtValue(selectedItem.balanceValue, ledger.summary.currency)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedItem.hsCode ? `HS ${selectedItem.hsCode}` : 'Tanpa HS'}
                    {selectedItem.itemCode ? ` · kode barang ${selectedItem.itemCode}` : ''}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[24%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                      <col className="w-[20%]" />
                    </colgroup>
                    <thead className="border-b text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Tanggal</th>
                        <th className="px-3 py-3">Dokumen</th>
                        <th className="px-3 py-3 text-right">Masuk</th>
                        <th className="px-3 py-3 text-right">Keluar</th>
                        <th className="px-3 py-3 text-right">Saldo</th>
                        <th className="px-5 py-3 text-right">Nilai saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kartuRows.map((row, index) => (
                        <tr key={index} className="border-b last:border-b-0">
                          <td className="px-5 py-2.5 text-slate-600">{fmtDate(row.tanggalDaftar)}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <DocBadge code={row.documentCode} />
                              <span className="truncate text-slate-700">
                                {row.nomorDaftar ?? '—'}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-emerald-700">
                            {row.quantityIn ? fmtQty(row.quantityIn) : ''}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-rose-700">
                            {row.quantityOut ? fmtQty(row.quantityOut) : ''}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                            {fmtQty(row.runningQty)}
                          </td>
                          <td className="px-5 py-2.5 text-right text-slate-600">
                            {fmtValue(row.runningValue, ledger.summary.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-sm text-slate-500">
                Pilih jenis barang untuk melihat kartu stoknya.
              </div>
            )}
          </section>
        </div>
      )}

      {view === 'dokumen' && (
        <section className="card overflow-hidden" aria-label="Rekap dokumen pabean">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[23%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Dokumen</th>
                  <th className="px-3 py-3">Nomor AJU</th>
                  <th className="px-3 py-3">No. daftar</th>
                  <th className="px-3 py-3">Tgl. daftar</th>
                  <th className="px-3 py-3">Arah</th>
                  <th className="px-3 py-3 text-right">Baris</th>
                  <th className="px-3 py-3 text-right">Total kuantitas</th>
                  <th className="px-5 py-3 text-right">Total nilai</th>
                </tr>
              </thead>
              <tbody>
                {ledger.documents.map((doc) => (
                  <tr key={doc.documentKey} className="border-b last:border-b-0">
                    <td className="px-5 py-3">
                      <DocBadge code={doc.documentCode} />
                    </td>
                    <td className="truncate px-3 py-3 font-mono text-xs text-slate-600" title={doc.nomorAju ?? ''}>
                      {doc.nomorAju ?? '—'}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      {doc.nomorDaftar ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{fmtDate(doc.tanggalDaftar)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`font-medium ${doc.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}
                      >
                        {doc.direction === 'IN' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">{doc.lineCount}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{fmtQty(doc.totalQty)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {fmtValue(doc.totalValue, ledger.summary.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Rekap ini mengikuti elemen data Lampiran R PER-6/BC/2023 — jenis dokumen, nomor dan
            tanggal pendaftaran — untuk persandingan dengan data SKP saat monitoring.
          </p>
        </section>
      )}
    </section>
  )
}
