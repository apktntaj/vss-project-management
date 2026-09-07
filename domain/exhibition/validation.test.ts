import assert from 'node:assert/strict'
import { validateDateRange, validateJobAllocation, validateShipmentAllocation } from './validation'
import type { CiplVersion, Shipment } from './types'

const version: CiplVersion = { id: 'v1', ciplId: 'c1', versionNumber: 1, receivedAt: '', receivedBy: '', sourceDocumentName: null, sourceDocument: null, revisionNote: null, createdAt: '', items: [{ id: 'i1', lineNumber: 1, description: 'Stand', quantity: 2, unit: 'PCS', unitValue: null, currency: null, grossWeightKg: null, netWeightKg: null, countryOfOrigin: null, identifiers: [], intendedUse: null, intendedDisposal: null }] }
const shipment: Shipment = { id: 's1', ciplId: 'c1', sourceCiplVersionId: 'v1', documentType: 'AWB', documentNumber: 'A', shipmentMode: null, direction: 'IMPORT', shipper: null, consignee: null, notifyParty: null, carrier: null, etaOrEtd: null, origin: null, destination: null, allocations: [{ ciplVersionId: 'v1', ciplItemId: 'i1', quantity: 2, unit: 'PCS' }], attachment: null, status: 'DRAFT', legacyReference: null, createdAt: '', updatedAt: '' }
assert.equal(validateDateRange('2026-09-08', '2026-09-08').ok, true)
assert.equal(validateShipmentAllocation(version, [], [{ ciplVersionId: 'v1', ciplItemId: 'i1', quantity: 3, unit: 'PCS' }]).ok, false)
assert.equal(validateJobAllocation(shipment, [], [{ ciplItemId: 'i1', quantity: 3, unit: 'PCS' }]).ok, false)
console.log('exhibition domain validation passed')
