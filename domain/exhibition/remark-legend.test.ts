import assert from 'node:assert/strict'

import {
  disposisiFromMark,
  disposisiOfMeaning,
  remarkLegendFromEntries,
} from './remark-legend'

// Template VSS: A = re-export, B = disposed, C = give away.
const vssLegend = remarkLegendFromEntries([
  { mark: 'A', meaning: 'RE-EXPORT AFTER EXHIBITION' },
  { mark: 'B', meaning: 'DISPOSED OR CONSUMED' },
  { mark: 'C', meaning: 'GIVE AWAY/SOLD' },
])
assert.equal(disposisiFromMark('A', vssLegend).disposisi, 'RE_EXPORT')
assert.equal(disposisiFromMark('B', vssLegend).disposisi, 'DISPOSED')
assert.equal(disposisiFromMark('C', vssLegend).disposisi, 'GIVE_AWAY')

// CIPL Shanghai Hi-EXPO (job S.01 Trade Show): header "A. 不回运 Not Return" / "B. 回运 Return".
// Huruf yang sama, arti terbalik dari template VSS — regresi bug barang re-ekspor masuk BC 2.5.
const shanghaiLegend = remarkLegendFromEntries([
  { mark: 'A.', meaning: '不回运 Not Return' },
  { mark: 'B.', meaning: '回运 Return' },
])
assert.equal(disposisiFromMark('A', shanghaiLegend).disposisi, 'DISPOSED')
assert.equal(disposisiFromMark('B', shanghaiLegend).disposisi, 'RE_EXPORT')

// Arti sebagian saja yang tercetak (Mandarin atau Inggris saja).
assert.equal(disposisiOfMeaning('不回运'), 'DISPOSED')
assert.equal(disposisiOfMeaning('回运'), 'RE_EXPORT')
assert.equal(disposisiOfMeaning('Non-return'), 'DISPOSED')
assert.equal(disposisiOfMeaning('Return'), 'RE_EXPORT')

// Tanda kosong = tidak disebut; tanda di luar legenda tidak ditebak dan ditandai tak dikenal.
assert.deepEqual(disposisiFromMark(null, vssLegend), { disposisi: 'TIDAK_DISEBUT', known: true })
assert.deepEqual(disposisiFromMark('Z', vssLegend), { disposisi: 'TIDAK_DISEBUT', known: false })

// Tanpa legenda sama sekali, huruf tidak diartikan.
assert.deepEqual(disposisiFromMark('A', remarkLegendFromEntries([])), {
  disposisi: 'TIDAK_DISEBUT',
  known: false,
})

// Arti ambigu atau bertabrakan tidak ditebak; tanda ganda dengan arti berbeda gugur.
assert.equal(disposisiOfMeaning('Return or sold'), 'TIDAK_DISEBUT')
assert.equal(disposisiOfMeaning('lain-lain'), 'TIDAK_DISEBUT')
const conflicting = remarkLegendFromEntries([
  { mark: 'A', meaning: 'Return' },
  { mark: 'A', meaning: 'Not Return' },
])
assert.equal(disposisiFromMark('A', conflicting).disposisi, 'TIDAK_DISEBUT')
