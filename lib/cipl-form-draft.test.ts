import assert from 'node:assert/strict'

import type { BarisBarang } from '@/domain/exhibition/cipl-document'
import type { ExhibitorLogistics } from '@/domain/job/manifest'
import { autoTotalPrice, emptyRow, isRowFilled, rowFromScan, rowSums, rowToScanEntry } from './cipl-form-draft'

const barang = (uraian: string, refKoli: string | null, extra: Partial<BarisBarang> = {}): BarisBarang => ({
  uraian,
  merekModel: null,
  kodeHs: null,
  jumlah: 1,
  satuan: 'PCE',
  nilaiSatuan: null,
  nilaiTotal: null,
  disposisi: 'TIDAK_DISEBUT',
  refKoli,
  refKoliIds: [],
  ...extra,
})

const logistics: ExhibitorLogistics = {
  hall: 'B1',
  booth: 'D035',
  koli: {
    totalCount: 2,
    bareCaseCount: 1,
    totalWeightKg: 150,
    totalNetWeightKg: 120,
    details: [
      { label: 'PKG 1', dimension: { lengthCm: 100, widthCm: 50, heightCm: 25 }, volumeCbm: 0.125, weightKg: 80, netWeightKg: 70, satuanKemasan: 'CARTON' },
      { label: 'PKG 2', dimension: null, volumeCbm: null, weightKg: 70, netWeightKg: 50 },
    ],
  },
  notes: [],
}

// Scan → draft: barang masuk ke case dengan label sama; label tak dikenal jadi case baru; tanpa ref ke case tanpa nomor.
const scanned = rowFromScan('r1', {
  name: 'PT MAJU',
  jobNo: 'S.01',
  logistics,
  items: [
    barang('PRINTER', 'PKG 1'),
    barang('CABLE', 'PKG 1'),
    barang('CATALOGUE', 'in package No. 22', { disposisi: 'DISPOSED' }),
    barang('SPARE', null),
  ],
})

assert.equal(scanned.bareCase, '1')
assert.deepEqual(scanned.cases.map((entry) => entry.label), ['PKG 1', 'PKG 2', 'in package No. 22', ''])
assert.deepEqual(scanned.cases[0].items.map((item) => item.uraian), ['PRINTER', 'CABLE'])
assert.equal(scanned.cases[0].netWeight, '70')
assert.equal(scanned.cases[1].items.length, 1) // case tanpa barang tetap punya satu baris kosong untuk diisi
assert.equal(scanned.cases[1].items[0].uraian, '')
assert.equal(scanned.cases[2].items[0].disposisi, 'DISPOSED')

// Draft → entri domain: koli membawa gross/net, barang tertaut ke id koli-nya; total exhibitor
// selalu dihitung dari rincian (tidak pernah dibawa dari dokumen).
const result = rowToScanEntry(scanned)
assert.ok(result)
const { entry, invalidItems } = result
assert.equal(invalidItems, 0)
assert.ok(entry.logistics.koli.totalWeightKg == null)
assert.ok(entry.logistics.koli.totalNetWeightKg == null)
assert.equal(entry.statedTotalCount, null)
assert.equal(entry.logistics.koli.bareCaseCount, 1)
assert.equal(entry.logistics.koli.details[0].netWeightKg, 70)
const printer = entry.items.find((item) => item.uraian === 'PRINTER')!
assert.deepEqual(printer.refKoliIds, [entry.logistics.koli.details[0].id])
assert.equal(printer.refKoli, 'PKG 1')
assert.deepEqual(entry.items.find((item) => item.uraian === 'SPARE')!.refKoliIds, [])
// Total paket dihitung dari rincian; baris titipan "in package No. 22" tidak menambah jumlah paket.
assert.equal(entry.logistics.koli.totalCount, 2)

// Barang terisi tetapi tak lolos skema (quantity kosong) tidak disimpan dan dilaporkan.
const invalid = emptyRow('r2')
invalid.name = 'PT BARU'
invalid.cases[0].label = '1'
invalid.cases[0].items[0].uraian = 'LAPTOP'
const invalidResult = rowToScanEntry(invalid)!
assert.equal(invalidResult.invalidItems, 1)
assert.equal(invalidResult.entry.items.length, 0)
assert.equal(invalidResult.entry.logistics.koli.details.length, 1)

// Tanpa nama exhibitor: tidak ada entri.
assert.equal(rowToScanEntry(emptyRow('r3')), null)

// Gerbang "Tambah exhibitor" dan jumlah rincian.
assert.equal(isRowFilled(emptyRow('r4')), false)
const typed = emptyRow('r5')
typed.cases[0].items[0].disposisi = 'DISPOSED'
assert.equal(isRowFilled(typed), true)
// Jumlah turunan: titipan ("in package No. 22") tidak menambah paket; rentang "7-11" bernilai 5.
assert.deepEqual(rowSums(scanned), { packages: 2, cbm: 0.125, gross: 150, net: 120 })
const ranged = emptyRow('r6')
ranged.cases[0].label = '7-11'
ranged.cases.push({ ...ranged.cases[0], label: '12' })
assert.equal(rowSums(ranged).packages, 6)
assert.equal(rowSums(emptyRow('r7')).packages, 0)

// Remark: bawaan non-disposal (scan "tidak disebut" ikut bawaan); Total price kosong = Qty × Price.
assert.equal(emptyRow('r9').cases[0].items[0].disposisi, 'RE_EXPORT')
assert.equal(isRowFilled(emptyRow('r10')), false)
assert.equal(rowFromScan('r11', { name: 'X', jobNo: null, logistics, items: [barang('A', 'PKG 1')] }).cases[0].items[0].disposisi, 'RE_EXPORT')
const priced = emptyRow('r12')
priced.name = 'PT HARGA'
Object.assign(priced.cases[0].items[0], { uraian: 'Kabel', jumlah: '3', nilaiSatuan: '12.5' })
assert.equal(autoTotalPrice(priced.cases[0].items[0]), 37.5)
assert.equal(rowToScanEntry(priced)!.entry.items[0].nilaiTotal, 37.5)
priced.cases[0].items[0].nilaiTotal = '40'
assert.equal(rowToScanEntry(priced)!.entry.items[0].nilaiTotal, 40)
assert.equal(autoTotalPrice({ jumlah: '3', nilaiSatuan: '' }), null)

// CBM kosong dihitung dari L × W × H; yang diketik operator menang.
const auto = emptyRow('r8')
auto.name = 'PT AUTO'
auto.cases[0] = { ...auto.cases[0], label: '1', length: '100', width: '50', height: '25', grossWeight: '40', netWeight: '35' }
assert.equal(rowToScanEntry(auto)!.entry.logistics.koli.details[0].volumeCbm, 0.125)
assert.equal(rowSums(auto).cbm, 0.125)
auto.cases[0].cbm = '0.2'
assert.equal(rowToScanEntry(auto)!.entry.logistics.koli.details[0].volumeCbm, 0.2)
assert.equal(rowSums(auto).cbm, 0.2)

// Total yang disebut dokumen lama (scan) tidak pernah dibawa — selalu dari rincian.
const afterScan = rowToScanEntry(auto)!.entry.logistics.koli
assert.equal(afterScan.totalCount, 1)
assert.ok(afterScan.totalWeightKg == null)
assert.ok(afterScan.totalNetWeightKg == null)
assert.ok(afterScan.totalVolumeCbm == null)
