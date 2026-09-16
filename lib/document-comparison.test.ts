import assert from 'node:assert/strict'
import { compareInvoiceWithTransport } from './document-comparison'
import type { JobInvoiceExtraction, JobTransportExtraction } from './data-client'

const invoice: JobInvoiceExtraction = {
  invoiceNumber: null, invoiceDate: null, seller: { name: 'PT. Contoh', address: null, countryCode: null, taxId: null }, buyer: { name: 'Acme Indonesia', address: null, countryCode: null, taxId: null }, currency: null, incoterm: null, incotermLocation: null, totalAmount: null, freightAmount: null, insuranceAmount: null, totalGrossWeightKg: 100, totalNetWeightKg: 90, totalPackageCount: 4, packageType: 'Wooden Case', items: [],
}
const transport: JobTransportExtraction = {
  documentNumber: null, documentDate: null, carrier: null, vesselOrFlight: null, voyageOrFlightNumber: null, bookingNumber: null, shipper: { name: 'PT Contoh', address: null, countryCode: null, taxId: null }, consignee: { name: 'Acme Indonesia', address: null, countryCode: null, taxId: null }, notifyParty: null, portOfLoading: null, portOfDischarge: null, placeOfReceipt: null, placeOfDelivery: null, etd: null, eta: null, packageCount: 4, packageType: 'WOODEN-CASE', marksAndNumbers: null, grossWeightKg: 100.0005, netWeightKg: 88, volumeM3: null, containers: [],
}

const comparison = compareInvoiceWithTransport(invoice, transport)
assert.equal(comparison.find((item) => item.field === 'shipper')?.status, 'MATCH')
assert.equal(comparison.find((item) => item.field === 'grossWeight')?.status, 'MATCH')
assert.equal(comparison.find((item) => item.field === 'netWeight')?.status, 'DIFFERENT')
assert.equal(comparison.find((item) => item.field === 'packageType')?.status, 'MATCH')
