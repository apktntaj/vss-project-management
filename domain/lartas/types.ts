// Bentuk respons `/api/lartas` yang dipakai UI. Tipe saja (tanpa server-only) supaya aman diimpor
// dari komponen client; logika sumber ada di `lib/insw-lartas.ts`.

export type LartasDetail = {
  idDokumen: string | null
  kodeIzin: string | null
  namaIzin: string | null
  komoditi: string | null
  noSkep: string | null
  uraianBarangSkep: string | null
  tanggalMulai: string | null
  tanggalAkhir: string | null
  link: string | null
}

export type LartasLookupStatus = 'found' | 'not-found' | 'invalid' | 'source-error'

export type LartasResult = {
  hsCode: string
  formattedHsCode: string
  lookupStatus: LartasLookupStatus
  dataSource: 'insw-cms' | 'insw-public-list' | null
  tariffs: { bm: string | null; ppn: string | null; pph: string | null; pphNonApi: string | null }
  lartas: {
    verification: 'verified' | 'unverified'
    import: boolean
    border: boolean
    postBorder: boolean
    export: boolean
    importDetails: LartasDetail[]
    borderDetails: LartasDetail[]
    postBorderDetails: LartasDetail[]
    exportDetails: LartasDetail[]
  }
  error: string | null
}

export type LartasResponse = { notice: string; results: LartasResult[] }

/** Batas jumlah HS code per permintaan `/api/lartas`. */
export const LARTAS_MAX_CODES_PER_REQUEST = 20
