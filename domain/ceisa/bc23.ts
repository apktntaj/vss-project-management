import { z } from 'zod'

export const BC23_SCHEMA = {
  documentType: 'BC_2_3' as const,
  documentCode: '23' as const,
  source: 'CEISA_PORTAL' as const,
  versionLabel: '0.8' as const,
}

export const bc23RequiredPaths = [
  'asalData',
  'asuransi',
  'bruto',
  'cif',
  'fob',
  'freight',
  'hargaPenyerahan',
  'jabatanTtd',
  'jumlahKontainer',
  'kodeAsuransi',
  'kodeDokumen',
  'kodeIncoterm',
  'kodeKantor',
  'kodeKantorBongkar',
  'kodePelBongkar',
  'kodePelMuat',
  'kodePelTransit',
  'kodeTps',
  'kodeTujuanTpb',
  'kodeTutupPu',
  'kodeValuta',
  'kotaTtd',
  'namaTtd',
  'ndpbm',
  'netto',
  'nilaiBarang',
  'nomorAju',
  'nomorBc11',
  'posBc11',
  'seri',
  'subposBc11',
  'tanggalBc11',
  'tanggalTiba',
  'tanggalTtd',
  'biayaTambahan',
  'biayaPengurang',
  'barang',
  'entitas',
  'kemasan',
  'dokumen',
  'pengangkut',
] as const

export type Bc23RequiredPath = (typeof bc23RequiredPaths)[number]
export type Bc23ManualField = {
  path: Bc23RequiredPath
  label: string
  kind: 'text' | 'number' | 'date' | 'json'
  description: string
}
export const bc23ManualFields: readonly Bc23ManualField[] = [
  { path: 'asuransi', label: 'Nilai asuransi', kind: 'number', description: 'Nilai asuransi yang berlaku untuk dokumen ini.' },
  { path: 'bruto', label: 'Berat bruto', kind: 'number', description: 'Berat bruto dalam kilogram.' },
  { path: 'cif', label: 'Nilai CIF', kind: 'number', description: 'Nilai CIF sesuai dokumen kepabeanan.' },
  { path: 'fob', label: 'Nilai FOB', kind: 'number', description: 'Nilai FOB sesuai dokumen kepabeanan.' },
  { path: 'freight', label: 'Freight', kind: 'number', description: 'Biaya pengangkutan.' },
  { path: 'hargaPenyerahan', label: 'Harga penyerahan', kind: 'number', description: 'Nilai harga penyerahan.' },
  { path: 'jabatanTtd', label: 'Jabatan penandatangan', kind: 'text', description: 'Jabatan pihak yang menandatangani.' },
  { path: 'jumlahKontainer', label: 'Jumlah kontainer', kind: 'number', description: 'Jumlah kontainer untuk pengiriman.' },
  { path: 'kodeAsuransi', label: 'Kode asuransi', kind: 'text', description: 'Gunakan kode referensi CEISA yang sudah diverifikasi.' },
  { path: 'kodeIncoterm', label: 'Kode Incoterm', kind: 'text', description: 'Kode Incoterm yang berlaku.' },
  { path: 'kodeKantor', label: 'Kode kantor pabean', kind: 'text', description: 'Kode referensi CEISA; jangan masukkan nama kantor.' },
  { path: 'kodeKantorBongkar', label: 'Kode kantor bongkar', kind: 'text', description: 'Kode referensi CEISA; jangan masukkan nama kantor.' },
  { path: 'kodePelBongkar', label: 'Kode pelabuhan bongkar', kind: 'text', description: 'Kode referensi CEISA; jangan masukkan nama pelabuhan.' },
  { path: 'kodePelMuat', label: 'Kode pelabuhan muat', kind: 'text', description: 'Kode referensi CEISA; jangan masukkan nama pelabuhan.' },
  { path: 'kodePelTransit', label: 'Kode pelabuhan transit', kind: 'text', description: 'Kode referensi CEISA; jangan masukkan nama pelabuhan.' },
  { path: 'kodeTps', label: 'Kode TPS', kind: 'text', description: 'Kode referensi TPS dari CEISA.' },
  { path: 'kodeTujuanTpb', label: 'Kode tujuan TPB', kind: 'text', description: 'Kode referensi tujuan TPB dari CEISA.' },
  { path: 'kodeTutupPu', label: 'Kode tutup PU', kind: 'text', description: 'Kode penutupan PU bila berlaku.' },
  { path: 'kodeValuta', label: 'Kode valuta', kind: 'text', description: 'Kode mata uang yang berlaku.' },
  { path: 'kotaTtd', label: 'Kota penandatangan', kind: 'text', description: 'Kota pada tanda tangan dokumen.' },
  { path: 'namaTtd', label: 'Nama penandatangan', kind: 'text', description: 'Nama pihak yang menandatangani.' },
  { path: 'ndpbm', label: 'NDPBM', kind: 'number', description: 'Nilai NDPBM yang berlaku.' },
  { path: 'netto', label: 'Berat netto', kind: 'number', description: 'Berat netto dalam kilogram.' },
  { path: 'nilaiBarang', label: 'Nilai barang', kind: 'number', description: 'Nilai barang sesuai dokumen kepabeanan.' },
  { path: 'nomorAju', label: 'Nomor aju', kind: 'text', description: 'Nomor aju yang telah ditetapkan.' },
  { path: 'nomorBc11', label: 'Nomor BC 1.1', kind: 'text', description: 'Nomor BC 1.1.' },
  { path: 'posBc11', label: 'Pos BC 1.1', kind: 'text', description: 'Pos BC 1.1.' },
  { path: 'seri', label: 'Seri', kind: 'text', description: 'Nomor seri dokumen.' },
  { path: 'subposBc11', label: 'Subpos BC 1.1', kind: 'text', description: 'Subpos BC 1.1.' },
  { path: 'tanggalBc11', label: 'Tanggal BC 1.1', kind: 'date', description: 'Tanggal BC 1.1.' },
  { path: 'tanggalTiba', label: 'Tanggal tiba', kind: 'date', description: 'Tanggal kedatangan.' },
  { path: 'tanggalTtd', label: 'Tanggal penandatangan', kind: 'date', description: 'Tanggal dokumen ditandatangani.' },
  { path: 'biayaTambahan', label: 'Biaya tambahan', kind: 'number', description: 'Biaya tambahan jika berlaku.' },
  { path: 'biayaPengurang', label: 'Biaya pengurang', kind: 'number', description: 'Biaya pengurang jika berlaku.' },
  { path: 'barang', label: 'Barang', kind: 'json', description: 'Masukkan array JSON barang bila tidak dapat diekstrak.' },
  { path: 'entitas', label: 'Entitas', kind: 'json', description: 'Masukkan array JSON entitas bila tidak dapat diekstrak.' },
  { path: 'kemasan', label: 'Kemasan', kind: 'json', description: 'Masukkan array JSON kemasan bila tidak dapat diekstrak.' },
  { path: 'dokumen', label: 'Dokumen pendukung', kind: 'json', description: 'Masukkan array JSON dokumen bila tidak dapat diekstrak.' },
  { path: 'pengangkut', label: 'Pengangkut', kind: 'json', description: 'Masukkan array JSON pengangkut bila tidak dapat diekstrak.' },
]
export type Bc23DraftStatus = 'DRAFT_INCOMPLETE' | 'LOCALLY_VALID'
export type Bc23Provenance = 'INVOICE' | 'TRANSPORT' | 'CONSTANT' | 'MANUAL' | 'CEISA_REFERENCE'

export type Bc23DraftIssue = {
  severity: 'ERROR' | 'WARNING'
  code: 'REQUIRED_FIELD_MISSING' | 'SOURCE_CONFLICT' | 'ITEM_TOTAL_MISMATCH'
  path: string
  message: string
}

export type Bc23Draft = Record<string, unknown> & {
  asalData: 'S'
  kodeDokumen: '23'
  barang: Array<Record<string, unknown>>
  entitas: Array<Record<string, unknown>>
  kemasan: Array<Record<string, unknown>>
  dokumen: Array<Record<string, unknown>>
  pengangkut: Array<Record<string, unknown>>
}

export const bc23DraftIssueSchema = z.object({
  severity: z.enum(['ERROR', 'WARNING']),
  code: z.enum(['REQUIRED_FIELD_MISSING', 'SOURCE_CONFLICT', 'ITEM_TOTAL_MISMATCH']),
  path: z.string().min(1),
  message: z.string().min(1),
})

export const bc23DraftSchema = z.object({
  asalData: z.literal('S'),
  kodeDokumen: z.literal('23'),
  barang: z.array(z.record(z.unknown())),
  entitas: z.array(z.record(z.unknown())),
  kemasan: z.array(z.record(z.unknown())),
  dokumen: z.array(z.record(z.unknown())),
  pengangkut: z.array(z.record(z.unknown())),
}).passthrough()
