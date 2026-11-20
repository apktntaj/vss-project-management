// Mengapa: UI memakai "tampil, jelaskan saat dicoba" untuk tombol tulis job. Modul ini MURNI: ia
// memutuskan boleh/tidaknya satu tombol beserta alasannya, memakai keputusan yang sama dengan guard
// server (`@/features/auth/write-scope`). Mengimpor modul itu (bukan `lib/data-client`) supaya tes
// tidak memuat klien data. Hook pemuatnya ada di `lib/use-write-access.ts`.

import type { Job, JobJenis } from '@/domain/job/types'
import {
  canManageEvent,
  canWriteJobInEvent,
  creatableJenisInEvent,
  jobWriteDenial,
  jobWriteScope,
  relationIn,
  type Actor,
  type JobWriteCapability,
  type JobWriteScope,
  type MyWriteAccess,
} from '@/features/auth/write-scope'
import type { JobDetailTab } from '@/lib/job-readiness'

/** Yang diketahui UI tentang hak tulis pengguna login di halaman ini. */
export type WriteAccess =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'READY'; readonly actor: Actor; readonly access: MyWriteAccess }
  | { readonly kind: 'UNAVAILABLE' }

/** Keputusan satu tombol tulis: null = boleh; string (tidak kosong) = alasan penolakan. */
export type Denial = string | null

/** Keputusan tombol tulis untuk satu job. */
export type JobPermissions = {
  readonly updateDenial: Denial
  readonly cancelDenial: Denial
  readonly createStageDenial: Denial
}

export const ALL_JOB_PERMISSIONS: JobPermissions = {
  updateDenial: null,
  cancelDenial: null,
  createStageDenial: null,
}

export const MEMUAT = 'Hak ubah Anda masih dimuat. Coba lagi sebentar.'
export const GAGAL_MUAT = 'Hak ubah Anda tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.'
export const BUKAN_MILIK = jobWriteDenial('OWN')
export const TANPA_PEMILIK =
  'Job ini belum punya pemilik tercatat, jadi hanya dapat diubah PIC event atau admin.'
export const AKSES_DICABUT =
  'Anda tidak lagi memiliki akses ke event ini. Minta PIC event memberi akses agar dapat mengubah job ini.'
export const TANPA_AKSES =
  'Job ini hanya dapat diubah PIC event, admin, atau pemilik job yang diberi akses event.'
export const FINANCE_JOB = 'Finance hanya dapat mengubah tagihan job.'
export const FINANCE_BUAT = 'Finance tidak dapat membuat job.'
export const BUAT_SATU =
  'Anda belum diberi akses untuk membuat job di event ini. Minta PIC event memberi akses.'
export const BUAT_BANYAK =
  'Anda belum diberi akses untuk membuat job di event mana pun. Minta PIC event memberi akses.'
export const TANPA_EVENT = 'Belum ada event yang dapat dipilih untuk job baru.'

type JobOwnership = Pick<Job, 'eventId' | 'createdById'>

// Alasan penolakan; hanya dipanggil bila `can-write-job-in-event` sudah menolak.
function deniedJobReason(actor: Actor, scope: JobWriteScope, owner: string | null): string {
  if (actor.role === 'FINANCE') return FINANCE_JOB
  switch (scope) {
    case 'OWN':
      return typeof owner === 'string' ? jobWriteDenial('OWN') : TANPA_PEMILIK
    case 'NONE':
      return typeof owner === 'string' && owner === actor.id ? AKSES_DICABUT : TANPA_AKSES
    case 'ALL':
      return jobWriteDenial('ALL')
    default: {
      const unreachable: never = scope
      return unreachable
    }
  }
}

/** null bila pengguna login boleh melakukan `capability` pada `job`; bila tidak, alasannya. */
export function jobWriteDenialReason(
  wa: WriteAccess,
  capability: JobWriteCapability,
  job: JobOwnership,
): Denial {
  switch (wa.kind) {
    case 'LOADING':
      return MEMUAT
    case 'UNAVAILABLE':
      return GAGAL_MUAT
    case 'READY': {
      const relation = relationIn(wa.access.events, job.eventId)
      const owner = job.createdById
      if (canWriteJobInEvent(wa.actor, capability, relation, owner)) return null
      return deniedJobReason(wa.actor, jobWriteScope(wa.actor, capability, relation), owner)
    }
    default: {
      const unreachable: never = wa
      return unreachable
    }
  }
}

/** Keputusan (dan alasan) tiap tombol tulis job untuk pengguna login. */
export function jobPermissions(wa: WriteAccess, job: JobOwnership): JobPermissions {
  return {
    updateDenial: jobWriteDenialReason(wa, 'job:update', job),
    cancelDenial: jobWriteDenialReason(wa, 'job:cancel', job),
    createStageDenial: jobWriteDenialReason(wa, 'job:create', job),
  }
}

/** Jenis job yang boleh dibuat pengguna login di `eventId`; kosong = tidak boleh. */
export function creatableJenis(wa: WriteAccess, eventId: string): JobJenis[] {
  switch (wa.kind) {
    case 'READY':
      return creatableJenisInEvent(
        wa.actor,
        wa.access.handledJobJenis,
        relationIn(wa.access.events, eventId),
      )
    case 'LOADING':
    case 'UNAVAILABLE':
      return []
    default: {
      const unreachable: never = wa
      return unreachable
    }
  }
}

/** null bila pengguna login boleh membuat job di minimal satu event `eventIds`; bila tidak, alasannya. */
export function jobCreateDenialReason(wa: WriteAccess, eventIds: readonly string[]): Denial {
  switch (wa.kind) {
    case 'LOADING':
      return MEMUAT
    case 'UNAVAILABLE':
      return GAGAL_MUAT
    case 'READY': {
      if (eventIds.some((id) => creatableJenis(wa, id).length > 0)) return null
      if (wa.actor.role === 'FINANCE') return FINANCE_BUAT
      if (eventIds.length === 0) return TANPA_EVENT
      if (eventIds.length === 1) return BUAT_SATU
      return BUAT_BANYAK
    }
    default: {
      const unreachable: never = wa
      return unreachable
    }
  }
}

/** Apakah kartu "Akses event" boleh tampil untuk event ber-PIC `picId`. */
export function canManageEventAccess(wa: WriteAccess, picId: string | null): boolean {
  switch (wa.kind) {
    case 'READY':
      return canManageEvent(wa.actor, 'event:access:manage', picId)
    case 'LOADING':
    case 'UNAVAILABLE':
      return false
    default: {
      const unreachable: never = wa
      return unreachable
    }
  }
}

/**
 * Keputusan tombol aksi di ujung tab detail job; `canEditBilling` = boleh mengubah tagihan
 * (useCanEditBilling). Tab Billing boleh dibuka Finance walau tidak boleh mengubah job.
 */
export function tabActionDenial(
  tab: JobDetailTab,
  perms: JobPermissions,
  canEditBilling: boolean,
): Denial {
  if (tab === 'billing' && canEditBilling) return null
  return perms.updateDenial
}
