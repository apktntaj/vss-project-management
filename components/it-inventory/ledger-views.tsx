'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { buildItemLedgerRows } from '@/domain/it-inventory/ledger'
import {
  adjustmentReasonLabels,
  bupDocumentLabels,
  movementDirectionLabels,
  type BupDocumentCode,
  type JournalSource,
  type Ledger,
  type MovementDirection,
} from '@/domain/it-inventory/types'

// Tiga tampilan yang bercerita seperti pembukuan akuntansi:
// 1. Buku Kas Barang — journal: daftar entry datar kronologis (arus = enum masuk/keluar).
// 2. Kartu Stok    — buku besar per akun: satu barang dengan saldo berjalan.
// 3. Rekap Dokumen — bentuk yang dipersandingkan monev DJBC dengan data SKP/CEISA per dokumen.

const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })

const fmtQty = (value: number) => numberFormat.format(value)
const fmtValue = (value: number | null, currency: string | null) =>
  value == null ? '—' : `${currency ? `${currency} ` : ''}${numberFormat.format(value)}`
const fmtDate = (value: string | null) => (value ? dateFormat.format(new Date(value)) : '—')
/** Jumlah berdimensi: angka dengan satuan menempel (mis. 9 PCE). */
const fmtJumlah = (quantity: number, unit: string | null) =>
  `${numberFormat.format(quantity)}${unit ? ` ${unit}` : ''}`

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

function ArusChip({ direction }: { direction: MovementDirection }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
        direction === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}
    >
      {movementDirectionLabels[direction]}
    </span>
  )
}

/** Kolom "Dokumen" sebagai field komposit: dokumen pabean (jenis+nomor+tanggal) atau penyesuaian. */
function DokumenCell({ entry }: { entry: Ledger['entries'][number] }) {
  if (entry.source === 'ADJUSTMENT') {
    return (
      <div className="min-w-0">
        <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
          Penyesuaian
        </span>
        <span className="mt-1 block truncate text-xs text-slate-600">
          {entry.adjustmentReason ? adjustmentReasonLabels[entry.adjustmentReason] : 'Tanpa alasan'}
        </span>
        {entry.beritaAcaraNumber && (
          <span className="mt-0.5 block truncate text-xs text-slate-400">
            {entry.beritaAcaraNumber}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="min-w-0">
      {entry.documentCode && <DocBadge code={entry.documentCode} />}
      <span className="mt-1 block truncate text-xs font-medium text-slate-700">
        {entry.nomorDaftar ?? '—'}
      </span>
      <span className="mt-0.5 block truncate text-xs text-slate-400">
        daftar {fmtDate(entry.tanggalDaftar)}
      </span>
      {entry.sourceRef && (
        <span className="mt-0.5 block truncate text-xs text-slate-400" title={entry.sourceRef}>
          ← {entry.sourceRef}
        </span>
      )}
    </div>
  )
}

/**
 * Kode barang tampilan: deterministik dari kunci akun (PER-24: kode barang dibuat oleh badan
 * usaha per jenis barang). Placeholder sampai master barang punya kode resmi.
 */
function itemCodeOfKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return `BRG-${(Math.abs(hash) % 100000).toString().padStart(5, '0')}`
}

/**
 * Kolom "Bukti" (elemen Bukti Penerimaan/Pengeluaran Barang pada format PER-24/BC/2023):
 * nomor invoice + urutan seri untuk entry dokumen; nomor berita acara untuk penyesuaian.
 */
function BuktiCell({ invoiceNumber, invoiceSeri, beritaAcaraNumber }: { invoiceNumber: string | null; invoiceSeri: number | null; beritaAcaraNumber: string | null }) {
  if (!invoiceNumber && !beritaAcaraNumber && invoiceSeri == null) {
    return <span className="text-slate-300">—</span>
  }
  return (
    <div className="min-w-0">
      {invoiceNumber && (
        <span className="block truncate text-xs font-medium text-slate-700" title={invoiceNumber}>
          {invoiceNumber}
        </span>
      )}
      {beritaAcaraNumber && (
        <span className="block truncate text-xs font-medium text-slate-700" title={beritaAcaraNumber}>
          {beritaAcaraNumber}
        </span>
      )}
      {invoiceSeri != null && invoiceSeri > 0 && (
        <span className="mt-0.5 block text-xs text-slate-400">seri {invoiceSeri}</span>
      )}
    </div>
  )
}

type LedgerView = 'jurnal' | 'kartu' | 'dokumen'

const viewOptions: [LedgerView, string][] = [
  ['jurnal', 'Jurnal Entry'],
  ['kartu', 'Kartu Stok'],
  ['dokumen', 'Rekap Dokumen'],
]

type LedgerViewsProps = {
  ledger: Ledger
}

export function LedgerViews({ ledger }: LedgerViewsProps) {
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
            <table className="min-w-[1100px] w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Dokumen</th>
                  <th className="px-3 py-3">No Invoice</th>
                  <th className="px-3 py-3">Arus</th>
                  <th className="px-3 py-3 text-right">Jumlah</th>
                  <th className="px-3 py-3 text-right">Harga satuan</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-b-0">
                    <td className="px-5 py-2.5 text-slate-700">{fmtDate(entry.entryDate)}</td>
                    <td className="px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={entry.description}>
                        {entry.description}
                      </span>
                      {entry.hsCode && (
                        <span className="mt-0.5 block text-xs text-slate-500">HS {entry.hsCode}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <DokumenCell entry={entry} />
                    </td>
                    <td className="px-3 py-2.5">
                      <BuktiCell
                        invoiceNumber={entry.invoiceNumber}
                        invoiceSeri={entry.invoiceSeri}
                        beritaAcaraNumber={entry.beritaAcaraNumber}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <ArusChip direction={entry.direction} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                      {fmtJumlah(entry.quantity, entry.unitCode)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {fmtValue(entry.unitPrice, entry.currency ?? ledger.summary.currency)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-700">
                      {fmtValue(entry.value, entry.currency ?? ledger.summary.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-slate-50 text-sm font-semibold text-slate-700">
                <tr>
                  <td colSpan={5} className="px-5 py-3">
                    Jumlah · {ledger.summary.totalEntries} entri
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-emerald-700">{fmtQty(ledger.summary.totalQtyIn)}</span>
                    <span className="block text-xs font-normal text-rose-700">
                      {fmtQty(ledger.summary.totalQtyOut)}
                    </span>
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
            Baris diurutkan kronologis per tanggal perpindahan; waktu input tersimpan sebagai log
            aktivitas dan tampil pada laporan Excel. Jurnal bersifat immutable — tidak ada ubah
            atau hapus; koreksi dicatat sebagai entry penyesuaian.
          </p>
        </section>
      )}

      {view === 'kartu' && (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <section className="card overflow-hidden" aria-label="Daftar barang">
            <div className="border-b bg-slate-50 px-4 py-3">
              <label className="relative block">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  className="input m-0 border-0 bg-white pl-9 shadow-none"
                  placeholder="Cari nama barang atau HS"
                  aria-label="Cari nama barang"
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
                      {fmtJumlah(item.balanceQty, item.unitCode)}
                    </span>
                  </button>
                </li>
              ))}
              {!filteredItems.length && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada barang yang cocok.
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
                      Saldo akhir{' '}
                      <span className="font-semibold text-slate-800">
                        {fmtJumlah(selectedItem.balanceQty, selectedItem.unitCode)}
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
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-600">Kode barang:</dt>
                      <dd>{selectedItem.hsCode ?? itemCodeOfKey(selectedItem.key)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-600">Kategori:</dt>
                      <dd>—</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-600">Satuan:</dt>
                      <dd>{selectedItem.unitCode ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[920px] w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[4%]" />
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                      <col className="w-[17%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[21%]" />
                    </colgroup>
                    <thead className="border-b text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">No</th>
                        <th className="px-3 py-3">Tanggal</th>
                        <th className="px-3 py-3">Dokumen</th>
                        <th className="px-3 py-3">Bukti</th>
                        <th className="px-3 py-3 text-right">Masuk</th>
                        <th className="px-3 py-3 text-right">Keluar</th>
                        <th className="px-3 py-3 text-right">Saldo</th>
                        <th className="px-5 py-3 text-right">Nilai saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kartuRows.map((row, index) => (
                        <tr key={index} className="border-b last:border-b-0">
                          <td className="px-4 py-2.5 text-xs text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2.5 text-slate-600">{fmtDate(row.entryDate)}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {row.source === 'ADJUSTMENT'
                              ? `Penyesuaian${row.adjustmentReason ? ` · ${adjustmentReasonLabels[row.adjustmentReason]}` : ''}`
                              : `${row.documentCode ? bupDocumentLabels[row.documentCode] : '—'} ${row.nomorDaftar ?? ''}`.trim()}
                          </td>
                          <td className="px-3 py-2.5">
                            <BuktiCell
                              invoiceNumber={row.invoiceNumber}
                              invoiceSeri={row.invoiceSeri}
                              beritaAcaraNumber={row.beritaAcaraNumber}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-emerald-700">
                            {row.direction === 'IN' ? fmtJumlah(row.quantity, selectedItem.unitCode) : ''}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-rose-700">
                            {row.direction === 'OUT' ? fmtJumlah(row.quantity, selectedItem.unitCode) : ''}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                            {fmtJumlah(row.runningQty, selectedItem.unitCode)}
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
                Pilih barang untuk melihat kartu stoknya.
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
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Dokumen</th>
                  <th className="px-3 py-3">Nomor AJU</th>
                  <th className="px-3 py-3">No. daftar</th>
                  <th className="px-3 py-3">Tgl. daftar</th>
                  <th className="px-3 py-3">Arah</th>
                  <th className="px-3 py-3 text-right">Entry</th>
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
                      <ArusChip direction={doc.direction} />
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
