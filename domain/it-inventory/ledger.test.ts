import assert from 'node:assert/strict'

import { buildItemLedgerRows, buildLedger, itemKeyOf } from './ledger'
import type { BupBarangLine, BupDocument } from './types'

// Fixture ringkas meniru rantai nyata: BC 2.3 masuk (2 jenis barang), BC 2.5 dan BC 3.0 keluar
// dari jenis yang sama — saldo harus berjalan seperti buku kas, bukan snapshot stok.
function line(
  description: string,
  quantity: number,
  overrides: Partial<BupBarangLine> = {},
): BupBarangLine {
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
    sourceLineSeri: null,
    ...overrides,
  }
}

function doc(
  fileName: string,
  documentCode: '23' | '25' | '30',
  tanggalDaftar: string,
  items: BupBarangLine[],
): BupDocument {
  return {
    fileName,
    documentCode,
    nomorAju: `0000${documentCode}JAS4852026`,
    nomorDaftar: fileName.replace(/\D/g, '').padStart(6, '0'),
    tanggalDaftar,
    kantor: '040400',
    bruto: null,
    netto: null,
    cif: null,
    currency: 'USD',
    ownerName: 'VENUE DEMO',
    uploadedAt: '2026-10-19T08:00:00.000Z',
    items,
  }
}

const lampuMeja = (qty: number, value: number | null = null, unitPrice: number | null = null) =>
  line('Lampu meja LED', qty, { seri: 1, lineValue: value, unitPrice })

const karpetBooth = (qty: number) => line('Karpet booth', qty, { seri: 2, hsCode: '5703.30.00' })

// Diunggah acak (30 dulu) untuk membuktikan jurnal tetap kronologis per tanggal daftar.
const documents = [
  doc('bup-30.xlsx', '30', '2026-08-19', [
    lampuMeja(2, 40),
    karpetBooth(5), // karpet habis: 6 masuk, 1 keluar via 2.5, 5 keluar via 3.0
  ]),
  doc('bup-23.xlsx', '23', '2026-07-27', [
    lampuMeja(6, 120, 20),
    karpetBooth(6),
    line('Banner roll-up', 20, { seri: 3, hsCode: '4911.10.00' }),
  ]),
  doc('bup-25.xlsx', '25', '2026-08-07', [
    lampuMeja(1, 20),
    karpetBooth(1),
    line('Banner roll-up', 4, { seri: 3, hsCode: '4911.10.00' }),
  ]),
]

const ledger = buildLedger(documents)

// -- Jurnal: kronologis per tanggal daftar, arah dari jenis dokumen. --
assert.equal(ledger.journal.length, 8, 'setiap baris barang menjadi satu baris jurnal')
assert.deepEqual(
  ledger.journal.map((row) => row.documentCode),
  ['23', '23', '23', '25', '25', '25', '30', '30'],
  'jurnal tersusun kronologis meski unggahan tidak berurutan',
)
assert.ok(ledger.journal[0].quantityIn > 0 && ledger.journal[0].quantityOut === 0, 'BC 2.3 = masuk')
assert.ok(ledger.journal[3].quantityOut > 0 && ledger.journal[3].quantityIn === 0, 'BC 2.5 = keluar')
assert.equal(ledger.journal[0].uploadedAt, '2026-10-19T08:00:00.000Z', 'stempel waktu input terbawa ke jurnal')
assert.equal(ledger.journal[0].unitPrice, 120 / 6, 'harga satuan terbawa ke jurnal')

// -- Jenis barang sebagai akun: keying menoleransi beda kapital/spasi. --
assert.equal(itemKeyOf(' 9405.11.00 ', 'lampu  meja  LED', ' pcs '), itemKeyOf('9405.11.00', 'Lampu meja LED', 'PCS'))
assert.equal(ledger.items.length, 3, 'tiga jenis barang = tiga akun')

const lampu = ledger.items.find((item) => item.description === 'Lampu meja LED')!
assert.equal(lampu.balanceQty, 6 - 1 - 2, 'saldo lampu = masuk − keluar lintas dokumen')
assert.equal(lampu.balanceValue, 120 - 20 - 40, 'saldo nilai berjalan dari nilai baris')
const karpet = ledger.items.find((item) => item.description === 'Karpet booth')!
assert.equal(karpet.balanceQty, 0, 'karpet habis tercatat nol, bukan hilang dari buku')
const banner = ledger.items.find((item) => item.description === 'Banner roll-up')!
assert.equal(banner.balanceQty, 16)

// -- Kartu stok: saldo berjalan per mutasi, seperti buku besar per akun. --
const kartuLampu = buildItemLedgerRows(ledger, lampu.key)
assert.deepEqual(
  kartuLampu.map((row) => row.runningQty),
  [6, 5, 3],
  'saldo berjalan lampu: 6 → 5 → 3',
)
assert.deepEqual(
  kartuLampu.map((row) => row.runningValue),
  [120, 100, 60],
  'nilai berjalan mengikuti arah mutasi',
)

// -- Saldo nilai menjadi null bila ada mutasi tanpa nilai (tidak mengarang angka). --
const kartuKarpet = buildItemLedgerRows(ledger, karpet.key)
assert.equal(karpet.balanceValue, null, 'akun dengan mutasi tak bernilai tidak punya saldo nilai')
assert.ok(kartuKarpet.every((row) => row.runningValue === null))

// -- Rekap dokumen dan ringkasan. --
assert.equal(ledger.documents.length, 3)
assert.deepEqual(
  ledger.documents.map((recap) => recap.tanggalDaftar),
  ['2026-07-27', '2026-08-07', '2026-08-19'],
  'rekap ikut urutan kronologis',
)
assert.equal(ledger.summary.itemTypes, 3)
assert.equal(ledger.summary.totalQtyIn, 32)
assert.equal(ledger.summary.totalQtyOut, 13)
assert.equal(ledger.summary.valueIn, 120)
assert.equal(ledger.summary.valueOut, 60)
assert.equal(ledger.summary.currency, 'USD')

// -- Jejak dokumen asal terbawa ke jurnal untuk keterlacakan. --
const berjejak = buildLedger([
  doc('bup-23.xlsx', '23', '2026-07-27', [lampuMeja(6)]),
  doc('bup-25.xlsx', '25', '2026-08-07', [
    line('Lampu meja LED', 1, {
      seri: 1,
      sourceDocumentCode: '23',
      sourceRegistrationNumber: '000973',
      sourceLineSeri: 1,
    }),
  ]),
])
assert.equal(
  berjejak.journal.find((row) => row.direction === 'OUT')?.sourceRef,
  'BC 2.3 000973 seri 1',
  'kolom asal BUP menjadi referensi jejak pada jurnal',
)

console.log('domain/it-inventory/ledger.test.ts — semua asersi lulus')
