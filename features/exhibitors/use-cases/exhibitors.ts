import 'server-only'

// Use-case exhibitor: daftar per event, daftarkan (bisa batch dari scan CIPL), ubah data.

import { authorize } from '@/features/auth'
import { findEventById } from '@/features/events/repository'
import {
  findExhibitorById,
  insertExhibitors,
  listExhibitorsByEvent,
  updateExhibitorRow,
  type ExhibitorWritableColumns,
} from '@/features/exhibitors/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Exhibitor } from '@/domain/exhibitor/types'
import type { ExhibitorCreateInput, ExhibitorUpdateInput } from '@/domain/exhibitor/validation'

export async function listEventExhibitors(
  currentUser: CurrentUser,
  eventId: string,
): Promise<Exhibitor[]> {
  await authorize(currentUser, 'event:read')
  return listExhibitorsByEvent(eventId)
}

export async function createExhibitors(
  currentUser: CurrentUser,
  eventId: string,
  inputs: ExhibitorCreateInput[],
): Promise<Exhibitor[]> {
  await authorize(currentUser, 'exhibitor:write')
  if (!(await findEventById(eventId))) throw new ApiError(404, 'Event tidak ditemukan.')
  return insertExhibitors(eventId, inputs, currentUser.id)
}

export async function updateExhibitor(
  currentUser: CurrentUser,
  exhibitorId: string,
  patch: ExhibitorUpdateInput,
): Promise<Exhibitor> {
  await authorize(currentUser, 'exhibitor:write')
  const current = await findExhibitorById(exhibitorId)
  if (!current) throw new ApiError(404, 'Exhibitor tidak ditemukan.')

  const kind = patch.kind ?? current.kind
  const npwp = patch.npwp !== undefined ? patch.npwp : current.npwp
  if (kind === 'INTERNATIONAL' && npwp) {
    throw new ApiError(400, 'NPWP hanya untuk exhibitor lokal.')
  }

  const columns: ExhibitorWritableColumns = {}
  if (patch.name !== undefined) columns.name = patch.name
  if (patch.kind !== undefined) columns.kind = patch.kind
  if (patch.npwp !== undefined) columns.npwp = patch.npwp
  // Exhibitor yang beralih ke internasional kehilangan NPWP-nya.
  if (kind === 'INTERNATIONAL' && current.npwp) columns.npwp = null
  if (patch.contact !== undefined) columns.contact = patch.contact
  if (patch.hall !== undefined) columns.hall = patch.hall
  if (patch.booth !== undefined) columns.booth = patch.booth

  const updated = await updateExhibitorRow(exhibitorId, columns)
  if (!updated) throw new ApiError(404, 'Exhibitor tidak ditemukan.')
  return updated
}
