import assert from 'node:assert/strict'
import { test } from 'bun:test'
import type { JobInvoiceExtraction, JobTransportExtraction } from '@/domain/exhibition/source-documents'
import { completeBc23Draft, createBc23Draft } from './bc23-draft'

const invoice: JobInvoiceExtraction = {
  invoiceNumber: 'INV-001',
  invoiceDate: '2026-10-06',
  seller: { name: 'PT Penjual', address: 'Jakarta', countryCode: 'ID', taxId: '123' },
  buyer: { name: 'Buyer Ltd', address: 'Singapore', countryCode: 'SG', taxId: null },
  currency: 'USD',
  incoterm: 'CIF',
  incotermLocation: null,
  totalAmount: 150,
  freightAmount: 10,
  insuranceAmount: 5,
  totalGrossWeightKg: 120,
  totalNetWeightKg: 100,
  totalPackageCount: 2,
  packageType: 'CT',
  items: [{
    lineNumber: 1,
    itemCode: 'DISPLAY',
    description: 'Display stand',
    hsCode: '94032090',
    quantity: 2,
    unit: 'PCE',
    unitPrice: 75,
    lineTotal: 150,
    currency: 'USD',
    grossWeightKg: 120,
    netWeightKg: 100,
    countryOfOrigin: 'ID',
    packageCount: 2,
    packageType: 'CT',
  }],
}

const transport: JobTransportExtraction = {
  documentNumber: 'BL-001',
  documentDate: '2026-10-05',
  carrier: 'Carrier',
  vesselOrFlight: 'MV Example',
  voyageOrFlightNumber: 'V-01',
  bookingNumber: null,
  shipper: { name: 'PT Penjual', address: 'Jakarta', countryCode: 'ID', taxId: '123' },
  consignee: { name: 'Buyer Ltd', address: 'Singapore', countryCode: 'SG', taxId: null },
  notifyParty: null,
  portOfLoading: 'Tanjung Priok',
  portOfDischarge: 'Singapore',
  placeOfReceipt: null,
  placeOfDelivery: null,
  etd: '2026-10-04',
  eta: '2026-10-08',
  packageCount: 2,
  packageType: 'CT',
  marksAndNumbers: 'MARKS',
  grossWeightKg: 121,
  netWeightKg: 100,
  volumeM3: null,
  containers: [{ containerNumber: 'CONT001', size: '20', type: '1', sealNumber: 'SEAL1' }],
}

test('creates a deterministic incomplete BC 2.3 draft without fabricated reference codes', () => {
  const first = createBc23Draft({ invoice, transport, generatedAt: '2026-10-06T00:00:00.000Z' })
  const second = createBc23Draft({ invoice, transport, generatedAt: '2026-10-06T00:00:00.000Z' })

  assert.deepEqual(first, second)
  assert.equal(first.draft.asalData, 'S')
  assert.equal(first.draft.kodeDokumen, '23')
  assert.equal(first.draft.bruto, 121)
  assert.equal(first.draft.kodePelMuat, null)
  assert.equal(first.provenance.bruto, 'TRANSPORT')
  assert.equal(first.provenance.nilaiBarang, 'INVOICE')
  assert.equal(first.draftStatus, 'DRAFT_INCOMPLETE')
  assert.ok(first.issues.some((issue) => issue.path === 'kodeKantor' && issue.severity === 'ERROR'))
  assert.ok(first.issues.some((issue) => issue.path === 'grossWeight' && issue.code === 'SOURCE_CONFLICT'))
  assert.deepEqual(first.draft.barang, [{
    seriBarang: 1,
    kodeBarang: 'DISPLAY',
    uraian: 'Display stand',
    kodeHs: '94032090',
    jumlahSatuan: 2,
    kodeSatuanBarang: 'PCE',
    hargaSatuan: 75,
    nilaiBarang: 150,
    kodeNegaraAsal: 'ID',
    netto: 100,
    bruto: 120,
    jumlahKemasan: 2,
    kodeJenisKemasan: 'CT',
  }])
})

test('applies manual values locally and recalculates missing field issues', () => {
  const response = createBc23Draft({ invoice, transport, generatedAt: '2026-10-06T00:00:00.000Z' })
  const completed = completeBc23Draft(response, {
    jabatanTtd: 'Manager',
    kodeAsuransi: '0',
    kodeKantor: '040300',
    kodeKantorBongkar: '040300',
    kodePelBongkar: 'IDJKT',
    kodePelMuat: 'SGSIN',
    kodePelTransit: 'SGSIN',
    kodeTps: 'TPS-01',
    kodeTujuanTpb: 'TPB-01',
    kodeTutupPu: '0',
    kotaTtd: 'Jakarta',
    namaTtd: 'Nurul',
    ndpbm: 1,
    nomorAju: '00000000000000000000',
    nomorBc11: '001',
    posBc11: '001',
    seri: '1',
    subposBc11: '0000',
    tanggalBc11: '2026-10-01',
    tanggalTtd: '2026-10-06',
    biayaTambahan: 0,
    biayaPengurang: 0,
  })

  assert.equal(completed.draft.kodeKantor, '040300')
  assert.equal(completed.draft.biayaTambahan, 0)
  assert.equal(completed.provenance.kodeKantor, 'MANUAL')
  assert.ok(!completed.issues.some((issue) => issue.path === 'kodeKantor' && issue.code === 'REQUIRED_FIELD_MISSING'))
  assert.ok(completed.issues.some((issue) => issue.path === 'grossWeight' && issue.code === 'SOURCE_CONFLICT'))
})
