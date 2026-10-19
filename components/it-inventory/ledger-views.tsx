'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'

import { KartuStokModal } from '@/components/it-inventory/kartu-stok-modal'
import {
  adjustmentReasonLabels,
  bupDocumentLabels,
  movementDirectionLabels,
  type BupDocumentCode,
  type Ledger,
  type MovementDirection,
} from '@/domain/it-inventory/types'

// Dua tampilan baca:
// 1. Jurnal Entry — daftar entry datar kronologis (arus = enum masuk/keluar).
// 2. Mutasi Barang — ringkasan per barang: masuk & keluar dalam satu baris; klik → kartu stok
//    (modal dua kolom Pemasukan|Pengeluaran ala format PER-24).

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

type LedgerView = 'jurnal' | 'mutasi'

const viewOptions: [LedgerView, string][] = [
  ['jurnal', 'Jurnal Entry'],
  ['mutasi', 'Mutasi Barang'],
]

type LedgerViewsProps = {
  ledger: Ledger
}

/** Dokumen yang menyentuh satu barang — untuk kolom Dokumen di Mutasi Barang. */
type ItemDocument = { documentCode: BupDocumentCode; nomorDaftar: string | null; tanggalDaftar: string | null }

export function LedgerViews({ ledger }: LedgerViewsProps) {
  const [view, setView] = useState<LedgerView>('jurnal')
  const [showAll, setShowAll] = useState(false)
  const [kartuKey, setKartuKey] = useState<string | null>(null)

  /** Ringkasan mutasi per barang (dokumen, total masuk/keluar) — dasar view Mutasi Barang. */
  const mutasiRows = useMemo(() => {
    return ledger.items.map((item) => {
      let qtyIn = 0
      let qtyOut = 0
      let adjustmentCount = 0
      const docs = new Map<string, ItemDocument>()
      for (const entry of ledger.entries) {
        if (entry.itemKey !== item.key) continue
        if (entry.direction === 'IN') qtyIn += entry.quantity
        else qtyOut += entry.quantity
        if (entry.source === 'ADJUSTMENT') {
          adjustmentCount += 1
          continue
        }
        if (entry.documentCode && !docs.has(entry.documentKey)) {
          docs.set(entry.documentKey, {
            documentCode: entry.documentCode,
            nomorDaftar: entry.nomorDaftar,
            tanggalDaftar: entry.tanggalDaftar,
          })
        }
      }
      return { item, qtyIn, qtyOut, docs: [...docs.values()], adjustmentCount }
    })
  }, [ledger])

  const visibleMutasiRows = showAll ? mutasiRows : mutasiRows.filter((row) => row.item.balanceQty !== 0)
  const kartuItem = ledger.items.find((item) => item.key === kartuKey) ?? null

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
                  <th className="px-3 py-3">Kode Barang</th>
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
                      {entry.itemCode ? (
                        <span
                          className="block truncate font-mono text-xs font-medium text-slate-700"
                          title={entry.itemCode}
                        >
                          {entry.itemCode}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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

      {view === 'mutasi' && (
        <section className="card overflow-hidden" aria-label="Mutasi barang">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-3">
            <p className="text-sm text-slate-500">
              Satu baris per barang — total pemasukan, pengeluaran, dan saldo. Klik baris untuk
              kartu stok.
            </p>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium" role="group" aria-label="Cakupan barang">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={`rounded-md px-3 py-1.5 ${!showAll ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Bersaldo
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`rounded-md px-3 py-1.5 ${showAll ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[15%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead className="border-b text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-3 py-3">Kode Barang</th>
                  <th className="px-3 py-3">Nama Barang</th>
                  <th className="px-3 py-3">Dokumen</th>
                  <th className="px-3 py-3">Satuan</th>
                  <th className="px-3 py-3 text-right">Masuk</th>
                  <th className="px-3 py-3 text-right">Keluar</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {visibleMutasiRows.map(({ item, qtyIn, qtyOut, docs, adjustmentCount }, index) => (
                  <tr
                    key={item.key}
                    tabIndex={0}
                    onClick={() => setKartuKey(item.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setKartuKey(item.key)
                    }}
                    title={`Lihat kartu stok ${item.description}`}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-orange-50 focus-visible:bg-orange-50"
                  >
                    <td className="px-4 py-3 text-xs text-slate-400">{index + 1}</td>
                    <td className="px-3 py-3">
                      {item.itemCode ? (
                        <span
                          className="block truncate font-mono text-xs font-medium text-slate-700"
                          title={item.itemCode}
                        >
                          {item.itemCode}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block truncate font-medium text-slate-800" title={item.description}>
                        {item.description}
                      </span>
                      {item.hsCode && (
                        <span className="mt-0.5 block text-xs text-slate-500">HS {item.hsCode}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        {docs.slice(0, 3).map((doc) => (
                          <span key={`${doc.documentCode}-${doc.nomorDaftar}`} className="flex items-center gap-1.5">
                            <DocBadge code={doc.documentCode} />
                            <span className="truncate text-xs text-slate-600" title={`Daftar ${fmtDate(doc.tanggalDaftar)}`}>
                              {doc.nomorDaftar ?? '—'}
                            </span>
                          </span>
                        ))}
                        {docs.length > 3 && (
                          <span className="text-xs text-slate-400">+{docs.length - 3} dokumen lain</span>
                        )}
                        {adjustmentCount > 0 && (
                          <span className="text-xs text-slate-500">
                            Penyesuaian ×{adjustmentCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.unitCode ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-medium text-emerald-700">
                      {qtyIn ? fmtQty(qtyIn) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-rose-700">
                      {qtyOut ? fmtQty(qtyOut) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      <span className="flex items-center justify-end gap-1">
                        {fmtJumlah(item.balanceQty, item.unitCode)}
                        <ChevronRight size={14} className="text-slate-300" aria-hidden="true" />
                      </span>
                    </td>
                  </tr>
                ))}
                {!visibleMutasiRows.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      {showAll
                        ? 'Belum ada barang.'
                        : 'Tidak ada barang bersaldo — semua sudah keluar. Pilih "All" untuk melihat seluruh mutasi.'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t bg-slate-50 text-sm font-semibold text-slate-700">
                <tr>
                  <td colSpan={5} className="px-5 py-3">
                    Jumlah · {visibleMutasiRows.length} barang
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {fmtQty(ledger.summary.totalQtyIn)}
                  </td>
                  <td className="px-3 py-3 text-right text-rose-700">
                    {fmtQty(ledger.summary.totalQtyOut)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {kartuItem && <KartuStokModal item={kartuItem} ledger={ledger} onClose={() => setKartuKey(null)} />}
    </section>
  )
}
