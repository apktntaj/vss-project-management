// Surat penunjukan: surat resmi dari Event Organizer yang menunjuk kita sebagai forwarder event.
// Satu event menyimpan paling banyak satu surat aktif; unggah ulang menggantikan surat lama.
// Isi file disimpan sebagai lampiran (owner EVENT); entitas ini hanya merujuk lampiran lewat id.

/** `kind` lampiran surat penunjukan pada tabel `attachments`. */
export const APPOINTMENT_LETTER_KIND = 'SURAT_PENUNJUKAN'

export const APPOINTMENT_LETTER_MAX_BYTES = 10 * 1024 * 1024

export const APPOINTMENT_LETTER_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

export type EventAppointmentLetter = {
  attachmentId: string
  fileName: string
  uploadedAt: string
}

/** Pesan error bila file tidak boleh dipakai sebagai surat penunjukan; null bila valid. */
export function appointmentLetterFileError(file: { type: string; size: number }): string | null {
  if (!(APPOINTMENT_LETTER_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Surat penunjukan harus berupa PDF, JPG, atau PNG.'
  }
  if (file.size === 0) return 'File surat penunjukan kosong.'
  if (file.size > APPOINTMENT_LETTER_MAX_BYTES) return 'Ukuran surat penunjukan melebihi batas 10 MB.'
  return null
}
