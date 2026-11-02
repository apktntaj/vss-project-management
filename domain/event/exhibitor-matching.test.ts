import assert from 'node:assert/strict'

import {
  isSameExhibitorName,
  matchExhibitorByName,
  normalizeExhibitorName,
} from './exhibitor-matching'

// Nama nyata dari CIPL S.12/ALP-VPN/2026 dan laporan inward manifest ALLPACK 2026.
assert.equal(normalizeExhibitorName('WUHAN PHEZER TECHNOLOGY., LTD.'), 'WUHAN PHEZER TECHNOLOGY')
assert.equal(normalizeExhibitorName('WUHAN PHEZER TECHNOLOGY CO., LTD'), 'WUHAN PHEZER TECHNOLOGY')
assert.equal(normalizeExhibitorName('WUXI BERBICA TECHNOLOGY CO., Ltd'), 'WUXI BERBICA TECHNOLOGY')
assert.equal(normalizeExhibitorName('WONCLEAN TECHNOLOGY COMPANY LIMITED'), 'WONCLEAN TECHNOLOGY')
assert.equal(
  normalizeExhibitorName('FOSHAN TEFUDE AUTOMATION EQUIPMENT CO.,LTD'),
  'FOSHAN TEFUDE AUTOMATION EQUIPMENT',
)
assert.equal(normalizeExhibitorName('PT. JAKARTA INTERNATIONAL EXPO'), 'JAKARTA INTERNATIONAL EXPO')
assert.equal(
  normalizeExhibitorName('BIOMATRIX LIFE SCIENCE (QINGDAO) CO.,LTD'),
  'BIOMATRIX LIFE SCIENCE QINGDAO',
)

// Perbedaan yang HANYA tanda baca/bentuk badan hukum = perusahaan yang sama.
assert.ok(isSameExhibitorName('SHANTOU PENGHUI MACHINERY CO., LTD', 'SHANTOU PENGHUI MACHINERY CO.,LTD'))
assert.ok(isSameExhibitorName('WISKIND CLEANROOM', 'Wiskind Cleanroom Co., Ltd.'))
assert.ok(isSameExhibitorName('JWELL', 'JWELL LTD'))

// Kata yang membawa identitas tidak boleh ikut dibuang — dua perusahaan berbeda tetap berbeda.
assert.ok(!isSameExhibitorName('SHANTOU PENGHUI MACHINERY CO., LTD', 'SHANTOU PENGHUI EQUIPMENT CO., LTD'))
assert.ok(!isSameExhibitorName('QINGDAO BOSTAR PACKING MACHINERY', 'QINGDAO FEIFAN PACKING MACHINERY'))
assert.ok(!isSameExhibitorName('', 'WISKIND CLEANROOM'))

// Nama yang hanya berisi token badan hukum menyusut sampai token terakhir dan tetap tidak
// melebur dengan nama lain — tidak pernah menjadi kunci kosong.
assert.equal(normalizeExhibitorName('CO., LTD.'), 'CO')
assert.equal(normalizeExhibitorName('PT.'), 'PT')
assert.ok(!isSameExhibitorName('CO., LTD.', 'PT.'))

const pool = [
  { id: 'exh-phezer', name: 'WUHAN PHEZER TECHNOLOGY CO., LTD' },
  { id: 'exh-penghui', name: 'SHANTOU PENGHUI MACHINERY CO.,LTD' },
  { id: 'exh-wisk', name: 'WISKIND CLEANROOM' },
]

const matched = matchExhibitorByName('WUHAN PHEZER TECHNOLOGY., LTD.', pool)
assert.equal(matched.kind, 'MATCHED')
assert.equal(matched.kind === 'MATCHED' ? matched.exhibitor.id : null, 'exh-phezer')

assert.equal(matchExhibitorByName('WUXI BERBICA TECHNOLOGY CO., Ltd', pool).kind, 'NONE')
assert.equal(matchExhibitorByName('   ', pool).kind, 'NONE')

// Master data yang memuat dua baris untuk satu perusahaan tidak boleh ditebak otomatis.
const ambiguous = matchExhibitorByName('WISKIND CLEANROOM CO., LTD', [
  ...pool,
  { id: 'exh-wisk-dup', name: 'Wiskind Cleanroom' },
])
assert.equal(ambiguous.kind, 'AMBIGUOUS')
assert.equal(ambiguous.kind === 'AMBIGUOUS' ? ambiguous.candidates.length : 0, 2)

console.log('exhibitor name matching passed')
