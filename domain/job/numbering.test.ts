import assert from 'node:assert/strict'

import { formatJobNumber, suggestNextManifestSeq } from './numbering'

assert.equal(formatJobNumber('S', 1, '234YFN'), 'S.01/234YFN')
assert.equal(formatJobNumber('ATA', 3, 'INV-9'), 'ATA.03/INV-9')
assert.equal(formatJobNumber('LOC', 12, null), 'LOC.12')
assert.equal(formatJobNumber('A', 100, ' X '), 'A.100/X')
// Tanpa awalan (jalur TPPB belum diisi) atau tanpa urutan → belum ada No Job.
assert.equal(formatJobNumber(null, 1, '234YFN'), null)
assert.equal(formatJobNumber('S', null, '234YFN'), null)

assert.equal(suggestNextManifestSeq([]), 1)
assert.equal(suggestNextManifestSeq([1, 2, null, 5]), 6)

console.log('job numbering passed')
