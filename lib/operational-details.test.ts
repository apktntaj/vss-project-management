import assert from 'node:assert/strict'

import { getOperationalDetails } from './data-client'

const legacyCustoms = {
  BC_2_3: { applicable: true, status: 'NOT_STARTED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null, billing: { kind: 'NOT_READY' } },
  BC_2_5: { applicable: false, status: 'NOT_STARTED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null, billing: { kind: 'NOT_APPLICABLE', reason: '' } },
  BC_3_0: { applicable: true, status: 'RELEASED', ajuNumber: 'AJU-1', registrationNumber: 'NOPEN-1', registrationDate: '2026-09-02', warehouseName: null, billing: { kind: 'NOT_READY' } },
} as const

// Job lama: objek operational tersimpan sebelum BC_2_7 ada (tanpa key BC_2_7).
const legacyJob = {
  blNumber: 'SHFPSJKT26026454',
  awbNumber: null,
  shippingLine: null,
  operational: {
    inbound: { mode: 'SEA', documentType: 'BL', documentNumber: 'SHFPSJKT26026454', carrier: null, scheduleAt: null, actualAt: null },
    outbound: { mode: null, documentType: null, documentNumber: null, carrier: null, scheduleAt: null, actualAt: null },
    invoiceNumber: null,
    cipl: { status: 'MISSING', referenceNumber: null, receivedAt: null },
    customs: legacyCustoms,
  },
}

const details = getOperationalDetails(legacyJob as unknown as Parameters<typeof getOperationalDetails>[0])

// BC 2.7 dilengkapi default (tidak applicable) — tabel job tak boleh crash membacanya.
assert.equal(details.customs.BC_2_7.applicable, false)
assert.equal(details.customs.BC_2_7.status, 'NOT_STARTED')
// Jenis lama tetap apa adanya.
assert.equal(details.customs.BC_3_0, legacyCustoms.BC_3_0)
assert.equal(details.inbound.documentNumber, 'SHFPSJKT26026454')

// Job tanpa operational tetap mendapat default penuh termasuk BC 2.7.
const fresh = getOperationalDetails({ blNumber: null, awbNumber: null, shippingLine: null })
assert.equal(Object.keys(fresh.customs).length, 4)
assert.equal(fresh.customs.BC_2_7.applicable, false)

console.log('operational details normalization passed')
