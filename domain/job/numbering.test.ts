import assert from 'node:assert/strict'

import { formatJobNumber, jobFileName, jobLabel, suggestNextManifestSeq } from './numbering'

assert.equal(formatJobNumber('S', 1, '234YFN'), 'S.01/234YFN')
assert.equal(formatJobNumber('ATA', 3, 'INV-9'), 'ATA.03/INV-9')
assert.equal(formatJobNumber('L', 12, null), 'L.12')
assert.equal(formatJobNumber('A', 100, ' X '), 'A.100/X')
// Tanpa awalan (jalur TPPB belum diisi) atau tanpa urutan → belum ada No Job.
assert.equal(formatJobNumber(null, 1, '234YFN'), null)
assert.equal(formatJobNumber('S', null, '234YFN'), null)

assert.equal(suggestNextManifestSeq([]), 1)
assert.equal(suggestNextManifestSeq([1, 2, null, 5]), 6)

// Label: No Job bila ada; awalan + strip bila urutan belum diisi; "Belum bernomor" tanpa awalan.
assert.equal(jobLabel({ jobNumber: 'S.01/234YFN', manifestPrefix: 'S' }), 'S.01/234YFN')
assert.equal(jobLabel({ jobNumber: null, manifestPrefix: 'T' }), 'T.-')
assert.equal(jobLabel({ jobNumber: null, manifestPrefix: null }), 'Belum bernomor')

// Nama file: "/" dari akhiran invoice tidak boleh masuk nama file; job tanpa urutan memakai nama pihak.
const party = { name: 'Shenzhen Bobon' }
assert.equal(
  jobFileName({ jobNumber: 'S.01/234YFN', manifestPrefix: 'S', party }, 'BC-2-3', 'xlsx'),
  'BC-2-3-S.01-234YFN.xlsx',
)
assert.equal(
  jobFileName({ jobNumber: null, manifestPrefix: 'S', party }, 'BC-2-3', 'xlsx'),
  'BC-2-3-S.- Shenzhen Bobon.xlsx',
)

console.log('job numbering passed')
