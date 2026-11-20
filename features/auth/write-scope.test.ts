import { describe, expect, test } from 'bun:test'
import type { JobJenis } from '@/domain/job/types'
import { jobJenisValues } from '@/domain/job/types'
import {
  canCreateJob,
  canCreateJobInEvent,
  canManageEvent,
  canWriteJob,
  canWriteJobInEvent,
  creatableJenisInEvent,
  eventRelation,
  exhibitorUpdateMessage,
  exhibitorUpdateVerdict,
  grantTargetError,
  isEventManager,
  isGrantableTarget,
  isJenisAllowed,
  isRoleSufficient,
  jenisOf,
  jobWriteDenial,
  jobWriteScope,
  mergeEventAccess,
  relationIn,
  type Actor,
  type EventAccessEntry,
} from './write-scope'

const AYU: Actor = { id: 'u-ayu', role: 'CS', isAdmin: true }
const BUDI: Actor = { id: 'u-budi', role: 'CS', isAdmin: false }
const RINA: Actor = { id: 'u-rina', role: 'CS', isAdmin: false }
const TONO: Actor = { id: 'u-tono', role: 'CS', isAdmin: false }
const YUDI: Actor = { id: 'u-yudi', role: 'SPESIALIS', isAdmin: false }
const PUTRI: Actor = { id: 'u-putri', role: 'SPESIALIS', isAdmin: false }
const FAJAR: Actor = { id: 'u-fajar', role: 'FINANCE', isAdmin: false }
const YUDI_JENIS: readonly JobJenis[] = ['ROAD_SHIPMENT']
const PUTRI_JENIS: readonly JobJenis[] = ['PERMANENT_IMPORT']

describe('canWriteJobInEvent', () => {
  test('PIC: semua job di eventnya', () => {
    expect(canWriteJobInEvent(BUDI, 'job:update', 'PIC', 'u-rina')).toBe(true)
    expect(canWriteJobInEvent(BUDI, 'job:cancel', 'PIC', 'u-yudi')).toBe(true)
  })
  test('penerima akses (CS atau spesialis): job miliknya saja', () => {
    expect(canWriteJobInEvent(RINA, 'job:update', 'GRANTEE', 'u-rina')).toBe(true)
    expect(canWriteJobInEvent(RINA, 'job:cancel', 'GRANTEE', 'u-rina')).toBe(true)
    expect(canWriteJobInEvent(RINA, 'job:update', 'GRANTEE', 'u-budi')).toBe(false)
    expect(canWriteJobInEvent(RINA, 'job:update', 'GRANTEE', null)).toBe(false)
    expect(canWriteJobInEvent(YUDI, 'job:update', 'GRANTEE', 'u-yudi')).toBe(true)
    expect(canWriteJobInEvent(YUDI, 'job:cancel', 'GRANTEE', 'u-rina')).toBe(false)
  })
  test('bekas penerima akses: job miliknya pun tidak bisa diubah lagi', () => {
    expect(canWriteJobInEvent(RINA, 'job:update', 'NONE', 'u-rina')).toBe(false)
  })
  test('tanpa kaitan', () => {
    expect(canWriteJobInEvent(TONO, 'job:update', 'NONE', 'u-budi')).toBe(false)
    expect(canWriteJobInEvent(PUTRI, 'job:update', 'NONE', 'u-putri')).toBe(false)
  })
  test('FINANCE tidak menulis job, walau diberi akses', () => {
    expect(canWriteJobInEvent(FAJAR, 'job:update', 'NONE', 'u-budi')).toBe(false)
    expect(canWriteJobInEvent(FAJAR, 'job:update', 'GRANTEE', 'u-fajar')).toBe(false)
  })
  test('admin', () => {
    expect(canWriteJobInEvent(AYU, 'job:cancel', 'NONE', 'u-budi')).toBe(true)
  })
})

describe('canCreateJobInEvent', () => {
  test('CS penerima: jenis apa pun', () => {
    expect(canCreateJobInEvent(RINA, [], 'GRANTEE', 'TPPB_BC_23')).toBe(true)
  })
  test('event tanpa akses', () => {
    expect(canCreateJobInEvent(RINA, [], 'NONE', 'ROAD_SHIPMENT')).toBe(false)
    expect(canCreateJobInEvent(TONO, [], 'NONE', 'LOCAL')).toBe(false)
  })
  test('PIC dan admin', () => {
    expect(canCreateJobInEvent(BUDI, [], 'PIC', 'ATA_CARNET')).toBe(true)
    expect(canCreateJobInEvent(AYU, [], 'NONE', 'PERMANENT_IMPORT')).toBe(true)
  })
  test('spesialis: jenisnya dan diberi akses', () => {
    expect(canCreateJobInEvent(YUDI, YUDI_JENIS, 'GRANTEE', 'ROAD_SHIPMENT')).toBe(true)
    expect(canCreateJobInEvent(YUDI, YUDI_JENIS, 'GRANTEE', 'TPPB_BC_23')).toBe(false)
    expect(canCreateJobInEvent(PUTRI, PUTRI_JENIS, 'NONE', 'PERMANENT_IMPORT')).toBe(false)
  })
  test('FINANCE tidak membuat job', () => {
    expect(canCreateJobInEvent(FAJAR, [], 'GRANTEE', 'LOCAL')).toBe(false)
  })
})

describe('canManageEvent', () => {
  test('PIC mengelola eventnya', () => {
    expect(canManageEvent(BUDI, 'event:update', 'u-budi')).toBe(true)
    expect(canManageEvent(BUDI, 'event:access:manage', 'u-budi')).toBe(true)
    expect(canManageEvent(BUDI, 'exhibitor:write', 'u-budi')).toBe(true)
  })
  test('penerima akses tidak lagi mengelola event', () => {
    expect(canManageEvent(RINA, 'event:update', 'u-budi')).toBe(false)
    expect(canManageEvent(RINA, 'event:cancel', 'u-budi')).toBe(false)
    expect(canManageEvent(RINA, 'event:delete', 'u-budi')).toBe(false)
  })
  test('exhibitor hanya lewat job miliknya', () => {
    expect(canManageEvent(YUDI, 'exhibitor:write', 'u-budi')).toBe(false)
  })
  test('admin; event tanpa PIC: admin saja', () => {
    expect(canManageEvent(AYU, 'event:delete', 'u-budi')).toBe(true)
    expect(canManageEvent(AYU, 'event:update', null)).toBe(true)
    expect(canManageEvent(TONO, 'event:update', null)).toBe(false)
  })
  test('FINANCE tidak mengelola event', () => {
    expect(canManageEvent(FAJAR, 'event:update', 'u-budi')).toBe(false)
  })
})

describe('exhibitorUpdateVerdict', () => {
  test('job milik pengguna dan exhibitor tercantum -> ALLOWED', () => {
    expect(exhibitorUpdateVerdict('OWN', 'u-rina', 'u-rina', true)).toBe('ALLOWED')
  })
  test('exhibitor tidak ada di job perantara -> NOT_LINKED', () => {
    expect(exhibitorUpdateVerdict('OWN', 'u-rina', 'u-rina', false)).toBe('NOT_LINKED')
  })
  test('job milik orang lain -> JOB_NOT_WRITABLE', () => {
    expect(exhibitorUpdateVerdict('OWN', 'u-rina', 'u-budi', true)).toBe('JOB_NOT_WRITABLE')
  })
  test('job lama tanpa pemilik -> JOB_NOT_WRITABLE', () => {
    expect(exhibitorUpdateVerdict('OWN', 'u-rina', null, true)).toBe('JOB_NOT_WRITABLE')
  })
  test('tanpa akses -> JOB_NOT_WRITABLE', () => {
    expect(exhibitorUpdateVerdict('NONE', 'u-tono', 'u-budi', true)).toBe('JOB_NOT_WRITABLE')
  })
  test('kepemilikan job diperiksa lebih dulu daripada keterkaitan', () => {
    expect(exhibitorUpdateVerdict('OWN', 'u-rina', 'u-budi', false)).toBe('JOB_NOT_WRITABLE')
  })
  test("cakupan 'ALL", () => {
    expect(exhibitorUpdateVerdict('ALL', 'u-budi', 'u-rina', true)).toBe('ALLOWED')
  })
})

describe('isRoleSufficient', () => {
  test('admin dan tabel peran', () => {
    expect(isRoleSufficient(AYU, 'event:create')).toBe(true)
    expect(isRoleSufficient(BUDI, 'event:create')).toBe(false)
    expect(isRoleSufficient(BUDI, 'reference:create')).toBe(false)
    expect(isRoleSufficient(BUDI, 'event:update')).toBe(true)
    expect(isRoleSufficient(YUDI, 'job:create')).toBe(true)
    expect(isRoleSufficient(FAJAR, 'job:update')).toBe(false)
    expect(isRoleSufficient(FAJAR, 'job:invoice:write')).toBe(true)
  })
})

describe('isEventManager', () => {
  test('admin atau PIC-nya', () => {
    expect(isEventManager(BUDI, 'u-budi')).toBe(true)
    expect(isEventManager(RINA, 'u-budi')).toBe(false)
    expect(isEventManager(AYU, 'u-budi')).toBe(true)
    expect(isEventManager(TONO, null)).toBe(false)
  })
})

describe('eventRelation', () => {
  test('PIC menang atas penerima akses', () => {
    expect(eventRelation('u-budi', 'u-budi', false)).toBe('PIC')
    expect(eventRelation('u-budi', 'u-budi', true)).toBe('PIC')
  })
  test('penerima akses dan tanpa kaitan', () => {
    expect(eventRelation('u-rina', 'u-budi', true)).toBe('GRANTEE')
    expect(eventRelation('u-rina', null, true)).toBe('GRANTEE')
    expect(eventRelation('u-tono', 'u-budi', false)).toBe('NONE')
  })
})

describe('jobWriteScope', () => {
  test('cakupan per peran dan kaitan', () => {
    expect(jobWriteScope(AYU, 'job:cancel', 'NONE')).toBe('ALL')
    expect(jobWriteScope(BUDI, 'job:update', 'PIC')).toBe('ALL')
    expect(jobWriteScope(RINA, 'job:update', 'GRANTEE')).toBe('OWN')
    expect(jobWriteScope(YUDI, 'job:create', 'GRANTEE')).toBe('OWN')
    expect(jobWriteScope(TONO, 'job:update', 'NONE')).toBe('NONE')
    expect(jobWriteScope(FAJAR, 'job:update', 'GRANTEE')).toBe('NONE')
  })
})

describe('canWriteJob', () => {
  test('cakupan terhadap pemilik job', () => {
    expect(canWriteJob('ALL', 'u-budi', 'u-rina')).toBe(true)
    expect(canWriteJob('ALL', 'u-budi', null)).toBe(true)
    expect(canWriteJob('OWN', 'u-rina', 'u-rina')).toBe(true)
    expect(canWriteJob('OWN', 'u-rina', 'u-budi')).toBe(false)
    expect(canWriteJob('OWN', 'u-rina', null)).toBe(false)
    expect(canWriteJob('NONE', 'u-tono', 'u-tono')).toBe(false)
  })
})

describe('canCreateJob', () => {
  test('cakupan cukup untuk membuat job', () => {
    expect(canCreateJob('ALL')).toBe(true)
    expect(canCreateJob('OWN')).toBe(true)
    expect(canCreateJob('NONE')).toBe(false)
  })
})

describe('jenisOf', () => {
  test('jenis dari bentuk masukan pembuatan job', () => {
    expect(jenisOf('LOCAL', null)).toBe('LOCAL')
    expect(jenisOf('INTERNATIONAL', 'ROAD_SHIPMENT')).toBe('ROAD_SHIPMENT')
    expect(jenisOf('INTERNATIONAL', null)).toBeNull()
  })
})

describe('isJenisAllowed', () => {
  test('hanya spesialis yang dibatasi', () => {
    expect(isJenisAllowed(AYU, [], 'ROAD_SHIPMENT')).toBe(true)
    expect(isJenisAllowed(BUDI, [], 'ATA_CARNET')).toBe(true)
    expect(isJenisAllowed(YUDI, YUDI_JENIS, 'ROAD_SHIPMENT')).toBe(true)
    expect(isJenisAllowed(YUDI, YUDI_JENIS, 'LOCAL')).toBe(false)
    expect(isJenisAllowed(YUDI, YUDI_JENIS, null)).toBe(false)
    expect(isJenisAllowed(FAJAR, [], 'LOCAL')).toBe(true)
  })
})

describe('creatableJenisInEvent', () => {
  test('jenis yang boleh dibuat, urut jobJenisValues', () => {
    expect(creatableJenisInEvent(YUDI, YUDI_JENIS, 'GRANTEE')).toEqual(['ROAD_SHIPMENT'])
    expect(creatableJenisInEvent(YUDI, YUDI_JENIS, 'NONE')).toEqual([])
    expect(creatableJenisInEvent(RINA, [], 'GRANTEE')).toEqual([...jobJenisValues])
    expect(creatableJenisInEvent(TONO, [], 'NONE')).toEqual([])
    expect(creatableJenisInEvent(FAJAR, [], 'GRANTEE')).toEqual([])
    expect(creatableJenisInEvent(AYU, [], 'NONE')).toEqual([...jobJenisValues])
  })
})

describe('jobWriteDenial', () => {
  test('pesan 403 per cakupan', () => {
    expect(jobWriteDenial('OWN')).toBe(
      'Penerima akses event hanya dapat mengubah job miliknya sendiri.',
    )
    expect(jobWriteDenial('NONE')).toBe('Anda tidak memiliki izin untuk melakukan tindakan ini.')
    expect(jobWriteDenial('ALL')).toBe('Anda tidak memiliki izin untuk melakukan tindakan ini.')
  })
})

describe('exhibitorUpdateMessage', () => {
  test('pesan 403 per vonis', () => {
    expect(exhibitorUpdateMessage('OWN', 'JOB_NOT_WRITABLE')).toBe(
      'Penerima akses event hanya dapat mengubah job miliknya sendiri.',
    )
    expect(exhibitorUpdateMessage('OWN', 'NOT_LINKED')).toBe(
      'Exhibitor ini tidak tercantum di job tersebut. Simpan CIPL job dulu, lalu ubah exhibitor.',
    )
    expect(exhibitorUpdateMessage('ALL', 'ALLOWED')).toBe('')
  })
})

describe('mergeEventAccess', () => {
  test('menggabungkan PIC dan akses, PIC menang dan lebih dulu', () => {
    expect(mergeEventAccess([], [])).toEqual([])
    expect(mergeEventAccess(['e-iims'], ['e-gjaw'])).toEqual([
      { eventId: 'e-iims', relation: 'PIC' },
      { eventId: 'e-gjaw', relation: 'GRANTEE' },
    ])
    expect(mergeEventAccess(['e-iims'], ['e-iims', 'e-gjaw'])).toEqual([
      { eventId: 'e-iims', relation: 'PIC' },
      { eventId: 'e-gjaw', relation: 'GRANTEE' },
    ])
  })
})

describe('relationIn', () => {
  const accessRina: readonly EventAccessEntry[] = [
    { eventId: 'e-gjaw', relation: 'PIC' },
    { eventId: 'e-iims', relation: 'GRANTEE' },
  ]
  test('kaitan menurut daftar akses; tidak tercantum = NONE', () => {
    expect(relationIn(accessRina, 'e-gjaw')).toBe('PIC')
    expect(relationIn(accessRina, 'e-iims')).toBe('GRANTEE')
    expect(relationIn(accessRina, 'e-lain')).toBe('NONE')
    expect(relationIn([], 'e-iims')).toBe('NONE')
  })
})

describe('isGrantableTarget', () => {
  test('hanya CS dan spesialis non-admin', () => {
    expect(isGrantableTarget('CS', false)).toBe(true)
    expect(isGrantableTarget('SPESIALIS', false)).toBe(true)
    expect(isGrantableTarget('FINANCE', false)).toBe(false)
    expect(isGrantableTarget('CS', true)).toBe(false)
  })
})

describe('grantTargetError', () => {
  test('boleh diberi akses -> null', () => {
    expect(grantTargetError({ role: 'CS', isAdmin: false }, 'u-budi', 'u-rina')).toBeNull()
    expect(grantTargetError({ role: 'SPESIALIS', isAdmin: false }, 'u-budi', 'u-yudi')).toBeNull()
  })
  test('pesan penolakan', () => {
    expect(grantTargetError({ role: 'CS', isAdmin: false }, 'u-budi', 'u-budi')).toBe(
      'PIC event sudah memiliki akses penuh.',
    )
    expect(grantTargetError(null, 'u-budi', 'u-x')).toBe('Pengguna bukan anggota workspace.')
    expect(grantTargetError({ role: 'FINANCE', isAdmin: false }, 'u-budi', 'u-fajar')).toBe(
      'Akses event hanya dapat diberikan kepada CS atau Spesialis.',
    )
    expect(grantTargetError({ role: 'CS', isAdmin: true }, 'u-budi', 'u-ayu')).toBe(
      'Admin sudah memiliki akses penuh ke semua event.',
    )
  })
})
