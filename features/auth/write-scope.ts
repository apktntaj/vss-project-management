// Mengapa: keputusan "siapa boleh menulis event, job, dan exhibitor" adalah logika MURNI. Ia
// dipisah dari `authorize.ts` (server-only) dan tidak mengimpor `server-only`, agar guard server dan
// UI klien memakai fungsi yang sama. Hanya bergantung pada `./capabilities` dan tipe domain.

import type { CurrentUser, Role } from '@/domain/auth/types'
import type { InternationalJobJenis, JobJenis, JobKind } from '@/domain/job/types'
import { jobJenisValues } from '@/domain/job/types'
import { can, type Capability } from './capabilities'

/** Bagian pengguna yang dibaca keputusan otorisasi; `CurrentUser` dan `session.user` memenuhinya. */
export type Actor = Pick<CurrentUser, 'id' | 'role' | 'isAdmin'>

export type JobWriteCapability = Extract<Capability, 'job:create' | 'job:update' | 'job:cancel'>

/** Kaitan pengguna dengan event. Invariant: 'PIC menang atas 'GRANTEE. */
export type EventRelation = 'PIC' | 'GRANTEE' | 'NONE'

/** Cakupan job yang boleh ditulis: semua, hanya milik sendiri, atau tidak ada. */
export type JobWriteScope = 'ALL' | 'OWN' | 'NONE'

/** Invariant: relation tidak pernah 'NONE; satu entri per event-id. */
export type EventAccessEntry = {
  readonly eventId: string
  readonly relation: EventRelation
}

/** Bekal UI: kaitan pengguna dengan event, dan jenis job yang ia pegang (kosong kecuali spesialis). */
export type MyWriteAccess = {
  readonly events: readonly EventAccessEntry[]
  readonly handledJobJenis: readonly JobJenis[]
}

export type ExhibitorUpdateVerdict = 'ALLOWED' | 'JOB_NOT_WRITABLE' | 'NOT_LINKED'

/** Peran dan flag admin calon penerima akses yang masih anggota aktif workspace. */
export type GrantTarget = {
  readonly role: Role
  readonly isAdmin: boolean
}

const OWN_ONLY_DENIAL = 'Penerima akses event hanya dapat mengubah job miliknya sendiri.'
const GENERIC_DENIAL = 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
const NOT_LINKED_MESSAGE =
  'Exhibitor ini tidak tercantum di job tersebut. Simpan CIPL job dulu, lalu ubah exhibitor.'

/** Apakah admin atau tabel peran mengizinkan jenis tindakan `capability`. */
export function isRoleSufficient(actor: Actor, capability: Capability): boolean {
  return actor.isAdmin || can(actor.role, capability)
}

/** Apakah pengguna pengelola event ber-PIC `picId` (admin atau PIC-nya). */
export function isEventManager(actor: Actor, picId: string | null): boolean {
  return actor.isAdmin || (typeof picId === 'string' && picId === actor.id)
}

/** Kaitan pengguna dengan event ber-PIC `picId`, diberi tahu apakah ada baris akses. */
export function eventRelation(
  userId: string,
  picId: string | null,
  granted: boolean,
): EventRelation {
  if (typeof picId === 'string' && picId === userId) return 'PIC'
  if (granted) return 'GRANTEE'
  return 'NONE'
}

/** Cakupan job yang boleh ditulis pengguna untuk `capability` di event berkaitan `relation`. */
export function jobWriteScope(
  actor: Actor,
  capability: JobWriteCapability,
  relation: EventRelation,
): JobWriteScope {
  if (actor.isAdmin) return 'ALL'
  if (!can(actor.role, capability)) return 'NONE'
  switch (relation) {
    case 'PIC':
      return 'ALL'
    case 'GRANTEE':
      return 'OWN'
    case 'NONE':
      return 'NONE'
    default: {
      const unreachable: never = relation
      return unreachable
    }
  }
}

/** Apakah cakupan `scope` milik `userId` mencakup job milik `createdById`. */
export function canWriteJob(
  scope: JobWriteScope,
  userId: string,
  createdById: string | null,
): boolean {
  switch (scope) {
    case 'ALL':
      return true
    case 'OWN':
      return typeof createdById === 'string' && createdById === userId
    case 'NONE':
      return false
    default: {
      const unreachable: never = scope
      return unreachable
    }
  }
}

/** Apakah cakupan cukup untuk membuat job baru (job baru selalu milik pembuatnya). */
export function canCreateJob(scope: JobWriteScope): boolean {
  switch (scope) {
    case 'ALL':
      return true
    case 'OWN':
      return true
    case 'NONE':
      return false
    default: {
      const unreachable: never = scope
      return unreachable
    }
  }
}

/** Jenis job dari bentuk masukan pembuatan job; International tanpa jenis -> null. */
export function jenisOf(
  kind: JobKind,
  internationalJenis: InternationalJobJenis | null,
): JobJenis | null {
  switch (kind) {
    case 'LOCAL':
      return 'LOCAL'
    case 'INTERNATIONAL':
      return internationalJenis
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

/**
 * Apakah peran pengguna (yang memegang `handled`) tidak membatasi pembuatan job `jenis`.
 * Hanya spesialis yang dibatasi; hak membuat job di event diputuskan `jobWriteScope`.
 */
export function isJenisAllowed(
  actor: Actor,
  handled: readonly JobJenis[],
  jenis: JobJenis | null,
): boolean {
  if (actor.isAdmin) return true
  if (actor.role === 'SPESIALIS') return jenis !== null && handled.includes(jenis)
  return true
}

/** Jenis job yang boleh dibuat pengguna di event berkaitan `relation`, urut `jobJenisValues`. */
export function creatableJenisInEvent(
  actor: Actor,
  handled: readonly JobJenis[],
  relation: EventRelation,
): JobJenis[] {
  if (canCreateJob(jobWriteScope(actor, 'job:create', relation))) {
    return jobJenisValues.filter((jenis) => isJenisAllowed(actor, handled, jenis))
  }
  return []
}

/** Pesan 403 saat tulis job ditolak dengan cakupan `scope`. */
export function jobWriteDenial(scope: JobWriteScope): string {
  switch (scope) {
    case 'OWN':
      return OWN_ONLY_DENIAL
    case 'NONE':
      return GENERIC_DENIAL
    case 'ALL':
      return GENERIC_DENIAL
    default: {
      const unreachable: never = scope
      return unreachable
    }
  }
}

/** Pesan 403 untuk vonis yang menolak; 'ALLOWED -> '' (tidak dipakai). */
export function exhibitorUpdateMessage(
  scope: JobWriteScope,
  verdict: ExhibitorUpdateVerdict,
): string {
  switch (verdict) {
    case 'JOB_NOT_WRITABLE':
      return jobWriteDenial(scope)
    case 'NOT_LINKED':
      return NOT_LINKED_MESSAGE
    case 'ALLOWED':
      return ''
    default: {
      const unreachable: never = verdict
      return unreachable
    }
  }
}

/**
 * Gabungkan event yang dipegang sebagai PIC dan event yang aksesnya diberikan; satu entri per
 * event, 'PIC menang, entri PIC lebih dulu.
 */
export function mergeEventAccess(
  picIds: readonly string[],
  grantedIds: readonly string[],
): EventAccessEntry[] {
  return [
    ...picIds.map((eventId): EventAccessEntry => ({ eventId, relation: 'PIC' })),
    ...grantedIds
      .filter((eventId) => !picIds.includes(eventId))
      .map((eventId): EventAccessEntry => ({ eventId, relation: 'GRANTEE' })),
  ]
}

/** Kaitan pengguna dengan `eventId` menurut daftar aksesnya; tidak tercantum -> 'NONE. */
export function relationIn(
  entries: readonly EventAccessEntry[],
  eventId: string,
): EventRelation {
  const [first, ...rest] = entries
  if (first === undefined) return 'NONE'
  if (first.eventId === eventId) return first.relation
  return relationIn(rest, eventId)
}

/**
 * Apakah pengguna boleh melakukan `capability` (ubah, batal, atau buat turunan) pada job milik
 * `createdById`, di event yang kaitannya dengan pengguna adalah `relation`.
 */
export function canWriteJobInEvent(
  actor: Actor,
  capability: JobWriteCapability,
  relation: EventRelation,
  createdById: string | null,
): boolean {
  return canWriteJob(jobWriteScope(actor, capability, relation), actor.id, createdById)
}

/**
 * Apakah pengguna yang memegang `handled` boleh membuat job baru berjenis `jenis` di event yang
 * kaitannya `relation`.
 */
export function canCreateJobInEvent(
  actor: Actor,
  handled: readonly JobJenis[],
  relation: EventRelation,
  jenis: JobJenis | null,
): boolean {
  return (
    canCreateJob(jobWriteScope(actor, 'job:create', relation)) &&
    isJenisAllowed(actor, handled, jenis)
  )
}

/**
 * Apakah pengguna boleh melakukan tindakan kelola `capability` pada event ber-PIC `picId`
 * ('event:update, 'event:cancel, 'event:delete, 'event:access:manage, 'exhibitor:write).
 */
export function canManageEvent(
  actor: Actor,
  capability: Capability,
  picId: string | null,
): boolean {
  return isRoleSufficient(actor, capability) && isEventManager(actor, picId)
}

/**
 * Keputusan mengubah exhibitor LEWAT satu job perantara milik `viaOwnerId`, oleh pengguna `userId`
 * dengan cakupan `scope`; `linked` = exhibitor tercantum di job perantara itu. Kepemilikan job
 * diperiksa lebih dulu daripada keterkaitan.
 */
export function exhibitorUpdateVerdict(
  scope: JobWriteScope,
  userId: string,
  viaOwnerId: string | null,
  linked: boolean,
): ExhibitorUpdateVerdict {
  if (!canWriteJob(scope, userId, viaOwnerId)) return 'JOB_NOT_WRITABLE'
  if (!linked) return 'NOT_LINKED'
  return 'ALLOWED'
}

/** Apakah pengguna berperan `role` (flag admin `isAdmin`) boleh diberi akses event. */
export function isGrantableTarget(role: Role, isAdmin: boolean): boolean {
  return !isAdmin && can(role, 'job:create')
}

/**
 * Pesan 400 bila `targetId` (yang datanya `target`, null bila bukan anggota aktif) tidak boleh
 * diberi akses event ber-PIC `picId`; null bila boleh.
 */
export function grantTargetError(
  target: GrantTarget | null,
  picId: string | null,
  targetId: string,
): string | null {
  if (typeof picId === 'string' && picId === targetId) {
    return 'PIC event sudah memiliki akses penuh.'
  }
  if (target === null) return 'Pengguna bukan anggota workspace.'
  if (target.isAdmin) return 'Admin sudah memiliki akses penuh ke semua event.'
  if (!isGrantableTarget(target.role, false)) {
    return 'Akses event hanya dapat diberikan kepada CS atau Spesialis.'
  }
  return null
}
