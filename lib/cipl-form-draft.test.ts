import assert from 'node:assert/strict'

import type { BarisBarang } from '@/domain/exhibition/cipl-document'
import type { ExhibitorLogistics } from '@/domain/job/manifest'
import type { JobCiplLine } from '@/domain/job/types'
import { autoTotalPrice, documentTotals, emptyRow, isRowFilled, rowFromJobLine, rowFromScan, rowSums, rowToScanEntry } from './cipl-form-draft'

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

// Total level dokumen: penjumlahan semua baris + barang belum terpetakan dari scan
// (priced memakai total yang diketik operator: 40, bukan 37.5 otomatis).
assert.deepEqual(documentTotals([scanned, priced], [{ nilaiTotal: 10 }]), {
  amount: 50,
  packages: 2,
  cbm: 0.125,
  gross: 150,
  net: 120,
})
assert.deepEqual(documentTotals([]), { amount: 0, packages: 0, cbm: 0, gross: 0, net: 0 })

// Edit CIPL tersimpan: baris dibuka kembali apa adanya (case dari koli, barang lewat refKoliIds),
// lalu simpan ulang mempertahankan isinya.
const storedLine: JobCiplLine = {
  id: 'line-1',
  exhibitorId: 'ex-1',
  exhibitor: { id: 'ex-1', name: 'PT MAJU', hall: 'B1', booth: 'D035' },
  nameOnDocument: 'PT MAJU JAYA',
  koli: {
    totalCount: 2,
    bareCaseCount: 1,
    totalWeightKg: 150,
    totalNetWeightKg: 120,
    details: [
      { id: 'k1', label: 'PKG 1', dimension: { lengthCm: 100, widthCm: 50, heightCm: 25 }, volumeCbm: 0.125, weightKg: 80, netWeightKg: 70, satuanKemasan: 'CARTON' },
      { id: 'k2', label: 'PKG 2', dimension: null, volumeCbm: null, weightKg: 70, netWeightKg: 50 },
    ],
  },
  items: [
    barang('PRINTER', 'PKG 1', { refKoliIds: ['k1'], kodeHs: '84716040', merekModel: 'HP' }),
    barang('SPARE', null),
  ],
  notes: [{ kind: 'ANOMALI_BARANG', text: 'Kardus penyok' }],
}
const editing = rowFromJobLine('line-1', storedLine)
assert.equal(editing.sourceLineId, 'line-1')
assert.equal(editing.name, 'PT MAJU')
assert.equal(editing.bareCase, '1')
assert.deepEqual(editing.cases.map((entry) => entry.label), ['PKG 1', 'PKG 2', ''])
assert.deepEqual(editing.cases[0].items.map((item) => item.uraian), ['PRINTER'])
assert.equal(editing.cases[1].items.length, 1) // case tanpa barang tetap punya satu baris kosong
assert.deepEqual(editing.cases[2].items.map((item) => item.uraian), ['SPARE'])

const resaved = rowToScanEntry(editing)!
assert.equal(resaved.invalidItems, 0)
assert.deepEqual(resaved.entry.items.map((item) => item.uraian), ['PRINTER', 'SPARE'])
assert.equal(resaved.entry.items[0].kodeHs, '84716040')
assert.equal(resaved.entry.items[0].merekModel, 'HP')
assert.equal(resaved.entry.items[0].refKoli, 'PKG 1')
assert.deepEqual(resaved.entry.items[0].refKoliIds, [resaved.entry.logistics.koli.details[0].id])
assert.deepEqual(resaved.entry.items[1].refKoliIds, [])
assert.deepEqual(resaved.entry.logistics.notes, [{ kind: 'ANOMALI_BARANG', text: 'Kardus penyok' }])
assert.equal(resaved.entry.logistics.koli.totalCount, 2)

// Data lama tanpa id koli: barang tetap masuk case-nya lewat label `refKoli`.
const legacy = rowFromJobLine('line-2', {
  ...storedLine,
  id: 'line-2',
  koli: {
    totalCount: 1,
    bareCaseCount: null,
    totalWeightKg: null,
    totalNetWeightKg: null,
    details: [{ label: 'PKG 9', dimension: null, volumeCbm: null, weightKg: null, netWeightKg: null }],
  },
  items: [barang('MONITOR', 'PKG 9', { refKoliIds: ['k1'] })],
  notes: [],
})
assert.deepEqual(legacy.cases.map((entry) => entry.label), ['PKG 9'])
assert.deepEqual(legacy.cases[0].items.map((item) => item.uraian), ['MONITOR'])
