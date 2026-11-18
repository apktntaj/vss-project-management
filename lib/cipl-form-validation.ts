// Validasi draft form CIPL sebelum simpan (murni, tanpa React/IO). Aturannya cermin dari yang
// diterapkan `rowToScanEntry` saat membangun entri: baris/barang yang tidak lolos tidak boleh
// dilewati diam-diam, jadi form menandainya di tempat (aria-invalid) dan memblokir simpan.

import {
  isRowFilled,
  itemFilled,
  numberOrNull,
  type CiplRowDraft,
} from '@/lib/cipl-form-draft'

export type CiplItemField = 'uraian' | 'jumlah' | 'nilaiSatuan' | 'nilaiTotal'

/** id elemen field nama exhibitor; dipakai sebagai target `aria-describedby`/fokus. */
export const ciplNameFieldId = (rowKey: string) => `cipl-${rowKey}-name`

/** id elemen field barang (baris → case → barang → field). */
export const ciplItemFieldId = (
  rowKey: string,
  caseIndex: number,
  itemIndex: number,
  field: CiplItemField,
) => `cipl-${rowKey}-c${caseIndex}-i${itemIndex}-${field}`

export type CiplValidation = {
  /** Pesan kesalahan per id field. */
  errors: Record<string, string>
  /** Id field yang salah, berurutan sesuai tampilan (dokumen); elemen pertama = target fokus. */
  order: string[]
}

export const noCiplErrors: CiplValidation = { errors: {}, order: [] }

export function validateCiplRows(rows: ReadonlyArray<CiplRowDraft>): CiplValidation {
  const errors: Record<string, string> = {}
  const order: string[] = []
  const fail = (id: string, message: string) => {
    errors[id] = message
    order.push(id)
  }
  for (const row of rows) {
    const filled = isRowFilled(row)
    if (!row.name.trim()) {
      // Baris kosong tunggal bukan kesalahan (form memang mulai dari satu baris kosong).
      if (filled) fail(ciplNameFieldId(row.key), 'Nama exhibitor wajib diisi.')
      else if (rows.length > 1)
        fail(ciplNameFieldId(row.key), 'Isi nama exhibitor atau hapus baris ini.')
    }
    row.cases.forEach((draft, caseIndex) => {
      draft.items.forEach((item, itemIndex) => {
        if (!itemFilled(item)) return
        const id = (field: CiplItemField) => ciplItemFieldId(row.key, caseIndex, itemIndex, field)
        if (!item.uraian.trim()) fail(id('uraian'), 'Deskripsi barang wajib diisi.')
        if (!item.jumlah.trim()) fail(id('jumlah'), 'Qty wajib diisi.')
        else {
          const qty = numberOrNull(item.jumlah)
          if (qty === null || qty <= 0) fail(id('jumlah'), 'Qty harus lebih dari 0.')
        }
        for (const field of ['nilaiSatuan', 'nilaiTotal'] as const) {
          const value = numberOrNull(item[field])
          if (value !== null && value < 0) fail(id(field), 'Tidak boleh negatif.')
        }
      })
    })
  }
  return { errors, order }
}
