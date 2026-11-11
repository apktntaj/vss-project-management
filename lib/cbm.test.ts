import assert from 'node:assert/strict'

import { computeCbm, parseDecimal } from './cbm'

const near = (actual: number | null, expected: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`)

// Koma dan titik desimal diterima; teks lain ditolak.
assert.equal(parseDecimal(''), null)
assert.equal(parseDecimal(' 12,5 '), 12.5)
assert.equal(parseDecimal('12.5'), 12.5)
assert.ok(Number.isNaN(parseDecimal('12a')))
assert.ok(Number.isNaN(parseDecimal('-3')))

// Dimensi yang sama secara fisik menghasilkan CBM yang sama di tiap satuan.
near(computeCbm({ length: '120', width: '80', height: '100' }, 'cm'), 0.96)
near(computeCbm({ length: '1200', width: '800', height: '1000' }, 'mm'), 0.96)
near(computeCbm({ length: '1,2', width: '0.8', height: '1' }, 'm'), 0.96)
near(computeCbm({ length: '10', width: '10', height: '10' }, 'in'), 1000 * 0.0254 ** 3)

// Dimensi kosong, nol, atau tidak sah tidak menghasilkan angka.
assert.equal(computeCbm({ length: '', width: '80', height: '100' }, 'cm'), null)
assert.equal(computeCbm({ length: '0', width: '80', height: '100' }, 'cm'), null)
assert.equal(computeCbm({ length: '10x', width: '80', height: '100' }, 'cm'), null)
