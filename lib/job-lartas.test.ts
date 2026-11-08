import assert from 'node:assert/strict'

import { chunkHsCodes, collectJobHsCodes, formatHsCode, normalizeHsCode } from './job-lartas'

const item = (uraian: string, kodeHs: string | null) => ({ uraian, kodeHs })
const line = (...items: ReturnType<typeof item>[]) => ({ items }) as Parameters<typeof collectJobHsCodes>[0][number]

// (1) formatHsCode memformat 8 digit dan membiarkan nilai lain.
assert.equal(formatHsCode('84713090'), '8471.30.90')
assert.equal(formatHsCode('8471'), '8471')

// (2) Normalisasi, dedup, dan pengumpulan pemakaian.
{
  const result = collectJobHsCodes([
    line(item('Laptop', '8471.30.90'), item('Kabel', '8544.42.99')),
    line(item('Laptop B', '84713090')),
  ])
  assert.deepEqual(result.valid.map((code) => code.hsCode), ['84713090', '85444299'])
  assert.equal(result.valid[0].usages.length, 2)
  assert.equal(result.valid[0].formatted, '8471.30.90')
  assert.equal(result.missingCount, 0)
}

// (3) Kode tidak valid dan baris tanpa HS dipisahkan.
{
  const result = collectJobHsCodes([line(item('A', '8471'), item('B', null), item('C', '  '), item('D', '8471'))])
  assert.deepEqual(result.valid, [])
  assert.deepEqual(result.invalid, ['8471'])
  assert.equal(result.missingCount, 2)
}

// (4) Invoice hanya dipakai bila CIPL kosong.
{
  const invoice = [{ description: 'Chair', hsCode: '9401.61.00' }]
  assert.equal(collectJobHsCodes([], invoice).valid[0].usages[0].source, 'INVOICE')
  assert.equal(collectJobHsCodes([line(item('Laptop', '8471.30.90'))], invoice).valid.length, 1)
}

// (5) chunkHsCodes memecah per 20.
{
  const codes = Array.from({ length: 45 }, (_, index) => String(index).padStart(8, '0'))
  assert.deepEqual(chunkHsCodes(codes).map((chunk) => chunk.length), [20, 20, 5])
  assert.deepEqual(chunkHsCodes([]), [])
}

// (6) Pos tarif 10 digit (8 digit BTKI + 2 digit fasilitas) diperiksa memakai 8 digit pertama,
// dan digabung dengan baris yang sudah menulis 8 digit.
{
  const result = collectJobHsCodes([
    line(item('Mesin A', '8428.33.00.00'), item('Mesin B', '84283300'), item('Mesin C', '8428 33 00 90')),
    line(item('Enam digit', '842833')),
  ])
  assert.deepEqual(result.valid.map((code) => code.hsCode), ['84283300'])
  assert.equal(result.valid[0].usages.length, 3)
  assert.deepEqual(result.truncated, ['8428.33.00.00', '8428 33 00 90'])
  assert.deepEqual(result.invalid, ['842833'])
  assert.equal(result.missingCount, 0)
}

// (7) normalizeHsCode: 8 digit apa adanya, 10 digit dipotong, sisanya null.
{
  assert.deepEqual(normalizeHsCode('8471.30.90'), { digits: '84713090', truncatedFrom: null })
  assert.deepEqual(normalizeHsCode('3920109090'), { digits: '39201090', truncatedFrom: '3920109090' })
  assert.equal(normalizeHsCode('847130'), null)
  assert.equal(normalizeHsCode('   '), null)
  assert.equal(normalizeHsCode(null), null)
}
