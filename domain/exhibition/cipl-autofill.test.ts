import assert from 'node:assert/strict'

import { exhibitorLogisticsSchema, summarizeKoli, type ExhibitorLogistics } from '@/domain/job/manifest'
import { resolveCiplAutofill, summarizeAutofill, type CiplScanEntry } from './cipl-autofill'
import type { BarisBarang } from './cipl-document'

/**
 * Fixture dari dokumen nyata: CIPL S.12/ALP-VPN/2026 (SHANGHAI YIJIA, 1x40HC, TTL 40 PACKAGES)
 * berisi ENAM exhibitor. Jumlah paket & berat yang diharapkan diambil dari laporan akhir klien
 * "Exhibits Details For Inward Movement" blok S.12 — jadi test ini mengunci hasil autofill pada
 * angka yang sudah dipakai pelanggan, bukan pada tafsiran kita sendiri.
 */
const koli = (label: string | null, weightKg: number | null) => ({
  label,
  dimension: null,
  volumeCbm: null,
  weightKg,
})

const entry = (
  name: string,
  hall: string | null,
  booth: string | null,
  statedTotalCount: number | null,
  rows: Array<[string | null, number | null]>,
  items: BarisBarang[] = [],
): CiplScanEntry => {
  const details = rows.map(([label, weight]) => koli(label, weight))
  return {
    name,
    statedTotalCount,
    logistics: {
      hall,
      booth,
      // totalCount awal = jumlah baris, seperti yang dikembalikan parser sebelum label dibaca;
      // resolusi yang memperbaikinya.
      koli: { totalCount: details.length, bareCaseCount: null, details },
      notes: [],
    } as ExhibitorLogistics,
    items,
  }
}

// CIPL konsolidasi tidak punya kolom total per exhibitor — hanya footer "TTL: 40 PACKAGES" milik
// seluruh kontainer. Karena itu statedTotalCount = null dan label baris yang berwenang.
const s12: CiplScanEntry[] = [
  entry('WUHAN PHEZER TECHNOLOGY., LTD.', 'C3', 'M302', null, [
    ['1', 24], ['2', 20], ['3', 25], ['4', 23], ['5', 24], ['6', 25],
    ['7-11', 189], ['12-13', 45], ['14', 6], ['15', 20], ['16', 13], ['17', 19], ['18-21', 85],
  ]),
  entry('WUXI BERBICA TECHNOLOGY CO., Ltd', 'B1', 'B055', null, [
    ['22', 600], ['23', 280], ['in package No. 22', null],
  ]),
  entry('FOSHAN TEFUDE AUTOMATION EQUIPMENT CO.,LTD', 'D1', 'DK035', null, [
    ['24', 1200], ['25', 500], ['in package No. 24', 29],
  ]),
  entry('SHANTOU PENGHUI MACHINERY CO., LTD', 'D2', 'D007-008', null, [
    ['26', 1500], ['27', 950], ['28', 400], ['29', 26],
  ]),
  entry('WONCLEAN TECHNOLOGY COMPANY LIMITED', 'C1', 'C035', null, [
    ['30', 179], ['31', 11], ['in package No. 30', null],
  ]),
  entry('WISKIND CLEANROOM', 'D', 'D010', null, [
    ['32', 23], ['33', 17], ['34', 17], ['35', 14], ['36', 14],
    ['37', 14], ['38', 14], ['39', 12], ['40', 4],
  ]),
]

// Tiga exhibitor sudah terdaftar di event (ditulis dengan ejaan yang berbeda), tiga belum.
const pool = [
  { id: 'exh-phezer', name: 'WUHAN PHEZER TECHNOLOGY CO., LTD' },
  { id: 'exh-penghui', name: 'SHANTOU PENGHUI MACHINERY CO.,LTD' },
  { id: 'exh-wiskind', name: 'Wiskind Cleanroom Co., Ltd' },
]

const plan = resolveCiplAutofill(s12, pool)
assert.equal(plan.rows.length, 6, 'satu CIPL konsolidasi = enam peserta')
assert.deepEqual(summarizeAutofill(plan.rows), { total: 6, tertaut: 3, baru: 3, ambigu: 0 })

// Yang tertaut memakai id exhibitor event, dan nama master menang untuk tampilan —
// nama seperti tertera di CIPL tetap disimpan sebagai bukti.
const phezer = plan.rows[0]
assert.equal(phezer.resolution, 'TERTAUT')
assert.equal(phezer.exhibitorId, 'exh-phezer')
assert.equal(phezer.name, 'WUHAN PHEZER TECHNOLOGY CO., LTD')
assert.equal(phezer.namaTertera, 'WUHAN PHEZER TECHNOLOGY., LTD.')

// Jumlah paket per exhibitor = angka pada laporan klien (21/2/2/4/2/9 PKG).
assert.deepEqual(
  plan.rows.map((row) => row.logistics.koli.totalCount),
  [21, 2, 2, 4, 2, 9],
)

// Berat per exhibitor; 880 / 2876 / 190 / 129 persis sama dengan laporan klien.
assert.deepEqual(
  plan.rows.map((row) => summarizeKoli(row.logistics.koli).weightKg),
  [518, 880, 1729, 2876, 190, 129],
)

// Exhibitor yang belum terdaftar dibawa hall/booth-nya sendiri supaya bisa dibuat apa adanya.
const berbica = plan.rows[1]
assert.equal(berbica.resolution, 'BARU')
assert.equal(berbica.exhibitorId, null)
assert.deepEqual([berbica.logistics.hall, berbica.logistics.booth], ['B1', 'B055'])

// Hasil resolusi tetap lolos skema domain (baris titipan tidak melanggar invariant koli).
for (const row of plan.rows) exhibitorLogisticsSchema.parse(row.logistics)

// Nama yang sama muncul dua kali (halaman lanjutan CIPL) digabung menjadi satu peserta.
const terbelah = resolveCiplAutofill(
  [
    entry('WISKIND CLEANROOM', 'D', 'D010', null, [['32', 23], ['33', 17]]),
    entry('Wiskind Cleanroom Co., Ltd.', null, null, null, [['34', 17], ['35', 14]]),
  ],
  [],
)
assert.equal(terbelah.rows.length, 1)
assert.equal(terbelah.rows[0].logistics.koli.totalCount, 4)
assert.equal(summarizeKoli(terbelah.rows[0].logistics.koli).weightKg, 71)
assert.deepEqual(
  [terbelah.rows[0].logistics.hall, terbelah.rows[0].logistics.booth],
  ['D', 'D010'],
  'hall/booth dari entri pertama dipertahankan saat entri lanjutan kosong',
)
assert.ok(terbelah.warnings.some((warning) => warning.includes('digabung')))

// Inward manifest MENYEBUT total per exhibitor, dan total itu menang atas rincian:
// blok S.08 menulis 17 PKG padahal hanya tujuh koli dirinci.
const s08 = resolveCiplAutofill(
  [entry('QINGDAO SOONFORWARD PACKING MACHINERY CO., LTD', 'B1', 'D007', 17, [
    ['PKG 1', 1100], ['PKG 2', 450], ['PKG 3', 1100], ['PKG 4', 400],
    ['PKG 5', 230], ['PKG 6', 280], ['PKG 7', 180],
  ])],
  [],
)
assert.equal(s08.rows[0].logistics.koli.totalCount, 17)

// Master data dengan dua baris untuk satu perusahaan tidak ditebak — ditandai AMBIGU.
const ambigu = resolveCiplAutofill([entry('JWELL', 'B3', 'I314', 1, [['PKG 1', 100]])], [
  { id: 'a', name: 'JWELL' },
  { id: 'b', name: 'Jwell Ltd.' },
])
assert.equal(ambigu.rows[0].resolution, 'AMBIGU')
assert.equal(ambigu.rows[0].exhibitorId, null)
assert.equal(ambigu.rows[0].candidates.length, 2)

// Entri tanpa nama dilewati dengan peringatan, bukan ditulis sebagai exhibitor kosong.
const tanpaNama = resolveCiplAutofill([entry('   ', null, null, null, [['PKG 1', 10]])], [])
assert.equal(tanpaNama.rows.length, 0)
assert.equal(tanpaNama.warnings.length, 1)

console.log('cipl autofill resolution passed')

// Dokumen yang mengulang nomor paket tidak boleh menghasilkan total di bawah jumlah rinciannya.
const terulang = resolveCiplAutofill(
  [entry('QINGDAO FEIFAN PACKING MACHINERY', 'C1', 'C036', null, [['24', 900], ['24', 300]])],
  [],
)
assert.equal(terulang.rows[0].logistics.koli.totalCount, 2)
exhibitorLogisticsSchema.parse(terulang.rows[0].logistics)

console.log('cipl autofill edge cases passed')
