import assert from 'node:assert/strict'

import { jobJenisListLabel } from './job-jenis'

// Daftar jenis job yang dipegang untuk tabel pengguna di Settings.
assert.equal(jobJenisListLabel([]), '')
assert.equal(jobJenisListLabel(['ROAD_SHIPMENT']), 'Road Shipment')
assert.equal(
  jobJenisListLabel(['ROAD_SHIPMENT', 'PERMANENT_IMPORT']),
  'Road Shipment, Permanent Import (Genco)',
)

console.log('job jenis list label passed')
