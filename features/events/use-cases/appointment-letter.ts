import 'server-only'

// Mengapa: use-case tulis surat penunjukan EO. Mengunggah/menghapus surat adalah bentuk edit event,
// jadi diotorisasi `event:update` + guard pengelola (PIC, admin). Satu surat aktif
// per event: unggahan baru disimpan dulu, baru surat lama dihapus, sehingga kegagalan unggah tidak
// pernah menghilangkan surat yang sudah ada.

import { authorize } from '@/features/auth'
import { eventManagerGuard } from '@/features/events/use-cases/event-guards'
import { findEventById } from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import {
  deleteAttachments,
  listAttachmentsByOwner,
  uploadAttachment,
} from '@/lib/supabase/attachments'
import {
  APPOINTMENT_LETTER_KIND,
  appointmentLetterFileError,
  type EventAppointmentLetter,
} from '@/domain/event/appointment-letter'
import type { CurrentUser } from '@/domain/auth/types'

async function authorizeManager(currentUser: CurrentUser, eventId: string) {
  const event = await findEventById(eventId)
  if (!event) throw new ApiError(404, 'Event tidak ditemukan.')
  await authorize(currentUser, 'event:update', eventManagerGuard(currentUser, event))
}

async function currentLetterIds(eventId: string): Promise<string[]> {
  const attachments = await listAttachmentsByOwner('EVENT', eventId)
  return attachments.filter((item) => item.kind === APPOINTMENT_LETTER_KIND).map((item) => item.id)
}

/** Surat penunjukan aktif event (terbaru); null bila belum diunggah. */
export async function getAppointmentLetter(
  currentUser: CurrentUser,
  eventId: string,
): Promise<EventAppointmentLetter | null> {
  await authorize(currentUser, 'event:read')
  const [latest] = (await listAttachmentsByOwner('EVENT', eventId)).filter(
    (item) => item.kind === APPOINTMENT_LETTER_KIND,
  )
  return latest ? { attachmentId: latest.id, fileName: latest.fileName, uploadedAt: latest.createdAt } : null
}

/** Unggah (atau ganti) surat penunjukan event. */
export async function uploadAppointmentLetter(
  currentUser: CurrentUser,
  eventId: string,
  file: File,
): Promise<EventAppointmentLetter> {
  await authorizeManager(currentUser, eventId)
  const fileError = appointmentLetterFileError(file)
  if (fileError) throw new ApiError(400, fileError)

  const previous = await currentLetterIds(eventId)
  const uploaded = await uploadAttachment({
    id: crypto.randomUUID(),
    ownerType: 'EVENT',
    ownerId: eventId,
    kind: APPOINTMENT_LETTER_KIND,
    file,
  })
  await deleteAttachments(previous)
  return { attachmentId: uploaded.id, fileName: uploaded.fileName, uploadedAt: uploaded.createdAt }
}

/** Hapus surat penunjukan event (idempoten: tanpa surat = no-op). */
export async function removeAppointmentLetter(currentUser: CurrentUser, eventId: string): Promise<void> {
  await authorizeManager(currentUser, eventId)
  await deleteAttachments(await currentLetterIds(eventId))
}
