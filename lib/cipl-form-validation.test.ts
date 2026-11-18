import assert from 'node:assert/strict'

import { emptyItem, emptyRow, type CiplRowDraft } from './cipl-form-draft'
import {
  ciplItemFieldId,
  ciplNameFieldId,
  validateCiplRows,
} from './cipl-form-validation'

const row = (key: string, patch: Partial<CiplRowDraft> = {}): CiplRowDraft => ({
  ...emptyRow(key),
  ...patch,
})

// (1) Satu baris kosong (keadaan awal form) bukan kesalahan.
assert.deepEqual(validateCiplRows([row('a')]).order, [])

// (2) Baris terisi tanpa nama ditandai pada field nama.
const noName = validateCiplRows([row('a', { hall: 'Hall 1' })])
assert.deepEqual(noName.order, [ciplNameFieldId('a')])
assert.equal(noName.errors[ciplNameFieldId('a')], 'Nama exhibitor wajib diisi.')

// (3) Baris kosong di antara baris lain ditandai agar dihapus/diisi, bukan dilewati diam-diam.
const extraEmpty = validateCiplRows([row('a', { name: 'ACME' }), row('b')])
assert.deepEqual(extraEmpty.order, [ciplNameFieldId('b')])

// (4) Barang terisi: deskripsi dan qty wajib; qty harus positif; harga tidak negatif.
const bad = row('a', { name: 'ACME' })
bad.cases[0].items = [
  { ...emptyItem(), kodeHs: '12345678' }, // tanpa deskripsi & qty
  { ...emptyItem(), uraian: 'Kursi', jumlah: '0' },
  { ...emptyItem(), uraian: 'Meja', jumlah: '2', nilaiSatuan: '-1' },
  { ...emptyItem(), uraian: 'Lampu', jumlah: '3', nilaiSatuan: '10' }, // valid
  emptyItem(), // kosong: diabaikan
]
const result = validateCiplRows([bad])
assert.deepEqual(result.order, [
  ciplItemFieldId('a', 0, 0, 'uraian'),
  ciplItemFieldId('a', 0, 0, 'jumlah'),
  ciplItemFieldId('a', 0, 1, 'jumlah'),
  ciplItemFieldId('a', 0, 2, 'nilaiSatuan'),
])
assert.equal(result.errors[ciplItemFieldId('a', 0, 1, 'jumlah')], 'Qty harus lebih dari 0.')

// (5) Data lengkap lolos.
const ok = row('a', { name: 'ACME' })
ok.cases[0].items = [{ ...emptyItem(), uraian: 'Kursi', jumlah: '4' }]
assert.deepEqual(validateCiplRows([ok]).order, [])

console.log('cipl-form-validation: ok')
