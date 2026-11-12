import { describe, expect, test } from 'bun:test'

import { buildBtkiCandidates, formatBtkiCode, formatHsInvoice, hsPrefix, lexicalMatch, type BtkiRow } from './btki-match'

// Potongan nyata BTKI 8504.40 dari INSW: baris 85044010 adalah judul kelompok (tidak bisa dipakai).
const rows: BtkiRow[] = [
  { id: 1, code: '850440', declarable: true, uraianId: '- Konverter statik :', uraianEn: '- Static converters :' },
  { id: 2, code: '85044010', declarable: false, uraianId: '- - Untuk mesin pengolah data otomatis :', uraianEn: '- - For automatic data processing machines :' },
  { id: 3, code: '85044011', declarable: true, uraianId: '- - - Uninterruptible power supplies (UPS)', uraianEn: '- - - Uninterruptible power supplies (UPS)' },
  { id: 4, code: '85044019', declarable: true, uraianId: '- - - Lain-lain', uraianEn: '- - - Other' },
  { id: 5, code: '85044030', declarable: true, uraianId: '- - Rectifier lainnya', uraianEn: '- - Other rectifiers' },
  { id: 6, code: '85044040', declarable: true, uraianId: '- - Inverter', uraianEn: '- - Inverters' },
  { id: 7, code: '85044090', declarable: true, uraianId: '- - Lain-lain', uraianEn: '- - Other' },
]

describe('hsPrefix', () => {
  test('memotong HS lebih dari 6 digit ke 6 digit pertama', () => {
    expect(hsPrefix('8504.40.90.00')).toEqual({ prefix: '850440', truncated: true })
    expect(hsPrefix('85044090')).toEqual({ prefix: '850440', truncated: true })
    expect(hsPrefix('8504.40')).toEqual({ prefix: '850440', truncated: false })
  })
  test('pos 4–5 digit dicari per pos; kurang dari itu tidak dicari', () => {
    expect(hsPrefix('8504')).toEqual({ prefix: '8504', truncated: false })
    expect(hsPrefix('85')).toEqual({ prefix: null, truncated: false })
    expect(hsPrefix(null)).toEqual({ prefix: null, truncated: false })
  })
})

describe('buildBtkiCandidates', () => {
  const candidates = buildBtkiCandidates([...rows].reverse(), '850440')

  test('hanya pos 8 digit yang bisa dipakai, urut BTKI', () => {
    expect(candidates.map((entry) => entry.code)).toEqual(['85044011', '85044019', '85044030', '85044040', '85044090'])
    expect(candidates[0].formatted).toBe('8504.40.11')
  })
  test('jalur uraian mengikuti kedalaman tanda "-"', () => {
    expect(candidates[0].pathEn).toEqual(['Static converters', 'For automatic data processing machines', 'Uninterruptible power supplies (UPS)'])
    expect(candidates[4].pathId).toEqual(['Konverter statik', 'Lain-lain'])
  })
  test('awalan lain tidak ikut', () => {
    expect(buildBtkiCandidates(rows, '850431')).toEqual([])
  })
})

describe('lexicalMatch', () => {
  const candidates = buildBtkiCandidates(rows, '850440')

  test('kata pada uraian pos menang', () => {
    expect(lexicalMatch('Solar inverter 5kW', candidates).code).toBe('85044040')
    expect(lexicalMatch('UPS uninterruptible power supply 1000VA', candidates)).toMatchObject({ code: '85044011', confidence: 'sedang' })
  })
  test('tanpa kecocokan jatuh ke "Lain-lain" paling umum, keyakinan rendah', () => {
    expect(lexicalMatch('LED driver', candidates)).toMatchObject({ code: '85044090', confidence: 'rendah' })
  })
  test('kandidat tunggal langsung dipakai', () => {
    expect(lexicalMatch('apa saja', candidates.slice(0, 1))).toMatchObject({ code: '85044011', confidence: 'tinggi' })
    expect(lexicalMatch('apa saja', []).code).toBeNull()
  })
})

test('formatBtkiCode', () => {
  expect(formatBtkiCode('85044090')).toBe('8504.40.90')
  expect(formatBtkiCode('850440')).toBe('8504.40')
  expect(formatBtkiCode('8504')).toBe('8504')
})

test('formatHsInvoice: titik setelah 4 digit pertama, lalu 2 digit', () => {
  expect(formatHsInvoice('43040091')).toBe('4304.00.91')
  expect(formatHsInvoice('4304.00.91.00')).toBe('4304.00.9100')
  expect(formatHsInvoice('430400')).toBe('4304.00')
  expect(formatHsInvoice('43040')).toBe('4304.0')
  expect(formatHsInvoice('4304')).toBe('4304')
  expect(formatHsInvoice('')).toBe('')
})
