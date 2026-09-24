import assert from 'node:assert/strict'

import { eventInputSchema, exhibitorInputSchema } from './validation'

const contact = { name: null, role: null, email: null, phone: null }

assert.equal(eventInputSchema.safeParse({
  name: 'Vissasa Expo',
  venueId: 'venue-jiexpo',
  eventOrganizerId: 'eo-vissasa',
  startsOn: '2026-10-01',
  endsOn: '2026-10-03',
}).success, true)

assert.equal(eventInputSchema.safeParse({
  name: 'Vissasa Expo',
  venueId: 'b3d6e4c5-1457-4a67-bbad-23778d112240',
  eventOrganizerId: '2a17e637-2c0e-4d43-9e55-85f46bf520f9',
  startsOn: '2026-10-03',
  endsOn: '2026-10-01',
}).success, false)

assert.equal(exhibitorInputSchema.safeParse({ kind: 'LOCAL', name: 'PT Vissasa', contact, agentId: null, npwp: null }).success, true)
assert.equal(exhibitorInputSchema.safeParse({ kind: 'INTERNATIONAL', name: 'Global Display Ltd', contact, agentId: null, npwp: '123' }).success, false)

console.log('event domain validation passed')
