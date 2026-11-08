import assert from 'node:assert/strict'

import type { LartasDetail, LartasResult } from '@/domain/lartas/types'
import { lartasDocuments, lartasStatus } from './lartas-status'

const detail = (kodeIzin: string | null, namaIzin: string | null): LartasDetail => ({
  idDokumen: null,
  kodeIzin,
  namaIzin,
  komoditi: null,
  noSkep: null,
  uraianBarangSkep: null,
  tanggalMulai: null,
  tanggalAkhir: null,
  link: null,
})

const result = (patch: {
  lookupStatus?: LartasResult['lookupStatus']
  verification?: LartasResult['lartas']['verification']
  import?: boolean
  importDetails?: LartasDetail[]
} = {}): LartasResult => ({
  hsCode: '84713090',
  formattedHsCode: '8471.30.90',
  lookupStatus: patch.lookupStatus ?? 'found',
  dataSource: 'insw-cms',
  tariffs: { bm: null, ppn: null, pph: null, pphNonApi: null },
  lartas: {
    verification: patch.verification ?? 'verified',
    import: patch.import ?? false,
    border: false,
    postBorder: false,
    export: false,
    importDetails: patch.importDetails ?? [],
    borderDetails: [],
    postBorderDetails: [],
    exportDetails: [],
  },
  error: null,
})

// (1) Terverifikasi: ketentuan ada / tidak ada.
assert.equal(lartasStatus(result({ import: true })).key, 'ada')
assert.equal(lartasStatus(result()).key, 'tidak-ada')
assert.equal(lartasStatus(result()).flagged, false)
assert.equal(lartasStatus(result({ import: true })).flagged, true)

// (2) Data publik (belum terverifikasi) tidak boleh diklaim "tidak ada".
{
  const pending = lartasStatus(result({ verification: 'unverified' }))
  assert.equal(pending.key, 'belum-terverifikasi')
  assert.notEqual(pending.label, 'Tidak ada')
  const pendingWithDetail = lartasStatus(
    result({ verification: 'unverified', importDetails: [detail('01', 'Persetujuan Impor')] }),
  )
  assert.equal(pendingWithDetail.flagged, true)
}

// (3) Status non-LARTAS dibedakan supaya tidak terbaca sebagai "aman".
assert.equal(lartasStatus(result({ lookupStatus: 'not-found' })).key, 'tidak-ditemukan')
assert.equal(lartasStatus(result({ lookupStatus: 'invalid' })).key, 'kode-tidak-valid')
assert.equal(lartasStatus(result({ lookupStatus: 'source-error' })).key, 'gagal')

// (4) Dokumen/izin unik menurut kode izin, urutan sumber dipertahankan.
{
  const documents = lartasDocuments(
    result({
      importDetails: [detail('01', 'Persetujuan Impor'), detail('01', 'Persetujuan Impor')],
    }),
  )
  assert.deepEqual(documents.map((entry) => entry.kodeIzin), ['01'])
}
