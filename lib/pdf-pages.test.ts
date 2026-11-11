import assert from 'node:assert/strict'

import { everyPage, parsePageRanges, splitFileName } from './pdf-pages'

const groups = (input: string, count: number) => {
  const result = parsePageRanges(input, count)
  assert.ok(result.ok, result.ok ? '' : result.error)
  return result.groups.map((group) => group.pages)
}

// Rentang, halaman tunggal, dan rentang terbuka.
assert.deepEqual(groups('1-3, 5, 8-', 10), [[1, 2, 3], [5], [8, 9, 10]])
assert.deepEqual(groups('-2', 4), [[1, 2]])
assert.deepEqual(groups(' 2 - 2 ; 4', 4), [[2], [4]])

// Label mengikuti rentang yang sudah dinormalkan.
const labeled = parsePageRanges('3-, 1', 5)
assert.ok(labeled.ok)
assert.deepEqual(
  labeled.groups.map((group) => group.label),
  ['3-5', '1'],
)

// Masukan tidak valid ditolak dengan pesan.
for (const bad of ['', ' , ', 'abc', '-', '0', '3-1', '11', '2-12', '1--2']) {
  assert.equal(parsePageRanges(bad, 10).ok, false, `harus ditolak: "${bad}"`)
}

assert.deepEqual(
  everyPage(3).map((group) => group.pages),
  [[1], [2], [3]],
)

assert.equal(splitFileName('Invoice ABC.PDF', '1-3'), 'Invoice ABC_hal-1-3.pdf')
assert.equal(splitFileName('.pdf', '2'), 'dokumen_hal-2.pdf')
