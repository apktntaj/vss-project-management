import 'server-only'

// Mengapa: use-case baca master data venue/EO untuk memilih yang SUDAH ADA dalam workspace
// (Req 12.1). Sama seperti use-case tulis, otorisasi ditegakkan DI SINI, bukan di route: membaca
// daftar referensi dibatasi ke peran yang boleh membaca event (`event:read` — semua peran). Route
// tetap tipis dan mendelegasi. `import 'server-only'` menjaga batas server/klien.

import { authorize, listWorkspaceMembers } from '@/features/auth'
import { listEventOrganizers, listVenues } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'
import type { EventOrganizerRecord, VenueRecord } from '@/domain/event/types'

/** Daftar venue dalam workspace untuk pemilihan existing (Req 12.1). Otorisasi `event:read` dulu. */
export async function listVenueReferences(currentUser: CurrentUser): Promise<VenueRecord[]> {
  await authorize(currentUser, 'event:read')
  return listVenues()
}

/** Daftar event organizer dalam workspace untuk pemilihan existing (Req 12.1). */
export async function listEventOrganizerReferences(
  currentUser: CurrentUser,
): Promise<EventOrganizerRecord[]> {
  await authorize(currentUser, 'event:read')
  return listEventOrganizers()
}

/**
 * Daftar anggota workspace aktif sebagai opsi PIC pada form event. Otorisasinya sama dengan
 * referensi lain (`event:read`): siapa pun yang boleh membaca event boleh melihat calon PIC-nya.
 * Data anggota tetap dimiliki slice auth (`listWorkspaceMembers`) — slice event hanya memanggil.
 */
export async function listUserReferences(
  currentUser: CurrentUser,
): Promise<{ id: string; fullName: string }[]> {
  await authorize(currentUser, 'event:read')
  return listWorkspaceMembers()
}
