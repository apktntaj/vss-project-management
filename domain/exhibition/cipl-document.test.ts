import assert from 'node:assert/strict'

import { ciplDocumentSchema, totalDokumen, versiCiplSchema } from './cipl-document'

// CIPL S.12/ALP-VPN/2026 (Shanghai Yijia, ALLPACK 2026): 1 dokumen, 6 entri exhibitor,
// TTL 40 PACKAGES (21+2+2+4+2+9). Koli dirinci di dokumen, tetapi untuk blok S.12 pada
// manifest klien hanya total per entri yang tercatat — details boleh kosong.
const s12 = ciplDocumentSchema.parse({
  nomor: 'S.12/ALP-VPN/2026',
  tanggal: '2026-09-12',
  pengirim: {
    name: 'SHANGHAI YIJIA INTERNATIONAL LOGISTICS CO., LTD.',
    address: 'ROOM 429, ASCENDAS PLAZA, NO. 333 TIANYAOQIAO ROAD, XUHUI DISTRICT, SHANGHAI 200030, P.R.CHINA',
    countryCode: 'CN',
    taxId: '91310109572732274D',
  },
  penerima: { name: 'PT. JAKARTA INTERNATIONAL EXPO', countryCode: 'ID', taxId: '0021 9216 3007 3000' },
  namaPameran: 'ALLPACK 2026/ OCT 20-23 2026/ JAKARTA,INDONESIA',
  incoterm: 'CIF',
  mataUang: 'USD',
  infoKontainer: '1*40HC (OOCU8067803)',
  nilaiTotalDeklarasi: 34466.29,
  entri: [
    { namaTertera: 'WUHAN PHEZER TECHNOLOGY., LTD.', hall: 'C3', booth: 'M302', koli: { totalCount: 21, details: [] }, items: [] },
    { namaTertera: 'WUXI BERBICA TECHNOLOGY CO., Ltd', hall: 'B1', booth: 'B055', koli: { totalCount: 2, details: [] }, items: [] },
    { namaTertera: 'FOSHAN TEFUDE AUTOMATION EQUIPMENT CO.,LTD', hall: 'D1', booth: 'DK035', koli: { totalCount: 2, details: [] }, items: [] },
    { namaTertera: 'SHANTOU PENGHUI MACHINERY CO., LTD', hall: 'D2', booth: 'D007-008', koli: { totalCount: 4, details: [] }, items: [] },
    { namaTertera: 'WONCLEAN TECHNOLOGY COMPANY LIMITED', hall: 'C1', booth: 'C035', koli: { totalCount: 2, details: [] }, items: [] },
    { namaTertera: 'WISKIND CLEANROOM', hall: 'D2', booth: 'D010', koli: { totalCount: 9, details: [] }, items: [] },
  ],
})

// Item dengan rentang koli ("7-11") dan rujukan eksplisit ("in package No. 22") —
// RefKoli teks apa adanya; disposisi dari tanda REMARKS per baris.
const itemRange = barisRangeFixture()

function barisRangeFixture() {
  return ciplDocumentSchema.parse({
    nomor: 'S.12/ALP-VPN/2026',
    tanggal: null,
    pengirim: { name: 'SHANGHAI YIJIA INTERNATIONAL LOGISTICS CO., LTD.' },
    penerima: { name: 'PT. JAKARTA INTERNATIONAL EXPO' },
    entri: [
      {
        namaTertera: 'WUHAN PHEZER TECHNOLOGY., LTD.',
        koli: { totalCount: 21, details: [] },
        items: [
          {
            uraian: 'INKJET PRINTER',
            merekModel: 'BRAND:PHEZER MODEL: S1920/PV20/PW-MAX/PRX-1000/P15/P16/PRX-680/P50',
            kodeHs: '84433229',
            jumlah: 13,
            satuan: 'SET',
            nilaiSatuan: 336.0,
            nilaiTotal: 4368.0,
            disposisi: 'RE_EXPORT',
            refKoli: '7-11',
          },
        ],
      },
    ],
    itemsBelumTerpetakan: [
      {
        uraian: 'CATALOGUE',
        kodeHs: '49111090',
        jumlah: 50,
        satuan: 'PCE',
        nilaiSatuan: 0.07,
        nilaiTotal: 3.5,
        disposisi: 'DISPOSED',
        refKoli: 'in package No. 22',
      },
    ],
  })
}

assert.equal(s12.entri.length, 6)
assert.equal(totalDokumen(s12).koli, 40)
assert.equal(totalDokumen(s12).entri, 6)
assert.equal(s12.entri[0].koli.bareCaseCount, null)

assert.equal(itemRange.entri[0].items[0].refKoli, '7-11')
assert.equal(itemRange.itemsBelumTerpetakan[0].disposisi, 'DISPOSED')

// Disposisi tanpa tanda default TIDAK_DISEBUT — baris tidak mewarisi entri di sekitarnya.
const tanpaDisposisi = ciplDocumentSchema.parse({
  nomor: 'X.1',
  tanggal: null,
  pengirim: { name: 'A' },
  penerima: { name: 'B' },
  entri: [{ namaTertera: 'C', koli: { totalCount: 1, details: [] }, items: [{ uraian: 'POSTER', jumlah: 1, satuan: 'SET' }] }],
})
assert.equal(tanpaDisposisi.entri[0].items[0].disposisi, 'TIDAK_DISEBUT')

// CIPL per-exhibitor (praktik lama) = dokumen dengan satu entri — model tanpa asumsi multi.
const satuEntri = ciplDocumentSchema.parse({
  nomor: 'S.01/234YFN/2026',
  tanggal: null,
  pengirim: { name: 'A' },
  penerima: { name: 'B' },
  entri: [{ namaTertera: 'WUHU CHURUI', koli: { totalCount: 3, details: [] }, items: [] }],
})
assert.equal(satuEntri.entri.length, 1)

// Versi immutable: revisi = snapshot baru dengan nomorVersi bertambah.
const versi1 = versiCiplSchema.parse({ nomorVersi: 1, diterimaPada: '2026-09-20', isi: s12, catatanRevisi: null })
const versi2 = versiCiplSchema.parse({ nomorVersi: 2, diterimaPada: '2026-09-25', isi: s12, catatanRevisi: 'tambah koli' })
assert.ok(versi2.nomorVersi > versi1.nomorVersi)
assert.notEqual(versi2, versi1)

// Invalid: jumlah 0, uraian kosong, namaTertera kosong.
assert.throws(() =>
  ciplDocumentSchema.parse({
    nomor: 'X',
    tanggal: null,
    pengirim: { name: 'A' },
    penerima: { name: 'B' },
    entri: [
      { namaTertera: 'C', koli: { totalCount: 1, details: [] }, items: [{ uraian: 'TOOL BOX', jumlah: 0, satuan: 'SET' }] },
    ],
  }),
)
assert.throws(() =>
  ciplDocumentSchema.parse({
    nomor: 'X',
    tanggal: null,
    pengirim: { name: 'A' },
    penerima: { name: 'B' },
    entri: [{ namaTertera: '   ', koli: { totalCount: 1, details: [] }, items: [] }],
  }),
)
assert.throws(() =>
  ciplDocumentSchema.parse({
    nomor: 'X',
    tanggal: null,
    pengirim: { name: 'A' },
    penerima: { name: 'B' },
    entri: [
      { namaTertera: 'C', koli: { totalCount: 1, details: [] }, items: [{ uraian: '  ', jumlah: 1, satuan: 'SET' }] },
    ],
  }),
)
