import assert from 'node:assert/strict'

import type { JobTransportExtraction } from '@/domain/exhibition/source-documents'
import {
  applyDocumentExtraction,
  emptyOperationalDetails,
  normalizeOperationalDetails,
} from './operational'
import type { JobOperationalDetails } from './types'

// Operational tanpa key BC_2_7 tetap aman dibaca: dilengkapi default (tidak applicable).
const partial = {
  inbound: { mode: 'SEA', carrier: 'KMTC', scheduleAt: null, actualAt: null },
  customs: {
    BC_3_0: { applicable: true, status: 'RELEASED', ajuNumber: 'AJU-1', registrationNumber: 'NOPEN-1', registrationDate: '2026-09-02', warehouseName: null },
  },
} as unknown as Partial<JobOperationalDetails>
const details = normalizeOperationalDetails(partial)
assert.equal(details.customs.BC_2_7.applicable, false)
assert.equal(details.customs.BC_3_0.status, 'RELEASED')
assert.equal(details.customs.BC_2_3.applicable, true)
assert.equal(details.inbound.carrier, 'KMTC')
assert.deepEqual(details.outbound, { mode: null, carrier: null, scheduleAt: null, actualAt: null })
// Customs tidak lagi membawa billing — satu job satu tagihan.
assert.equal('billing' in details.customs.BC_2_3, false)

const fresh = normalizeOperationalDetails(null)
assert.deepEqual(fresh, emptyOperationalDetails())

// Ekstraksi B/L: nomor & isi mentah menjadi milik job; leg inbound hanya carrier + jadwal.
const transport: JobTransportExtraction = {
  documentNumber: ' HLCU123 ', documentDate: null, carrier: 'Hapag-Lloyd', vesselOrFlight: null,
  voyageOrFlightNumber: null, bookingNumber: null,
  shipper: { name: 'ACME GmbH', address: null, countryCode: 'DE', taxId: null },
  consignee: null, notifyParty: null,
  portOfLoading: null, portOfDischarge: null, placeOfReceipt: null, placeOfDelivery: null,
  etd: null, eta: '2026-10-01', packageCount: null, packageType: null, marksAndNumbers: null,
  grossWeightKg: null, netWeightKg: null, volumeM3: null, containers: [],
}
const empty = { operational: fresh, transportDocumentType: null, commercialInvoiceNumber: null }
const viaBl = applyDocumentExtraction(empty, { transport })
assert.equal(viaBl.fields.transportDocumentType, 'BL')
assert.equal(viaBl.fields.transportDocumentNumber, 'HLCU123')
assert.equal(viaBl.fields.transportDocument, transport)
assert.equal(viaBl.operational.inbound.mode, 'SEA')
assert.equal(viaBl.operational.inbound.carrier, 'Hapag-Lloyd')
assert.equal(viaBl.operational.inbound.scheduleAt, '2026-10-01')

// Jenis eksplisit AWB menang; tanpa jenis eksplisit, jenis yang sudah tercatat di job dipakai.
assert.equal(applyDocumentExtraction(empty, { transport, transportDocumentType: 'AWB' }).fields.transportDocumentType, 'AWB')
assert.equal(applyDocumentExtraction({ ...empty, transportDocumentType: 'AWB' }, { transport }).fields.transportDocumentType, 'AWB')

// Commercial invoice: nomor + baris barang; mengisi akhiran No Job hanya bila job belum punya.
const invoice = {
  invoiceNumber: '234YFN', invoiceDate: null, seller: null, buyer: null, currency: 'USD',
  incoterm: null, incotermLocation: null, totalAmount: 10, freightAmount: null,
  insuranceAmount: null, totalGrossWeightKg: null, totalNetWeightKg: null,
  totalPackageCount: null, packageType: null, items: [],
}
const viaInvoice = applyDocumentExtraction(empty, { invoice })
assert.equal(viaInvoice.operational.invoiceNumber, '234YFN')
assert.equal(viaInvoice.fields.commercialInvoiceNumber, '234YFN')
assert.equal(viaInvoice.fields.transportDocumentNumber, undefined)
const keepExisting = applyDocumentExtraction({ ...empty, commercialInvoiceNumber: 'MANUAL-1' }, { invoice })
assert.equal(keepExisting.fields.commercialInvoiceNumber, undefined)

console.log('job operational details passed')
