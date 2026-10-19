import assert from 'node:assert/strict'

import {
  buildItemLedgerRows,
  buildLedger,
  entriesFromBupDocument,
  itemKeyOf,
  validateEntryBalance,
} from './ledger'
import type { BupBarangLine, BupDocument, JournalEntry } from './types'

// Fixture meniru rantai nyata: BC 2.3 masuk, BC 2.5 & BC 3.0 keluar dari jenis yang sama,
// plus satu entry PENYESUAIAN (stock opname selisih kurang). Saldo harus berjalan seperti
// buku kas — bukan snapshot stok.

function entry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'e1',
    entryDate: '2026-07-27',
    uploadedAt: '2026-10-19T08:00:00.000Z',
    source: 'DOCUMENT',
    direction: 'IN',
    documentKey: 'bup-23.xlsx',
    documentCode: '23',
    nomorDaftar: '000973',
    tanggalDaftar: '2026-07-27',
    nomorAju: '000023JAS48520260717040033',
    invoiceNumber: null,
    invoiceSeri: null,
    adjustmentReason: null,
    beritaAcaraNumber: null,
    itemKey: itemKeyOf('9405.11.00', 'Lampu meja LED', 'PCS'),
    hsCode: '9405.11.00',
    description: 'Lampu meja LED',
    unitCode: 'PCS',
    quantity: 1,
    unitPrice: null,
    value: null,
    currency: 'USD',
    ownerName: 'VENUE DEMO',
    sourceRef: null,
    ...overrides,
  }
}

const lampu = (key: string) => itemKeyOf('9405.11.00', 'Lampu meja LED', 'PCS')
const karpet = itemKeyOf('5703.30.00', 'Karpet booth', 'PCS')
const banner = itemKeyOf('4911.10.00', 'Banner roll-up', 'PCS')

// Diinput tidak berurutan (30 → 23 → 25) untuk membuktikan jurnal tetap kronologis per tanggal.
const entries = [
  entry({
    id: 'out-30',
    entryDate: '2026-08-19',
    direction: 'OUT',
    documentKey: 'bup-30.xlsx',
    documentCode: '30',
    nomorDaftar: '519242',
    tanggalDaftar: '2026-08-19',
    itemKey: lampu(''),
    quantity: 2,
    value: 40,
    unitPrice: 20,
  }),
  entry({
    id: 'in-1',
    quantity: 6,
    value: 120,
    unitPrice: 20,
  }),
  entry({
    id: 'in-2',
    itemKey: karpet,
    hsCode: '5703.30.00',
    description: 'Karpet booth',
    quantity: 6,
  }),
  entry({
    id: 'in-3',
    itemKey: banner,
    hsCode: '4911.10.00',
    description: 'Banner roll-up',
    quantity: 20,
  }),
  entry({
    id: 'out-25',
    entryDate: '2026-08-07',
    documentKey: 'bup-25.xlsx',
    documentCode: '25',
    nomorDaftar: '000219',
    tanggalDaftar: '2026-08-07',
    direction: 'OUT',
    itemKey: lampu(''),
    quantity: 1,
    value: 20,
    unitPrice: 20,
    sourceRef: 'BC 2.3 000973 seri 1',
  }),
  entry({
    id: 'out-25b',
    entryDate: '2026-08-07',
    documentKey: 'bup-25.xlsx',
    documentCode: '25',
    nomorDaftar: '000219',
    tanggalDaftar: '2026-08-07',
    direction: 'OUT',
    itemKey: karpet,
    hsCode: '5703.30.00',
    description: 'Karpet booth',
    quantity: 1,
  }),
  entry({
    id: 'adj-1',
    entryDate: '2026-08-25',
    source: 'ADJUSTMENT',
    direction: 'OUT',
    documentKey: 'adjustment:adj-1',
    documentCode: null,
    adjustmentReason: 'STOCK_OPNAME',
    beritaAcaraNumber: 'BA-01',
    itemKey: banner,
    hsCode: '4911.10.00',
    description: 'Banner roll-up',
    quantity: 4,
  }),
]

const ledger = buildLedger(entries)

// -- Jurnal: kronologis per tanggal perpindahan, meski input tidak berurutan. --
assert.equal(ledger.entries.length, 7, 'setiap perpindahan = satu entry')
assert.deepEqual(
  ledger.entries.map((row) => row.id),
  ['in-1', 'in-2', 'in-3', 'out-25', 'out-25b', 'out-30', 'adj-1'],
  'jurnal terurut kronologis, bukan urutan input',
)

// -- Akun barang: keying menoleransi beda kapital/spasi; saldo = turunan jurnal. --
assert.equal(
  itemKeyOf(' 9405.11.00 ', 'lampu  meja  LED', ' pcs'),
  itemKeyOf('9405.11.00', 'Lampu meja LED', 'PCS'),
)
assert.equal(ledger.items.length, 3, 'tiga jenis barang = tiga akun')
const lampuItem = ledger.items.find((item) => item.description === 'Lampu meja LED')!
assert.equal(lampuItem.balanceQty, 6 - 1 - 2, 'saldo lampu = masuk − keluar lintas dokumen')
assert.equal(lampuItem.balanceValue, 120 - 20 - 40, 'saldo nilai berjalan dari nilai entry')
const karpetItem = ledger.items.find((item) => item.description === 'Karpet booth')!
assert.equal(karpetItem.balanceValue, null, 'akun dengan mutasi tak bernilai tidak punya saldo nilai')
const bannerItem = ledger.items.find((item) => item.description === 'Banner roll-up')!
assert.equal(bannerItem.balanceQty, 20 - 4, 'penyesuaian menggerakkan saldo seperti entry lain')

// -- Kartu stok: saldo berjalan per mutasi, seperti buku besar per akun. --
const kartuLampu = buildItemLedgerRows(ledger, lampuItem.key)
assert.deepEqual(
  kartuLampu.map((row) => row.runningQty),
  [6, 5, 3],
  'saldo berjalan lampu: 6 → 5 → 3',
)
const kartuBanner = buildItemLedgerRows(ledger, bannerItem.key)
assert.equal(kartuBanner.at(-1)?.source, 'ADJUSTMENT', 'penyesuaian tampil di kartu stok')

// -- Rekap dokumen: hanya entry bersumber dokumen pabean; penyesuaian tidak masuk. --
assert.equal(ledger.documents.length, 3)
const rekap25 = ledger.documents.find((doc) => doc.nomorDaftar === '000219')!
assert.equal(rekap25.lineCount, 2, 'dua entry BC 2.5 menjadi satu rekap dokumen')
assert.ok(!ledger.documents.some((doc) => doc.documentKey.startsWith('adjustment:')))

// -- Ringkasan. --
assert.equal(ledger.summary.totalEntries, 7)
assert.equal(ledger.summary.totalQtyIn, 32)
assert.equal(ledger.summary.totalQtyOut, 8)
assert.equal(ledger.summary.valueIn, 120)
assert.equal(ledger.summary.valueOut, 60)

// -- Konversi BUP → entry (mode bulk). --
function line(description: string, quantity: number, overrides: Partial<BupBarangLine> = {}): BupBarangLine {
  return {
    seri: 1,
    hsCode: '9405.11.00',
    itemCode: null,
    description,
    brand: null,
    type: null,
    size: null,
    unitCode: 'PCS',
    quantity,
    netWeightKg: null,
    grossWeightKg: null,
    cifValue: null,
    unitPrice: null,
    lineValue: null,
    countryCode: 'CN',
    sourceDocumentCode: null,
    sourceRegistrationNumber: null,
    sourceRegistrationDate: null,
    sourceLineSeri: 0,
    ...overrides,
  }
}
const bupDoc: BupDocument = {
  fileName: 'bup-25.xlsx',
  documentCode: '25',
  nomorAju: '000025JAS48520260803040017',
  nomorDaftar: '000219',
  tanggalDaftar: '2026-08-07',
  kantor: '040400',
  bruto: null,
  netto: null,
  cif: null,
  currency: 'USD',
  ownerName: 'VENUE DEMO',
  invoiceNumber: 'S.01/IDW-VPN/2026',
  invoiceDate: '2026-06-25',
  uploadedAt: '2026-10-19T03:41:00.000Z',
  items: [
    line('Lampu meja LED', 1, {
      seri: 9,
      sourceDocumentCode: '23',
      sourceRegistrationNumber: '000973',
      sourceLineSeri: 52,
    }),
  ],
}
const converted = entriesFromBupDocument(bupDoc)
assert.equal(converted.length, 1)
assert.equal(converted[0].source, 'DOCUMENT')
assert.equal(converted[0].direction, 'OUT', 'BC 2.5 otomatis menjadi arus keluar')
assert.equal(converted[0].entryDate, '2026-08-07', 'tanggal entry bulk = tanggal daftar dokumen')
assert.equal(converted[0].uploadedAt, '2026-10-19T03:41:00.000Z', 'waktu unggah tersimpan sebagai log')
assert.equal(converted[0].sourceRef, 'BC 2.3 000973 seri 52', 'kolom asal BUP menjadi jejak entry')
assert.equal(converted[0].id, 'bup-25.xlsx#9', 'id entry bulk stabil dari file + seri')
assert.equal(converted[0].invoiceNumber, 'S.01/IDW-VPN/2026', 'invoice dari sheet DOKUMEN menjadi bukti entry')
assert.equal(converted[0].invoiceSeri, 9, 'seri barang BUP menjadi urutan bukti')

// -- Invariant saldo: keluar melebihi saldo ditolak; tepat sama diizinkan. --
const saldoBannerSaatIni = 20 - 4
const berlebih = validateEntryBalance(entries, entry({
  itemKey: banner,
  hsCode: '4911.10.00',
  description: 'Banner roll-up',
  direction: 'OUT',
  quantity: saldoBannerSaatIni + 1,
}))
assert.equal(berlebih.ok, false, 'keluar melebihi saldo ditolak')
if (!berlebih.ok) assert.match(berlebih.issues[0].message, /Saldo Banner roll-up tidak cukup/)
const pas = validateEntryBalance(entries, entry({
  itemKey: banner,
  hsCode: '4911.10.00',
  description: 'Banner roll-up',
  direction: 'OUT',
  quantity: saldoBannerSaatIni,
}))
assert.equal(pas.ok, true, 'keluar tepat sebesar saldo diizinkan (saldo akhir nol)')
const masukBebas = validateEntryBalance([], entry({ quantity: 100 }))
assert.equal(masukBebas.ok, true, 'arus masuk selalu diizinkan')

console.log('domain/it-inventory/ledger.test.ts — semua asersi lulus')
