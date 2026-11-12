import { describe, expect, test } from 'bun:test'

import { hsCellText, readInvoiceHsItems } from './invoice-hs-items'

describe('hsCellText', () => {
  test('menerima kode 4–12 digit dengan pemisah', () => {
    expect(hsCellText('8504.40.90.00')).toBe('8504.40.90.00')
    expect(hsCellText(85044090)).toBe('85044090')
    expect(hsCellText('8504')).toBe('8504')
  })
  test('angka Excel 8504.4 dipulihkan menjadi 8504.40', () => {
    expect(hsCellText(8504.4)).toBe('8504.40')
  })
  test('teks, tanggal, dan angka pendek bukan HS', () => {
    expect(hsCellText('LED panel')).toBeNull()
    expect(hsCellText(120)).toBeNull()
    expect(hsCellText(new Date())).toBeNull()
    expect(hsCellText(null)).toBeNull()
  })
})

describe('readInvoiceHsItems', () => {
  test('memakai header HS dan uraian, melewati baris di atas header', () => {
    const items = readInvoiceHsItems([
      {
        name: 'Invoice',
        rows: [
          ['COMMERCIAL INVOICE', null, null, null],
          ['No', 'Description of Goods', 'HS Code', 'Qty'],
          [1, 'LED display module P3.9', '8528.59.10.00', 20],
          [2, 'Power  supply unit', 850440, 12345678],
          ['TOTAL', null, null, 32],
        ],
      },
    ])
    expect(items).toEqual([
      { id: '1', sheet: 'Invoice', row: 3, description: 'LED display module P3.9', hsCode: '8528.59.10.00' },
      { id: '2', sheet: 'Invoice', row: 4, description: 'Power supply unit', hsCode: '850440' },
    ])
  })

  test('tanpa header: kolom mirip HS terbanyak dan kolom teks terpanjang', () => {
    const items = readInvoiceHsItems([
      {
        name: 'S1',
        rows: [
          ['A1', 'Aluminium truss 3m', 76109090, 4],
          ['A2', 'Flight case with wheels', 42029990, 2],
        ],
      },
    ])
    expect(items.map((item) => [item.description, item.hsCode])).toEqual([
      ['Aluminium truss 3m', '76109090'],
      ['Flight case with wheels', '42029990'],
    ])
  })

  test('sheet tanpa HS diabaikan', () => {
    expect(readInvoiceHsItems([{ name: 'Kosong', rows: [['Nama', 'Qty'], ['Kursi', 2]] }])).toEqual([])
  })
})
