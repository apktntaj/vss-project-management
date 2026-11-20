import assert from 'node:assert/strict'
import {
  UserSchema,
  handledJenisError,
  normalizeHandledJenis,
  userCreateSchema,
  userUpdateSchema,
} from './validation'

const admin = UserSchema.parse({
  nama: 'Admin Demo VSS',
  email: ' ADMIN@VSS.DEMO ',
  password: 'demo-vss-2026',
  isAdmin: true,
  role: 'CS',
})

assert.equal(admin.email, 'admin@vss.demo')
assert.equal(admin.isAdmin, true)
assert.equal(admin.role, 'CS')
assert.equal(UserSchema.safeParse({ ...admin, nama: '' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, email: 'bukan-email' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, password: '' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, role: 'SUPERVISOR' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, role: undefined }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, role: 'FINANCE' }).success, true)

// normalize-handled-jenis
assert.deepEqual(normalizeHandledJenis('CS', ['ROAD_SHIPMENT']), [])
assert.deepEqual(
  normalizeHandledJenis('SPESIALIS', ['ROAD_SHIPMENT', 'ROAD_SHIPMENT', 'PERMANENT_IMPORT']),
  ['ROAD_SHIPMENT', 'PERMANENT_IMPORT'],
)
assert.deepEqual(normalizeHandledJenis('SPESIALIS', []), [])

// handled-jenis-error
assert.equal(handledJenisError('SPESIALIS', []), 'Spesialis wajib memegang minimal satu jenis job.')
assert.equal(handledJenisError('SPESIALIS', ['LOCAL']), null)
assert.equal(handledJenisError('CS', []), null)
assert.equal(handledJenisError('FINANCE', ['LOCAL']), null)

// UserSchema: handledJobJenis default kosong
assert.deepEqual(admin.handledJobJenis, [])

// userCreateSchema / userUpdateSchema
const spesialis = { ...admin, isAdmin: false, role: 'SPESIALIS' as const }
const spesialisKosong = userCreateSchema.safeParse(spesialis)
assert.equal(spesialisKosong.success, false)
if (!spesialisKosong.success) {
  assert.deepEqual(spesialisKosong.error.issues[0]?.path, ['handledJobJenis'])
  assert.equal(spesialisKosong.error.issues[0]?.message, 'Spesialis wajib memegang minimal satu jenis job.')
}
const spesialisOk = userCreateSchema.parse({
  ...spesialis,
  handledJobJenis: ['ROAD_SHIPMENT', 'ROAD_SHIPMENT', 'LOCAL'],
})
assert.deepEqual(spesialisOk.handledJobJenis, ['ROAD_SHIPMENT', 'LOCAL'])
assert.deepEqual(userCreateSchema.parse({ ...admin, handledJobJenis: ['LOCAL'] }).handledJobJenis, [])
assert.equal(userCreateSchema.safeParse({ ...spesialis, handledJobJenis: ['BUKAN_JENIS'] }).success, false)

const { password: _password, ...tanpaPassword } = spesialis
assert.equal(userUpdateSchema.safeParse({ ...tanpaPassword, handledJobJenis: ['LOCAL'] }).success, true)
assert.equal(userUpdateSchema.safeParse({ ...tanpaPassword, password: '' }).success, false)
assert.equal(userUpdateSchema.safeParse(tanpaPassword).success, false)

console.log('user domain validation passed')
