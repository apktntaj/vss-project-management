import assert from 'node:assert/strict'

import { jobJenisValues, type JobJenis } from '@/domain/job/types'
import type { Actor, EventAccessEntry } from '@/features/auth/write-scope'
import {
  AKSES_DICABUT,
  ALL_JOB_PERMISSIONS,
  BUAT_BANYAK,
  BUAT_SATU,
  BUKAN_MILIK,
  FINANCE_BUAT,
  FINANCE_JOB,
  GAGAL_MUAT,
  MEMUAT,
  TANPA_AKSES,
  TANPA_EVENT,
  TANPA_PEMILIK,
  canManageEventAccess,
  creatableJenis,
  jobCreateDenialReason,
  jobPermissions,
  jobWriteDenialReason,
  tabActionDenial,
  type Denial,
  type JobPermissions,
  type WriteAccess,
} from './write-access'

const AYU: Actor = { id: 'u-ayu', role: 'CS', isAdmin: true }
const BUDI: Actor = { id: 'u-budi', role: 'CS', isAdmin: false }
const RINA: Actor = { id: 'u-rina', role: 'CS', isAdmin: false }
const TONO: Actor = { id: 'u-tono', role: 'CS', isAdmin: false }
const YUDI: Actor = { id: 'u-yudi', role: 'SPESIALIS', isAdmin: false }
const FAJAR: Actor = { id: 'u-fajar', role: 'FINANCE', isAdmin: false }
const YUDI_JENIS: readonly JobJenis[] = ['ROAD_SHIPMENT']

const IIMS_PIC: EventAccessEntry = { eventId: 'e-iims', relation: 'PIC' }
const IIMS_GRANTEE: EventAccessEntry = { eventId: 'e-iims', relation: 'GRANTEE' }
const GJAW_PIC: EventAccessEntry = { eventId: 'e-gjaw', relation: 'PIC' }

const ready = (
  actor: Actor,
  events: readonly EventAccessEntry[],
  handledJobJenis: readonly JobJenis[] = [],
): WriteAccess => ({ kind: 'READY', actor, access: { events, handledJobJenis } })

const WA_AYU = ready(AYU, [])
const WA_BUDI = ready(BUDI, [IIMS_PIC])
const WA_RINA = ready(RINA, [GJAW_PIC, IIMS_GRANTEE])
const WA_RINA_DICABUT = ready(RINA, [GJAW_PIC]) // Rina setelah aksesnya ke IIMS dicabut
const WA_YUDI = ready(YUDI, [IIMS_GRANTEE], YUDI_JENIS)
const WA_TONO = ready(TONO, [])
const WA_FAJAR = ready(FAJAR, [])
const WA_LOADING: WriteAccess = { kind: 'LOADING' }
const WA_GAGAL: WriteAccess = { kind: 'UNAVAILABLE' }

const JOB_BUDI = { eventId: 'e-iims', createdById: 'u-budi' }
const JOB_RINA = { eventId: 'e-iims', createdById: 'u-rina' }
const JOB_YUDI = { eventId: 'e-iims', createdById: 'u-yudi' }
const JOB_LAMA = { eventId: 'e-iims', createdById: null }

const deniedAll = (reason: Denial): JobPermissions => ({
  updateDenial: reason,
  cancelDenial: reason,
  createStageDenial: reason,
})

// jobWriteDenialReason: boleh
assert.equal(jobWriteDenialReason(WA_BUDI, 'job:update', JOB_RINA), null) // PIC: semua job
assert.equal(jobWriteDenialReason(WA_RINA, 'job:cancel', JOB_RINA), null) // penerima: miliknya
assert.equal(jobWriteDenialReason(WA_YUDI, 'job:create', JOB_YUDI), null)
assert.equal(jobWriteDenialReason(WA_AYU, 'job:update', JOB_LAMA), null) // admin
assert.equal(jobWriteDenialReason(WA_BUDI, 'job:update', JOB_LAMA), null) // PIC, job lama
// job milik orang lain (penerima akses)
assert.equal(jobWriteDenialReason(WA_RINA, 'job:update', JOB_BUDI), BUKAN_MILIK)
assert.equal(jobWriteDenialReason(WA_YUDI, 'job:cancel', JOB_RINA), BUKAN_MILIK)
// job lama tanpa pemilik tercatat (penerima akses)
assert.equal(jobWriteDenialReason(WA_RINA, 'job:update', JOB_LAMA), TANPA_PEMILIK)
// bekas penerima akses: job miliknya sendiri pun ditolak
assert.equal(jobWriteDenialReason(WA_RINA_DICABUT, 'job:update', JOB_RINA), AKSES_DICABUT)
// tanpa kaitan dengan event
assert.equal(jobWriteDenialReason(WA_TONO, 'job:update', JOB_BUDI), TANPA_AKSES)
assert.equal(jobWriteDenialReason(WA_RINA_DICABUT, 'job:update', JOB_BUDI), TANPA_AKSES)
// Finance (tagihan diputuskan terpisah oleh useCanEditBilling)
assert.equal(jobWriteDenialReason(WA_FAJAR, 'job:update', JOB_BUDI), FINANCE_JOB)
// hak belum siap
assert.equal(jobWriteDenialReason(WA_LOADING, 'job:update', JOB_RINA), MEMUAT)
assert.equal(jobWriteDenialReason(WA_GAGAL, 'job:update', JOB_RINA), GAGAL_MUAT)
// teks alasan sama persis dengan pesan 403 server
assert.equal(BUKAN_MILIK, 'Penerima akses event hanya dapat mengubah job miliknya sendiri.')

// denied-job-reason (non-export) lewat jobWriteDenialReason: peran tak dikenal (token lama) jatuh ke NONE
const WA_TOKEN_LAMA = ready({ id: 'u-lama', role: 'STAFF' as Actor['role'], isAdmin: false }, [])
assert.equal(jobWriteDenialReason(WA_TOKEN_LAMA, 'job:update', JOB_BUDI), TANPA_AKSES)
assert.equal(jobWriteDenialReason(WA_TOKEN_LAMA, 'job:update', JOB_LAMA), TANPA_AKSES)

// jobPermissions
assert.deepEqual(jobPermissions(WA_BUDI, JOB_RINA), ALL_JOB_PERMISSIONS)
assert.deepEqual(jobPermissions(WA_RINA, JOB_RINA), ALL_JOB_PERMISSIONS)
assert.deepEqual(jobPermissions(WA_RINA, JOB_BUDI), deniedAll(BUKAN_MILIK))
assert.deepEqual(jobPermissions(WA_RINA, JOB_LAMA), deniedAll(TANPA_PEMILIK))
assert.deepEqual(jobPermissions(WA_RINA_DICABUT, JOB_RINA), deniedAll(AKSES_DICABUT))
assert.deepEqual(jobPermissions(WA_YUDI, JOB_YUDI), ALL_JOB_PERMISSIONS)
assert.deepEqual(jobPermissions(WA_YUDI, JOB_RINA), deniedAll(BUKAN_MILIK))
assert.deepEqual(jobPermissions(WA_FAJAR, JOB_BUDI), deniedAll(FINANCE_JOB))
assert.deepEqual(jobPermissions(WA_AYU, JOB_LAMA), ALL_JOB_PERMISSIONS)
assert.deepEqual(jobPermissions(WA_LOADING, JOB_RINA), deniedAll(MEMUAT))
assert.deepEqual(jobPermissions(WA_GAGAL, JOB_RINA), deniedAll(GAGAL_MUAT))

// jobCreateDenialReason
assert.equal(jobCreateDenialReason(WA_YUDI, ['e-iims']), null)
assert.equal(jobCreateDenialReason(WA_RINA, ['e-iims']), null)
assert.equal(jobCreateDenialReason(WA_AYU, ['e-gjaw']), null)
assert.equal(jobCreateDenialReason(WA_YUDI, ['e-gjaw', 'e-iims']), null) // /jobs
assert.equal(jobCreateDenialReason(WA_YUDI, ['e-gjaw']), BUAT_SATU)
assert.equal(jobCreateDenialReason(WA_RINA_DICABUT, ['e-iims']), BUAT_SATU) // bekas penerima
assert.equal(jobCreateDenialReason(WA_TONO, ['e-gjaw', 'e-iims']), BUAT_BANYAK)
assert.equal(jobCreateDenialReason(WA_FAJAR, ['e-iims']), FINANCE_BUAT)
assert.equal(jobCreateDenialReason(WA_AYU, []), TANPA_EVENT)
assert.equal(jobCreateDenialReason(WA_LOADING, ['e-iims']), MEMUAT)
assert.equal(jobCreateDenialReason(WA_GAGAL, ['e-iims']), GAGAL_MUAT)

// creatableJenis
assert.deepEqual(creatableJenis(WA_YUDI, 'e-iims'), ['ROAD_SHIPMENT'])
assert.deepEqual(creatableJenis(WA_YUDI, 'e-gjaw'), [])
assert.deepEqual(creatableJenis(WA_RINA, 'e-iims'), [...jobJenisValues])
assert.deepEqual(creatableJenis(WA_BUDI, 'e-gjaw'), [])
assert.deepEqual(creatableJenis(WA_FAJAR, 'e-iims'), [])
assert.deepEqual(creatableJenis(WA_AYU, 'e-gjaw'), [...jobJenisValues])
assert.deepEqual(creatableJenis(WA_LOADING, 'e-iims'), [])

// canManageEventAccess
assert.equal(canManageEventAccess(WA_BUDI, 'u-budi'), true)
assert.equal(canManageEventAccess(WA_RINA, 'u-budi'), false)
assert.equal(canManageEventAccess(WA_YUDI, 'u-budi'), false)
assert.equal(canManageEventAccess(WA_AYU, 'u-budi'), true)
assert.equal(canManageEventAccess(WA_AYU, null), true)
assert.equal(canManageEventAccess(WA_LOADING, 'u-budi'), false)

// tabActionDenial
assert.equal(tabActionDenial('muatan', ALL_JOB_PERMISSIONS, false), null)
assert.equal(tabActionDenial('muatan', deniedAll(BUKAN_MILIK), false), BUKAN_MILIK)
assert.equal(tabActionDenial('transport', deniedAll(FINANCE_JOB), true), FINANCE_JOB)
assert.equal(tabActionDenial('billing', deniedAll(FINANCE_JOB), true), null) // Finance: tagihan
assert.equal(tabActionDenial('billing', deniedAll(BUKAN_MILIK), false), BUKAN_MILIK)
assert.equal(tabActionDenial('billing', ALL_JOB_PERMISSIONS, false), null) // pemilik: pihak
assert.equal(tabActionDenial('billing', deniedAll(MEMUAT), true), null) // billing? dari sesi

console.log('write access passed')
