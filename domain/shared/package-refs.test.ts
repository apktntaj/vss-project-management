import assert from 'node:assert/strict'

import { countPackageRefs, parsePackageRef } from './package-refs'

// Bentuk nomor paket yang benar-benar muncul di CIPL S.12/ALP-VPN/2026 dan di laporan
// inward manifest ALLPACK 2026.
assert.deepEqual(parsePackageRef('22'), { count: 1, kind: 'SINGLE', numbers: [22] })
assert.deepEqual(parsePackageRef('PKG 1'), { count: 1, kind: 'SINGLE', numbers: [1] })
assert.deepEqual(parsePackageRef('PK 2'), { count: 1, kind: 'SINGLE', numbers: [2] })
assert.equal(parsePackageRef('7-11').count, 5)
assert.deepEqual(parsePackageRef('7-11').numbers, [7, 8, 9, 10, 11])
assert.equal(parsePackageRef('12-13').count, 2)
assert.equal(parsePackageRef('18-21').count, 4)
// "PKG 3 - 8" pada blok S.08: satu baris, enam paket.
assert.equal(parsePackageRef('PKG 3 - 8').count, 6)
// En dash dari dokumen hasil cetak PDF.
assert.equal(parsePackageRef('PK 18 – 21').count, 4)

// Barang yang dititipkan di koli baris lain BUKAN paket tersendiri — inilah sebab
// WUXI BERBICA tertulis 2 PKG di laporan klien padahal punya tiga baris.
assert.deepEqual(parsePackageRef('in package No. 22'), { count: 0, kind: 'CONTAINED', numbers: [] })
assert.equal(parsePackageRef('in package No. 24').count, 0)
assert.equal(parsePackageRef('in pkg 30').count, 0)

// Kolom jumlah pada inward manifest ("8 PKG", "2 WOODEN CASE" → angka + satuan).
assert.deepEqual(parsePackageRef('8 PKG'), { count: 8, kind: 'QUANTITY', numbers: [] })
assert.equal(parsePackageRef('17 PKG').count, 17)
assert.equal(parsePackageRef('2 CASES').count, 2)

// Label kosong/tak terbaca tetap satu baris koli fisik — tidak boleh mengecilkan total.
assert.deepEqual(parsePackageRef(null), { count: 1, kind: 'UNKNOWN', numbers: [] })
assert.equal(parsePackageRef('   ').count, 1)
assert.equal(parsePackageRef('CASE').count, 1)

// Rentang hasil salah baca tidak diperluas membabi buta.
assert.equal(parsePackageRef('7-11000').count, 1)

// WUHAN PHEZER memegang paket 1..21 lewat baris tunggal dan rentang; laporan klien: 21 PKG.
const phezerLabels = ['1', '2', '3', '4', '5', '6', '7-11', '12-13', '14', '15', '16', '17', '18-21']
assert.equal(countPackageRefs(phezerLabels), 21)

// WISKIND CLEANROOM: sembilan nomor terpisah → 9 PKG.
assert.equal(countPackageRefs(['32', '33', '34', '35', '36', '37', '38', '39', '40']), 9)

// WUXI BERBICA: paket 22 dan 23 plus satu baris titipan → 2 PKG, bukan 3.
assert.equal(countPackageRefs(['22', '23', 'in package No. 22']), 2)

// Nomor yang terulang di halaman lanjutan dihitung sekali.
assert.equal(countPackageRefs(['24', '25', '24']), 2)

console.log('package ref parsing passed')
