import assert from 'node:assert/strict'

import { columnLetter, scanHsColumns, uniqueHsCodes } from './lartas-sheet'

// (1) Kolom ber-header HS dipilih, 8 digit/bertitik/10 digit diterima, teks lain diabaikan.
{
  const scan = scanHsColumns([
    {
      name: 'Invoice',
      rows: [
        ['No', 'Uraian', 'HS Code', 'Qty'],
        [1, 'Mesin', 84283300, 2],
        [2, 'Kabel', '8544.49.29', 100],
        [3, 'Kemasan', 3920109090, 500],
        [4, 'Katalog', 'Tanpa HS', 1],
        [5, 'Enam digit', '842833', 1],
      ],
    },
  ])

  assert.deepEqual(scan.columns, [{ sheet: 'Invoice', column: 'C', header: 'HS Code', found: 3 }])
  assert.deepEqual(
    scan.rows.map((row) => [row.row, row.hsCode]),
    [
      [2, '84283300'],
      [3, '85444929'],
      [4, '39201090'],
    ],
  )
  assert.deepEqual(uniqueHsCodes(scan), ['84283300', '85444929', '39201090'])
  assert.equal(scan.skipped, 1)
}

// (2) Header yang menyebut HS menang atas kolom lain berisi lebih banyak angka 8 digit.
{
  const scan = scanHsColumns([
    {
      name: 'Sheet1',
      rows: [
        ['Ref', 'Pos Tarif'],
        [11111111, 84283300],
        [22222222, null],
        [33333333, null],
      ],
    },
  ])
  assert.deepEqual(scan.columns, [{ sheet: 'Sheet1', column: 'B', header: 'Pos Tarif', found: 1 }])
  assert.deepEqual(scan.rows.map((row) => row.hsCode), ['84283300'])
}

// (3) Tanpa petunjuk header, kolom dengan kode terbanyak dipilih (seri → paling kiri).
{
  const scan = scanHsColumns([
    {
      name: 'Data',
      rows: [
        ['A', 'B', 'C'],
        [84283300, 85444929, null],
        [39201090, null, null],
      ],
    },
  ])
  assert.equal(scan.columns[0].column, 'A')
  assert.equal(scan.columns[0].found, 2)
}

// (4) Beberapa sheet: tiap sheet dipindai sendiri; nomor baris mengikuti Excel.
{
  const scan = scanHsColumns([
    { name: 'Jan', rows: [['HS'], [84283300]] },
    { name: 'Feb', rows: [['HS Code'], [null], [85444929]] },
  ])
  assert.deepEqual(scan.columns.map((column) => column.sheet), ['Jan', 'Feb'])
  assert.deepEqual(scan.rows.map((row) => [row.sheet, row.row, row.hsCode]), [
    ['Jan', 2, '84283300'],
    ['Feb', 3, '85444929'],
  ])
}

// (5) Sheet tanpa kolom HS dilewati; huruf kolom mengikuti Excel.
{
  const scan = scanHsColumns([{ name: 'Kosong', rows: [['Nama', 'Qty'], ['A', 2]] }])
  assert.deepEqual(scan.columns, [])
  assert.deepEqual(scan.rows, [])
  assert.equal(columnLetter(0), 'A')
  assert.equal(columnLetter(25), 'Z')
  assert.equal(columnLetter(26), 'AA')
  assert.equal(columnLetter(27), 'AB')
}
